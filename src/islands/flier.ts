/** An idea's form flown across the page by hand, outside the sky's simulation: a new idea up into the sky, a closed letter home to its plane. */
import { arcPoint, headingBetween } from "../lib/flight-path";
import { orientationFor, orientationTransform } from "../lib/orientation";
import { formFor } from "../lib/forms";
import type { Stage } from "../lib/stages";
import type { Vec } from "../lib/vec";

const FLIER_HALF = 32;

export type Landing = { at: Vec; heading: number };

/** Flies from `from` to wherever `target()` says the plane should land (asked every frame, so the target may move).
 *  Resolves once the arc is done and `mayLand()` agrees; the flier element is gone by then. */
export function flyAcrossPage(opts: {
  from: Vec;
  target: () => Vec;
  durationMs: number;
  scaleAt: (u: number) => number;
  /** Which form flies: a new idea is a bird; a letter flies home as its idea's form. */
  stage: Stage;
  mayLand?: (elapsedMs: number) => boolean;
}): Promise<Landing> {
  const el = document.createElement("div");
  el.className = "note-flier"; el.innerHTML = formFor(opts.stage); el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return new Promise((resolve) => {
    const t0 = performance.now();
    let prev = opts.from, heading = -Math.PI / 2, mirrored = false;
    function tick(t: number): void {
      const elapsed = t - t0, u = Math.min(1, elapsed / opts.durationMs);
      const pt = arcPoint(opts.from, opts.target(), u);
      heading = headingBetween(prev, pt, heading);
      const o = orientationFor((heading * 180) / Math.PI, mirrored);
      mirrored = o.mirrored;
      el.style.transform = `translate(${pt.x - FLIER_HALF}px, ${pt.y - FLIER_HALF}px) scale(${opts.scaleAt(u)}) ${orientationTransform(o)}`;
      prev = pt;
      if (u < 1 || !(opts.mayLand?.(elapsed) ?? true)) { requestAnimationFrame(tick); return; }
      el.remove();
      resolve({ at: pt, heading });
    }
    requestAnimationFrame(tick);
  });
}
