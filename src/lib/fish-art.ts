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
 *  below it, and a wooden handle with a wrapped grip running down to the right. Inside the rim there is only water (the mesh shows
 *  only on the bag outside it). The hoop is centred on (0, 0) with a reach of 30 units; the handle ends at HANDLE_END (lib/net),
 *  where the pointer holds it. The bag's group (.hn-bag-g) stretches downward from the rim while the net is held. */
export const HAND_NET_SVG =
  `<svg viewBox="-60 -60 120 120" aria-hidden="true"><defs>` +
  `<pattern id="hn-diamonds" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="hn-thread" d="M0 0H7M0 0V7"/></pattern>` +
  `<mask id="hn-outside" maskUnits="userSpaceOnUse" x="-60" y="-60" width="200" height="200"><rect x="-60" y="-60" width="200" height="200" fill="#fff"/><ellipse rx="30" ry="24" fill="#000"/></mask>` +
  `</defs>` +
  `<path class="hn-handle-edge" d="M23.6 14.8 L52 40"/><path class="hn-handle" d="M23.6 14.8 L52 40"/>` +
  `<path class="hn-grip" d="M40.5 26.6 l-2.7 3 M44.5 30.2 l-2.7 3 M48.5 33.8 l-2.7 3"/>` +
  `<g mask="url(#hn-outside)"><g class="hn-bag-g">` +
  `<path class="hn-bag" d="M-30 0 C-29 22 -12 40 2 42 C15 40 29 22 30 0 Z"/>` +
  `<path class="hn-bag-mesh" d="M-30 0 C-29 22 -12 40 2 42 C15 40 29 22 30 0 Z"/>` +
  `</g></g>` +
  `<ellipse class="hn-mouth" rx="30" ry="24"/>` +
  `<ellipse class="hn-rim-edge" rx="30" ry="24"/><ellipse class="hn-rim" rx="30" ry="24"/>` +
  `</svg>`;
