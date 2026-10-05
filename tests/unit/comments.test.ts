import { describe, it, expect, vi } from "vitest";
import { cleanComment, threadFor, commentGroups, replyParent, tally, validateCommentDraft, COMMENT_LIMITS, type Comment } from "../../src/lib/comments";
import { supabaseComments, memoryComments } from "../../src/boundaries/commentStore";
import { browserKeyStore, COMMENT_KEYS_ITEM, DELETE_KEYS_ITEM } from "../../src/boundaries/keyStore";
import { commentFields, formspreeInbox } from "../../src/boundaries/inbox";

const c = (id: string, at: number, extra: Partial<Comment> = {}): Comment => ({ id, ideaId: "idea01", parentId: null, name: "A", message: "m", at, ...extra });
const res = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };

describe("comment rules", () => {
  it("cleanComment rejects bad ids and empty text; trims and caps", () => {
    expect(cleanComment({ id: "abcdef", ideaId: "BAD", message: "x" })).toBeNull();
    expect(cleanComment({ id: "abcdef", ideaId: "idea01", message: " " })).toBeNull();
    const got = cleanComment({ id: "abcdef", ideaId: "idea01", name: " ", message: "y".repeat(900), at: 3 })!;
    expect(got.name).toBe("Anonymous");
    expect(got.message).toHaveLength(COMMENT_LIMITS.message);
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
});

describe("replies", () => {
  it("cleanComment keeps a well-formed parent and drops a bad or self-pointing one", () => {
    expect(cleanComment({ id: "abcdef", ideaId: "idea01", message: "x", parentId: "parent1" })!.parentId).toBe("parent1");
    expect(cleanComment({ id: "abcdef", ideaId: "idea01", message: "x" })!.parentId).toBeNull();
    expect(cleanComment({ id: "abcdef", ideaId: "idea01", message: "x", parentId: "BAD!" })!.parentId).toBeNull();
    expect(cleanComment({ id: "abcdef", ideaId: "idea01", message: "x", parentId: "abcdef" })!.parentId).toBeNull();
  });
  it("groups one idea's comments: top-level oldest first, each with its replies oldest first", () => {
    const all = [c("top002", 5), c("rep001", 9, { parentId: "top001" }), c("top001", 1), c("rep002", 7, { parentId: "top001" }), c("rep003", 6, { parentId: "top002" }), c("elsewh", 0, { ideaId: "other1" })];
    expect(commentGroups(all, "idea01").map((g) => [g.comment.id, g.replies.map((r) => r.id)])).toEqual([["top001", ["rep002", "rep001"]], ["top002", ["rep003"]]]);
  });
  it("never loses a reply whose comment isn't there: it shows on its own", () => {
    const groups = commentGroups([c("top001", 1), c("orphan", 2, { parentId: "gone01" })], "idea01");
    expect(groups.map((g) => g.comment.id)).toEqual(["top001", "orphan"]);
  });
  it("files a reply to a reply under the same top-level comment (one level deep)", () => {
    expect(replyParent(c("top001", 1))).toBe("top001");
    expect(replyParent(c("rep001", 2, { parentId: "top001" }))).toBe("top001");
  });
});

describe("comment likes", () => {
  it("tally counts each id", () => {
    expect(Object.fromEntries(tally(["a", "b", "a", "a"]))).toEqual({ a: 3, b: 1 });
    expect(tally([]).size).toBe(0);
  });
});

describe("supabaseComments", () => {
  const deps = (f: typeof fetch) => ({ url: "https://x.supabase.co", key: "sb_publishable_k", fetch: f, keys: browserKeyStore(memStorage(), COMMENT_KEYS_ITEM),
    randomBytes: (n: number) => new Uint8Array(n).fill(171), sha256Hex: async (t: string) => "hash:" + t });
  it("lists one idea's comments, oldest first, cleaning rows", async () => {
    const f = vi.fn(async (_u: string) => res([{ id: "cmt001", idea_id: "idea01", name: "", message: "hi", created_at: "2026-10-01T00:00:00Z" }, { id: "x" }]));
    const got = await supabaseComments(deps(f as unknown as typeof fetch)).list("idea01");
    expect(got).toEqual([{ id: "cmt001", ideaId: "idea01", parentId: null, name: "Anonymous", message: "hi", at: Date.parse("2026-10-01T00:00:00Z") }]);
    expect(f.mock.calls[0]![0]).toContain("/rest/v1/comments?select=id,idea_id,parent_id,name,message,created_at&idea_id=eq.idea01&order=created_at.asc");
  });
  it("reads a reply's parent", async () => {
    const f = vi.fn(async (_u: string) => res([{ id: "rep001", idea_id: "idea01", parent_id: "cmt001", name: "B", message: "yes", created_at: "2026-10-01T00:00:00Z" }]));
    expect((await supabaseComments(deps(f as unknown as typeof fetch)).list("idea01"))![0]!.parentId).toBe("cmt001");
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
  it("sends a reply's parent, and nothing extra for a top-level comment", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(null));
    const store = supabaseComments(deps(f as unknown as typeof fetch));
    await store.add(c("rep001", 1, { parentId: "cmt001" }));
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toMatchObject({ id: "rep001", parent_id: "cmt001" });
    await store.add(c("top001", 1));
    expect(JSON.parse((f.mock.calls[1]![1] as RequestInit).body as string)).not.toHaveProperty("parent_id");
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
