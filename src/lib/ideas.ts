/** Pure rules for visitor ideas. */
import { checkLinkRows, cleanLinks, type Link, type LinkRow } from "./links";
import { stageOrIdea, type Stage } from "./stages";

export type Idea = { id: string; name: string; message: string; at: number; stage: Stage; links: Link[] };
export type Draft = { name: string; email: string; message: string; trap: string; linkRows: readonly LinkRow[] };
export type DraftCheck =
  | { ok: true; idea: Pick<Idea, "name" | "message" | "links">; email: string }
  | { ok: false; reason: "empty-message"; text: string }
  | { ok: false; reason: "bad-link"; row: number; text: string }
  | { ok: false; reason: "bot" };

export const IDEA_LIMITS = { name: 40, message: 600, inSky: 8 } as const;
export const ANONYMOUS = "Anonymous";
const RECORD_ID = /^[a-z0-9]{6,20}$/;

export const isRecordId = (id: unknown): id is string => typeof id === "string" && RECORD_ID.test(id);
export const ideaName = (num: number | undefined): string => "Idea" + (num ?? "");

/** Untrusted data in, a safe idea (or null) out. */
export function cleanIdea(raw: unknown): Idea | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isRecordId(r.id)) return null;
  const message = typeof r.message === "string" ? r.message.trim().slice(0, IDEA_LIMITS.message) : "";
  if (!message) return null;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, IDEA_LIMITS.name) : "";
  return { id: r.id, name: name || ANONYMOUS, message, at: Number(r.at) || 0, stage: stageOrIdea(r.stage), links: cleanLinks(r.links) };
}

export function newestIdeas(ideas: Iterable<Idea>, max: number): Idea[] {
  return [...ideas].sort((a, b) => b.at - a.at).slice(0, max);
}

/** Idea1 is the oldest; ties broken by id so numbers never flicker. */
export function ideaNumbers(ideas: Iterable<Idea>): Map<string, number> {
  const sorted = [...ideas].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  return new Map(sorted.map((n, i) => [n.id, i + 1]));
}

export function validateDraft(d: Draft): DraftCheck {
  if (d.trap) return { ok: false, reason: "bot" };
  const message = d.message.trim().slice(0, IDEA_LIMITS.message);
  if (!message) return { ok: false, reason: "empty-message", text: "Write your idea first." };
  const links = checkLinkRows(d.linkRows);
  if (!links.ok) return { ok: false, reason: "bad-link", row: links.row, text: links.text };
  return { ok: true, idea: { name: d.name.trim().slice(0, IDEA_LIMITS.name) || ANONYMOUS, message, links: links.links }, email: d.email.trim() };
}

/** Ids for ideas and comments alike. */
export function newRecordId(bytes: Uint8Array): string {
  return [...bytes].map((b) => (b % 36).toString(36)).join("");
}

export function previewLine(message: string, max = 90): string {
  return message.length > max ? message.slice(0, max - 1) + "…" : message;
}

export function letterDateLine(idea: Idea, formatDate: (at: number) => string): string {
  return ["From " + idea.name, idea.at ? formatDate(idea.at) : ""].filter(Boolean).join(" · ");
}
