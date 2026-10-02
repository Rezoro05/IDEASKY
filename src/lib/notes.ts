/** Pure rules for visitor idea notes. */

export type Note = { id: string; name: string; message: string; at: number; owner?: string };
export type Draft = { name: string; email: string; message: string; trap: string };
export type DraftCheck =
  | { ok: true; note: Pick<Note, "name" | "message">; email: string }
  | { ok: false; reason: "empty-message"; text: string }
  | { ok: false; reason: "bot" };

export const NOTE_LIMITS = { name: 40, message: 600, perPerson: 5, inSky: 8 } as const;
export const ANONYMOUS = "Anonymous";
const NOTE_ID = /^[a-z0-9]{6,20}$/;

export const noteSlug = (id: string): string => "note-" + id;
export const isNoteSlug = (slug: string): boolean => slug.startsWith("note-");
export const noteIdFromSlug = (slug: string): string => slug.slice("note-".length);
export const ideaName = (num: number | undefined): string => "Idea" + (num ?? "");

/** Untrusted data in, a safe note (or null) out. */
export function cleanNote(raw: unknown, owner?: string): Note | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !NOTE_ID.test(r.id)) return null;
  const message = typeof r.message === "string" ? r.message.trim().slice(0, NOTE_LIMITS.message) : "";
  if (!message) return null;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, NOTE_LIMITS.name) : "";
  const note: Note = { id: r.id, name: name || ANONYMOUS, message, at: Number(r.at) || 0 };
  if (owner !== undefined) note.owner = owner;
  return note;
}

/** The claude.ai store keeps one doc per visitor holding their notes. */
export function notesFromDocs(docs: readonly { owner: string; items?: readonly unknown[] }[]): Map<string, Note> {
  const out = new Map<string, Note>();
  for (const d of docs) for (const raw of d.items ?? []) {
    const n = cleanNote(raw, d.owner);
    if (n) out.set(n.id, n);
  }
  return out;
}

export function newestNotes(notes: Iterable<Note>, max: number): Note[] {
  return [...notes].sort((a, b) => b.at - a.at).slice(0, max);
}

/** Idea1 is the oldest; ties broken by id so numbers never flicker. */
export function ideaNumbers(notes: Iterable<Note>): Map<string, number> {
  const sorted = [...notes].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  return new Map(sorted.map((n, i) => [n.id, i + 1]));
}

export function validateDraft(d: Draft): DraftCheck {
  if (d.trap) return { ok: false, reason: "bot" };
  const message = d.message.trim().slice(0, NOTE_LIMITS.message);
  if (!message) return { ok: false, reason: "empty-message", text: "Write your idea first." };
  return { ok: true, note: { name: d.name.trim().slice(0, NOTE_LIMITS.name) || ANONYMOUS, message }, email: d.email.trim() };
}

export function newNoteId(bytes: Uint8Array): string {
  return [...bytes].map((b) => (b % 36).toString(36)).join("");
}

export function previewLine(message: string, max = 90): string {
  return message.length > max ? message.slice(0, max - 1) + "…" : message;
}

export function letterDateLine(note: Note, formatDate: (at: number) => string): string {
  return ["From " + note.name, note.at ? formatDate(note.at) : ""].filter(Boolean).join(" · ");
}

/** Who may see "Remove this idea". */
export function canRemove(
  note: Note,
  who: { mode: "public"; hasKey: boolean } | { mode: "claude"; isOwner: boolean; uid: string | null } | { mode: "none" },
): boolean {
  if (who.mode === "public") return who.hasKey;
  if (who.mode === "claude") return who.isOwner || (!!who.uid && note.owner === who.uid);
  return false;
}
