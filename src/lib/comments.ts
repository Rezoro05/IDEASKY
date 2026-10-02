/** Pure rules for comments on visitor ideas. */
import { ANONYMOUS, IDEA_LIMITS, isRecordId } from "./ideas";

export type Comment = { id: string; ideaId: string; name: string; message: string; at: number };
export type CommentDraft = { name: string; message: string; trap: string };
export type CommentCheck =
  | { ok: true; comment: Pick<Comment, "name" | "message"> }
  | { ok: false; reason: "empty"; text: string }
  | { ok: false; reason: "bot" };

export const COMMENT_LIMITS = { name: IDEA_LIMITS.name, message: 400, perIdea: 100 } as const;

/** Untrusted data in, a safe comment (or null) out. */
export function cleanComment(raw: unknown): Comment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isRecordId(r.id) || !isRecordId(r.ideaId)) return null;
  const message = typeof r.message === "string" ? r.message.trim().slice(0, COMMENT_LIMITS.message) : "";
  if (!message) return null;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, COMMENT_LIMITS.name) : "";
  return { id: r.id, ideaId: r.ideaId, name: name || ANONYMOUS, message, at: Number(r.at) || 0 };
}

/** One idea's comments, oldest first (ties by id, so the order never flickers). */
export function threadFor(comments: Iterable<Comment>, ideaId: string): Comment[] {
  return [...comments].filter((c) => c.ideaId === ideaId).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

export function validateCommentDraft(d: CommentDraft): CommentCheck {
  if (d.trap) return { ok: false, reason: "bot" };
  const message = d.message.trim().slice(0, COMMENT_LIMITS.message);
  if (!message) return { ok: false, reason: "empty", text: "Write your comment first." };
  return { ok: true, comment: { name: d.name.trim().slice(0, COMMENT_LIMITS.name) || ANONYMOUS, message } };
}

export const commentCountLabel = (n: number): string => (n === 0 ? "No comments yet" : n === 1 ? "1 comment" : `${n} comments`);
