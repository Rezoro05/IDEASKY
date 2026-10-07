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
  holdMs: 420,
} as const;

/** How deep the bag hangs after the net has been held `heldMs`: 1 when it dips in, easing out to `bagStretch`. */
export function bagDepth(heldMs: number): number {
  const u = Math.min(1, Math.max(0, heldMs / NET.stretchMs)), eased = 1 - (1 - u) ** 3;
  return 1 + (NET.bagStretch - 1) * eased;
}

/** Which way the bag trails (degrees, screen: 0 = right, 90 = down). Moving, it streams out behind the net, opposite the way the hand
 *  moves; still, it sinks and hangs down. It swings there smoothly, the short way round. */
export const TRAIL = { minSpeed: 25, turnRate: 7 } as const;
export function trailAngle(current: number, velocity: Vec, dt: number): number {
  const target = len(velocity) < TRAIL.minSpeed ? 90 : (Math.atan2(-velocity.y, -velocity.x) * 180) / Math.PI;
  return normalizeDeg(current + normalizeDeg(target - current) * Math.min(1, dt * TRAIL.turnRate));
}

/** How long the bag is: it stretches while the net is held (bagDepth), and a little more while the hand moves fast through the water. */
export const bagLength = (heldMs: number, speed: number): number => bagDepth(heldMs) * (1 + Math.min(0.35, speed / 900));

/** Where the end of the handle is, from the hoop's centre, in drawing units (the hoop's reach is 30 units). Shared with the drawing. */
export const HANDLE_END = { x: 52, y: 40 } as const;
export const HOOP_UNITS = 30;

/** The pointer holds the handle: the hoop's centre is up and to the left of it, by the handle's length at this size. */
export const hoopCentre = (pointer: Vec, reach: number = NET.radius): Vec =>
  v(pointer.x - (HANDLE_END.x * reach) / HOOP_UNITS, pointer.y - (HANDLE_END.y * reach) / HOOP_UNITS);

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
