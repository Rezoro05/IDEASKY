/** The drawing for each stage of an idea, all facing right so flight and orientation treat them alike.
 *  Paper plane and airplane: flat shapes with shading in one svg box. Bird: the six photos of a bluebird, stacked, one shown at a time (lib/bird-frames picks it). */
import type { Stage } from "./stages";
import { BIRD_SPRITES, FRAME_IDS } from "./bird-sprites";

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

/** Live: every photo of the bird, each positioned by its own anchor (CSS reads --w --h --ax --ay); only the one named by the plane's data-frame shows. They all load at once, so changing the frame never waits on the network. */
const BIRD = FRAME_IDS.map((id) => {
  const { w, h, ax, ay } = BIRD_SPRITES[id];
  return `<img class="bird-frame" data-frame="${id}" src="birds/${id}.webp" width="${w}" height="${h}" alt="" draggable="false" decoding="async" style="--w:${w};--h:${h};--ax:${ax};--ay:${ay}">`;
}).join("");

/** The drawing for a stage. */
export const formFor = (stage: Stage): string => stage === "live" ? BIRD : stage === "idea" ? PAPER_PLANE : AIRPLANE;
