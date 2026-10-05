/** Pure rules for comments on visitor ideas. */
import { ANONYMOUS, IDEA_LIMITS, isRecordId } from "./ideas";

/** parentId: the top-level comment a reply answers (replies go one level deep), or null for a top-level comment. */
export type Comment = { id: string; ideaId: string; parentId: string | null; name: string; message: string; at: number };
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
  const parentId = isRecordId(r.parentId) && r.parentId !== r.id ? r.parentId : null;
  return { id: r.id, ideaId: r.ideaId, parentId, name: name || ANONYMOUS, message, at: Number(r.at) || 0 };
}

/** One idea's comments, oldest first (ties by id, so the order never flickers). */
export function threadFor(comments: Iterable<Comment>, ideaId: string): Comment[] {
  return [...comments].filter((c) => c.ideaId === ideaId).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

/** A top-level comment and the replies to it. */
export type CommentGroup = { comment: Comment; replies: Comment[] };

/** One idea's comments as groups: top-level comments oldest first, each with its replies oldest first.
 *  A reply whose comment isn't in the list (removed, or not loaded) shows on its own rather than vanishing. */
export function commentGroups(comments: Iterable<Comment>, ideaId: string): CommentGroup[] {
  const ordered = threadFor(comments, ideaId);
  const tops = new Map(ordered.filter((c) => c.parentId === null || !ordered.some((p) => p.id === c.parentId && p.parentId === null)).map((c) => [c.id, { comment: c, replies: [] as Comment[] }]));
  for (const c of ordered) if (!tops.has(c.id) && c.parentId) tops.get(c.parentId)?.replies.push(c);
  return [...tops.values()];
}

/** The comment a reply is filed under: the one answered, or, when answering a reply, that reply's own comment. */
export const replyParent = (target: Comment): string => target.parentId ?? target.id;

/** How many times each id appears (used to count likes per comment from one query). */
export function tally(ids: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of ids) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

export function validateCommentDraft(d: CommentDraft): CommentCheck {
  if (d.trap) return { ok: false, reason: "bot" };
  const message = d.message.trim().slice(0, COMMENT_LIMITS.message);
  if (!message) return { ok: false, reason: "empty", text: "Write your comment first." };
  return { ok: true, comment: { name: d.name.trim().slice(0, COMMENT_LIMITS.name) || ANONYMOUS, message } };
}

