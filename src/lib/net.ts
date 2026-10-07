/** Catching a dream, like catching a bird: a press grabs the fish; drag it into the net (top right) and it stays there, wriggling,
 *  until it is tapped to read; let go anywhere else and it darts off. A quick tap on any fish opens it straight away. Pure rules. */
import type { Gesture } from "./gesture";
import type { Rect } from "./cage";
import { v, type Vec } from "./vec";

/** open: show the dream. net: it was dropped in the net (it stays there). free: let go outside the net (it swims off). */
export type FishOutcome = "open" | "net" | "free";

export function fishPressOutcome(p: { gesture: Gesture; overNet: boolean; canceled: boolean }): FishOutcome {
  if (p.canceled) return "free";
  if (p.gesture === "open") return "open";
  return p.overNet ? "net" : "free";
}

/** A tap on open water lets every netted fish go; a drag across the water doesn't. */
export const waterTapReleases = (gesture: Gesture): boolean => gesture === "open";

/** Where the n-th netted fish rests in the net (field coordinates): the bag's middle, the next ones nudged side to side and up. */
export function netSpot(net: Rect, index: number): Vec {
  const side = index === 0 ? 0 : (index % 2 === 1 ? -1 : 1) * Math.ceil(index / 2);
  return v(net.x + net.width / 2 + side * net.width * 0.18, net.y + net.height * 0.62 - Math.ceil(index / 2) * 4);
}

/** A fish let go outside the net darts off, away from where it was held, as a bird bolts: this fast (px/s). */
export const DART_SPEED = 130;
