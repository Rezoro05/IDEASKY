/** The drawing of a dream: a line fish facing right, in the birds' bold raised-line style (lib/line-art), after the owner's mural:
 *  spiral eye, gill arcs, and one of three patterns (scales, flowing lines, big fins). The tail is its own group, so it can sway.
 *  Coloured by the school in site.css. Pure: SVG strings. */
import { raised, spiral, svgBox } from "./line-art";

const BODY = "M112,33 C100,11 58,9 30,31 C58,53 100,55 112,33";
const TAIL = `<g class="fish-tail">${raised(`<path d="M31,31 L10,13 Q20,32 10,51 L31,31"/>`)}</g>`;
const HEAD = `<path d="${BODY}"/><path d="M112,33 L103,36"/><path d="M84,15 Q75,33 84,51"/><path d="M89,16 Q81,33 89,50"/>` + spiral(100, 29, 0.85);
const SCALES = [[79, [21, 29, 37, 45]], [71, [19, 27, 35, 43]], [63, [22, 30, 38]]] as const;
const scales = `<path d="${SCALES.flatMap(([x, ys]) => ys.map((y) => `M${x},${y - 4} a4,4 0 0 0 0,8`)).join(" ")}"/>`;

export const FISH_PATTERNS = {
  scales,
  lines: `<path d="M40,37 Q60,43 80,37"/><path d="M50,35 Q64,38 76,34"/>`,
  fins: `<path d="M58,16 L64,4 L76,14"/><path d="M60,47 L54,59 L72,49"/><path d="M64,27 L77,26 L77,34 L66,33 Z"/><path d="M68,30 L75,30"/>`,
} as const;
export type FishPattern = keyof typeof FISH_PATTERNS;

/** A fish with the given pattern. */
export const fishSvg = (pattern: FishPattern): string => svgBox(TAIL + raised(HEAD + FISH_PATTERNS[pattern], BODY));

/** Which pattern a dream's fish wears: fixed by its id, so it is the same fish every visit. */
export const patternFor = (id: string): FishPattern => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (["scales", "lines", "fins"] as const)[h % 3];
};

/** The plain fish (a new dream being sent, a letter flying home). */
export const FISH_SVG = fishSvg("scales");
