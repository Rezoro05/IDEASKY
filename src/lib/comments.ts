/** Pure rules for comments on visitor ideas. */
import { ANONYMOUS, NOTE_LIMITS } from "./notes";

export type Comment = { id: string; ideaId: string; name: string; message: string; at: number; owner?: string };
export type CommentDraft = { name: string; message: string; trap: string };
export type CommentCheck =
  | { ok: true; comment: Pick<Comment, "name" | "message"> }
  | { ok: false; reason: "empty"; text: string }
  | { ok: false; reason: "bot" };

export const COMMENT_LIMITS = { name: NOTE_LIMITS.name, message: 400, perIdea: 100, perPerson: 30 } as const;
const ID = /^[a-z0-9]{6,20}$/;

/** Untrusted data in, a safe comment (or null) out. */
export function cleanComment(raw: unknown, owner?: string): Comment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !ID.test(r.id)) return null;
  if (typeof r.ideaId !== "string" || !ID.test(r.ideaId)) return null;
  const message = typeof r.message === "string" ? r.message.trim().slice(0, COMMENT_LIMITS.message) : "";
  if (!message) return null;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, COMMENT_LIMITS.name) : "";
  const c: Comment = { id: r.id, ideaId: r.ideaId, name: name || ANONYMOUS, message, at: Number(r.at) || 0 };
  if (owner !== undefined) c.owner = owner;
  return c;
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
