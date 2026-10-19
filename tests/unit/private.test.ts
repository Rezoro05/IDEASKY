import { describe, it, expect } from "vitest";
import { memoryPrivateStore, privateCategorizer, privateUpdates, supabasePrivateStore } from "../../src/boundaries/privateStore";
import { memoryStore } from "../../src/boundaries/ideaStore";
import { labelOf } from "../../src/islands/board";
import { modeAfterSignIn, startingMode } from "../../src/lib/mode";
import type { Idea } from "../../src/lib/ideas";

type Call = { url: string; init: RequestInit };
function fakeFetch(answer: (url: string, init: RequestInit) => Response) {
  const calls: Call[] = [];
  return { calls, f: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return answer(url, init); }) as unknown as typeof fetch };
}
const idea: Idea = { id: "abcdef12", name: "", message: "My own idea", stage: "idea", at: 0, links: [] };
const deps = (f: typeof fetch, token: string | null = "tok") => ({ url: "https://board.test", key: "pk", fetch: f, token: async () => token, kind: "idea" as const });
const header = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name];

describe("your own ideas and dreams (private store)", () => {
  it("reads only your kind, with your sign-in, newest first", async () => {
    const { f, calls } = fakeFetch(() => new Response(JSON.stringify([{ id: "abcdef12", name: "", message: "My own idea", stage: "idea", links: [], categories: ["tech"], created_at: "2026-10-19T10:00:00Z" }])));
    let got: Map<string, Idea> | null = null;
    expect(await supabasePrivateStore(deps(f)).subscribe((m) => { got = m; })).toBe(true);
    expect(calls[0]!.url).toBe("https://board.test/rest/v1/private_items?select=id,name,message,stage,links,categories,public_id,created_at&kind=eq.idea&order=created_at.desc&limit=200");
    expect(header(calls[0]!, "Authorization")).toBe("Bearer tok");
    expect(header(calls[0]!, "apikey")).toBe("pk");
    expect(got!.get("abcdef12")?.categories).toEqual(["tech"]);
  });
  it("signed out: nothing is asked and nothing is saved", async () => {
    const { f, calls } = fakeFetch(() => new Response("[]"));
    const store = supabasePrivateStore(deps(f, null));
    expect(await store.subscribe(() => {})).toBe(false);
    expect(await store.add(idea)).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("adds with its kind and no owner field (the database sets you as the owner)", async () => {
    const { f, calls } = fakeFetch(() => new Response("", { status: 201 }));
    expect(await supabasePrivateStore({ ...deps(f), kind: "dream" }).add(idea)).toBe(true);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ id: "abcdef12", kind: "dream", name: "", message: "My own idea", links: [] });
  });
  it("removes only what was really removed (nothing removed = not yours, or gone)", async () => {
    expect(await supabasePrivateStore(deps(fakeFetch(() => new Response(JSON.stringify([{ id: "abcdef12" }]))).f)).remove(idea)).toBe(true);
    expect(await supabasePrivateStore(deps(fakeFetch(() => new Response("[]")).f)).remove(idea)).toBe(false);
    expect(await supabasePrivateStore(deps(fakeFetch(() => { throw new Error("offline"); }).f)).remove(idea)).toBe(false);
  });
  it("everything in your own sky is yours", () => {
    expect(supabasePrivateStore(deps(fakeFetch(() => new Response("")).f)).ownsKey("anything")).toBe(true);
  });
  it("sorting a private item sends your sign-in and says it's private", async () => {
    const { f, calls } = fakeFetch(() => new Response(JSON.stringify({ categories: ["health"] })));
    expect(await privateCategorizer(deps(f)).categorize("abcdef12")).toEqual(["health"]);
    expect(calls[0]!.url).toBe("https://board.test/functions/v1/categorize");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ id: "abcdef12", private: true });
    expect(header(calls[0]!, "Authorization")).toBe("Bearer tok");
    expect(await privateCategorizer(deps(f, null)).categorize("abcdef12")).toBeNull();
  });
});

describe("public or your own", () => {
  it("signed out is always public; signing in opens your own, unless you chose public before or a public idea's link is opening", () => {
    expect(startingMode({ signedIn: false, remembered: "mine", openingPublicIdea: false })).toBe("public");
    expect(startingMode({ signedIn: true, remembered: null, openingPublicIdea: false })).toBe("mine");
    expect(startingMode({ signedIn: true, remembered: "public", openingPublicIdea: false })).toBe("public");
    expect(startingMode({ signedIn: true, remembered: "mine", openingPublicIdea: true })).toBe("public");
    expect([modeAfterSignIn(true), modeAfterSignIn(false)]).toEqual(["mine", "public"]);
  });
});

describe("updates on your own ideas", () => {
  const u = { id: "upd00001", ideaId: "abcdef12", message: "Mapped 20 streets", links: [], at: 0 };
  it("lists an idea's updates with your sign-in, oldest first", async () => {
    const { f, calls } = fakeFetch(() => new Response(JSON.stringify([{ id: "upd00001", item_id: "abcdef12", message: "Mapped 20 streets", links: [], created_at: "2026-10-19T10:00:00Z" }])));
    const list = await privateUpdates(deps(f)).list("abcdef12");
    expect(list?.map((x) => x.message)).toEqual(["Mapped 20 streets"]);
    expect(calls[0]!.url).toBe("https://board.test/rest/v1/private_updates?select=id,item_id,message,links,created_at&item_id=eq.abcdef12&order=created_at.asc&limit=50");
    expect(header(calls[0]!, "Authorization")).toBe("Bearer tok");
  });
  it("adds on the idea, removes only what was removed, and every update on your own idea is yours", async () => {
    const add = fakeFetch(() => new Response("", { status: 201 }));
    expect(await privateUpdates(deps(add.f)).add(u)).toBe(true);
    expect(JSON.parse(add.calls[0]!.init.body as string)).toEqual({ id: "upd00001", item_id: "abcdef12", message: "Mapped 20 streets", links: [] });
    expect(await privateUpdates(deps(fakeFetch(() => new Response("[]")).f)).remove(u)).toBe(false);
    expect(privateUpdates(deps(add.f)).canManage("anything")).toBe(true);
    expect(await privateUpdates(deps(add.f, null)).list("abcdef12")).toBeNull();
  });
});

describe("names", () => {
  const idea: Idea = { id: "abcdef12", name: "Telescope diary", message: "m", stage: "idea", at: 0, links: [] };
  it("your own go by the name you gave them; otherwise, and on the public board, by their number", () => {
    expect(labelOf(idea, "Idea3", true)).toBe("Telescope diary");
    expect(labelOf({ ...idea, name: "Anonymous" }, "Idea3", true)).toBe("Idea3");
    expect(labelOf({ ...idea, name: "" }, "Idea3", true)).toBe("Idea3");
    expect(labelOf(idea, "Idea3", false)).toBe("Idea3"); // public: the name is who wrote it, not the idea's
  });
});

describe("shared on the public board", () => {
  it("reads the public copy's id with your own item, and remembers or forgets it", async () => {
    const read = fakeFetch(() => new Response(JSON.stringify([{ id: "abcdef12", name: "", message: "m", stage: "idea", links: [], categories: null, public_id: "pub00001", created_at: "2026-10-19T10:00:00Z" }])));
    let got: Map<string, Idea> | null = null;
    await supabasePrivateStore(deps(read.f)).subscribe((m) => { got = m; });
    expect(got!.get("abcdef12")?.publicId).toBe("pub00001");
    const mark = fakeFetch(() => new Response(JSON.stringify([{ id: "abcdef12" }])));
    expect(await supabasePrivateStore(deps(mark.f)).markShared("abcdef12", "pub00001")).toBe(true);
    expect(mark.calls[0]!.url).toBe("https://board.test/rest/v1/private_items?id=eq.abcdef12");
    expect(JSON.parse(mark.calls[0]!.init.body as string)).toEqual({ public_id: "pub00001" });
    expect(await supabasePrivateStore(deps(mark.f)).markShared("abcdef12", null)).toBe(true);
    expect(JSON.parse(mark.calls[1]!.init.body as string)).toEqual({ public_id: null });
    expect(await supabasePrivateStore(deps(fakeFetch(() => new Response("[]")).f)).markShared("abcdef12", "pub00001")).toBe(false);
  });
  it("in memory too", async () => {
    const store = memoryPrivateStore(memoryStore([idea]));
    expect(await store.markShared("abcdef12", "pub00001")).toBe(true);
    let got: Map<string, Idea> | null = null;
    await store.subscribe((m) => { got = m; });
    expect(got!.get("abcdef12")?.publicId).toBe("pub00001");
    await store.markShared("abcdef12", null);
    await store.subscribe((m) => { got = m; });
    expect(got!.get("abcdef12")?.publicId).toBeUndefined();
    expect(await store.markShared("nothere1", "x")).toBe(false);
  });
});
