/** The hero sky: renders the pure flight simulation, and turns pointer and keyboard input into held/paused planes. */
import { createWorld, step, addPlane, removePlane, setStage, type Bounds, type Held, type PointerInfo, type World } from "../lib/sim";
import { wingLook } from "../lib/bird";
import { classifyGesture, movedFarEnough, type PointerMark } from "../lib/gesture";
import type { FlightConfig } from "../lib/motion";
import { formFor } from "../lib/forms";
import type { Stage } from "../lib/stages";
import { headingDeg, len, v, type Vec } from "../lib/vec";
import { orientationFor, orientationTransform, type Orientation } from "../lib/orientation";

export type PlaneSpec = { tag: string; label: string; stage: Stage; from?: Vec; velocity?: Vec; fresh?: boolean };
export type Sky = {
  has(slug: string): boolean;
  slugs(): string[];
  bounds(): Bounds;
  fieldRect(): DOMRect;
  /** Where a plane is on screen right now (its center), or null if it isn't in the sky. */
  screenPointOf(slug: string): Vec | null;
  add(slug: string, spec: PlaneSpec): void;
  retag(slug: string, tag: string, label: string): void;
  /** The idea moved stage: draw its new form in place and fly it by that form's rules, from where it is. */
  reform(slug: string, stage: Stage): void;
  remove(slug: string): void;
};

/** A mouse that hasn't moved for this long is counted as still (its last speed no longer scares birds). */
const MOUSE_STILL_MS = 120;
/** Planes keep their last heading when they slow below this speed, so they don't spin in place. */
const MIN_SPEED_FOR_HEADING = 6;
const FRESH_GLOW_MS = 7000;

export function startSky(opts: {
  field: HTMLElement;
  config: FlightConfig;
  visitSeed: number;
  onOpen: (slug: string, origin: Vec) => void;
  /** While something covers the sky (an open letter or the Idea Note), it holds still: nothing to see, nothing to pay for. */
  covered?: () => boolean;
}): Sky {
  const { field, config } = opts;
  const bounds = (): Bounds => ({ width: field.clientWidth, height: field.clientHeight });
  let world: World = createWorld([], opts.visitSeed, bounds(), config);
  const els = new Map<string, HTMLAnchorElement>(), facing = new Map<string, Orientation>();
  const pausedSlugs = new Set<string>(); // keyboard focus only; hover just recolors
  let mouse: (PointerInfo & { at: number }) | null = null; // the mouse over the sky: birds flee it; touch has no hover, so it never sets this
  let held: Held | null = null, press: (PointerMark & { slug: string }) | null = null, suppressClick = false;

  function makePlane(slug: string, spec: PlaneSpec): HTMLAnchorElement {
    const a = document.createElement("a");
    a.className = "plane" + (spec.fresh ? " fresh" : "");
    a.href = "#";
    a.dataset.slug = slug;
    a.style.setProperty("--s", config.planeSize + "px");
    a.setAttribute("aria-label", spec.label);
    a.innerHTML = `<span class="body">${formFor(spec.stage)}</span><span class="tag"></span>`;
    a.dataset.stage = spec.stage;
    a.querySelector(".tag")!.textContent = spec.tag;
    a.addEventListener("focus", () => pausedSlugs.add(slug));
    a.addEventListener("blur", () => pausedSlugs.delete(slug));
    field.appendChild(a);
    els.set(slug, a);
    return a;
  }

  const local = (e: PointerEvent): Vec => { const r = field.getBoundingClientRect(); return v(e.clientX - r.left, e.clientY - r.top); };
  field.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const at = performance.now(), position = local(e);
    const speed = mouse ? Math.hypot(position.x - mouse.position.x, position.y - mouse.position.y) / Math.max(8, at - mouse.at) * 1000 : 0;
    mouse = { position, speed: mouse ? speed * 0.6 + mouse.speed * 0.4 : 0, at }; // smoothed, since pointer events come unevenly
  });
  field.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") mouse = null; });
  field.addEventListener("pointerdown", (e) => {
    const a = (e.target as Element).closest<HTMLElement>(".plane");
    if (!a) return;
    e.preventDefault();
    press = { slug: a.dataset.slug!, point: v(e.clientX, e.clientY), at: performance.now() };
    a.setPointerCapture(e.pointerId);
  });
  field.addEventListener("pointermove", (e) => {
    if (!press) return;
    if (!held && movedFarEnough(press.point, v(e.clientX, e.clientY))) {
      held = { slug: press.slug, pointer: local(e) };
      els.get(press.slug)?.classList.add("held");
    }
    if (held) held = { ...held, pointer: local(e) };
  });
  const endPress = (e: PointerEvent) => {
    if (!press) return;
    const gesture = classifyGesture(press, { point: v(e.clientX, e.clientY), at: performance.now() });
    const slug = press.slug;
    if (held) els.get(held.slug)?.classList.remove("held");
    held = null; press = null;
    suppressClick = true; // the click that follows a press is handled here, not by the click listener
    if (gesture === "open" && e.type === "pointerup") opts.onOpen(slug, v(e.clientX, e.clientY));
    if (e.pointerType !== "mouse") pausedSlugs.delete(slug);
  };
  field.addEventListener("pointerup", endPress);
  field.addEventListener("pointercancel", endPress);
  field.addEventListener("click", (e) => { // keyboard Enter, or a click without pointer events
    const a = (e.target as Element).closest<HTMLElement>(".plane");
    if (!a) return;
    e.preventDefault();
    if (suppressClick) { suppressClick = false; return; }
    const r = a.getBoundingClientRect();
    opts.onOpen(a.dataset.slug!, v(r.left + r.width / 2, r.top));
  });

  let last = performance.now();
  function frame(now: number) {
    const dt = (now - last) / 1000;
    last = now;
    if (opts.covered?.()) { requestAnimationFrame(frame); return; }
    const pointer: PointerInfo | null = mouse ? { position: mouse.position, speed: now - mouse.at < MOUSE_STILL_MS ? mouse.speed : 0 } : null;
    world = step(world, { dt, bounds: bounds(), held, pausedSlugs, pointer }, config);
    for (const p of world.planes) {
      const el = els.get(p.slug);
      if (!el) continue;
      if (len(p.velocity) > MIN_SPEED_FOR_HEADING) facing.set(p.slug, orientationFor(headingDeg(p.velocity), facing.get(p.slug)?.mirrored ?? false));
      el.style.transform = `translate3d(${p.position.x}px, ${p.position.y}px, 0)`;
      const look = wingLook(p); // a bird's wings: still, beating or folded (CSS reads this)
      if (look && el.dataset.state !== look) el.dataset.state = look;
      else if (!look && el.dataset.state) delete el.dataset.state;
      const o = facing.get(p.slug);
      if (o) (el.firstElementChild as HTMLElement).style.transform = orientationTransform(o);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    has: (slug) => els.has(slug),
    slugs: () => [...els.keys()],
    bounds,
    fieldRect: () => field.getBoundingClientRect(),
    screenPointOf(slug) {
      const body = els.get(slug)?.querySelector(".body");
      if (!body) return null;
      const r = body.getBoundingClientRect();
      return v(r.left + r.width / 2, r.top + r.height / 2);
    },
    add(slug, spec) {
      const a = makePlane(slug, spec);
      const velocity = spec.velocity ?? v(0, 0);
      facing.set(slug, orientationFor(headingDeg(velocity), false));
      world = addPlane(world, { slug, stage: spec.stage, position: spec.from ?? v(0, 0), velocity });
      if (spec.fresh) setTimeout(() => a.classList.remove("fresh"), FRESH_GLOW_MS);
    },
    retag(slug, tag, label) {
      const a = els.get(slug);
      if (!a) return;
      const t = a.querySelector(".tag")!;
      if (t.textContent !== tag) t.textContent = tag;
      a.setAttribute("aria-label", label);
    },
    reform(slug, stage) {
      const a = els.get(slug);
      if (!a || a.dataset.stage === stage) return;
      a.dataset.stage = stage;
      a.querySelector(".body")!.innerHTML = formFor(stage);
      world = setStage(world, slug, stage);
    },
    remove(slug) {
      world = removePlane(world, slug);
      pausedSlugs.delete(slug);
      els.get(slug)?.remove();
      els.delete(slug);
      facing.delete(slug);
    },
  };
}
