/** Pure: the faint line an airplane leaves behind. A trail is the places its tail has been, with the time of each.
 *  Points are added as the plane moves and dropped when older than the trail's length; the line fades and thins towards its old end.
 *  No clock and no DOM: time comes in, and what to draw comes out as segments. */
import { type Vec, scale, sub, len } from "./vec";

export type TrailPoint = { readonly position: Vec; readonly time: number };
export type TrailSegment = { readonly from: Vec; readonly to: Vec; readonly alpha: number; readonly width: number };

export const TRAIL = {
  /** Least distance (px) between two recorded points. */
  spacing: 5,
  /** A plane that moves farther than this between two frames (thrown, dropped in) starts a new trail instead of drawing a streak. */
  breakDistance: 60,
  /** How opaque the newest part is, and how thick (px) the newest and oldest parts are. */
  maxAlpha: 0.7,
  headWidth: 2.6,
  tailWidth: 0.5,
  /** Where the line starts, as a share of the plane's size behind its center (its tail). */
  tailOffset: 0.45,
} as const;

/** The point behind a plane, opposite its heading. A plane that isn't moving has no "behind": its own position. */
export function tailPoint(position: Vec, velocity: Vec, distance: number): Vec {
  const speed = len(velocity);
  return speed < 1e-6 ? position : sub(position, scale(velocity, distance / speed));
}

/** The trail after one more frame. `seconds` is its length in time; 0 or less means no trail at all. */
export function extendTrail(trail: readonly TrailPoint[], position: Vec, time: number, seconds: number): TrailPoint[] {
  if (seconds <= 0) return [];
  const last = trail[trail.length - 1];
  if (last && len(sub(position, last.position)) > TRAIL.breakDistance) return [{ position, time }];
  const kept = trail.filter((p) => time - p.time <= seconds);
  const newest = kept[kept.length - 1];
  return !newest || len(sub(position, newest.position)) >= TRAIL.spacing ? [...kept, { position, time }] : kept;
}

/** The line to draw: one segment between each pair of neighbouring points, brightest and thickest at the newest end. */
export function trailSegments(trail: readonly TrailPoint[], now: number, seconds: number): TrailSegment[] {
  const out: TrailSegment[] = [];
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1]!, b = trail[i]!;
    const fade = Math.min(1, Math.max(0, 1 - (now - b.time) / seconds));
    if (fade > 0) out.push({ from: a.position, to: b.position, alpha: TRAIL.maxAlpha * fade, width: TRAIL.tailWidth + (TRAIL.headWidth - TRAIL.tailWidth) * fade });
  }
  return out;
}

/** A box in CSS px: what a frame of trails covers, so the next frame wipes only that. */
export type TrailBox = { x: number; y: number; w: number; h: number };

/** The box around a set of segments, padded for line width and antialiasing. */
export function trailBox(segments: readonly TrailSegment[]): TrailBox | null {
  if (segments.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, pad = 0;
  for (const s of segments) {
    x0 = Math.min(x0, s.from.x, s.to.x); y0 = Math.min(y0, s.from.y, s.to.y);
    x1 = Math.max(x1, s.from.x, s.to.x); y1 = Math.max(y1, s.from.y, s.to.y);
    pad = Math.max(pad, s.width);
  }
  pad += 2;
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + 2 * pad) + 1, h: Math.ceil(y1 - y0 + 2 * pad) + 1 };
}
