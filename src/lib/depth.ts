/** Where the visitor is: up in the sky (ideas) or down in the Sea of Dreams. Pure rules for what moves them between the two. */

export type Depth = "sky" | "sea";

export const DIVE = {
  /** Wheel scrolling (px, summed in one direction) that dives or surfaces. */
  wheelPx: 140,
  /** A pause longer than this starts a new wheel gesture. */
  wheelGapMs: 250,
  /** After a move, wheel input is ignored this long, so one flick doesn't dive and surface again. */
  lockMs: 1100,
  /** A touch swipe this long (px, vertical) dives or surfaces. */
  swipePx: 70,
} as const;

export type Wheel = { readonly sum: number; readonly at: number; readonly lockedUntil: number };
export const NO_WHEEL: Wheel = { sum: 0, at: 0, lockedUntil: 0 };

/** One wheel event: scrolling down in the sky dives, scrolling up in the sea surfaces. */
export function wheelStep(depth: Depth, wheel: Wheel, deltaY: number, now: number): { depth: Depth; wheel: Wheel } {
  if (now < wheel.lockedUntil) return { depth, wheel: { ...wheel, at: now } };
  const sameGesture = now - wheel.at <= DIVE.wheelGapMs && Math.sign(deltaY) === Math.sign(wheel.sum);
  const sum = (sameGesture ? wheel.sum : 0) + deltaY;
  const next = depthFor(depth, sum, DIVE.wheelPx);
  if (next === depth) return { depth, wheel: { sum, at: now, lockedUntil: 0 } };
  return { depth: next, wheel: { sum: 0, at: now, lockedUntil: now + DIVE.lockMs } };
}

/** A finished touch swipe: `upBy` is how far the finger moved up (negative = down). Swiping up in the sky dives; down in the sea surfaces. */
/** Swipes only dive: in the sea a finger drag is the hand net (any direction), so the way back up is "Back to the sky". */
export const swipeStep = (depth: Depth, upBy: number): Depth => (depth === "sky" ? depthFor(depth, upBy, DIVE.swipePx) : depth);

/** Keys: Page Down dives, Page Up surfaces. */
export function keyStep(depth: Depth, key: string): Depth {
  if (key === "PageDown") return "sea";
  if (key === "PageUp") return "sky";
  return depth;
}

/** Downward motion past the threshold goes to the sea; upward past it goes to the sky. */
function depthFor(depth: Depth, down: number, threshold: number): Depth {
  if (depth === "sky" && down >= threshold) return "sea";
  if (depth === "sea" && down <= -threshold) return "sky";
  return depth;
}

/** A link to the sea (…/#sea) starts the visit there. */
export const depthFromHash = (hash: string): Depth => (hash === "#sea" ? "sea" : "sky");
