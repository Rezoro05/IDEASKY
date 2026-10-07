/** Site-wide facts and service endpoints. Public by design (no secrets here). */
export const SITE = {
  name: "Sky of Ideas", // the owner renamed IDEA SKY on 2026-10-07; the web address stays .../IDEASKY/
  url: "https://rezoro05.github.io/IDEASKY/",
} as const;

/** The Sea of Dreams, below the sky. Copy written by Claude, for the owner to review. */
export const SEA = {
  headline: "Sea of Dreams",
  lede: "Dreams people had, set free to swim. Share yours and watch it find its school.",
} as const;

export const HERO = {
  headline: "Sky of Ideas",
  lede: "Idea without execution is just a thought exercise. Let yours fly into this sky as a bird, where anyone can catch it, read it, and maybe bring it to life.",
} as const;

/* Services come from the build environment, so nothing points at a real service by accident.
   Unset (local runs): the board lives in memory and nothing is emailed. The browser tests set fake addresses and intercept them. */

/** Every idea and comment is emailed to the platform owner here. */
export const FORMSPREE_ENDPOINT: string = import.meta.env.PUBLIC_FORMSPREE_ENDPOINT ?? "";

/** Public idea board. The publishable key is meant to be public; database rules decide what it can do. */
/** Build flag: start an empty in-memory board with five example ideas, one or more per stage. */
export const DEMO_IDEAS = import.meta.env.PUBLIC_DEMO_IDEAS === "1";

/** Build flag: show idea stages (Idea → In Progress → Live) as forms in the sky and as the stage bar on an open idea.
 *  Off for the public board (owner, 2026-10-07): every idea is a bird, and there is no stage bar. */
export const SHOW_STAGES = import.meta.env.PUBLIC_SHOW_STAGES === "1";

export const PUBLIC_BOARD = {
  url: (import.meta.env.PUBLIC_BOARD_URL ?? "") as string,
  key: (import.meta.env.PUBLIC_BOARD_KEY ?? "") as string,
} as const;

export type PageMeta = { title: string; description: string };
export const PAGE_META: Record<"home" | "notFound", PageMeta> = {
  home: { title: "Sky of Ideas · Share ideas, bring them to life", description: HERO.lede },
  notFound: { title: "Page not found · Sky of Ideas", description: HERO.lede },
};
