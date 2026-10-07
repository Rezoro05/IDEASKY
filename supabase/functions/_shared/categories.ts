/** Categories for ideas and themes for dreams: the lists, the questions Jev is asked, and the rule that turns Jev's answers into at most three.
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

/** Themes for dreams (the Sea of Dreams): fish that share one swim together. */
export const DREAM_THEMES = [
  { key: "flying", label: "Flying", fits: "flying, floating, soaring, weightless" },
  { key: "falling", label: "Falling", fits: "falling, dropping, losing footing, sinking" },
  { key: "chased", label: "Being chased", fits: "being chased, hunted, followed, running away" },
  { key: "water", label: "Water", fits: "sea, rivers, rain, swimming, drowning, floods" },
  { key: "lost", label: "Lost", fits: "being lost, searching, missing something, late, can't find the way" },
  { key: "people", label: "People", fits: "family, friends, strangers, someone from the past, conversations" },
  { key: "places", label: "Places", fits: "houses, cities, schools, rooms, travel, places that change" },
  { key: "animals", label: "Animals", fits: "animals, creatures, pets, beasts" },
  { key: "strange", label: "Strange", fits: "surreal, impossible, absurd or magical things" },
  { key: "nightmare", label: "Nightmare", fits: "fear, danger, darkness, death, something terrible" },
] as const satisfies readonly Category[];

/** What a record is: an idea in the sky, or a dream in the sea. Each has its own list. */
export type Kind = "idea" | "dream";
export const LISTS: Record<Kind, readonly Category[]> = { idea: IDEA_CATEGORIES, dream: DREAM_THEMES };
export const kindOf = (raw: unknown): Kind => (raw === "dream" ? "dream" : "idea");

/** How Jev's yes/no answers become categories: up to `max` with probability at least `fits`. Nothing reaching it means no category
 *  (owner's choice: no "best guess", which tagged gibberish). */
export const PICK = { max: 3, fits: 0.5 } as const;

/** One yes/no question per category, all asked in one Jev call. Question ids are the category keys (Jev never sees them). */
export function categoryQuestions(list: readonly Category[], kind: Kind = "idea"): Record<string, { type: "noul"; instructions: string }> {
  return Object.fromEntries(list.map((c) => [c.key, {
    type: "noul" as const,
    instructions: kind === "dream"
      ? `Is this dream about "${c.label}" (${c.fits})?`
      : `Does this idea belong in the category "${c.label}" (${c.fits})?`,
  }]));
}

/** Jev's answers (probability per category key) → the categories to keep, most likely first. Unknown keys and non-numbers are ignored. */
export function pickCategories(list: readonly Category[], probabilities: Readonly<Record<string, unknown>>, rule: { max: number; fits: number } = PICK): string[] {
  return list
    .map((c) => ({ key: c.key, p: probabilities[c.key] }))
    .filter((s): s is { key: string; p: number } => typeof s.p === "number" && Number.isFinite(s.p) && s.p >= rule.fits)
    .sort((a, b) => b.p - a.p)
    .slice(0, rule.max)
    .map((s) => s.key);
}

/** Stored categories (untrusted) → known keys only, at most `max`, no repeats. */
export function cleanCategories(list: readonly Category[], raw: unknown, max: number = PICK.max): string[] | undefined {
  if (!Array.isArray(raw)) return undefined; // not sorted yet
  const known = new Set(list.map((c) => c.key));
  return [...new Set(raw.filter((k): k is string => typeof k === "string" && known.has(k)))].slice(0, max);
}

export const categoryLabel = (list: readonly Category[], key: string): string => list.find((c) => c.key === key)?.label ?? key;
