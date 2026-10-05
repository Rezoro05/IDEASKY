/** The drawing for each stage of an idea, all facing right so flight and orientation treat them alike.
 *  Paper plane and airplane: flat shapes with shading in one svg box. Bird: a geometric bird whose wings the sky moves (lib/bird-pose). */
import type { Stage } from "./stages";

const svg = (body: string): string => `<svg viewBox="-30 -30 60 60" aria-hidden="true">${body}</svg>`;

/** Idea (0): a folded paper plane. */
const PAPER_PLANE = svg(`
  <polygon class="pf pf-hi" points="26,-2.2 -22.6,-18.6 -18.1,-6.3"></polygon>
  <polygon class="pf pf-mid" points="26,-2.2 -18.1,-6.3 -28,9.5 -14.8,2.4"></polygon>
  <polygon class="pf pf-lo" points="-28,9.5 -14.8,2.4 -13.8,8.7"></polygon>
  <polygon class="pf pf-hi2" points="26,-2.2 -14.8,2.4 -9.2,18.6"></polygon>`);

/** In Progress: an airliner seen from above. Swept wings with engine pods, tailplane, fin, cockpit glass; the shade shapes give it depth. */
const AIRPLANE = svg(`
  <polygon class="pf" points="9,-2.4 -7,-25 -12.5,-25 -4.5,-2.4"></polygon>
  <polygon class="pf" points="9,2.4 -7,25 -12.5,25 -4.5,2.4"></polygon>
  <polygon class="pf-shade" points="-1,-2.4 -9.5,-25 -12.5,-25 -4.5,-2.4"></polygon>
  <polygon class="pf-shade" points="-1,2.4 -9.5,25 -12.5,25 -4.5,2.4"></polygon>
  <rect class="pf" x="-6" y="-14.5" width="13" height="4.4" rx="2.2"></rect>
  <rect class="pf" x="-6" y="10.1" width="13" height="4.4" rx="2.2"></rect>
  <polygon class="pf" points="-17,-2.2 -24.5,-11 -28,-11 -24,-2.2"></polygon>
  <polygon class="pf" points="-17,2.2 -24.5,11 -28,11 -24,2.2"></polygon>
  <path class="pf" d="M28.5 0 Q27.5 -2.9 22 -2.9 L-23 -2.9 Q-29 -1.6 -29 0 Q-29 1.6 -23 2.9 L22 2.9 Q27.5 2.9 28.5 0 Z"></path>
  <path class="pf-shade" d="M28.5 0 Q27.5 2.9 22 2.9 L-23 2.9 Q-29 1.6 -29 0 Z"></path>
  <path class="pf-light" d="M22 -2.2 L-20 -2.2 L-20 -1.4 L22 -1.4 Z"></path>
  <path class="pf-glass" d="M24 0 Q23 -1.9 20.2 -1.9 L18 -1.9 L18 1.9 L20.2 1.9 Q23 1.9 24 0 Z"></path>
  <path class="pf-shade" d="M-16 -0.5 L-28 -0.5 L-28 0.5 L-16 0.5 Z"></path>`);

/** Live: a geometric bird, side view. Each wing is a group hinged on the back (the sky sets its .bw transform every frame, so it beats smoothly);
 *  the far wing sits behind the body and is darker. Legs show only on a perch (CSS). Drawn at 0.75 so it is smaller than the planes. */
const wing = (cls: string) => `<g class="bw-hinge" transform="translate(-2,-4)"><g class="bw ${cls}">
    <polygon class="pf" points="7,0 -11,0 -9,-11 -2,-19"></polygon>
    <polygon class="pf-shade" points="-1,0 -11,0 -9,-11"></polygon></g></g>`;
const BIRD = svg(`<g transform="scale(0.75)">
  ${wing("bw-far")}
  <polygon class="pf" points="-12,-2 -28,-8 -25,2 -11,3"></polygon>
  <g class="bird-legs"><polyline points="-1,6 -2,12 -4,12"></polyline><polyline points="4,6 3,12 1,12"></polyline></g>
  <polygon class="pf" points="-14,-1 -4,-8 8,-9 15,-4 12,4 1,7 -10,4"></polygon>
  <polygon class="pf-shade" points="-10,4 1,7 12,4 6,2 -4,2"></polygon>
  <circle class="pf" cx="13" cy="-8" r="6"></circle>
  <polygon class="pf-beak" points="18.6,-10 25,-7.5 18.6,-6"></polygon>
  <circle class="pf-eye" cx="15" cy="-9.2" r="1.1"></circle>
  ${wing("bw-near")}</g>`);
/** The drawing for a stage. */
export const formFor = (stage: Stage): string => stage === "live" ? BIRD : stage === "idea" ? PAPER_PLANE : AIRPLANE;
