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

/** The hand net, in the planes' paper style, seen a little from above: an oval hoop with a cream rim, a diamond-mesh bag hanging
 *  beneath it, and a wooden handle with a wrapped grip running off to the lower right. The hoop is centred on (0, 0) with a
 *  horizontal reach of 30 units, so the drawing scales to the net's reach in px (1 unit = reach / 30). */
export const HAND_NET_REACH_UNITS = 30;
export const HAND_NET_SVG =
  `<svg viewBox="-60 -60 120 120" aria-hidden="true"><defs>` +
  `<pattern id="hn-diamonds" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="hn-thread" d="M0 0H7M0 0V7"/></pattern>` +
  `</defs><g transform="rotate(-10)">` +
  `<path class="hn-handle-edge" d="M23 15 L56 47"/><path class="hn-handle" d="M23 15 L56 47"/>` +
  `<path class="hn-grip" d="M44 35.5 l-3.2 3.2 M48 39.5 l-3.2 3.2 M52 43.5 l-3.2 3.2"/>` +
  `<path class="hn-bag" d="M-30 0 C-29 22 -12 40 2 42 C15 40 29 22 30 0 Z"/>` +
  `<path class="hn-bag-mesh" d="M-30 0 C-29 22 -12 40 2 42 C15 40 29 22 30 0 Z"/>` +
  `<ellipse class="hn-mouth" rx="30" ry="24"/><ellipse class="hn-mouth-mesh" rx="30" ry="24"/>` +
  `<ellipse class="hn-rim-edge" rx="30" ry="24"/><ellipse class="hn-rim" rx="30" ry="24"/>` +
  `</g></svg>`;
