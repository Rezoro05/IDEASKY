import { describe, it, expect, vi } from "vitest";
import { supabaseCommentLikes, memoryCommentLikes } from "../../src/boundaries/commentLikeStore";
import { browserKeyStore, COMMENT_LIKES_ITEM } from "../../src/boundaries/keyStore";

const res = (body: unknown, ok = true, status = ok ? 200 : 500) => ({ ok, status, json: async () => body }) as Response;
const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const deps = (f: typeof fetch) => ({ url: "https://x.supabase.co", key: "sb_publishable_k", fetch: f, keys: browserKeyStore(memStorage(), COMMENT_LIKES_ITEM),
  likerId: () => "me", sha256Hex: async (t: string) => "hash:" + t });

describe("likes on comments (Supabase)", () => {
  it("counts the likes on a set of comments in one request", async () => {
    const f = vi.fn(async (_u: string) => res([{ comment_id: "cmt001" }, { comment_id: "cmt002" }, { comment_id: "cmt001" }]));
    const counts = await supabaseCommentLikes(deps(f as unknown as typeof fetch)).counts(["cmt001", "cmt002", "cmt003"]);
    expect(Object.fromEntries(counts!)).toEqual({ cmt001: 2, cmt002: 1 });
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/comment_likes?select=comment_id&comment_id=in.(cmt001,cmt002,cmt003)");
  });
  it("asks for nothing when there are no comments", async () => {
    const f = vi.fn();
    expect((await supabaseCommentLikes(deps(f as unknown as typeof fetch)).counts([]))!.size).toBe(0);
    expect(f).not.toHaveBeenCalled();
  });
  it("likes with only the liker id's hash, and remembers it in this browser", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(null));
    const s = supabaseCommentLikes(deps(f as unknown as typeof fetch));
    expect(await s.like("cmt001")).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/comment_likes");
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ comment_id: "cmt001", liker_hash: "hash:me" });
    expect(s.likedHere("cmt001")).toBe(true);
  });
  it("treats 'already liked' as liked", async () => {
    const s = supabaseCommentLikes(deps((async () => res(null, false, 409)) as unknown as typeof fetch));
    expect(await s.like("cmt001")).toBe(true);
    expect(s.likedHere("cmt001")).toBe(true);
  });
  it("unlikes through unlike_comment with the liker id itself", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(true));
    const d = deps(f as unknown as typeof fetch); d.keys.set("cmt001", "1");
    const s = supabaseCommentLikes(d);
    expect(await s.unlike("cmt001")).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/rpc/unlike_comment");
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ p_comment_id: "cmt001", p_liker: "me" });
    expect(s.likedHere("cmt001")).toBe(false);
  });
  it("failures become null/false and take the change back", async () => {
    for (const f of [(async () => { throw new Error("offline"); }), (async () => res(null, false))] as unknown as (typeof fetch)[]) {
      const s = supabaseCommentLikes(deps(f));
      expect(await s.counts(["cmt001"])).toBeNull();
      expect(await s.like("cmt001")).toBe(false);
      expect(s.likedHere("cmt001")).toBe(false);
    }
  });
});

describe("likes on comments (memory)", () => {
  it("counts, likes once per browser, unlikes", async () => {
    const s = memoryCommentLikes({ cmt001: 2 });
    expect(Object.fromEntries((await s.counts(["cmt001", "cmt002"]))!)).toEqual({ cmt001: 2 });
    await s.like("cmt001"); await s.like("cmt001");
    expect((await s.counts(["cmt001"]))!.get("cmt001")).toBe(3);
    await s.unlike("cmt001");
    expect((await s.counts(["cmt001"]))!.get("cmt001")).toBe(2);
    expect(await memoryCommentLikes({}, { failReads: true }).counts(["cmt001"])).toBeNull();
  });
});
