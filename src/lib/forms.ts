/** The drawing for each stage of an idea, all facing right so flight and orientation treat them alike.
 *  Bold raised lines (lib/line-art; owner, 2026-10-20), coloured by the flock in site.css. Bird: its wings are groups the sky moves (lib/bird-pose). */
import type { Stage } from "./stages";
import { raised, spiral, svgBox } from "./line-art";

/** In Progress: a folded paper plane, two wings and the fold between them. */
const PAPER_PLANE = svgBox(raised(`<path d="M112,30 L14,12 L38,32 Z"/><path d="M112,30 L38,32 L30,52 Z"/><path d="M38,32 L56,31"/>`,
  "M112,30 L14,12 L38,32 L30,52 Z"));

/** Live: an airliner: fuselage with a row of windows, swept wings, a tail fin, a spiral nose light. */
const AIRLINER_BODY = "M110,32 C106,27 96,26 30,27 L14,14 L20,30 C16,32 16,34 22,36 L96,38 C104,38 110,36 110,32";
const AIRPLANE = svgBox(raised(`<path d="${AIRLINER_BODY}"/><path d="M60,28 L40,10 L50,10 L76,28 M60,37 L42,54 L52,54 L78,37"/>` +
  spiral(100, 31, 0.55) + `<path d="M50,32 h4 M58,32 h4 M66,32 h4 M74,32 h4"/>`, AIRLINER_BODY));

/** Idea (the first stage): a line bird, side view, spiral eye. Each wing is a group hinged on the back (the sky sets its .bw
 *  transform every frame, so it beats); the far wing sits behind the body and is fainter. Legs show only on a perch (CSS).
 *  Drawn a little larger, so it reads at bird size. */
const WING = `<path d="M76,19 C78,0 62,-6 40,-5 C48,2 48,8 54,13 C46,13 46,19 56,23"/><path d="M68,10 Q60,5 52,4"/>`;
const wing = (cls: string, hx: number, hy: number) =>
  `<g class="bw-hinge" transform="translate(${hx} ${hy})"><g class="bw ${cls}"><g transform="translate(${-hx} ${-hy})">${raised(WING)}</g></g></g>`;
const BIRD = svgBox(`<g transform="translate(63 26) scale(1.08) translate(-63 -26)">
  ${wing("bw-far", 72, 19)}
  <g class="bird-legs">${raised(`<path d="M68,46 L66,56 M74,46 L74,56 M62,56 L70,56 M70,56 L78,56"/>`)}</g>
  ${raised(`<path d="M84,17 A10,10 0 1 1 98,31"/><path d="M84,17 C70,15 54,21 38,31"/><path d="M98,31 C94,45 72,48 54,41 C48,39 43,36 38,33"/>` +
    `<path d="M97,22 L110,25 L98,28"/><path d="M39,31 L16,23 L22,32 L16,42 L39,33"/>` + spiral(91, 22, 0.75))}
  ${wing("bw-near", 66, 20)}</g>`);

/** The drawing for a stage. */
export const formFor = (stage: Stage): string => stage === "idea" ? BIRD : stage === "implementation" ? PAPER_PLANE : AIRPLANE; // a new idea is a bird, then a paper plane, then an airplane
