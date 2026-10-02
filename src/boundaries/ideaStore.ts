/** Where visitor notes live. One interface, three places:
 *  - Supabase (the live site's public board)
 *  - claude.ai artifact db (the review preview)
 *  - memory (tests, and when no board is reachable)
 *  Every adapter turns failures into `false`/`null`, so the page never breaks because a board is down. */
import { cleanNote, notesFromDocs, NOTE_LIMITS, type Note } from "../lib/notes";
import type { KeyStore } from "./keyStore";

export type BoardMode = "public" | "claude" | "none";
export type Viewer = { mode: BoardMode; isOwner: boolean; uid: string | null };

export interface IdeaStore {
  readonly mode: BoardMode;
  /** Starts listening; calls back with the full set whenever it changes. Returns false if the board isn't reachable. */
  subscribe(onNotes: (notes: Map<string, Note>) => void): Promise<boolean>;
  add(note: Note): Promise<boolean>;
  remove(note: Note): Promise<boolean>;
  viewer(): Viewer;
  /** Has this browser kept the delete key for this note? (public board only) */
  ownsKey(id: string): boolean;
}

/* ---------- Supabase ---------- */
export type SupabaseDeps = {
  url: string;
  key: string;
  fetch: typeof fetch;
  keys: KeyStore;
  randomBytes: (n: number) => Uint8Array;
  sha256Hex: (text: string) => Promise<string>;
};

export const toHex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export function supabaseHeaders(key: string): Record<string, string> {
  // Legacy anon keys are JWTs and also go in Authorization; new publishable keys go in apikey only.
  return { apikey: key, "Content-Type": "application/json", ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}) };
}

export function supabaseStore(d: SupabaseDeps): IdeaStore {
  const headers = supabaseHeaders(d.key);
  return {
    mode: "public",
    async subscribe(onNotes) {
      try {
        const r = await d.fetch(d.url + "/rest/v1/ideas?select=id,name,message,created_at&order=created_at.desc&limit=60", { headers });
        if (!r.ok) return false;
        const rows = (await r.json()) as { id: string; name: string; message: string; created_at: string }[];
        const out = new Map<string, Note>();
        for (const row of rows) {
          const n = cleanNote({ id: row.id, name: row.name, message: row.message, at: Date.parse(row.created_at) }, "public");
          if (n) out.set(n.id, n);
        }
        onNotes(out);
        return true;
      } catch { return false; }
    },
    async add(note) {
      try {
        const deleteKey = toHex(d.randomBytes(16));
        const r = await d.fetch(d.url + "/rest/v1/ideas", {
          method: "POST", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ id: note.id, name: note.name, message: note.message, delete_key_hash: await d.sha256Hex(deleteKey) }),
        });
        if (!r.ok) return false;
        d.keys.set(note.id, deleteKey);
        return true;
      } catch { return false; }
    },
    async remove(note) {
      const key = d.keys.get(note.id);
      if (!key) return false;
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/delete_idea", { method: "POST", headers, body: JSON.stringify({ p_id: note.id, p_key: key }) });
        if (!r.ok) return false;
        const ok = !!(await r.json());
        if (ok) d.keys.drop(note.id);
        return ok;
      } catch { return false; }
    },
    viewer: () => ({ mode: "public", isOwner: false, uid: null }),
    ownsKey: (id) => !!d.keys.get(id),
  };
}

/* ---------- claude.ai artifact db ----------
   Collection "notes", one doc per visitor (notes/<viewer id>) holding { items: [{ id, name, message, at }] }.
   Everyone reads; each visitor writes only their own doc; the owner can remove any note. */
type DocSnap = { id: string; exists: boolean; data(): { items?: unknown } };
export type ClaudeDb = {
  collection(path: string): { onSnapshot(next: (snap: { docs: DocSnap[] }) => void, error?: (e: unknown) => void): unknown };
  doc(path: string): { get(): Promise<DocSnap>; set(data: unknown): Promise<unknown> };
};
export type ClaudeUser = { id(): Promise<string>; isOwner(): Promise<boolean> };

export function claudeStore(db: ClaudeDb, user: ClaudeUser | null): IdeaStore {
  let uid: string | null = null, isOwner = false, ownItems: unknown[] = [];
  const ready = (async () => {
    if (!user) return;
    try { uid = await user.id(); isOwner = await user.isOwner(); } catch { /* signed out */ }
  })();
  const itemsOf = (d: DocSnap): unknown[] => { const it = d.data().items; return Array.isArray(it) ? it : []; };
  return {
    mode: "claude",
    async subscribe(onNotes) {
      await ready;
      try {
        db.collection("notes").onSnapshot((snap) => {
          const docs = snap.docs.filter((d) => d.exists).map((d) => ({ owner: d.id, items: itemsOf(d) }));
          ownItems = docs.find((d) => d.owner === uid)?.items.slice() ?? [];
          onNotes(notesFromDocs(docs));
        }, () => {});
        return true;
      } catch { return false; }
    },
    async add(note) {
      await ready;
      if (!uid) return false;
      const items = ownItems.concat({ id: note.id, name: note.name, message: note.message, at: note.at }).slice(-NOTE_LIMITS.perPerson);
      try { await db.doc("notes/" + uid).set({ items }); ownItems = items; return true; } catch { return false; }
    },
    async remove(note) {
      if (!note.owner) return false;
      try {
        const ref = db.doc("notes/" + note.owner), snap = await ref.get();
        const items = snap.exists ? itemsOf(snap).filter((it) => !(it && typeof it === "object" && (it as { id?: unknown }).id === note.id)) : [];
        await ref.set({ items });
        return true;
      } catch { return false; }
    },
    viewer: () => ({ mode: "claude", isOwner, uid }),
    ownsKey: () => false,
  };
}

/* ---------- memory ---------- */
export function memoryStore(initial: Note[] = [], opts: { failWrites?: boolean } = {}): IdeaStore & { notes: Map<string, Note> } {
  const notes = new Map(initial.map((n) => [n.id, n]));
  let listener: ((n: Map<string, Note>) => void) | null = null;
  const emit = () => listener?.(new Map(notes));
  return {
    mode: "none",
    notes,
    async subscribe(onNotes) { listener = onNotes; emit(); return true; },
    async add(note) { if (opts.failWrites) return false; notes.set(note.id, note); emit(); return true; },
    async remove(note) { if (opts.failWrites) return false; const had = notes.delete(note.id); emit(); return had; },
    viewer: () => ({ mode: "none", isOwner: false, uid: null }),
    ownsKey: () => false,
  };
}
