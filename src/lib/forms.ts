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

/** Implementation (–): an airplane seen from above. */
const AIRPLANE = svg(`
  <polygon class="pf" points="7,-2 -5,-23 -10,-23 -4,-2"></polygon>
  <polygon class="pf" points="7,2 -5,23 -10,23 -4,2"></polygon>
  <polygon class="pf" points="-17,-2 -23,-10 -26,-10 -23,-2"></polygon>
  <polygon class="pf" points="-17,2 -23,10 -26,10 -23,2"></polygon>
  <path class="pf" d="M28 0 Q27 -2.6 22 -2.6 L-23 -2.6 Q-28 -1.5 -28 0 Q-28 1.5 -23 2.6 L22 2.6 Q27 2.6 28 0 Z"></path>`);

/** Live (1): a bird, wings spread, seen from above. */
const BIRD = svg(`
  <path class="pf" d="M27 0 Q21 -2.6 13 -1.6 Q4 -15 -13 -24 Q-6 -11 -4 -1.4 Q-14 -0.8 -27 -5 Q-21 0 -27 5 Q-14 0.8 -4 1.4 Q-6 11 -13 24 Q4 15 13 1.6 Q21 2.6 27 0 Z"></path>
  <circle class="pf-eye" cx="21" cy="0" r="1"></circle>`);

const FORMS: Record<Stage, string> = { idea: PAPER_PLANE, implementation: AIRPLANE, live: BIRD };

export const formFor = (stage: Stage): string => FORMS[stage];
