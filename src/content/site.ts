/** Site-wide facts and service endpoints. Public by design (no secrets here). */
export const SITE = {
  name: "IDEA SKY",
  url: "https://rezoro05.github.io/IDEASKY/",
} as const;

export const HERO = {
  headline: "Ideas are everywhere.",
  lede: "But an idea without execution is just a thought exercise. Fold yours into a paper plane and send it into this sky, where anyone can catch it, read it, and maybe bring it to life.",
} as const;

/* Services come from the build environment, so nothing points at a real service by accident.
   Unset (local runs): the board lives in memory and nothing is emailed. The browser tests set fake addresses and intercept them. */

/** Every idea and comment is emailed to the platform owner here. */
export const FORMSPREE_ENDPOINT: string = import.meta.env.PUBLIC_FORMSPREE_ENDPOINT ?? "";

/** Public idea board. The publishable key is meant to be public; database rules decide what it can do. */
export const PUBLIC_BOARD = {
  url: (import.meta.env.PUBLIC_BOARD_URL ?? "") as string,
  key: (import.meta.env.PUBLIC_BOARD_KEY ?? "") as string,
} as const;

export type PageMeta = { title: string; description: string };
export const PAGE_META: Record<"home" | "notFound", PageMeta> = {
  home: { title: "IDEA SKY · Share ideas, bring them to life", description: HERO.lede },
  notFound: { title: "Page not found · IDEA SKY", description: HERO.lede },
};
