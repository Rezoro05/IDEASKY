import { describe, it, expect, vi } from "vitest";
import { supabaseStore, supabaseHeaders, memoryStore } from "../../src/boundaries/ideaStore";
import { browserKeyStore, DELETE_KEYS_ITEM } from "../../src/boundaries/keyStore";
import { feedbackFields, formspreeInbox, inboxFields, inboxFor, unconfiguredInbox } from "../../src/boundaries/inbox";
import type { Idea } from "../../src/lib/ideas";

const idea: Idea = { id: "abc123", name: "Nino", message: "An idea", at: 1000, stage: "idea", links: [{ title: "Demo", url: "https://demo.app/" }] };
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
    const f = vi.fn(async () => res([{ id: "abc123", name: "", message: "hi", stage: "live", links: [{ url: "javascript:x" }, { title: "", url: "https://demo.app" }], created_at: "2026-10-01T00:00:00Z" }, { id: "x", message: "" }]));
    const got = vi.fn();
    expect(await supabaseStore(deps(f as unknown as typeof fetch)).subscribe(got)).toBe(true);
    const ideas = got.mock.calls[0]![0] as Map<string, Idea>;
    expect([...ideas.values()]).toEqual([{ id: "abc123", name: "Anonymous", message: "hi", at: Date.parse("2026-10-01T00:00:00Z"), stage: "live", links: [{ title: "demo.app", url: "https://demo.app/" }] }]);
    expect((f.mock.calls[0] as unknown[])[0]).toContain("/rest/v1/ideas?select=id,name,message,stage,links,categories,created_at");
  });
  it("adding stores only the key's hash remotely and the key locally", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(null));
    const d = deps(f as unknown as typeof fetch);
    const store = supabaseStore(d);
    expect(await store.add(idea)).toBe(true);
    const body = JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ id: "abc123", name: "Nino", message: "An idea", links: [{ title: "Demo", url: "https://demo.app/" }], delete_key_hash: "hash:" + "ab".repeat(16) }); // no stage: the database starts every idea at "idea"
    expect(d.keys.get("abc123")).toBe("ab".repeat(16));
    expect(store.ownsKey("abc123")).toBe(true);
  });
  it("removing calls the delete_idea function with the saved key, then forgets it", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(true));
    const d = deps(f as unknown as typeof fetch); d.keys.set("abc123", "secret");
    expect(await supabaseStore(d).remove(idea)).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/rpc/delete_idea");
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ p_id: "abc123", p_key: "secret" });
    expect(d.keys.get("abc123")).toBeUndefined();
  });
  it("moving a stage calls set_idea_stage with the owner's key", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res(true));
    const d = deps(f as unknown as typeof fetch); d.keys.set("abc123", "secret");
    expect(await supabaseStore(d).setStage(idea, "implementation")).toBe(true);
    expect(f.mock.calls[0]![0]).toBe("https://x.supabase.co/rest/v1/rpc/set_idea_stage");
    expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toEqual({ p_id: "abc123", p_key: "secret", p_stage: "implementation" });
  });
  it("a stage move needs the key, a single step, and the database's yes", async () => {
    const f = vi.fn(async () => res(true));
    expect(await supabaseStore(deps(f as unknown as typeof fetch)).setStage(idea, "implementation")).toBe(false); // no key
    const d = deps(f as unknown as typeof fetch); d.keys.set("abc123", "secret");
    expect(await supabaseStore(d).setStage(idea, "live")).toBe(false); // two steps
    expect(f).not.toHaveBeenCalled();
    const refused = deps((async () => res(false)) as unknown as typeof fetch); refused.keys.set("abc123", "secret");
    expect(await supabaseStore(refused).setStage(idea, "implementation")).toBe(false);
  });
  it("without a key, removing does nothing", async () => {
    const f = vi.fn();
    expect(await supabaseStore(deps(f as unknown as typeof fetch)).remove(idea)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("network errors and bad statuses become false, never throws", async () => {
    const boom = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    const bad = (async () => res(null, false)) as unknown as typeof fetch;
    for (const f of [boom, bad]) {
      const s = supabaseStore(deps(f));
      expect(await s.subscribe(() => {})).toBe(false);
      expect(await s.add(idea)).toBe(false);
    }
  });
});

describe("memoryStore", () => {
  it("adds, removes and reports changes", async () => {
    const s = memoryStore();
    const seen: number[] = [];
    await s.subscribe((n) => seen.push(n.size));
    await s.add(idea); await s.remove(idea);
    expect(seen).toEqual([0, 1, 0]);
  });
  it("can simulate a broken board", async () => {
    expect(await memoryStore([], { failWrites: true }).add(idea)).toBe(false);
  });
  it("moves stages for its own ideas, one step at a time", async () => {
    const other: Idea = { ...idea, id: "zzz999" };
    const s = memoryStore([other]);
    await s.add(idea);
    expect(await s.setStage(idea, "live")).toBe(false);
    expect(await s.setStage(idea, "implementation")).toBe(true);
    expect(s.ideas.get(idea.id)!.stage).toBe("implementation");
    expect(await s.setStage(other, "implementation")).toBe(false);
  });
  it("owns only the ideas posted through it", async () => {
    const other: Idea = { ...idea, id: "zzz999" };
    const s = memoryStore([other]);
    await s.add(idea);
    expect(s.ownsKey(idea.id)).toBe(true);
    expect(s.ownsKey(other.id)).toBe(false);
    expect(await s.remove(other)).toBe(false);
    expect(s.ideas.has(other.id)).toBe(true);
  });
});

describe("inbox", () => {
  it("sends the fields Formspree expects; email only when given", () => {
    expect(inboxFields(idea, "", "https://x/")).toEqual([["name", "Nino"], ["message", "An idea"], ["idea_id", "abc123"], ["page", "https://x/"], ["_subject", "New idea on IDEA SKY from Nino"]]);
    expect(inboxFields(idea, "a@b.c", "p").map(([k]) => k)).toContain("email");
  });
  it("posts as JSON-accepting form data; failures become false", async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res({}));
    expect(await formspreeInbox("https://formspree.io/f/x", f as unknown as typeof fetch).send(idea, "", "p")).toBe(true);
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(await formspreeInbox("u", (async () => { throw new Error("x"); }) as unknown as typeof fetch).send(idea, "", "p")).toBe(false);
  });
  it("with no endpoint configured, nothing is fetched and sends report false", async () => {
    const f = vi.fn();
    const inbox = inboxFor("", f as unknown as typeof fetch);
    expect(inbox).toBe(unconfiguredInbox);
    expect(await inbox.send(idea, "", "p")).toBe(false);
    expect(f).not.toHaveBeenCalled();
    expect(inboxFor("https://formspree.io/f/x", f as unknown as typeof fetch)).not.toBe(unconfiguredInbox);
  });
  it("says whether an inbox is set up, so feedback can refuse to pretend", () => {
    expect(unconfiguredInbox.configured).toBe(false);
    expect(formspreeInbox("https://formspree.io/f/x", vi.fn() as unknown as typeof fetch).configured).toBe(true);
  });
  it("feedback goes out with its own subject; email only when given", async () => {
    expect(feedbackFields({ message: "Love it", email: "" }, "https://x/")).toEqual([["message", "Love it"], ["page", "https://x/"], ["_subject", "Feedback on IDEA SKY"]]);
    expect(feedbackFields({ message: "Love it", email: "a@b.c" }, "p")[0]).toEqual(["email", "a@b.c"]);
    const f = vi.fn(async (_u: string, _i?: RequestInit) => res({}));
    expect(await formspreeInbox("https://formspree.io/f/x", f as unknown as typeof fetch).sendFeedback({ message: "Love it", email: "" }, "p")).toBe(true);
    expect((f.mock.calls[0]![1] as RequestInit).body).toBeInstanceOf(FormData);
    expect(await unconfiguredInbox.sendFeedback({ message: "x", email: "" }, "p")).toBe(false);
  });
});
