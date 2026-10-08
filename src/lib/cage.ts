/** Pure: is a point over the cage? The cage's rectangle is measured from the page by the sky; the generous edge is decided here. */
import type { Vec } from "./vec";

export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** How far outside the drawn cage a drop still counts (px): a bird flapping in a hand is hard to aim. */
export const CAGE_SLACK = 14;

/** A fingertip covers what it drops and lands less precisely than a mouse: on touch the edge is wider. */
export const TOUCH_SLACK = 30;
/** How generous a drop target is for this kind of pointer ("mouse", "touch", "pen"). */
export const slackFor = (pointerType: string): number => (pointerType === "touch" ? TOUCH_SLACK : CAGE_SLACK);

/** On touch, a press that lands near a bird or fish (not exactly on it) takes the nearest one within this distance (px). */
export const TOUCH_REACH = 36;
/** The nearest of `things` within `reach` of `point`, or null. Pure. */
export function nearestWithin<T extends { readonly position: Vec }>(point: Vec, things: readonly T[], reach: number): T | null {
  let best: T | null = null, bestD = reach;
  for (const t of things) {
    const d = Math.hypot(t.position.x - point.x, t.position.y - point.y);
    if (d <= bestD) { best = t; bestD = d; }
  }
  return best;
}

export const isOverCage = (point: Vec, cage: Rect, slack: number = CAGE_SLACK): boolean =>
  point.x >= cage.x - slack && point.x <= cage.x + cage.width + slack && point.y >= cage.y - slack && point.y <= cage.y + cage.height + slack;
