/** Pure rules for browsing every idea or dream, not just the few in the sky or sea. */
import type { Idea } from "./ideas";
import type { Category } from "./categories";

/** How many older ones each "Show older" asks for. */
export const OLDER_PAGE = 30;

/** Numbers that never shift as more are loaded: the oldest of all is 1. `base` is how many older ones aren't loaded
 *  (the total at load time minus what was loaded, then less each older page). Unknown total: base 0. */
export function recordNumbers(records: Iterable<Idea>, base: number): Map<string, number> {
  const sorted = [...records].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const start = Math.max(0, base);
  return new Map(sorted.map((n, i) => [n.id, start + i + 1]));
}

/** What the list shows: newest first, only one category if one is chosen (null = all). */
export function browseList(records: Iterable<Idea>, category: string | null): Idea[] {
  return [...records].filter((n) => !category || (n.categories ?? []).includes(category)).sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));
}

/** The categories worth a chip: those at least one record has, in the list's own order. */
export function categoriesIn(records: Iterable<Idea>, list: readonly Category[]): Category[] {
  const present = new Set<string>();
  for (const n of records) for (const c of n.categories ?? []) present.add(c);
  return list.filter((c) => present.has(c.key));
}
