/** Where comments on visitor ideas live. Same three places and the same failure rule as the idea store:
 *  failures become null/false, never an exception. */
import { cleanComment, COMMENT_LIMITS, type Comment } from "../lib/comments";
import { supabaseHeaders, toHex, type ClaudeDb, type ClaudeUser } from "./ideaStore";
import type { KeyStore } from "./keyStore";

export interface CommentStore {
  /** null = couldn't load */
  list(ideaId: string): Promise<Comment[] | null>;
  add(comment: Comment): Promise<boolean>;
  remove(comment: Comment): Promise<boolean>;
  canRemove(comment: Comment): boolean;
}

/* ---------- Supabase ---------- */
export type SupabaseCommentDeps = {
  url: string; key: string; fetch: typeof fetch; keys: KeyStore;
  randomBytes: (n: number) => Uint8Array; sha256Hex: (text: string) => Promise<string>;
};

export function supabaseComments(d: SupabaseCommentDeps): CommentStore {
  const headers = supabaseHeaders(d.key);
  return {
    async list(ideaId) {
      try {
        const q = `/rest/v1/comments?select=id,idea_id,name,message,created_at&idea_id=eq.${encodeURIComponent(ideaId)}&order=created_at.asc&limit=${COMMENT_LIMITS.perIdea}`;
        const r = await d.fetch(d.url + q, { headers });
        if (!r.ok) return null;
        const rows = (await r.json()) as { id: string; idea_id: string; name: string; message: string; created_at: string }[];
        return rows.map((row) => cleanComment({ id: row.id, ideaId: row.idea_id, name: row.name, message: row.message, at: Date.parse(row.created_at) }))
          .filter((c): c is Comment => c !== null);
      } catch { return null; }
    },
    async add(c) {
      try {
        const deleteKey = toHex(d.randomBytes(16));
        const r = await d.fetch(d.url + "/rest/v1/comments", {
          method: "POST", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ id: c.id, idea_id: c.ideaId, name: c.name, message: c.message, delete_key_hash: await d.sha256Hex(deleteKey) }),
        });
        if (!r.ok) return false;
        d.keys.set(c.id, deleteKey);
        return true;
      } catch { return false; }
    },
    async remove(c) {
      const key = d.keys.get(c.id);
      if (!key) return false;
      try {
        const r = await d.fetch(d.url + "/rest/v1/rpc/delete_comment", { method: "POST", headers, body: JSON.stringify({ p_id: c.id, p_key: key }) });
        if (!r.ok) return false;
        const ok = !!(await r.json());
        if (ok) d.keys.drop(c.id);
        return ok;
      } catch { return false; }
    },
    canRemove: (c) => !!d.keys.get(c.id),
  };
}

/* ---------- claude.ai artifact db: collection "comments", one doc per visitor holding { items } ---------- */
export function claudeComments(db: ClaudeDb, user: ClaudeUser | null): CommentStore {
  let uid: string | null = null, isOwner = false;
  const ready = (async () => {
    if (!user) return;
    try { uid = await user.id(); isOwner = await user.isOwner(); } catch { /* signed out */ }
  })();
  const itemsOf = (data: { items?: unknown }): unknown[] => (Array.isArray(data.items) ? data.items : []);
  const allDocs = () => new Promise<{ id: string; items: unknown[] }[]>((resolve, reject) => {
    let done = false;
    const stop = db.collection("comments").onSnapshot((snap) => {
      if (done) return;
      done = true;
      resolve(snap.docs.filter((x) => x.exists).map((x) => ({ id: x.id, items: itemsOf(x.data()) })));
      if (typeof stop === "function") stop();
    }, reject);
  });
  return {
    async list(ideaId) {
      await ready;
      try {
        const docs = await allDocs();
        return docs.flatMap((doc) => doc.items.map((raw) => cleanComment(raw, doc.id)))
          .filter((c): c is Comment => c !== null && c.ideaId === ideaId);
      } catch { return null; }
    },
    async add(c) {
      await ready;
      if (!uid) return false;
      try {
        const ref = db.doc("comments/" + uid), snap = await ref.get();
        const items = (snap.exists ? itemsOf(snap.data()) : [])
          .concat({ id: c.id, ideaId: c.ideaId, name: c.name, message: c.message, at: c.at }).slice(-COMMENT_LIMITS.perPerson);
        await ref.set({ items });
        c.owner = uid;
        return true;
      } catch { return false; }
    },
    async remove(c) {
      if (!c.owner) return false;
      try {
        const ref = db.doc("comments/" + c.owner), snap = await ref.get();
        const items = snap.exists ? itemsOf(snap.data()).filter((it) => !(it && typeof it === "object" && (it as { id?: unknown }).id === c.id)) : [];
        await ref.set({ items });
        return true;
      } catch { return false; }
    },
    canRemove: (c) => isOwner || (!!uid && c.owner === uid),
  };
}

/* ---------- memory ---------- */
export function memoryComments(initial: Comment[] = [], opts: { failWrites?: boolean; failReads?: boolean } = {}): CommentStore & { all: Map<string, Comment> } {
  const all = new Map(initial.map((c) => [c.id, c]));
  const mine = new Set<string>();
  return {
    all,
    async list(ideaId) { return opts.failReads ? null : [...all.values()].filter((c) => c.ideaId === ideaId); },
    async add(c) { if (opts.failWrites) return false; all.set(c.id, c); mine.add(c.id); return true; },
    async remove(c) { if (opts.failWrites) return false; mine.delete(c.id); return all.delete(c.id); },
    canRemove: (c) => mine.has(c.id),
  };
}
