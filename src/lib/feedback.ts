/** Pure rules for feedback sent to the platform owner. It is private: it goes to the owner's email and is never shown on the site. */
export type Feedback = { message: string; email: string };
export type FeedbackDraft = { message: string; email: string; trap: string };
export type FeedbackCheck =
  | { ok: true; feedback: Feedback }
  | { ok: false; reason: "empty-message"; text: string }
  | { ok: false; reason: "bot" };

export const FEEDBACK_LIMITS = { message: 1000, email: 120 } as const;

export function validateFeedbackDraft(d: FeedbackDraft): FeedbackCheck {
  if (d.trap) return { ok: false, reason: "bot" };
  const message = d.message.trim().slice(0, FEEDBACK_LIMITS.message);
  if (!message) return { ok: false, reason: "empty-message", text: "Write your feedback first." };
  return { ok: true, feedback: { message, email: d.email.trim().slice(0, FEEDBACK_LIMITS.email) } };
}
