import { describe, it, expect } from "vitest";
import { FEEDBACK_LIMITS, validateFeedbackDraft } from "../../src/lib/feedback";

const draft = { message: "Love it", email: "", trap: "" };

describe("validateFeedbackDraft", () => {
  it("accepts a message, trimmed, with the email optional", () => {
    expect(validateFeedbackDraft({ ...draft, message: "  Love it \n", email: " a@b.c " })).toEqual({ ok: true, feedback: { message: "Love it", email: "a@b.c" } });
    expect(validateFeedbackDraft(draft)).toEqual({ ok: true, feedback: { message: "Love it", email: "" } });
  });
  it("asks for the feedback when it is empty", () => {
    expect(validateFeedbackDraft({ ...draft, message: "   " })).toEqual({ ok: false, reason: "empty-message", text: "Write your feedback first." });
  });
  it("treats a filled bot trap as a bot, before anything else", () => {
    expect(validateFeedbackDraft({ ...draft, message: "", trap: "http://spam" })).toEqual({ ok: false, reason: "bot" });
  });
  it("cuts the message and the email at their limits", () => {
    const r = validateFeedbackDraft({ ...draft, message: "x".repeat(5000), email: "e".repeat(500) });
    expect(r.ok && r.feedback.message.length).toBe(FEEDBACK_LIMITS.message);
    expect(r.ok && r.feedback.email.length).toBe(FEEDBACK_LIMITS.email);
  });
});
