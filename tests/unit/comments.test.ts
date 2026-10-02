import { describe, it, expect, vi } from "vitest";
import { cleanComment, threadFor, validateCommentDraft, commentCountLabel, COMMENT_LIMITS, type Comment } from "../../src/lib/comments";
import { supabaseComments, claudeComments, memoryComments } from "../../src/boundaries/commentStore";
import { browserKeyStore, COMMENT_KEYS_ITEM, DELETE_KEYS_ITEM } from "../../src/boundaries/keyStore";
import { commentFields, formspreeInbox } from "../../src/boundaries/inbox";
import type { ClaudeDb } from "../../src/boundaries/ideaStore";

const c = (id: string, at: number, extra: Partial<Comment> = {}): Comment => ({ id, ideaId: "idea01", name: "A", message: "m", at, ...extra });
const res = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };

describe("comment rules", () => {
  it("cleanComment rejects bad ids and empty text; trims and caps", () => {
    expect(cleanComment({ id: "abcdef", ideaId: "BAD", message: "x" })).toBeNull();
    expect(cleanComment({ id: "abcdef", ideaId: "idea01", message: " " })).toBeNull();
    const got = cleanComment({ id: "abcdef", ideaId: "idea01", name: " ", message: "y".repeat(900), at: 3 }, "u1")!;
    expect(got.name).toBe("Anonymous");
    expect(got.message).toHaveLength(COMMENT_LIMITS.message);
    expect(got.owner).toBe("u1");
  });
  it("threadFor keeps one idea's comments, oldest first, stable on ties", () => {
    const all = [c("bbbbbb", 2), c("aaaaaa", 2), c("cccccc", 1), c("dddddd", 0, { ideaId: "other1" })];
    expect(threadFor(all, "idea01").map((x) => x.id)).toEqual(["cccccc", "aaaaaa", "bbbbbb"]);
  });
  it("validateCommentDraft: bot first, then empty, then ok", () => {
    expect(validateCommentDraft({ name: "", message: "hi", trap: "x" })).toEqual({ ok: false, reason: "bot" });
    expect(validateCommentDraft({ name: "", message: "  ", trap: "" })).toEqual({ ok: false, reason: "empty", text: "Write your comment first." });
    expect(validateCommentDraft({ name: " Gio ", message: " nice ", trap: "" })).toEqual({ ok: true, comment: { name: "Gio", message: "nice" } });
  });
  it("count labels", () => {
    expect([0, 1, 5].map(commentCountLabel)).toEqual(["No comments yet", "1 comment", "5 comments"]);
  });
});

describe("supabaseComments", () => {
  const deps = (f: typeof fetch) => ({ url: "https://x.supabase.co", key: "sb_publishable_k", fetch: f, keys: browserKeyStore(memStorage(), COMMENT_KEYS_ITEM),
    randomBytes: (n: number) => new Uint8Array(n).fill(171), sha256Hex: async (t: string) => "hash:" + t });
  it("lists one idea's comments, oldest first, cleaning rows", async () => {
    const f = vi.fn(async (_u: string) => res([{ id: "cmt001", idea_id: "idea01", name: "", message: "hi", created_at: "2026-10-01T00:00:00Z" }, { id: "x" }]));
    const got = await supabaseComments(deps(f as unknown as typeof fetch)).list("idea01");
    expect(got).toEqual([{ id: "cmt001", ideaId: "idea01", name: "Anonymous", message: "hi", at: Date.parse("2026-10-01T00:00:00Z") }]);
    expect(f.mock.calls[0]![0]).toContain("/rest/v1/comments?select=id,idea_id,name,message,created_at&idea_id=eq.idea01&order=created_at.asc");
  });
  it("adds with only the key's hash; the key stays in this browser", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(null));
    const d = deps(f as unknown as typeof fetch);
    const store = supabaseComments(d);
    expect(await store.add(c("cmt001", 1))).toBe(true);
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ id: "cmt001", idea_id: "idea01", name: "A", message: "m", delete_key_hash: "hash:" + "ab".repeat(16) });
    expect(store.canRemove(c("cmt001", 1))).toBe(true);
    expect(store.canRemove(c("other1", 1))).toBe(false);
  });
  it("removes through delete_comment with the saved key", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(true));
    const d = deps(f as unknown as typeof fetch); d.keys.set("cmt001", "secret");
    expect(await supabaseComments(d).remove(c("cmt001", 1))).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/rpc/delete_comment");
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ p_id: "cmt001", p_key: "secret" });
    expect(d.keys.get("cmt001")).toBeUndefined();
  });
  it("failures become null/false", async () => {
    const boom = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const bad = (async () => res(null, false)) as unknown as typeof fetch;
    for (const f of [boom, bad]) {
      const s = supabaseComments(deps(f));
      expect(await s.list("idea01")).toBeNull();
      expect(await s.add(c("cmt001", 1))).toBe(false);
    }
  });
  it("comment keys are kept apart from idea keys", () => {
    const st = memStorage();
    browserKeyStore(st, COMMENT_KEYS_ITEM).set("a", "k");
    expect(browserKeyStore(st, DELETE_KEYS_ITEM).get("a")).toBeUndefined();
  });
});

describe("claudeComments", () => {
  function fakeDb(initial: Record<string, unknown[]>) {
    const docs = new Map(Object.entries(initial).map(([k, v]) => [k, { items: v }]));
    const db: ClaudeDb = {
      collection: () => ({ onSnapshot: (next) => { next({ docs: [...docs].map(([id, data]) => ({ id, exists: true, data: () => data })) }); return () => {}; } }),
      doc: (path) => { const id = path.split("/")[1]!; return {
        get: async () => ({ id, exists: docs.has(id), data: () => docs.get(id) ?? {} }),
        set: async (data) => { docs.set(id, data as { items: unknown[] }); },
      }; },
    };
    return { db, docs };
  }
  const user = (id: string, owner = false) => ({ id: async () => id, isOwner: async () => owner });
  it("lists across visitors for one idea; writes only to the viewer's own doc", async () => {
    const { db, docs } = fakeDb({ u2: [{ id: "cmt002", ideaId: "idea01", message: "theirs", at: 1 }, { id: "cmt003", ideaId: "other1", message: "x" }] });
    const s = claudeComments(db, user("u1"));
    expect((await s.list("idea01"))!.map((x) => x.id)).toEqual(["cmt002"]);
    const mine = c("cmt001", 5);
    expect(await s.add(mine)).toBe(true);
    expect(docs.get("u1")!.items).toHaveLength(1);
    expect(s.canRemove(mine)).toBe(true);
    expect(s.canRemove({ ...c("cmt002", 1), owner: "u2" })).toBe(false);
  });
  it("the owner may remove anyone's comment", async () => {
    const { db, docs } = fakeDb({ u2: [{ id: "cmt002", ideaId: "idea01", message: "a" }] });
    const s = claudeComments(db, user("me", true));
    await s.list("idea01");
    expect(s.canRemove({ ...c("cmt002", 1), owner: "u2" })).toBe(true);
    expect(await s.remove({ ...c("cmt002", 1), owner: "u2" })).toBe(true);
    expect(docs.get("u2")!.items).toEqual([]);
  });
  it("signed out: cannot add", async () => {
    expect(await claudeComments(fakeDb({}).db, null).add(c("cmt001", 1))).toBe(false);
  });
});

describe("memoryComments and inbox", () => {
  it("memory store adds, lists, removes and can fail", async () => {
    const s = memoryComments();
    await s.add(c("cmt001", 1));
    expect(await s.list("idea01")).toHaveLength(1);
    expect(await s.remove(c("cmt001", 1))).toBe(true);
    expect(await memoryComments([], { failReads: true }).list("idea01")).toBeNull();
  });
  it("comment emails name the idea", async () => {
    expect(commentFields(c("cmt001", 1, { name: "Gio" }), "Idea3", "p").at(-1)).toEqual(["_subject", "New comment on Idea3 from Gio"]);
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res({}));
    expect(await formspreeInbox("u", f as unknown as typeof fetch).sendComment(c("cmt001", 1), "Idea3", "p")).toBe(true);
    expect((f.mock.calls[0]![1] as RequestInit).body).toBeInstanceOf(FormData);
  });
});
