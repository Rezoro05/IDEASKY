/** Pure: is a point over the cage? The cage's rectangle is measured from the page by the sky; the generous edge is decided here. */
import type { Vec } from "./vec";

export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

/** How far outside the drawn cage a drop still counts (px): a bird flapping in a hand is hard to aim. */
export const CAGE_SLACK = 14;

export const isOverCage = (point: Vec, cage: Rect, slack: number = CAGE_SLACK): boolean =>
  point.x >= cage.x - slack && point.x <= cage.x + cage.width + slack && point.y >= cage.y - slack && point.y <= cage.y + cage.height + slack;
