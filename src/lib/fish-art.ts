/** The drawing of a dream: an origami fish, facing right, in the birds' folded-paper style (no outlines; of1 lightest … of4 darkest).
 *  The tail is its own group, so it can sway; tail and fins take the school's tint (ot1, ot2 from --fish-tint), so a school reads as one. Pure: an SVG string. */
export const FISH_SVG =
  `<svg viewBox="-32 -32 64 64" aria-hidden="true">` +
  `<g class="fish-tail"><polygon class="pf ot1" points="-15,0 -30,-12 -23,0"/><polygon class="pf ot2" points="-15,0 -23,0 -30,12"/></g>` +
  `<polygon class="pf ot1" points="0,-9 -9,-19 -7,-7"/><polygon class="pf ot2" points="0,-9 -7,-7 -2,-6"/>` +
  `<polygon class="pf of2" points="-15,0 6,-11 14,-6"/><polygon class="pf of3" points="-15,0 14,-6 14,6"/><polygon class="pf of4" points="-15,0 14,6 6,10"/>` +
  `<polygon class="pf of1" points="14,-6 25,0 14,6"/>` +
  `<polygon class="pf ot2" points="4,2 -6,3 -8,10"/>` +
  `<circle class="pf-eye" cx="17" cy="-1.5" r="1.4"/>` +
  `</svg>`;
