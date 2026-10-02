import { describe, it, expect, vi } from "vitest";
import { countFromContentRange, likeButtonLabel, likeCountText, toggled } from "../../src/lib/likes";
import { likerIdFrom, memoryLikes, supabaseLikes } from "../../src/boundaries/likeStore";
import { browserKeyStore, LIKES_ITEM } from "../../src/boundaries/keyStore";

const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const response = (status: number, headers: Record<string, string> = {}) =>
  ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => null }) as unknown as Response;

describe("like rules", () => {
  it("toggling likes and unlikes; the count never goes below zero", () => {
    expect(toggled({ liked: false, count: 4 })).toEqual({ liked: true, count: 5 });
    expect(toggled({ liked: true, count: 5 })).toEqual({ liked: false, count: 4 });
    expect(toggled({ liked: true, count: 0 })).toEqual({ liked: false, count: 0 });
  });
  it("labels and counts", () => {
    expect(likeButtonLabel({ liked: false, count: 0 })).toBe("Like this idea");
    expect(likeButtonLabel({ liked: true, count: 1 })).toBe("Unlike this idea");
    expect([null, 0, 3].map(likeCountText)).toEqual(["", "", "3"]);
  });
  it("reads totals from Content-Range", () => {
    expect(countFromContentRange("*/12")).toBe(12);
    expect(countFromContentRange("0-24/3573")).toBe(3573);
    expect(countFromContentRange("*/0")).toBe(0);
    expect(countFromContentRange("0-24/*")).toBeNull();
    expect(countFromContentRange(null)).toBeNull();
  });
});

describe("liker id", () => {
  it("is made once and kept in browser storage", () => {
    const keys = browserKeyStore(memStorage(), LIKES_ITEM), bytes = vi.fn((n: number) => new Uint8Array(n).fill(171));
    const id = likerIdFrom(keys, bytes);
    expect(id()).toBe("ab".repeat(16));
    expect(id()).toBe("ab".repeat(16));
    expect(bytes).toHaveBeenCalledTimes(1);
    expect(keys.get("liker")).toBe("ab".repeat(16));
  });
  it("without storage it still lasts for the visit", () => {
    const id = likerIdFrom(browserKeyStore(null, LIKES_ITEM), (n) => new Uint8Array(n).fill(1));
    expect(id()).toBe(id());
  });
});

describe("supabaseLikes", () => {
  const deps = (f: typeof fetch) => ({ url: "https://x.supabase.co", key: "sb_publishable_k", fetch: f,
    keys: browserKeyStore(memStorage(), LIKES_ITEM), likerId: () => "liker-secret", sha256Hex: async (t: string) => "hash:" + t });

  it("counts with an exact-count HEAD request", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => response(200, { "content-range": "*/7" }));
    expect(await supabaseLikes(deps(f as unknown as typeof fetch)).count("idea01")).toBe(7);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://x.supabase.co/rest/v1/likes?select=idea_id&idea_id=eq.idea01");
    expect(init).toMatchObject({ method: "HEAD", headers: { Prefer: "count=exact" } });
  });
  it("liking sends only the liker's hash and remembers the like here", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => response(201));
    const d = deps(f as unknown as typeof fetch), s = supabaseLikes(d);
    expect(s.likedHere("idea01")).toBe(false);
    expect(await s.like("idea01")).toBe(true);
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toEqual({ idea_id: "idea01", liker_hash: "hash:liker-secret" });
    expect(s.likedHere("idea01")).toBe(true);
  });
  it("an already-existing like (409) still counts as liked here", async () => {
    const s = supabaseLikes(deps((async () => response(409)) as unknown as typeof fetch));
    expect(await s.like("idea01")).toBe(true);
    expect(s.likedHere("idea01")).toBe(true);
  });
  it("unliking calls unlike_idea with the liker id and forgets the like", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => response(200));
    const d = deps(f as unknown as typeof fetch); d.keys.set("idea01", "1");
    expect(await supabaseLikes(d).unlike("idea01")).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/rpc/unlike_idea");
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toEqual({ p_idea_id: "idea01", p_liker: "liker-secret" });
    expect(d.keys.get("idea01")).toBeUndefined();
  });
  it("failures become null/false and leave the like state alone, never throw", async () => {
    for (const f of [async () => { throw new Error("offline"); }, async () => response(500)]) {
      const d = deps(f as unknown as typeof fetch), s = supabaseLikes(d);
      expect(await s.count("idea01")).toBeNull();
      expect(await s.like("idea01")).toBe(false);
      expect(s.likedHere("idea01")).toBe(false);
      d.keys.set("idea01", "1");
      expect(await s.unlike("idea01")).toBe(false);
      expect(s.likedHere("idea01")).toBe(true);
    }
  });
});

describe("memoryLikes", () => {
  it("likes once per browser, unlikes, and can fail", async () => {
    const s = memoryLikes({ idea01: 2 });
    await s.like("idea01"); await s.like("idea01");
    expect(await s.count("idea01")).toBe(3);
    await s.unlike("idea01");
    expect(await s.count("idea01")).toBe(2);
    expect(s.likedHere("idea01")).toBe(false);
    expect(await memoryLikes({}, { failWrites: true }).like("idea01")).toBe(false);
    expect(await memoryLikes({}, { failReads: true }).count("idea01")).toBeNull();
  });
});
