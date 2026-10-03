/** The stage progress bar: Idea at the left end, In Progress in the middle, Live at the right end.
 *  Positions are fractions along the bar, 0 to 1. The owner drags the knob, which may travel at most one stage from where the idea is. */
import { STAGES, type Stage } from "./stages";

const LAST = STAGES.length - 1;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Where a stage sits on the bar. */
export const stageFraction = (stage: Stage): number => STAGES.indexOf(stage) / LAST;

/** Pointer x → how far along the bar it is, given the bar's left edge and width. */
export const fractionAt = (x: number, left: number, width: number): number => (width > 0 ? clamp((x - left) / width, 0, 1) : 0);

/** Where the knob may be while dragging: under the pointer, but no further than the next stage either way. */
export function knobFraction(current: Stage, pointer: number): number {
  const at = STAGES.indexOf(current);
  return clamp(clamp(pointer, 0, 1), Math.max(0, (at - 1) / LAST), Math.min(1, (at + 1) / LAST));
}

/** The stage the knob settles on when let go: the nearest stop to where the knob is. */
export const settledStage = (current: Stage, pointer: number): Stage => STAGES[Math.round(knobFraction(current, pointer) * LAST)]!;
