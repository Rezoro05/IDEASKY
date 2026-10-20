/** Site-wide facts and service endpoints. Public by design (no secrets here). */
export const SITE = {
  name: "Sky of Ideas", // the owner renamed IDEA SKY on 2026-10-07; the web address stays .../IDEASKY/
  url: "https://rezoro05.github.io/IDEASKY/",
} as const;

/** The Sea of Dreams, below the sky. Copy written by Claude, for the owner to review. */
export const SEA = {
  headline: "Sea of Dreams",
  lede: "Dreams people had, set free to swim. Share yours and watch it find its school.",
  /** Signed in, in your own sea. */
  mineLede: "Your own sea. Dreams you share here are private: only you can see them.",
} as const;

export const HERO = {
  headline: "Sky of Ideas",
  lede: "Idea without execution is just a thought exercise. Let yours fly into this sky as a bird, where anyone can catch it, read it, and maybe bring it to life.",
  /** Signed in, in your own sky. */
  mineLede: "Your own sky. Ideas you share here are private: only you can see them.",
} as const;

/* Services come from the build environment, so nothing points at a real service by accident.
   Unset (local runs): the board lives in memory and nothing is emailed (the board emails the owner: supabase/functions/notify). The browser tests set fake addresses and intercept them. */

/** Public idea board. The publishable key is meant to be public; database rules decide what it can do. */
/** Build flag: start an empty in-memory board with five example ideas, one or more per stage. */
export const DEMO_IDEAS = import.meta.env.PUBLIC_DEMO_IDEAS === "1";

/** Build flag: show idea stages (Idea → In Progress → Live) as forms in the sky and as the stage bar on an open idea.
 *  Off for the public board (owner, 2026-10-07): every idea is a bird, and there is no stage bar. */
export const SHOW_STAGES = import.meta.env.PUBLIC_SHOW_STAGES === "1";

/** Build flag: the 3D backgrounds (skyline and deep sea as gaussian splats). On unless PUBLIC_SCENE=0 (the browser-test builds turn it off,
 *  so the other tests don't pay for it; the studio can still turn it on in that browser). */
export const SCENE_ON = import.meta.env.PUBLIC_SCENE !== "0";

export const PUBLIC_BOARD = {
  url: (import.meta.env.PUBLIC_BOARD_URL ?? "") as string,
  key: (import.meta.env.PUBLIC_BOARD_KEY ?? "") as string,
} as const;

export type PageMeta = { title: string; description: string };
export const PAGE_META: Record<"home" | "notFound", PageMeta> = {
  home: { title: "Sky of Ideas · Share ideas, bring them to life", description: HERO.lede },
  notFound: { title: "Page not found · Sky of Ideas", description: HERO.lede },
};
