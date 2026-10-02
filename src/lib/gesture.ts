/** Pure: was a press-and-release a click to open, or a drag? */
import { type Vec, len, sub } from "./vec";

export type PointerMark = { point: Vec; at: number };
export type Gesture = "open" | "drag";

export const DRAG_DISTANCE = 6;
export const TAP_MAX_MS = 500;

export const movedFarEnough = (from: Vec, to: Vec): boolean => len(sub(to, from)) >= DRAG_DISTANCE;

export function classifyGesture(press: PointerMark, release: PointerMark): Gesture {
  return !movedFarEnough(press.point, release.point) && release.at - press.at < TAP_MAX_MS ? "open" : "drag";
}
