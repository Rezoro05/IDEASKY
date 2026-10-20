/** The bold, raised line style shared by the birds, planes and fish (owner, 2026-10-20: after a mural of single-line fish).
 *  Each part is drawn four times: a soft shadow, the line's dark underside, the coloured line, and a thin highlight on top,
 *  so a plain line reads like a raised tube. Colours come from CSS (.ln-*, currentColor = the flock's or school's tint). Pure strings. */

/** All drawings share one square box, centred on the shapes (drawn about x 10…118, y −6…60). */
export const LINE_BOX = "3 -28 120 120";

export const svgBox = (body: string): string =>
  `<svg viewBox="${LINE_BOX}" class="line-art" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** One part, raised: shadow, underside, line, highlight. `fill` (a path's d) gets a faint tint, for a little volume. */
export const raised = (paths: string, fill?: string): string =>
  (fill ? `<path class="ln-fill" d="${fill}"/>` : "") +
  `<g class="ln-shadow" transform="translate(2 3)">${paths}</g>` +
  `<g class="ln-under" transform="translate(.6 1.1)">${paths}</g>` +
  `<g class="ln-main">${paths}</g>` +
  `<g class="ln-light" transform="translate(-.6 -.9)">${paths}</g>`;

/** A spiral eye, as in the mural: four widening half-turns. */
export const spiral = (x: number, y: number, s = 1): string =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0,0 m-0.9,0 a0.9,0.9 0 1 1 1.8,0 a1.9,1.9 0 1 1 -3.8,0 a2.9,2.9 0 1 1 5.8,0 a3.9,3.9 0 1 1 -7.6,1.2"/>`;
