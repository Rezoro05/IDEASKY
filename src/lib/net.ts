/** Catching a dream with a hand net: a click anywhere in the sea swoops a small net down on that spot. A fish inside it is caught
 *  (its dream opens); fish just outside take fright and dart off. Pure rules; the sea island draws the net. */
import { len, sub, v, type Vec } from "./vec";

export const NET = {
  /** The net's reach (px from the click): small, so a fish has to be right there. */
  radius: 40,
  /** Fish this close (px) but not caught are startled by the splash. */
  startle: 150,
  /** How long the swoop takes before a caught fish is lifted out (ms). */
  swoopMs: 260,
  /** How long a caught fish wriggles in the net before its dream opens (ms). */
  holdMs: 420,
} as const;

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
