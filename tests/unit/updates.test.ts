import { describe, it, expect, vi } from "vitest";
import { cleanUpdate, updateCountLabel, updatesFor, validateUpdateDraft, UPDATE_LIMITS, type Update } from "../../src/lib/updates";
import { memoryUpdates, supabaseUpdates } from "../../src/boundaries/updateStore";
import { browserKeyStore, DELETE_KEYS_ITEM } from "../../src/boundaries/keyStore";

const u = (id: string, at: number, extra: Partial<Update> = {}): Update => ({ id, ideaId: "idea01", message: "m", links: [], at, ...extra });
const res = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const memStorage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("update rules", () => {
  it("cleanUpdate rejects bad ids and empty text; trims, caps, cleans links", () => {
    expect(cleanUpdate({ id: "abcdef", ideaId: "BAD", message: "x" })).toBeNull();
    expect(cleanUpdate({ id: "abcdef", ideaId: "idea01", message: "  " })).toBeNull();
    const got = cleanUpdate({ id: "abcdef", ideaId: "idea01", message: "y".repeat(900), links: [{ url: "javascript:x" }, { url: "demo.app" }], at: 3 })!;
    expect(got.message).toHaveLength(UPDATE_LIMITS.message);
    expect(got.links).toEqual([{ title: "demo.app", url: "https://demo.app/" }]);
  });
  it("one idea's updates, oldest first, stable on ties", () => {
    const all = [u("bbbbbb", 2), u("aaaaaa", 2), u("cccccc", 1), u("dddddd", 0, { ideaId: "other1" })];
    expect(updatesFor(all, "idea01").map((x) => x.id)).toEqual(["cccccc", "aaaaaa", "bbbbbb"]);
  });
  it("a draft needs text; a bad link names its row", () => {
    expect(validateUpdateDraft({ message: " ", linkRows: [] })).toEqual({ ok: false, reason: "empty", text: "Write your update first." });
    expect(validateUpdateDraft({ message: "Prototype is up", linkRows: [{ title: "", url: "proto.app" }] }))
      .toEqual({ ok: true, update: { message: "Prototype is up", links: [{ title: "proto.app", url: "https://proto.app/" }] } });
    expect(validateUpdateDraft({ message: "x", linkRows: [{ title: "", url: "nope" }] })).toMatchObject({ ok: false, reason: "bad-link", row: 0 });
  });
  it("count labels", () => expect([0, 1, 4].map(updateCountLabel)).toEqual(["No updates yet", "1 update", "4 updates"]));
});

describe("supabaseUpdates", () => {
  const deps = (f: typeof fetch) => ({ url: "https://x.supabase.co", key: "sb_publishable_k", fetch: f, ideaKeys: browserKeyStore(memStorage(), DELETE_KEYS_ITEM) });

  it("lists one idea's updates, cleaning rows", async () => {
    const f = vi.fn(async (_u: string) => res([{ id: "upd001", idea_id: "idea01", message: "hi", links: [], created_at: "2026-10-02T00:00:00Z" }, { id: "x" }]));
    expect(await supabaseUpdates(deps(f as unknown as typeof fetch)).list("idea01")).toEqual([u("upd001", Date.parse("2026-10-02T00:00:00Z"), { message: "hi" })]);
    expect(f.mock.calls[0]![0]).toContain("/rest/v1/idea_updates?select=id,idea_id,message,links,created_at&idea_id=eq.idea01&order=created_at.asc");
  });
  it("adding and removing prove ownership with the idea's own key", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(true));
    const d = deps(f as unknown as typeof fetch); d.ideaKeys.set("idea01", "owner-key");
    const s = supabaseUpdates(d), upd = u("upd001", 0, { message: "Prototype", links: [{ title: "P", url: "https://p.app/" }] });
    expect(s.canManage("idea01")).toBe(true);
    expect(await s.add(upd)).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/rpc/add_idea_update");
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toEqual({ p_idea_id: "idea01", p_key: "owner-key", p_id: "upd001", p_message: "Prototype", p_links: [{ title: "P", url: "https://p.app/" }] });
    expect(await s.remove(upd)).toBe(true);
    expect(JSON.parse(f.mock.calls[1]![1]!.body as string)).toEqual({ p_id: "upd001", p_key: "owner-key" });
  });
  it("without the idea's key nothing is sent; refusals and failures become false/null", async () => {
    const f = vi.fn(async () => res(true));
    const s = supabaseUpdates(deps(f as unknown as typeof fetch));
    expect(s.canManage("idea01")).toBe(false);
    expect(await s.add(u("upd001", 0))).toBe(false);
    expect(f).not.toHaveBeenCalled();
    for (const bad of [async () => res(false), async () => res(null, false), async () => { throw new Error("offline"); }]) {
      const d = deps(bad as unknown as typeof fetch); d.ideaKeys.set("idea01", "k");
      expect(await supabaseUpdates(d).add(u("upd001", 0))).toBe(false);
    }
    expect(await supabaseUpdates(deps((async () => { throw new Error("x"); }) as unknown as typeof fetch)).list("idea01")).toBeNull();
  });
});

describe("memoryUpdates", () => {
  it("only the owner adds and removes, up to the limit", async () => {
    const s = memoryUpdates((id) => id === "idea01");
    expect(await s.add(u("upd001", 1))).toBe(true);
    expect(await s.add(u("upd002", 1, { ideaId: "other1" }))).toBe(false);
    expect(await s.list("idea01")).toHaveLength(1);
    expect(await s.remove(u("upd001", 1))).toBe(true);
    const full = memoryUpdates(() => true, Array.from({ length: UPDATE_LIMITS.perIdea }, (_, i) => u("upd" + String(i).padStart(3, "0"), i)));
    expect(await full.add(u("updnew", 99))).toBe(false);
    expect(await memoryUpdates(() => true, [], { failReads: true }).list("idea01")).toBeNull();
  });
});
