/** What the `categorize` function does, with the outside world (database, Jev) passed in, so it can be tested without either.
 *  Rules: the text comes from the database, never from the caller; an idea is sorted once ([] means "checked, nothing fits");
 *  anything that goes wrong answers `categories: null` and leaves the idea as it was. Import-free apart from the shared list. */
import { categoryQuestions, pickCategories, type Category } from "./categories.ts";

export type Stored = { message: string; categories: unknown };
export type CategorizeDeps = {
  /** The record's text and current categories; null if there is no such record; "error" if the database can't be read. */
  load(id: string): Promise<Stored | null | "error">;
  /** Jev's answers for these yes/no questions about `state` (question key → probability), or null if Jev can't be reached. */
  ask(state: string, questions: ReturnType<typeof categoryQuestions>): Promise<Record<string, unknown> | null>;
  /** Saves the categories if the record has none yet. False if the database refused. */
  save(id: string, categories: string[]): Promise<boolean>;
};
export type Reply = { status: number; categories: string[] | null };

const RECORD_ID = /^[a-z0-9]{6,20}$/;

export async function categorize(body: unknown, list: readonly Category[], deps: CategorizeDeps): Promise<Reply> {
  const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
  if (typeof id !== "string" || !RECORD_ID.test(id)) return { status: 400, categories: null };
  const stored = await deps.load(id);
  if (stored === "error") return { status: 502, categories: null };
  if (stored === null) return { status: 404, categories: null };
  if (Array.isArray(stored.categories)) return { status: 200, categories: stored.categories.filter((k): k is string => typeof k === "string") }; // sorted already: no second Jev call
  const answers = await deps.ask(stored.message, categoryQuestions(list));
  if (!answers) return { status: 502, categories: null };
  const categories = pickCategories(list, answers);
  if (!(await deps.save(id, categories))) return { status: 502, categories: null };
  return { status: 200, categories };
}

/** Jev's response body → probability per question key (noul answers only). */
export function noulAnswers(json: unknown): Record<string, number> | null {
  const answers = json && typeof json === "object" ? (json as { answers?: unknown }).answers : undefined;
  if (!answers || typeof answers !== "object") return null;
  const out: Record<string, number> = {};
  for (const [key, a] of Object.entries(answers as Record<string, unknown>)) {
    const p = a && typeof a === "object" ? (a as { noul?: unknown }).noul : undefined;
    if (typeof p === "number" && Number.isFinite(p)) out[key] = p;
  }
  return out;
}
