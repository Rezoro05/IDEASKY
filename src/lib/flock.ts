/** Ideas of one category fly together, as dreams of one theme swim together (lib/swim). Pure.
 *  In the air: match the heading of the mates in sight, and drift toward the flock's middle.
 *  Birds also land and leave together: one flying in to a perch calls its mates down beside it, and one taking off lifts the mates perched near it. */
import { add, len, scale, sub, v, type Vec } from "./vec";
import type { Plane } from "./plane";

export const FLOCK = {
  /** Mates this close (px) match heading; farther ones still draw the flock together, more gently. */
  sight: 240,
  align: 0.9, cohere: 0.4,
  /** A gliding bird answers a mate's landing only after gliding this long itself (s), so it doesn't drop straight back after take-off. */
  airborneAtLeast: 2.5,
  /** Perched mates closer than this (px) to one taking off go with it. */
  liftRadius: 220,
  /** How far along the wire (px) from a landed mate a bird looks for its own spot. */
  besideReach: 170,
} as const;

/** Flying freely: not perched, not landing, not in a hand. Only these steer the flock in the air. */
export const isAloft = (p: Plane): boolean => !p.bird || p.bird.mode === "gliding" || p.bird.mode === "takingOff";

export const matesOf = (plane: Plane, others: readonly Plane[]): Plane[] =>
  plane.flock ? others.filter((o) => o.slug !== plane.slug && o.flock === plane.flock) : [];

/** The pull of the flock on a plane in the air (px/s²); nothing for a loner. */
export function flockSteer(plane: Plane, others: readonly Plane[]): Vec {
  let near = 0, heading = v(0, 0), count = 0, middle = v(0, 0);
  for (const o of matesOf(plane, others)) {
    if (!isAloft(o)) continue;
    count++; middle = add(middle, o.position);
    if (len(sub(o.position, plane.position)) <= FLOCK.sight) { near++; heading = add(heading, o.velocity); }
  }
  let steer = v(0, 0);
  if (near > 0) steer = add(steer, scale(sub(scale(heading, 1 / near), plane.velocity), FLOCK.align));
  if (count > 0) steer = add(steer, scale(sub(scale(middle, 1 / count), plane.position), FLOCK.cohere * (near > 0 ? 1 : 0.35)));
  return steer;
}

/** What the flock is doing that a bird should follow: the nearest spot a mate is landing on or sits at, and the velocity of a mate
 *  taking off close by. Null when nothing calls. */
export type FlockCall = { readonly landing: Vec | null; readonly leaving: Vec | null };
export function flockCall(plane: Plane, others: readonly Plane[]): FlockCall {
  let landing: Vec | null = null, best = Infinity, leaving: Vec | null = null, closest = Infinity;
  for (const o of matesOf(plane, others)) {
    const spot = o.bird?.mode === "approaching" ? o.bird.target : o.bird?.mode === "perched" ? o.position : null;
    const d = len(sub(o.position, plane.position));
    if (spot && d < best) { best = d; landing = spot; }
    if (o.bird?.mode === "takingOff" && d < FLOCK.liftRadius && d < closest) { closest = d; leaving = o.velocity; }
  }
  return { landing, leaving };
}

export const NO_CALL: FlockCall = { landing: null, leaving: null };
