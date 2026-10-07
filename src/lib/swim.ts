/** How dreams swim in the Sea of Dreams: slow wandering fish that keep apart, stay in the water,
 *  and swim together with fish of the same theme (a school). Pure: the clock and the sea's size come in. */
import { add, clampLen, len, scale, sub, v, type Vec } from "./vec";
import { hashString } from "./random";
import type { Bounds } from "./sim";
import type { PointerInfo } from "./plane";
import { BIRD } from "./bird";

export type Fish = {
  readonly slug: string;
  /** The dream's main theme; fish with the same school swim together. "" = a loner. */
  readonly school: string;
  readonly position: Vec;
  readonly velocity: Vec;
};

export const SWIM = {
  /** px/s: the pace a fish settles into, and the limits. */
  cruise: 36, slowest: 14, fastest: 78,
  /** How quickly a fish's speed eases back to cruise (per second). */
  settle: 0.6,
  /** School mates this close (px) match heading; farther ones still draw the school together, more gently. */
  sight: 170,
  /** Closer than this (px), any two fish push apart. */
  personalSpace: 62, apart: 100,
  /** School pull: match the school's heading, and drift toward its middle. */
  align: 0.9, cohere: 0.45,
  /** A slow, seeded meander so a lone fish isn't a straight line. */
  wander: 16,
  /** Soft walls: from this far (px) from an edge, a push back in grows to `wallPush`. */
  wall: 80, wallPush: 120,
  /** The top part of the sea (a share of its height) holds the headline and its buttons: fish stay below it, so they can always be caught. */
  surfaceShare: 0.38,
  /** A frightened fish's top speed, in cruise speeds (like a bird's: a creeping mouse never reaches it, a quick one does). */
  fleeSpeedScale: BIRD.fleeSpeedScale,
  /** How hard a mouse right next to a fish pushes it (px/s²), fading to nothing at the alarm radius. Stronger than a bird's:
   *  a fish darts in a flick of its tail, and the burst has to show before a quick mouse has passed. */
  fleeAccel: 1500,
} as const;

/** Fish take fright like birds do: the same alarm radius and the same "a slow mouse frightens nothing"; they dart harder. */
export const isFrightened = (position: Vec, pointer: PointerInfo | null | undefined): boolean =>
  !!pointer && pointer.speed >= BIRD.alarmSpeed && len(sub(position, pointer.position)) < BIRD.alarmRadius;

/** The push away from a moving mouse: strongest right next to it, nothing at the alarm radius. */
function fleeFrom(position: Vec, pointer: PointerInfo): Vec {
  const away = sub(position, pointer.position), d = len(away);
  const dir = d > 1e-6 ? scale(away, 1 / d) : v(1, 0);
  return scale(dir, SWIM.fleeAccel * (1 - d / BIRD.alarmRadius));
}

export type SwimInput = {
  readonly dt: number; readonly time: number; readonly bounds: Bounds;
  /** Fish that hold still (netted, or focused for the keyboard). */
  readonly still: ReadonlySet<string>;
  /** The mouse over the sea, if any: fish dart away from it when it moves near (touch has no hover, so it never sets this). */
  readonly pointer?: PointerInfo | null;
};

/** The water a fish may swim in: below the headline band, inside the walls. */
export function swimArea(b: Bounds): { top: number; bottom: number; left: number; right: number } {
  return { top: b.height * SWIM.surfaceShare, bottom: b.height - 24, left: 16, right: b.width - 16 };
}

export function stepSwim(fish: readonly Fish[], input: SwimInput): Fish[] {
  const { dt, time } = input, area = swimArea(input.bounds);
  return fish.map((f) => {
    if (input.still.has(f.slug)) return { ...f, velocity: scale(f.velocity, Math.max(0, 1 - 4 * dt)) };
    let steer = v(0, 0), near = 0, heading = v(0, 0), mates = 0, middle = v(0, 0);
    for (const o of fish) {
      if (o.slug === f.slug) continue;
      const away = sub(f.position, o.position), d = len(away);
      if (d > 0 && d < SWIM.personalSpace) steer = add(steer, scale(away, (SWIM.apart * (1 - d / SWIM.personalSpace)) / d));
      if (!f.school || o.school !== f.school) continue;
      mates++; middle = add(middle, o.position); // a school finds itself across the whole sea
      if (d <= SWIM.sight) { near++; heading = add(heading, o.velocity); } // and swims in step with the mates it can see
    }
    if (near > 0) steer = add(steer, scale(sub(scale(heading, 1 / near), f.velocity), SWIM.align));
    if (mates > 0) steer = add(steer, scale(sub(scale(middle, 1 / mates), f.position), SWIM.cohere * (near > 0 ? 1 : 0.35)));
    const frightened = isFrightened(f.position, input.pointer);
    if (frightened) steer = add(steer, fleeFrom(f.position, input.pointer!));
    steer = add(steer, wander(f, time));
    steer = add(steer, walls(f.position, area));
    let velocity = add(f.velocity, scale(steer, dt));
    const speed = len(velocity) || 1e-6;
    const eased = frightened ? speed : speed + (SWIM.cruise - speed) * Math.min(1, SWIM.settle * dt); // a frightened fish keeps its burst; it calms down after
    velocity = clampLen(scale(velocity, Math.max(SWIM.slowest, eased) / speed), frightened ? SWIM.cruise * SWIM.fleeSpeedScale : Math.max(SWIM.fastest, Math.min(len(f.velocity), SWIM.cruise * SWIM.fleeSpeedScale))); // after a fright it only slows down
    const p = add(f.position, scale(velocity, dt));
    // A fish in the water stays in it. One outside it (let go from the net, up by the headline) isn't snapped back: the walls steer it in.
    const inside = f.position.y >= area.top && f.position.y <= area.bottom && f.position.x >= area.left && f.position.x <= area.right;
    const box = inside ? area : { top: 0, bottom: input.bounds.height, left: 0, right: input.bounds.width };
    const position = v(Math.min(box.right, Math.max(box.left, p.x)), Math.min(box.bottom, Math.max(box.top, p.y)));
    return { ...f, position, velocity };
  });
}

/** A gentle sideways push that slowly changes direction, different for every fish (seeded by its id). */
function wander(f: Fish, time: number): Vec {
  const phase = (hashString(f.slug) % 1000) / 159;
  const speed = len(f.velocity) || 1;
  const side = v(-f.velocity.y / speed, f.velocity.x / speed); // perpendicular to where it swims
  return scale(side, SWIM.wander * Math.sin(time * 0.37 + phase) + SWIM.wander * 0.5 * Math.sin(time * 0.11 + phase * 2));
}

function walls(p: Vec, area: ReturnType<typeof swimArea>): Vec {
  const push = (gap: number) => (gap >= SWIM.wall ? 0 : SWIM.wallPush * (1 - Math.max(0, gap) / SWIM.wall));
  return v(push(p.x - area.left) - push(area.right - p.x), push(p.y - area.top) - push(area.bottom - p.y));
}

/** Where a new fish starts: spread over the water, heading left or right. Pure: the random numbers come in. */
export function spawnFish(slug: string, school: string, bounds: Bounds, r: () => number): Fish {
  const area = swimArea(bounds), dir = r() < 0.5 ? -1 : 1;
  return {
    slug, school,
    position: v(area.left + r() * (area.right - area.left), area.top + r() * (area.bottom - area.top)),
    velocity: v(dir * SWIM.cruise, (r() - 0.5) * 10),
  };
}

/** How a fish is drawn (art faces right): mirrored when it swims left, tilted a little with its climb or dive, never on its back. */
export const FISH_TILT_MAX_DEG = 22;
export function fishFacing(velocity: Vec, wasMirrored: boolean): { mirrored: boolean; tiltDeg: number } {
  const mirrored = velocity.x < -2 ? true : velocity.x > 2 ? false : wasMirrored; // nearly still: keep facing
  const climb = (Math.atan2(velocity.y, Math.abs(velocity.x) || 1e-6) * 180) / Math.PI;
  const tilt = Math.max(-FISH_TILT_MAX_DEG, Math.min(FISH_TILT_MAX_DEG, climb));
  return { mirrored, tiltDeg: mirrored ? -tilt : tilt };
}
export const fishTransform = (f: { mirrored: boolean; tiltDeg: number }): string =>
  `rotate(${f.tiltDeg.toFixed(1)}deg)${f.mirrored ? " scaleX(-1)" : ""}`;
