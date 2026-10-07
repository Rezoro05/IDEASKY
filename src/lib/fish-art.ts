/** The drawing of a dream: a flat paper fish in the planes' style, facing right. The tail is its own group, so it can sway;
 *  the fin and stripe take the school's tint (--fish-tint), so a school reads as one at a glance. Pure: an SVG string. */
export const FISH_SVG =
  `<svg viewBox="-32 -32 64 64" aria-hidden="true">` +
  `<g class="fish-tail"><polygon class="pf" points="-15,0 -30,-11 -25,0 -30,11"/></g>` +
  `<path class="pf fish-fin" d="M4 -9 Q-2 -19 -10 -8 Z"/>` +
  `<path class="pf" d="M25 0 C15 -13 -8 -13 -17 0 C-8 13 15 13 25 0 Z"/>` +
  `<path class="fish-stripe" d="M7 -9 Q10.5 0 7 9"/>` +
  `<path class="pf-shade" d="M25 0 C15 13 -8 13 -17 0 C-6 6 14 6 25 0 Z"/>` +
  `<circle class="pf-eye" cx="15.5" cy="-2" r="1.9"/>` +
  `</svg>`;

/** The hand net that swoops down where the sea is clicked: a hoop with a mesh bag and a short handle. */
export const HAND_NET_SVG =
  `<svg viewBox="-40 -40 80 80" aria-hidden="true">` +
  `<path class="hn-handle" d="M19.8 -19.8 L40 -40"/>` +
  `<circle class="hn-bag" cx="0" cy="0" r="28"/>` +
  `<path class="hn-mesh" d="M-20 -20 L20 20 M-28 -6 L6 28 M-6 -28 L28 6 M20 -20 L-20 20 M28 -6 L-6 28 M6 -28 L-28 6"/>` +
  `<circle class="hn-hoop" cx="0" cy="0" r="28"/>` +
  `</svg>`;
