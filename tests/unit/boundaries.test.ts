import { describe, it, expect, vi } from "vitest";
import { supabaseStore, supabaseHeaders, claudeStore, memoryStore, type ClaudeDb } from "../../src/boundaries/ideaStore";
import { browserKeyStore, DELETE_KEYS_ITEM } from "../../src/boundaries/keyStore";
import { formspreeInbox, inboxFields } from "../../src/boundaries/inbox";
import type { Note } from "../../src/lib/notes";

const note: Note = { id: "abc123", name: "Nino", message: "An idea", at: 1000 };
const res = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };

describe("keyStore", () => {
  it("keeps keys per id", () => {
    const s = browserKeyStore(memStorage());
    s.set("a", "k1"); s.set("b", "k2"); s.drop("a");
    expect(s.get("a")).toBeUndefined();
    expect(s.get("b")).toBe("k2");
  });
  it("survives missing or broken storage", () => {
    expect(browserKeyStore(null).get("a")).toBeUndefined();
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const s = browserKeyStore(broken);
    expect(() => s.set("a", "k")).not.toThrow();
    expect(s.get("a")).toBeUndefined();
  });
  it("reads keys saved by the old site (same storage name)", () => {
    const st = memStorage(); st.setItem(DELETE_KEYS_ITEM, JSON.stringify({ old: "k" }));
    expect(browserKeyStore(st).get("old")).toBe("k");
  });
});

describe("supabaseStore", () => {
  const deps = (fetchImpl: typeof fetch) => ({
    url: "https://x.supabase.co", key: "sb_publishable_k", fetch: fetchImpl, keys: browserKeyStore(memStorage()),
    randomBytes: (n: number) => new Uint8Array(n).fill(171), sha256Hex: async (t: string) => "hash:" + t,
  });
  it("sends the key as apikey, and as Bearer only for legacy JWT keys", () => {
    expect(supabaseHeaders("sb_publishable_k")).not.toHaveProperty("Authorization");
    expect(supabaseHeaders("eyJabc")).toHaveProperty("Authorization", "Bearer eyJabc");
  });
  it("lists ideas, cleaning rows", async () => {
    const f = vi.fn(async () => res([{ id: "abc123", name: "", message: "hi", created_at: "2026-10-01T00:00:00Z" }, { id: "x", message: "" }]));
    const got = vi.fn();
    expect(await supabaseStore(deps(f as unknown as typeof fetch)).subscribe(got)).toBe(true);
    const notes = got.mock.calls[0]![0] as Map<string, Note>;
    expect([...notes.values()]).toEqual([{ id: "abc123", name: "Anonymous", message: "hi", at: Date.parse("2026-10-01T00:00:00Z"), owner: "public" }]);
    expect((f.mock.calls[0] as unknown[])[0]).toContain("/rest/v1/ideas?select=id,name,message,created_at");
  });
  it("adding stores only the key's hash remotely and the key locally", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(null));
    const d = deps(f as unknown as typeof fetch);
    const store = supabaseStore(d);
    expect(await store.add(note)).toBe(true);
    const body = JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ id: "abc123", name: "Nino", message: "An idea", delete_key_hash: "hash:" + "ab".repeat(16) });
    expect(d.keys.get("abc123")).toBe("ab".repeat(16));
    expect(store.ownsKey("abc123")).toBe(true);
  });
  it("removing calls the delete_idea function with the saved key, then forgets it", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(true));
    const d = deps(f as unknown as typeof fetch); d.keys.set("abc123", "secret");
    expect(await supabaseStore(d).remove(note)).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/rpc/delete_idea");
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ p_id: "abc123", p_key: "secret" });
    expect(d.keys.get("abc123")).toBeUndefined();
  });
  it("without a key, removing does nothing", async () => {
    const f = vi.fn();
    expect(await supabaseStore(deps(f as unknown as typeof fetch)).remove(note)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("network errors and bad statuses become false, never throws", async () => {
    const boom = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const bad = (async () => res(null, false)) as unknown as typeof fetch;
    for (const f of [boom, bad]) {
      const s = supabaseStore(deps(f));
      expect(await s.subscribe(() => {})).toBe(false);
      expect(await s.add(note)).toBe(false);
    }
  });
});

describe("claudeStore", () => {
  function fakeDb(initial: Record<string, unknown[]>) {
    const docs = new Map(Object.entries(initial).map(([k, v]) => [k, { items: v }]));
    let listener: ((s: { docs: { id: string; exists: boolean; data(): { items?: unknown } }[] }) => void) | null = null;
    const snap = () => ({ docs: [...docs].map(([id, data]) => ({ id, exists: true, data: () => data })) });
    const db: ClaudeDb = {
      collection: () => ({ onSnapshot: (next) => { listener = next; next(snap()); return () => {}; } }),
      doc: (path) => {
        const id = path.split("/")[1]!;
        return {
          get: async () => ({ id, exists: docs.has(id), data: () => docs.get(id) ?? {} }),
          set: async (data) => { docs.set(id, data as { items: unknown[] }); listener?.(snap()); },
        };
      },
    };
    return { db, docs };
  }
  const user = (id: string, owner = false) => ({ id: async () => id, isOwner: async () => owner });

  it("reads everyone's notes and writes only to the viewer's own doc, keeping the last 5", async () => {
    const { db, docs } = fakeDb({ u2: [{ id: "zzzzzz", message: "theirs", at: 1 }] });
    const s = claudeStore(db, user("u1"));
    const seen: Map<string, Note>[] = [];
    await s.subscribe((n) => seen.push(n));
    expect([...seen.at(-1)!.keys()]).toEqual(["zzzzzz"]);
    for (let i = 0; i < 6; i++) await s.add({ ...note, id: "abc12" + i });
    expect((docs.get("u1")!.items as unknown[]).length).toBe(5);
    expect(docs.get("u2")!.items).toHaveLength(1);
    expect(s.viewer()).toEqual({ mode: "claude", isOwner: false, uid: "u1" });
  });
  it("signed out: cannot add", async () => {
    const { db } = fakeDb({});
    expect(await claudeStore(db, null).add(note)).toBe(false);
  });
  it("removes one note from its author's doc", async () => {
    const { db, docs } = fakeDb({ u2: [{ id: "abc123", message: "a" }, { id: "def456", message: "b" }] });
    expect(await claudeStore(db, user("owner", true)).remove({ ...note, owner: "u2" })).toBe(true);
    expect(docs.get("u2")!.items).toEqual([{ id: "def456", message: "b" }]);
  });
});

describe("memoryStore", () => {
  it("adds, removes and reports changes", async () => {
    const s = memoryStore();
    const seen: number[] = [];
    await s.subscribe((n) => seen.push(n.size));
    await s.add(note); await s.remove(note);
    expect(seen).toEqual([0, 1, 0]);
  });
  it("can simulate a broken board", async () => {
    expect(await memoryStore([], { failWrites: true }).add(note)).toBe(false);
  });
});

describe("inbox", () => {
  it("sends the fields Formspree expects; email only when given", () => {
    expect(inboxFields(note, "", "https://x/")).toEqual([["name", "Nino"], ["message", "An idea"], ["idea_id", "abc123"], ["page", "https://x/"], ["_subject", "New idea on your site from Nino"]]);
    expect(inboxFields(note, "a@b.c", "p").map(([k]) => k)).toContain("email");
  });
  it("posts as JSON-accepting form data; failures become false", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res({}));
    expect(await formspreeInbox("https://formspree.io/f/x", f as unknown as typeof fetch).send(note, "", "p")).toBe(true);
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(await formspreeInbox("u", (async () => { throw new Error("x"); }) as unknown as typeof fetch).send(note, "", "p")).toBe(false);
  });
});
