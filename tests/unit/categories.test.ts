import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { IDEA_CATEGORIES, PICK, categoryLabel, categoryQuestions, cleanCategories, pickCategories } from "../../src/lib/categories";
import { categorize, noulAnswers, type CategorizeDeps, type Stored } from "../../supabase/functions/_shared/categorize";
import { supabaseCategorizer } from "../../src/boundaries/categorizer";
import { cleanIdea } from "../../src/lib/ideas";

describe("the category list", () => {
  it("has the eleven agreed categories", () => {
    expect(IDEA_CATEGORIES.map((c) => c.label)).toEqual(["Tech", "Food & Drink", "City & Places", "Health", "Learning", "Business", "Art & Design", "Social Good", "Environment", "Play & Games", "Science"]);
  });
  it("matches the keys the database accepts (supabase/07-categories.sql)", () => {
    const sql = readFileSync("supabase/07-categories.sql", "utf8");
    const keys = sql.match(/array\[([^\]]+)\]/)![1]!.split(",").map((k) => k.trim().replace(/'/g, ""));
    expect(keys).toEqual(IDEA_CATEGORIES.map((c) => c.key));
    expect(sql).toContain(`cardinality(categories) <= ${PICK.max}`);
  });
  it("asks Jev one complete yes/no question per category (ids are never sent to the model)", () => {
    const q = categoryQuestions(IDEA_CATEGORIES);
    expect(Object.keys(q)).toEqual(IDEA_CATEGORIES.map((c) => c.key));
    expect(q["food-drink"]).toEqual({ type: "noul", instructions: expect.stringContaining('"Food & Drink"') });
    expect(q["food-drink"]!.instructions).toContain("cooking");
  });
  it("labels a key, and leaves an unknown key as it is", () => {
    expect(categoryLabel(IDEA_CATEGORIES, "play-games")).toBe("Play & Games");
    expect(categoryLabel(IDEA_CATEGORIES, "mystery")).toBe("mystery");
  });
});

describe("pickCategories", () => {
  const pick = (p: Record<string, unknown>) => pickCategories(IDEA_CATEGORIES, p);
  it("keeps up to three that fit, most likely first", () => {
    expect(pick({ tech: 0.6, health: 0.9, science: 0.7, learning: 0.55, business: 0.1 })).toEqual(["health", "science", "tech"]);
  });
  it("keeps the single best when none clearly fits but it comes close", () => {
    expect(pick({ tech: 0.35, health: 0.2 })).toEqual(["tech"]);
  });
  it("keeps nothing when nothing comes close", () => {
    expect(pick({ tech: 0.29, health: 0.1 })).toEqual([]);
  });
  it("ignores keys it doesn't know and answers that aren't numbers", () => {
    expect(pick({ dreams: 0.99, tech: "yes", health: 0.8 })).toEqual(["health"]);
  });
});

describe("cleanCategories (from the database)", () => {
  it("is undefined until the idea is sorted", () => {
    expect(cleanCategories(IDEA_CATEGORIES, null)).toBeUndefined();
  });
  it("keeps known keys only, no repeats, at most three", () => {
    expect(cleanCategories(IDEA_CATEGORIES, ["tech", "x", "tech", "health", "science", "learning"])).toEqual(["tech", "health", "science"]);
  });
  it("reaches the idea model: sorted ideas carry them, unsorted ones don't", () => {
    const row = { id: "abcdef1", name: "A", message: "m", stage: "idea" };
    expect(cleanIdea({ ...row, categories: ["food-drink"] })?.categories).toEqual(["food-drink"]);
    expect(cleanIdea({ ...row, categories: [] })?.categories).toEqual([]);
    expect(cleanIdea({ ...row, categories: null })).not.toHaveProperty("categories");
  });
});

describe("the categorize function", () => {
  function fakes(stored: Stored | null | "error", answers: Record<string, unknown> | null = { tech: 0.9, science: 0.6 }, saves = true) {
    const calls = { ask: [] as string[], save: [] as [string, string[]][] };
    const deps: CategorizeDeps = {
      load: async () => stored,
      ask: async (state) => { calls.ask.push(state); return answers; },
      save: async (id, c) => { calls.save.push([id, c]); return saves; },
    };
    return { deps, calls };
  }
  const run = (body: unknown, f: ReturnType<typeof fakes>) => categorize(body, IDEA_CATEGORIES, f.deps);

  it("asks Jev about the stored text (never the caller's), saves and returns the categories", async () => {
    const f = fakes({ message: "Telescope app for kids", categories: null });
    expect(await run({ id: "abcdef1", message: "spoofed" }, f)).toEqual({ status: 200, categories: ["tech", "science"] });
    expect(f.calls.ask).toEqual(["Telescope app for kids"]);
    expect(f.calls.save).toEqual([["abcdef1", ["tech", "science"]]]);
  });
  it("sorts an idea only once: an already sorted idea costs no Jev call", async () => {
    const f = fakes({ message: "m", categories: ["health"] });
    expect(await run({ id: "abcdef1" }, f)).toEqual({ status: 200, categories: ["health"] });
    expect(f.calls.ask).toEqual([]);
  });
  it("saves an empty list when nothing fits, so it isn't asked again", async () => {
    const f = fakes({ message: "m", categories: null }, { tech: 0.1 });
    expect(await run({ id: "abcdef1" }, f)).toEqual({ status: 200, categories: [] });
    expect(f.calls.save).toEqual([["abcdef1", []]]);
  });
  it("refuses a bad id without touching the database or Jev", async () => {
    const f = fakes({ message: "m", categories: null });
    expect(await run({ id: "../ideas" }, f)).toEqual({ status: 400, categories: null });
    expect(await run(null, f)).toEqual({ status: 400, categories: null });
    expect(f.calls.ask).toEqual([]);
  });
  it("says so when there is no such idea, or the database or Jev can't be reached, and saves nothing", async () => {
    expect(await run({ id: "abcdef1" }, fakes(null))).toEqual({ status: 404, categories: null });
    expect(await run({ id: "abcdef1" }, fakes("error"))).toEqual({ status: 502, categories: null, failed: "read" });
    const jevDown = fakes({ message: "m", categories: null }, null);
    expect(await run({ id: "abcdef1" }, jevDown)).toEqual({ status: 502, categories: null, failed: "jev" });
    expect(jevDown.calls.save).toEqual([]);
    expect(await run({ id: "abcdef1" }, fakes({ message: "m", categories: null }, { tech: 0.9 }, false))).toEqual({ status: 502, categories: null, failed: "save" });
  });
  it("reads Jev's noul answers and nothing else", () => {
    expect(noulAnswers({ answers: { tech: { type: "noul", noul: 0.8 }, odd: { type: "choice", choice: "x" }, bad: { noul: "high" } } })).toEqual({ tech: 0.8 });
    expect(noulAnswers({ error: "nope" })).toBeNull();
  });
});

describe("the site's categorizer", () => {
  const respond = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  it("posts the idea id to the function and returns its categories", async () => {
    let seen: { url: string; body: string } | null = null;
    const fetchFake = (async (url: string, init: RequestInit) => { seen = { url, body: String(init.body) }; return new Response(JSON.stringify({ categories: ["tech"] })); }) as unknown as typeof fetch;
    expect(await supabaseCategorizer({ url: "https://x.supabase.co", key: "sb_publishable_k", fetch: fetchFake }).categorize("abcdef1")).toEqual(["tech"]);
    expect(seen).toEqual({ url: "https://x.supabase.co/functions/v1/categorize", body: '{"id":"abcdef1"}' });
  });
  it("answers null when the function fails or the network does", async () => {
    expect(await supabaseCategorizer({ url: "u", key: "k", fetch: respond(502, { categories: null }) }).categorize("abcdef1")).toBeNull();
    const broken = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await supabaseCategorizer({ url: "u", key: "k", fetch: broken }).categorize("abcdef1")).toBeNull();
  });
});
