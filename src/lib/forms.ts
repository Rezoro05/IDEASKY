/** The drawing for each stage of an idea, all facing right so flight and orientation treat them alike.
 *  All three are origami: folded facets, no outlines (of1 lightest … of4 darkest, ot = the flock's tint; coloured in site.css). Bird: an origami bird whose wings the sky moves (lib/bird-pose). */
import type { Stage } from "./stages";

const svg = (body: string): string => `<svg viewBox="-30 -30 60 60" aria-hidden="true">${body}</svg>`;

/** In Progress: a folded paper plane, its near wing in the flock's colour (owner, 2026-10-19: one wing), the rest lit like paper (of1 lightest … of4 darkest; ot = the flock's tint; coloured in site.css). */
const PAPER_PLANE = svg(`
  <polygon class="pf of1" points="26,-2.2 -22.6,-18.6 -18.1,-6.3"></polygon>
  <polygon class="pf of3" points="26,-2.2 -18.1,-6.3 -28,9.5 -14.8,2.4"></polygon>
  <polygon class="pf ot2" points="-28,9.5 -14.8,2.4 -13.8,8.7"></polygon>
  <polygon class="pf ot1" points="26,-2.2 -14.8,2.4 -9.2,18.6"></polygon>`);

/** Live: an airliner seen from above, folded like the bird and the paper plane: swept wings and tailplanes lit on the near side,
 *  shaded on the far side, a fuselage creased along its length, engine pods; one wing and the tail in the flock's colour (owner, 2026-10-19). */
const AIRPLANE = svg(`
  <polygon class="pf ot1" points="8,2.5 -9,25 -14,25 -5,2.5"></polygon>
  <polygon class="pf ot2" points="-1,2.5 -11.5,25 -14,25 -5,2.5"></polygon>
  <polygon class="pf of3" points="-17,2 -25,11 -28.5,11 -24,2"></polygon>
  <polygon class="pf of4" points="0,12 -7,10.5 -7,14"></polygon>
  <polygon class="pf of1" points="8,-2.5 -9,-25 -14,-25 -5,-2.5"></polygon>
  <polygon class="pf of2" points="-1,-2.5 -11.5,-25 -14,-25 -5,-2.5"></polygon>
  <polygon class="pf of1" points="-17,-2 -25,-11 -28.5,-11 -24,-2"></polygon>
  <polygon class="pf of2" points="0,-12 -7,-10.5 -7,-14"></polygon>
  <polygon class="pf of2" points="29,0 22,-3 -23,-3 -29,0"></polygon>
  <polygon class="pf of3" points="29,0 -29,0 -23,3 22,3"></polygon>
  <polygon class="pf of1" points="29,0 22,-3 22,3"></polygon>
  <polygon class="pf ot1" points="-17,-1.2 -28,-0.5 -28,0.5 -17,1.2"></polygon>`);

/** Idea (the first stage): an origami bird, side view: folded facets, no outlines. Each wing is a group hinged on the back
 *  (the sky sets its .bw transform every frame, so it beats smoothly); the far wing sits behind the body and is darker.
 *  Legs show only on a perch (CSS). Drawn at 0.75 so it is smaller than the planes. */
const wing = (cls: string) => `<g class="bw-hinge" transform="translate(-2,-4)"><g class="bw ${cls}">
    <polygon class="pf of1" points="-1,0 10,-1 -7,-22"></polygon>
    <polygon class="pf ot2" points="-1,0 -7,-22 -6,1"></polygon></g></g>`;
const BIRD = svg(`<g transform="scale(0.75)">
  ${wing("bw-far")}
  <polygon class="pf ot1" points="-16,-2 -29,-11 -24,2"></polygon>
  <polygon class="pf ot2" points="-16,-2 -24,2 -12,4"></polygon>
  <g class="bird-legs"><polyline points="-1,6 -2,12 -4,12"></polyline><polyline points="4,5 3,12 1,12"></polyline></g>
  <polygon class="pf of2" points="-16,-2 12,-8 14,0"></polygon>
  <polygon class="pf of3" points="-16,-2 14,0 0,8"></polygon>
  <polygon class="pf of1" points="10,-8 18,-12 20,-4"></polygon>
  <polygon class="pf of2" points="10,-8 20,-4 14,0"></polygon>
  <polygon class="pf-beak" points="20,-7 27,-5 20,-3"></polygon>
  <circle class="pf-eye" cx="16" cy="-7" r="1"></circle>
  ${wing("bw-near")}</g>`);
/** The drawing for a stage. */
export const formFor = (stage: Stage): string => stage === "idea" ? BIRD : stage === "implementation" ? PAPER_PLANE : AIRPLANE; // a new idea is a bird, then a paper plane, then an airplane
