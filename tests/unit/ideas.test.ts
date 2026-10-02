import { describe, it, expect } from "vitest";
import { cleanIdea, newestIdeas, ideaNumbers, validateDraft, newRecordId, previewLine, letterDateLine, isRecordId, ideaName, IDEA_LIMITS, type Idea } from "../../src/lib/ideas";

const idea = (id: string, at: number, extra: Partial<Idea> = {}): Idea => ({ id, name: "A", message: "m", at, ...extra });

describe("cleanIdea", () => {
  it("rejects bad ids, empty messages and non-objects", () => {
    expect(cleanIdea(null)).toBeNull();
    expect(cleanIdea({ id: "BAD!", message: "x" })).toBeNull();
    expect(cleanIdea({ id: "abcdef", message: "   " })).toBeNull();
  });
  it("trims, caps lengths and names anonymous authors", () => {
    const c = cleanIdea({ id: "abcdef", name: "  ", message: " hi ".padEnd(800, "x"), at: "5" })!;
    expect(c.name).toBe("Anonymous");
    expect(c.message.length).toBe(IDEA_LIMITS.message);
    expect(c.at).toBe(5);
  });
});

describe("collections", () => {
  it("newestIdeas sorts newest first and caps", () => {
    expect(newestIdeas([idea("a", 1), idea("b", 3), idea("c", 2)], 2).map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("idea numbers: oldest is 1, and numbers stay stable when one is removed", () => {
    const all = [idea("c", 30), idea("a", 10), idea("b", 20), idea("d", 20)];
    const nums = ideaNumbers(all);
    expect([nums.get("a"), nums.get("b"), nums.get("d"), nums.get("c")]).toEqual([1, 2, 3, 4]);
    const after = ideaNumbers(all.filter((x) => x.id !== "c")); // newest removed: others unchanged
    expect([after.get("a"), after.get("b"), after.get("d")]).toEqual([1, 2, 3]);
  });
});

describe("validateDraft", () => {
  const draft = { name: "", email: "", message: "", trap: "" };
  it("needs a message", () => expect(validateDraft(draft)).toEqual({ ok: false, reason: "empty-message", text: "Write your idea first." }));
  it("catches the bot trap first", () => expect(validateDraft({ ...draft, message: "x", trap: "spam" })).toEqual({ ok: false, reason: "bot" }));
  it("accepts any email, even incomplete", () => {
    expect(validateDraft({ ...draft, message: " idea ", email: " half@ ", name: " Nino " }))
      .toEqual({ ok: true, idea: { name: "Nino", message: "idea" }, email: "half@" });
  });
});

describe("small helpers", () => {
  it("ids, names, preview lines and dates", () => {
    expect(newRecordId(new Uint8Array([0, 35, 36, 71]))).toBe("0z0z");
    expect(isRecordId("abc123")).toBe(true);
    expect(isRecordId("ABC")).toBe(false);
    expect(isRecordId(7)).toBe(false);
    expect(ideaName(3)).toBe("Idea3");
    expect(previewLine("x".repeat(100))).toHaveLength(90);
    expect(previewLine("short")).toBe("short");
    expect(letterDateLine(idea("a", 0, { name: "Nino" }), () => "Oct 1")).toBe("From Nino");
    expect(letterDateLine(idea("a", 1, { name: "Nino" }), () => "Oct 1")).toBe("From Nino · Oct 1");
  });
});
