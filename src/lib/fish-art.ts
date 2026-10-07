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

/** The hand net: a fishing dip net in the planes' paper style. A slim oval hoop (dark ring with a cream inner line and a collar where
 *  the handle joins), a wooden handle running down to the right, and a soft sack of net: threads that gather to a knotted tail,
 *  with two rings across. The sack is drawn trailing along +x from the hoop's centre; the sea turns it (.hn-bag-g) to stream
 *  behind the hand and stretches it while the net is held. Outside the rim the net is drawn strong; inside the rim, seen through
 *  the opening, the same net is lighter. The hoop is centred on (0, 0) with a reach of 30 units; the handle ends at HANDLE_END. */
/** The bag drawn streaming along +x from the hoop to its knot; the island turns and stretches it. `from` is where its threads
 *  start: the near rim for the outside, the far rim for the inside seen through the opening (clipped to the hoop). */
const netSack = (from: number): string => {
  const mid = (from + 70) / 2, ys = [-24, -15, -7, 0, 7, 15, 24];
  const threads = ys.map((y) => `M ${from} ${y} Q ${mid} ${(y * 0.42).toFixed(1)} 70 0`).join(" ");
  return `<path class="hn-sack" d="M ${from} -24 C ${from + 26} -25 54 -11 70 0 C 54 11 ${from + 26} 25 ${from} 24 Z"/>` +
    `<path class="hn-threads" d="${threads} M 26 -19.5 Q 33 0 26 19.5 M 50 -10.5 Q 54 0 50 10.5"/><circle class="hn-knot" cx="70" cy="0" r="2.2"/>`;
};
export const HAND_NET_SVG =
  `<svg viewBox="-60 -60 120 120" aria-hidden="true"><defs>` +
  `<mask id="hn-outside" maskUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400"><rect x="-200" y="-200" width="400" height="400" fill="#fff"/><ellipse rx="30" ry="24" fill="#000"/></mask>` +
  `<clipPath id="hn-inside"><ellipse rx="30" ry="24"/></clipPath>` +
  `</defs>` +
  `<path class="hn-handle-edge" d="M23.6 14.8 L52 40"/><path class="hn-handle" d="M23.6 14.8 L52 40"/><path class="hn-grain" d="M30 20.6 L49 37.4"/>` +
  `<ellipse class="hn-mouth" rx="30" ry="24"/>` +
  `<g class="hn-in" clip-path="url(#hn-inside)"><g class="hn-bag-g">${netSack(-30)}</g></g>` +
  `<g class="hn-out" mask="url(#hn-outside)"><g class="hn-bag-g">${netSack(-2)}</g></g>` +
  `<ellipse class="hn-rim-edge" rx="30" ry="24"/><ellipse class="hn-rim" rx="30" ry="24"/>` +
  `<path class="hn-collar" d="M21 12.4 l5.6 5.2"/>` +
  `</svg>`;
