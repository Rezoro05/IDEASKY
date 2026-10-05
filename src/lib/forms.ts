/** The drawing for each stage of an idea, all facing right in the same box so flight and orientation treat them alike.
 *  Simple line art for now; the near-photographic art replaces these strings later, nothing else changes. */
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

/** Live (1): a bird, wings spread, seen from above. */
const BIRD = svg(`
  <path class="pf" d="M27 0 Q21 -2.6 13 -1.6 Q4 -15 -13 -24 Q-6 -11 -4 -1.4 Q-14 -0.8 -27 -5 Q-21 0 -27 5 Q-14 0.8 -4 1.4 Q-6 11 -13 24 Q4 15 13 1.6 Q21 2.6 27 0 Z"></path>
  <circle class="pf-eye" cx="21" cy="0" r="1"></circle>`);

const FORMS: Record<Stage, string> = { idea: PAPER_PLANE, implementation: AIRPLANE, live: BIRD };

export const formFor = (stage: Stage): string => FORMS[stage];
