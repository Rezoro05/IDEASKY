/** Pure: where a bird can perch. Birds sit on the horizontal lines of the sky's grid, like wires, never on the vertical ones. */
import { type Vec, v, sub, len } from "./vec";
import type { Rand } from "./random";

/** The grid's square, in px (kept in step with `.field::after` in site.css). */
export const GRID = 32;
/** The grid line k is drawn 1px thick ending at y = GRID * k, so its middle is half a pixel above that. */
const lineY = (k: number): number => GRID * k - 0.5;

/** Heights of the grid lines a bird may use: inside the field, at least `inset` from the top and bottom. */
export function perchLines(height: number, inset: number): number[] {
  const lines: number[] = [];
  for (let k = 1; lineY(k) <= height - inset; k++) if (lineY(k) >= inset) lines.push(lineY(k));
  return lines;
}

const TRIES = 16;

/** A free spot on a perch line, or null when there is none. "Free" = at least `spacing` from every spot in `taken`.
 *  Draws from `rand`, so the same random source gives the same answer. */
export function pickPerch(rand: Rand, bounds: { width: number; height: number }, inset: number, taken: readonly Vec[], spacing: number): Vec | null {
  const lines = perchLines(bounds.height, inset);
  const span = bounds.width - 2 * inset;
  if (lines.length === 0 || span <= 0) return null;
  for (let i = 0; i < TRIES; i++) {
    const spot = v(inset + rand() * span, lines[Math.floor(rand() * lines.length)]!);
    if (taken.every((t) => len(sub(spot, t)) >= spacing)) return spot;
  }
  return null;
}
