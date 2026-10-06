/** Categories for ideas (and, later, themes for dreams): the list, the questions Jev is asked, and the rule that turns Jev's answers into at most three.
 *  Pure and import-free, so the site (Vite) and the Supabase Edge Function (Deno) share this one file. */

export type Category = { readonly key: string; readonly label: string; /** What fits, in words Jev reads. */ readonly fits: string };

export const IDEA_CATEGORIES = [
  { key: "tech", label: "Tech", fits: "software, apps, gadgets, hardware, AI, the internet" },
  { key: "food-drink", label: "Food & Drink", fits: "cooking, restaurants, recipes, drinks, groceries, eating together" },
  { key: "city-places", label: "City & Places", fits: "neighbourhoods, streets, transport, public spaces, buildings, local life" },
  { key: "health", label: "Health", fits: "body and mind, fitness, medicine, sleep, wellbeing, care" },
  { key: "learning", label: "Learning", fits: "education, schools, skills, teaching, books, courses" },
  { key: "business", label: "Business", fits: "companies, products to sell, money, work, jobs, services" },
  { key: "art-design", label: "Art & Design", fits: "art, design, music, film, photography, fashion, crafts" },
  { key: "social-good", label: "Social Good", fits: "helping people, community, charity, fairness, volunteering" },
  { key: "environment", label: "Environment", fits: "climate, nature, energy, recycling, animals and plants, pollution" },
  { key: "play-games", label: "Play & Games", fits: "fun, games, toys, sport for fun, hobbies, entertainment" },
  { key: "science", label: "Science", fits: "research, space, physics, biology, chemistry, discovery" },
] as const satisfies readonly Category[];

export type IdeaCategoryKey = (typeof IDEA_CATEGORIES)[number]["key"];

/** How Jev's yes/no answers become categories: up to `max` with probability at least `fits`; if none reaches it, the single best one if at least `bestFits`. */
export const PICK = { max: 3, fits: 0.5, bestFits: 0.3 } as const;

/** One yes/no question per category, all asked in one Jev call. Question ids are the category keys (Jev never sees them). */
export function categoryQuestions(list: readonly Category[]): Record<string, { type: "noul"; instructions: string }> {
  return Object.fromEntries(list.map((c) => [c.key, {
    type: "noul" as const,
    instructions: `Does this idea belong in the category "${c.label}" (${c.fits})?`,
  }]));
}

/** Jev's answers (probability per category key) → the categories to keep, most likely first. Unknown keys and non-numbers are ignored. */
export function pickCategories(list: readonly Category[], probabilities: Readonly<Record<string, unknown>>, rule: { max: number; fits: number; bestFits: number } = PICK): string[] {
  const scored = list
    .map((c) => ({ key: c.key, p: probabilities[c.key] }))
    .filter((s): s is { key: string; p: number } => typeof s.p === "number" && Number.isFinite(s.p))
    .sort((a, b) => b.p - a.p);
  const fitting = scored.filter((s) => s.p >= rule.fits).slice(0, rule.max);
  if (fitting.length > 0) return fitting.map((s) => s.key);
  const best = scored[0];
  return best && best.p >= rule.bestFits ? [best.key] : [];
}

/** Stored categories (untrusted) → known keys only, at most `max`, no repeats. */
export function cleanCategories(list: readonly Category[], raw: unknown, max: number = PICK.max): string[] | undefined {
  if (!Array.isArray(raw)) return undefined; // not sorted yet
  const known = new Set(list.map((c) => c.key));
  return [...new Set(raw.filter((k): k is string => typeof k === "string" && known.has(k)))].slice(0, max);
}

export const categoryLabel = (list: readonly Category[], key: string): string => list.find((c) => c.key === key)?.label ?? key;
