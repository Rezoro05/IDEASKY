/** Catching a dream with a hand net: pressing in the sea dips a small net into the water at the pointer. Held, it follows the pointer
 *  and slowly stretches open; on release, a fish inside the hoop is caught (its dream opens) and fish just outside dart off.
 *  Pure rules; the sea island draws the net. */
import { len, sub, v, type Vec } from "./vec";

export const NET = {
  /** The hoop's reach (px from the pointer) the moment it dips in: small, so a fish has to be right there. */
  radius: 34,
  /** Held down, the hoop stretches open to this reach (px)… */
  stretched: 52,
  /** …over this long (ms), easing out. */
  stretchMs: 1200,
  /** Fish this close (px) but not caught are startled by the splash. */
  startle: 150,
  /** How long the lift takes before a caught fish's dream opens (ms). */
  swoopMs: 260,
  /** How long a caught fish wriggles in the net before its dream opens (ms). */
  holdMs: 420,
} as const;

/** How far the hoop reaches after being held `heldMs`: from `radius` easing out to `stretched`. */
export function netReach(heldMs: number): number {
  const u = Math.min(1, Math.max(0, heldMs / NET.stretchMs)), eased = 1 - (1 - u) ** 3;
  return NET.radius + (NET.stretched - NET.radius) * eased;
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
