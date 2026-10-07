/** The first-visit hint: a blueprint-style drawing that shows how to catch a bird and drop it in the cage. Pure rules. */
import { v, type Vec } from "./vec";

/** The browser remembers the hint was shown here (a per-visitor convenience: losing it only shows the hint once more). */
export const HINT_SEEN_KEY = "skyofideas.hint.cage";

export const HINT = {
  /** Wait for the page to settle before drawing (ms). */
  delayMs: 1200,
  /** One run of the hint (ms), and how many runs before it fades away. */
  loopMs: 4800, loops: 2,
} as const;

/** Show it only on a first visit, with motion allowed, when the visit starts in the sky with nothing else asked for. */
export function shouldShowHint(p: { seen: boolean; reducedMotion: boolean; hash: string }): boolean {
  return !p.seen && !p.reducedMotion && p.hash === "";
}

/** Where the ghost bird is caught: left of and below the cage, inside the sky, clear of the edges. */
export function hintStart(cage: Vec, field: { width: number; height: number }): Vec {
  const dx = Math.min(420, field.width * 0.42), dy = Math.min(320, field.height * 0.38);
  return v(Math.max(60, cage.x - dx), Math.min(field.height - 80, cage.y + dy));
}

/** The dashed path the ghost hand drags the bird along: a gentle upward curve from the catch to the cage. */
export function hintPath(from: Vec, to: Vec): string {
  const lift = Math.max(40, Math.abs(to.x - from.x) * 0.25);
  const c = v((from.x + to.x) / 2, Math.min(from.y, to.y) - lift);
  const r = (n: number) => Math.round(n * 10) / 10;
  return `M ${r(from.x)} ${r(from.y)} Q ${r(c.x)} ${r(c.y)} ${r(to.x)} ${r(to.y)}`;
}
