import { describe, it, expect, vi } from "vitest";
import { supabaseAccountPosts } from "../../src/boundaries/accountPosts";
import { supabaseStore } from "../../src/boundaries/ideaStore";
import { supabaseUpdates } from "../../src/boundaries/updateStore";
import { memoryAuth } from "../../src/boundaries/auth";
import { browserKeyStore } from "../../src/boundaries/keyStore";

const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("public posts that belong to your account", () => {
  it("on sign-in, this browser's posts are claimed with their keys, then your post ids are asked for (yours only)", async () => {
    const keys = browserKeyStore(memStorage()); keys.set("old001", "k1");
    const f = vi.fn(async (u: string, _i?: RequestInit) => json(u.endsWith("my_idea_ids") ? ["old001", "new001"] : 1));
    const auth = memoryAuth();
    const account = supabaseAccountPosts({ url: "https://x.supabase.co", key: "sb_publishable_k", fetch: f as unknown as typeof fetch, auth, ideaKeys: keys });
    expect(account.owns("new001")).toBe(false);
    await auth.sendLink("rez@example.com", "x"); await flush(); await flush();
    expect(f.mock.calls.map((c) => c[0])).toEqual(["https://x.supabase.co/rest/v1/rpc/claim_ideas", "https://x.supabase.co/rest/v1/rpc/my_idea_ids"]);
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toEqual({ p_items: [{ id: "old001", key: "k1" }] });
    expect((f.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBe("Bearer local");
    expect(account.owns("new001")).toBe(true);
    await auth.signOut(); await flush();
    expect(account.owns("new001")).toBe(false); // signed out: nothing is yours by account here
  });

  it("signed in, a post carries your sign-in; one yours by account is removed, moved and updated without a key", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => json(true));
    const account = { token: async () => "tok", owns: (id: string) => id === "mine01", added: vi.fn() };
    const base = { url: "https://x.supabase.co", key: "sb_publishable_k", fetch: f as unknown as typeof fetch, keys: browserKeyStore(memStorage()), randomBytes: (n: number) => new Uint8Array(n), sha256Hex: async (t: string) => "h" + t, account };
    const store = supabaseStore(base);
    expect(await store.add({ id: "new001", name: "Rez", message: "hi", at: 0, stage: "idea", links: [] })).toBe(true);
    expect((f.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(account.added).toHaveBeenCalledWith("new001");
    expect(store.ownsKey("mine01")).toBe(true);
    expect(await store.remove({ id: "mine01", name: "", message: "", at: 0, stage: "idea", links: [] })).toBe(true);
    expect(JSON.parse(f.mock.calls[1]![1]!.body as string)).toEqual({ p_id: "mine01", p_key: null });
    expect(await store.remove({ id: "other1", name: "", message: "", at: 0, stage: "idea", links: [] })).toBe(false); // neither key nor account: not even asked
    expect(f).toHaveBeenCalledTimes(2);
    const updates = supabaseUpdates({ url: base.url, key: base.key, fetch: base.fetch, ideaKeys: base.keys, account });
    expect(updates.canManage("mine01")).toBe(true);
    expect(await updates.add({ id: "upd001", ideaId: "mine01", message: "progress", links: [], at: 0 })).toBe(true);
    expect(JSON.parse(f.mock.calls[2]![1]!.body as string)).toMatchObject({ p_idea_id: "mine01", p_key: null });
    expect((f.mock.calls[2]![1]!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });
});
