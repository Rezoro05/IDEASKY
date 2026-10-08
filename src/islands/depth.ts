/** Dive and Surface: moves the visitor between the sky and the Sea of Dreams (pure rules in lib/depth).
 *  The page root carries data-depth; the part not in view is inert, so keyboard and screen readers stay where the eyes are.
 *  With reduced motion both parts are simply stacked, and Dive and Surface scroll. */
import { NO_WHEEL, depthFromHash, keyStep, swipeStep, wheelStep, type Depth, type Wheel } from "../lib/depth";

export type DepthControl = { depth(): Depth; go(depth: Depth): void };

const SWIPE_IGNORES = ".plane, .fish, button, a, input, textarea, select, label, .holding-bird, .holding-fish"; // a held bird or fish is being carried, not swiped

export function startDepth(opts: {
  root: HTMLElement; world: HTMLElement; sky: HTMLElement; sea: HTMLElement;
  dive: HTMLElement; surface: HTMLElement; seaTitle: HTMLElement;
  reducedMotion: boolean;
  /** True while something covers the page (a letter or a note): no diving then. */
  blocked: () => boolean;
}): DepthControl {
  const { root, world, sky, sea } = opts;
  let depth: Depth = "sky", wheel: Wheel = NO_WHEEL;

  function apply(next: Depth, moveFocus: boolean): void {
    depth = next;
    root.dataset.depth = next;
    if (!opts.reducedMotion) { sea.inert = next !== "sea"; sky.inert = next !== "sky"; }
    else sea.inert = false;
    const hash = next === "sea" ? "#sea" : "";
    if ((location.hash === "#sea") !== (next === "sea")) history.replaceState(null, "", location.pathname + location.search + hash);
    if (opts.reducedMotion && moveFocus) (next === "sea" ? sea : sky).scrollIntoView({ block: "start" });
    if (moveFocus) (next === "sea" ? opts.seaTitle : opts.dive).focus({ preventScroll: true });
  }
  function go(next: Depth): void { if (next !== depth) apply(next, true); }

  world.classList.add("no-glide");
  apply(depthFromHash(location.hash), false);
  requestAnimationFrame(() => requestAnimationFrame(() => world.classList.remove("no-glide")));

  opts.dive.addEventListener("click", () => go("sea"));
  opts.surface.addEventListener("click", () => go("sky"));
  if (opts.reducedMotion) return { depth: () => depth, go };

  addEventListener("wheel", (e) => {
    if (opts.blocked()) return;
    const step = wheelStep(depth, wheel, e.deltaY, performance.now());
    wheel = step.wheel;
    go(step.depth);
  }, { passive: true });

  // Touch events, not pointer events: the browser claims vertical pans (and cancels the pointer), but touch events still arrive.
  let swipeFrom: number | null = null;
  world.addEventListener("touchstart", (e) => {
    swipeFrom = e.touches.length === 1 && !(e.target as Element).closest(SWIPE_IGNORES) ? e.touches[0]!.clientY : null;
  }, { passive: true });
  world.addEventListener("touchend", (e) => {
    const end = e.changedTouches[0];
    if (swipeFrom === null || !end || opts.blocked()) return;
    go(swipeStep(depth, swipeFrom - end.clientY));
    swipeFrom = null;
  });
  world.addEventListener("touchcancel", () => { swipeFrom = null; });

  addEventListener("keydown", (e) => {
    if (opts.blocked() || (e.target as Element).closest?.("input, textarea, select")) return;
    const next = keyStep(depth, e.key);
    if (next !== depth) { e.preventDefault(); go(next); }
  });
  return { depth: () => depth, go };
}
