/** Pure geometry for a paper plane flown by hand across the page: an eased arc that swings out and up, then lands on its target. */
import { len, sub, v, type Vec } from "./vec";

const SWING_OUT = 180, LIFT = 140;

/** Slow start, slow finish. */
export const easeInOut = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** The arc bends left of the start and above both ends, so the plane loops up before it lands. */
export const arcControl = (start: Vec, end: Vec): Vec => v(start.x - SWING_OUT, Math.min(start.y, end.y) - LIFT);

/** Where the plane is at progress u (0..1, clamped) along the eased arc from start to end. */
export function arcPoint(start: Vec, end: Vec, u: number): Vec {
  const e = easeInOut(Math.min(1, Math.max(0, u))), a = 1 - e, c = arcControl(start, end);
  return v(a * a * start.x + 2 * a * e * c.x + e * e * end.x, a * a * start.y + 2 * a * e * c.y + e * e * end.y);
}

/** The direction of travel between two frames; keeps the previous heading when the plane barely moved. */
export function headingBetween(prev: Vec, next: Vec, previousHeading: number): number {
  return len(sub(next, prev)) > 0.5 ? Math.atan2(next.y - prev.y, next.x - prev.x) : previousHeading;
}
