/** Catching a dream with a hand net: pressing in the sea dips a small net into the water. The pointer holds the end of its handle,
 *  so the hoop sits just ahead of it. Held, the net follows the pointer and its bag stretches out behind the rim (the net itself
 *  keeps its size); on release, a fish inside the hoop is caught (its dream opens) and fish just outside dart off.
 *  Pure rules; the sea island draws the net. */
import { len, sub, v, type Vec } from "./vec";
import { normalizeDeg } from "./orientation";

export const NET = {
  /** The hoop's reach (px from its centre): small, so a fish has to be right there. */
  radius: 34,
  /** Held down, the bag behind the rim stretches to this many times its depth… */
  bagStretch: 1.5,
  /** …over this long (ms), easing out. */
  stretchMs: 1200,
  /** Fish this close (px) but not caught are startled by the splash. */
  startle: 150,
  /** How long the lift takes before a caught fish's dream opens (ms). */
  swoopMs: 260,
  /** How long a caught fish wriggles in the net before its dream opens (ms). */
  holdMs: 640,
} as const;

/** How deep the bag hangs after the net has been held `heldMs`: 1 when it dips in, easing out to `bagStretch`. */
export function bagDepth(heldMs: number): number {
  const u = Math.min(1, Math.max(0, heldMs / NET.stretchMs)), eased = 1 - (1 - u) ** 3;
  return 1 + (NET.bagStretch - 1) * eased;
}

/** Which way the bag trails (degrees, screen: 0 = right, 90 = down). Moving, it streams out behind the net, opposite the way the hand
 *  moves, swinging there smoothly (faster the faster the hand); still, it drifts down slowly like cloth in water, never like a stone. */
export const TRAIL = { minSpeed: 40, turnRate: 4.5, sinkRate: 0.9 } as const;
export function trailAngle(current: number, velocity: Vec, dt: number): number {
  const speed = len(velocity), moving = speed >= TRAIL.minSpeed;
  const target = moving ? (Math.atan2(-velocity.y, -velocity.x) * 180) / Math.PI : 90;
  const rate = moving ? TRAIL.turnRate * Math.min(1, Math.max(0.35, speed / 220)) : TRAIL.sinkRate;
  return normalizeDeg(current + normalizeDeg(target - current) * Math.min(1, dt * rate));
}

/** The hand's velocity, smoothed: each pointer sample eases in (pointer events arrive unevenly), and when the hand stops, it fades. */
export const easeVelocity = (current: Vec, sample: Vec, dt: number, tau = 0.09): Vec => {
  const k = 1 - Math.exp(-Math.max(0, dt) / tau);
  return v(current.x + (sample.x - current.x) * k, current.y + (sample.y - current.y) * k);
};

/** The water drags on the hoop: the net leans back a few degrees about the hand as it moves (moving right or up tilts it back). */
export const dragTilt = (velocity: Vec): number => Math.max(-8, Math.min(8, (velocity.y - velocity.x) * 0.015));

/** Swept in: a fish the moving hoop reaches while heading its way goes into the net, like a real sweep. The hand must be moving
 *  (SWEEP.minSpeed) and the fish inside the hoop, ahead of its centre or nearly at it. The nearest such fish. */
export const SWEEP = { minSpeed: 60 } as const;
export function sweptIn(hoop: Vec, velocity: Vec, fish: readonly { slug: string; position: Vec }[], radius: number = NET.radius): string | null {
  const speed = len(velocity);
  if (speed < SWEEP.minSpeed) return null;
  let best: string | null = null, bestD = radius;
  for (const f of fish) {
    const to = sub(f.position, hoop), d = len(to), ahead = to.x * velocity.x + to.y * velocity.y >= 0;
    if (d <= bestD && (ahead || d <= radius * 0.5)) { best = f.slug; bestD = d; }
  }
  return best;
}

/** How long the bag is: it stretches while the net is held (bagDepth), and a little more while the hand moves fast through the water. */
export const bagLength = (heldMs: number, speed: number): number => bagDepth(heldMs) * (1 + Math.min(0.35, speed / 900));

/** Where the end of the handle is, from the hoop's centre, in drawing units (the hoop's reach is 30 units). Shared with the drawing. */
export const HANDLE_END = { x: 52, y: 40 } as const;
export const HOOP_UNITS = 30;

/** The pointer holds the handle: the hoop's centre is up and to the left of it, by the handle's length at this size.
 *  `swingDeg` turns the whole net about the hand (positive: clockwise on screen); 0 is the drawing as made. */
export function hoopCentre(pointer: Vec, reach: number = NET.radius, swingDeg = 0): Vec {
  const dx = -(HANDLE_END.x * reach) / HOOP_UNITS, dy = -(HANDLE_END.y * reach) / HOOP_UNITS, a = (swingDeg * Math.PI) / 180;
  return v(pointer.x + dx * Math.cos(a) - dy * Math.sin(a), pointer.y + dx * Math.sin(a) + dy * Math.cos(a));
}

/** On a touch screen the finger covers what it holds, so the net swings about the hand to lead the way the finger moves:
 *  sweeping right puts the hoop to the right of the finger, sweeping down puts it below. Still, it keeps where it last pointed. */
export const SWING = {
  /** Which way the hoop points from the hand in the drawing as made (degrees, screen y down): up and to the left. */
  restDeg: (Math.atan2(-HANDLE_END.y, -HANDLE_END.x) * 180) / Math.PI,
  /** The finger must move at least this fast (px/s) to turn the net. */
  minSpeed: 90,
  /** How quickly it turns toward the finger's heading (per second). */
  turnRate: 9,
} as const;

/** The net's swing this frame, eased toward leading the finger's heading. Pure. */
export function swingToward(current: number, velocity: Vec, dt: number): number {
  if (len(velocity) < SWING.minSpeed) return current;
  const target = normalizeDeg((Math.atan2(velocity.y, velocity.x) * 180) / Math.PI - SWING.restDeg);
  return normalizeDeg(current + normalizeDeg(target - current) * Math.min(1, dt * SWING.turnRate));
}

/** The fish the net catches: the one nearest the click, if it is inside the net. */
export function caughtBy(at: Vec, fish: readonly { slug: string; position: Vec }[], radius: number = NET.radius): string | null {
  let best: string | null = null, bestD = radius;
  for (const f of fish) {
    const d = len(sub(f.position, at));
    if (d <= bestD) { best = f.slug; bestD = d; }
  }
  return best;
}

/** The fish the splash frightens: near the net but not in it. */
export const startledBy = (at: Vec, fish: readonly { slug: string; position: Vec }[], caught: string | null): string[] =>
  fish.filter((f) => f.slug !== caught && len(sub(f.position, at)) <= NET.startle).map((f) => f.slug);

/** A startled fish darts off, away from the splash: this fast (px/s). */
export const DART_SPEED = 130;

/** Its dart: straight away from the splash (a fish right under it picks a side). */
export function dartAway(position: Vec, from: Vec, coin: number): Vec {
  const away = sub(position, from), d = len(away);
  return d > 1 ? v((away.x / d) * DART_SPEED, (away.y / d) * DART_SPEED) : v((coin < 0.5 ? -1 : 1) * DART_SPEED, 0);
}
