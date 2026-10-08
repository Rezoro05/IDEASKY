/** Catching a dream, as birds are caught in the sky: a press on a fish holds it (it wriggles in the hand and follows it);
 *  dropped into the small net, its dream opens and it waits there until the dream closes; let go anywhere else, it bolts.
 *  Pure rules; the sea island moves the fish and measures the net (its rectangle, as the sky measures the cage). */
import { len, sub, v, type Vec } from "./vec";
import { CAGE_SLACK, isOverCage, type Rect } from "./cage";

/** What letting go of a held fish comes to. netted: dropped in the net (open its dream). released: let go elsewhere (it bolts). */
export type FishDrop = "netted" | "released";

/** A drop counts as in the net with the same generous edge as the cage: a wriggling fish is hard to aim. A pointer taken away
 *  (pointercancel) never nets anything. */
export const fishDrop = (point: Vec, net: Rect, canceled: boolean, slack: number = CAGE_SLACK): FishDrop => (!canceled && isOverCage(point, net, slack) ? "netted" : "released");

export const NET = {
  /** Fish this close (px) to a splash (a fish let go of) are startled. */
  startle: 150,
} as const;

/** The fish a splash at `at` startles: those close by, except the one that made it. */
export const startledBy = (at: Vec, fish: readonly { slug: string; position: Vec }[], except: string | null): string[] =>
  fish.filter((f) => f.slug !== except && len(sub(f.position, at)) <= NET.startle).map((f) => f.slug);

/** A startled fish darts off, away from the splash: this fast (px/s). */
export const DART_SPEED = 130;
/** A fish let go of panics: it bolts this many times faster than a startled one. */
export const BOLT_SCALE = 3;

/** Its dart: straight away from the splash (a fish right under it picks a side). */
export function dartAway(position: Vec, from: Vec, coin: number, speed: number = DART_SPEED): Vec {
  const away = sub(position, from), d = len(away);
  return d > 1 ? v((away.x / d) * speed, (away.y / d) * speed) : v((coin < 0.5 ? -1 : 1) * speed, 0);
}

/** A fish let go of bolts the way the hand was carrying it (or, if the hand was still, to a side). */
export const boltAway = (handVelocity: Vec, coin: number): Vec =>
  dartAway(v(0, 0), v(-handVelocity.x, -handVelocity.y), coin, DART_SPEED * BOLT_SCALE);
