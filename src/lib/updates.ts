/** Pure rules for an owner's updates on their idea: dated notes with links, added over time. The idea itself never changes. */
import { isRecordId } from "./ideas";
import { checkLinkRows, cleanLinks, type Link, type LinkRow } from "./links";

export type Update = { id: string; ideaId: string; message: string; links: Link[]; at: number };
export type UpdateDraft = { message: string; linkRows: readonly LinkRow[] };
export type UpdateCheck =
  | { ok: true; update: Pick<Update, "message" | "links"> }
  | { ok: false; reason: "empty"; text: string }
  | { ok: false; reason: "bad-link"; row: number; text: string };

export const UPDATE_LIMITS = { message: 600, perIdea: 50 } as const;

/** Untrusted data in, a safe update (or null) out. */
export function cleanUpdate(raw: unknown): Update | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isRecordId(r.id) || !isRecordId(r.ideaId)) return null;
  const message = typeof r.message === "string" ? r.message.trim().slice(0, UPDATE_LIMITS.message) : "";
  if (!message) return null;
  return { id: r.id, ideaId: r.ideaId, message, links: cleanLinks(r.links), at: Number(r.at) || 0 };
}

/** One idea's updates, oldest first, so they read as the story since the idea (ties by id, so the order never flickers). */
export function updatesFor(updates: Iterable<Update>, ideaId: string): Update[] {
  return [...updates].filter((u) => u.ideaId === ideaId).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

export function validateUpdateDraft(d: UpdateDraft): UpdateCheck {
  const message = d.message.trim().slice(0, UPDATE_LIMITS.message);
  if (!message) return { ok: false, reason: "empty", text: "Write your update first." };
  const links = checkLinkRows(d.linkRows);
  if (!links.ok) return { ok: false, reason: "bad-link", row: links.row, text: links.text };
  return { ok: true, update: { message, links: links.links } };
}

export const updateCountLabel = (n: number): string => (n === 0 ? "No updates yet" : n === 1 ? "1 update" : `${n} updates`);
