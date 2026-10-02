import { describe, it, expect } from "vitest";
import { cleanNote, notesFromDocs, newestNotes, ideaNumbers, validateDraft, newNoteId, previewLine, letterDateLine, canRemove, noteSlug, isNoteSlug, noteIdFromSlug, ideaName, NOTE_LIMITS, type Note } from "../../src/lib/notes";

const n = (id: string, at: number, extra: Partial<Note> = {}): Note => ({ id, name: "A", message: "m", at, ...extra });

describe("cleanNote", () => {
  it("rejects bad ids, empty messages and non-objects", () => {
    expect(cleanNote(null)).toBeNull();
    expect(cleanNote({ id: "BAD!", message: "x" })).toBeNull();
    expect(cleanNote({ id: "abcdef", message: "   " })).toBeNull();
  });
  it("trims, caps lengths and names anonymous authors", () => {
    const c = cleanNote({ id: "abcdef", name: "  ", message: " hi ".padEnd(800, "x"), at: "5" }, "u1")!;
    expect(c.name).toBe("Anonymous");
    expect(c.message.length).toBe(NOTE_LIMITS.message);
    expect(c.at).toBe(5);
    expect(c.owner).toBe("u1");
  });
});

describe("collections", () => {
  it("notesFromDocs flattens per-visitor docs and drops junk", () => {
    const m = notesFromDocs([{ owner: "u1", items: [{ id: "aaaaaa", message: "x" }, { id: "!" }] }, { owner: "u2" }]);
    expect([...m.keys()]).toEqual(["aaaaaa"]);
    expect(m.get("aaaaaa")!.owner).toBe("u1");
  });
  it("newestNotes sorts newest first and caps", () => {
    expect(newestNotes([n("a", 1), n("b", 3), n("c", 2)], 2).map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("idea numbers: oldest is 1, and numbers stay stable when one is removed", () => {
    const all = [n("c", 30), n("a", 10), n("b", 20), n("d", 20)];
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
      .toEqual({ ok: true, note: { name: "Nino", message: "idea" }, email: "half@" });
  });
});

describe("small helpers", () => {
  it("ids, slugs, names, preview lines and dates", () => {
    expect(newNoteId(new Uint8Array([0, 35, 36, 71]))).toBe("0z0z");
    expect(noteIdFromSlug(noteSlug("abc123"))).toBe("abc123");
    expect(isNoteSlug("note-x")).toBe(true);
    expect(isNoteSlug("econsul")).toBe(false);
    expect(ideaName(3)).toBe("Idea3");
    expect(previewLine("x".repeat(100))).toHaveLength(90);
    expect(previewLine("short")).toBe("short");
    expect(letterDateLine(n("a", 0, { name: "Nino" }), () => "Oct 1")).toBe("From Nino");
    expect(letterDateLine(n("a", 1, { name: "Nino" }), () => "Oct 1")).toBe("From Nino · Oct 1");
  });
});

describe("canRemove", () => {
  const note = n("a", 1, { owner: "u1" });
  it("public board: only with this browser's key", () => {
    expect(canRemove(note, { mode: "public", hasKey: true })).toBe(true);
    expect(canRemove(note, { mode: "public", hasKey: false })).toBe(false);
  });
  it("preview board: the owner or the author", () => {
    expect(canRemove(note, { mode: "claude", isOwner: true, uid: "x" })).toBe(true);
    expect(canRemove(note, { mode: "claude", isOwner: false, uid: "u1" })).toBe(true);
    expect(canRemove(note, { mode: "claude", isOwner: false, uid: "u2" })).toBe(false);
    expect(canRemove(note, { mode: "claude", isOwner: false, uid: null })).toBe(false);
  });
  it("no board: nobody", () => expect(canRemove(note, { mode: "none" })).toBe(false));
});
