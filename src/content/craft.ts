/** Craft page: key visual, ads and print work from the ABK years. */

export const CRAFT_INTRO = "Before building products, I spent years making campaigns land at ABK, a small but influential agency: strategy, copy and production, from brief to broadcast.";

export const KEY_WORK = {
  img: { src: "craft/print-cyl-georgia.jpg", w: 991, h: 1400, alt: "Print ad: a woman irons a mountain landscape on an ironing board; Georgia is a small country but if you iron it, it will be bigger than the USA" },
  chip: "Bronze · Cannes Young Lions Georgia 2017",
  text: "A print to promote Georgia in a positive light. Copywriter and creative strategy.",
} as const;

export type Ad = { youtubeId: string; title: string; brief: string; role: string };
export const ADS_NOTE = "20+ productions; the team won national awards in craft and film.";
/** The first ad is featured (larger tile). */
export const ADS: readonly Ad[] = [
  { youtubeId: "k3YcXqnPyA8", title: "Ministry of Internal Affairs", brief: "A film encouraging women facing domestic violence to work with local police.", role: "Creative strategy · Production" },
  { youtubeId: "qAVsTncnyTE", title: "Betlive", brief: "A fast-cut launch film for a sports-betting platform.", role: "Creative strategy · Production" },
  { youtubeId: "fUr06OnEshE", title: "Betlive 2", brief: "The oldest slot machine, reintroduced.", role: "Creative strategy · Production" },
  { youtubeId: "I_IppdYDLIk", title: "Alpina", brief: "Why children's paint is made differently: safe, non-toxic, made for exploring.", role: "Creative strategy · Asst. production" },
  { youtubeId: "UujI_u-3DZg", title: "Caparol, spring 2017", brief: "The daily cost of an uninsulated home, told through one family.", role: "Production" },
  { youtubeId: "GOa8sQ7KfFE", title: "Kharizma", brief: "After-party, parents home early. Kharizma has you covered.", role: "Creative strategy · Production" },
];

export type Print = { img: { src: string; w: number; h: number; alt: string }; chip: string; title: string; brief: string; role: string };
export const PRINTS: readonly Print[] = [
  { img: { src: "craft/print-cyl-litter.jpg", w: 990, h: 1400, alt: "Print ad: a dog made of litter under the line Don’t domesticate trash, common space littering is contagious" }, chip: "Near win", title: "Cannes Young Lions Georgia 2018", brief: "Litter adds up into something big. Keep it clean.", role: "Copywriter · Creative strategy" },
  { img: { src: "about/print-acag.jpg", w: 801, h: 1133, alt: "Print ad: a dragon lies across a dam, draining a mountain lake into cracked, burning earth" }, chip: "Print", title: "ACAG", brief: "The environmental threat of a hydro plant project.", role: "Creative strategy" },
];

export const CREDENTIAL = "Production Management course, June 2017, with Rebecca Rivo.";
