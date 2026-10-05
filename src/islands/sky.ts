/** The hero sky: renders the pure flight simulation, and turns pointer and keyboard input into held/paused planes. */
import { createWorld, step, addPlane, removePlane, setStage, type Bounds, type Held, type PointerInfo, type World } from "../lib/sim";
import { landingFlare, wingEffort, wingLook } from "../lib/bird";
import { blendedPose, nextEffort, type LookChange } from "../lib/bird-pose";
import { birdOrientation, birdTransform } from "../lib/bird-orientation";
import { classifyGesture, movedFarEnough, type PointerMark } from "../lib/gesture";
import { isOverCage, type Rect } from "../lib/cage";
import { isCatchable, pressOutcome } from "../lib/catch";
import type { FlightConfig } from "../lib/motion";
import { formFor } from "../lib/forms";
import type { Stage } from "../lib/stages";
import { headingDeg, len, v, type Vec } from "../lib/vec";
import { orientationFor, orientationTransform, type Orientation } from "../lib/orientation";
import { BIRD_STAGE, FORM_FLIGHT, configFor } from "../lib/flight-forms";
import { TRAIL, extendTrail, tailPoint, trailSegments, type TrailPoint } from "../lib/trail";
import { createTrailLayer } from "./trail-canvas";

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
  /** The cage: where a caught bird is dropped to open its idea. Measured on each drop. */
  cage: HTMLElement;
  /** While something covers the sky (an open letter or the Idea Note), it holds still: nothing to see, nothing to pay for. */
  covered?: () => boolean;
}): Sky {
  const { field, config } = opts;
  const bounds = (): Bounds => ({ width: field.clientWidth, height: field.clientHeight });
  let world: World = createWorld([], opts.visitSeed, bounds(), config);
  const els = new Map<string, HTMLAnchorElement>(), facing = new Map<string, Orientation>();
  const changes = new Map<string, LookChange>(); // per bird: what it is doing and since when, so changes blend in
  const efforts = new Map<string, number>(); // per bird: how hard its wings are working now (eases toward what it needs)
  const birdCruise = configFor(config, FORM_FLIGHT[BIRD_STAGE]).cruise;
  const trails = new Map<string, TrailPoint[]>(), trailLayer = createTrailLayer(field); // airplanes leave a faint line
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

  const cageRect = (): Rect => { const c = opts.cage.getBoundingClientRect(), f = field.getBoundingClientRect(); return { x: c.left - f.left, y: c.top - f.top, width: c.width, height: c.height }; };
  const stageOf = (slug: string): Stage => els.get(slug)!.dataset.stage as Stage;
  function hold(slug: string, pointer: Vec): void {
    held = { slug, pointer };
    els.get(slug)?.classList.add("held");
    if (isCatchable(stageOf(slug))) field.classList.add("holding-bird"); // the cage lights up
  }
  function letGo(): void {
    if (held) els.get(held.slug)?.classList.remove("held");
    held = null;
    field.classList.remove("holding-bird");
    opts.cage.classList.remove("over");
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
    if (isCatchable(stageOf(press.slug))) hold(press.slug, local(e)); // a press on a bird catches it at once
  });
  field.addEventListener("pointermove", (e) => {
    if (!press) return;
    if (!held && movedFarEnough(press.point, v(e.clientX, e.clientY))) hold(press.slug, local(e));
    if (held) {
      held = { ...held, pointer: local(e) };
      if (isCatchable(stageOf(held.slug))) opts.cage.classList.toggle("over", isOverCage(held.pointer, cageRect()));
    }
  });
  const endPress = (e: PointerEvent) => {
    if (!press) return;
    const gesture = classifyGesture(press, { point: v(e.clientX, e.clientY), at: performance.now() });
    const slug = press.slug, canceled = e.type !== "pointerup";
    const outcome = pressOutcome({ stage: stageOf(slug), gesture, canceled, overCage: isOverCage(local(e), cageRect()) });
    letGo();
    press = null;
    suppressClick = true; // the click that follows a press is handled here, not by the click listener
    if (outcome === "open") opts.onOpen(slug, v(e.clientX, e.clientY));
    if (outcome === "caged") { const c = opts.cage.getBoundingClientRect(); opts.onOpen(slug, v(c.left + c.width / 2, c.top + c.height / 2)); } // the letter opens from the cage; the bird waits there, and flies off when the letter closes
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

  /** The wings hinge on the back: 1 fully up, -1 fully down (the far wing a little less, as seen from the side). */
  function setWings(el: HTMLElement, wing: number): void {
    el.querySelectorAll<SVGGElement>(".bw").forEach((g) => {
      const k = g.classList.contains("bw-far") ? 0.8 * wing : wing;
      g.setAttribute("transform", `matrix(1 0 0 ${k.toFixed(3)} 0 0)`);
    });
  }

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
      if (FORM_FLIGHT[p.stage].trails) trails.set(p.slug, extendTrail(trails.get(p.slug) ?? [], tailPoint(p.position, p.velocity, config.planeSize * TRAIL.tailOffset), world.time, config.trailSeconds));
      else trails.delete(p.slug);
      const look = wingLook(p); // what a bird is doing with its wings
      if (look && el.dataset.state !== look) el.dataset.state = look;
      else if (!look && el.dataset.state) delete el.dataset.state;
      const was = changes.get(p.slug);
      if (look && was?.look !== look) changes.set(p.slug, { look, from: was?.look ?? null, since: world.time }); // blend into the new way of flying
      else if (!look && was) changes.delete(p.slug);
      const change = changes.get(p.slug);
      if (change) efforts.set(p.slug, nextEffort(efforts.get(p.slug) ?? 1, wingEffort(p, birdCruise), dt)); // glides down, works to climb
      const flare = landingFlare(p);
      el.classList.toggle("landing", flare > 0.5); // legs down for the last of the approach
      const pose = change ? blendedPose(change, world.time, p.slug, efforts.get(p.slug), flare) : null;
      if (pose) setWings(el, pose.wing);
      let o = facing.get(p.slug);
      if (o && look) o = birdOrientation(o, look === "perch" || look === "held"); // a bird tilts only part of the way, and sits upright
      if (o) (el.firstElementChild as HTMLElement).style.transform = pose ? birdTransform(o, pose, config.planeSize) : orientationTransform(o);
    }
    trailLayer.draw([...trails.values()].flatMap((t) => trailSegments(t, world.time, config.trailSeconds)));
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
      trails.delete(slug);
      changes.delete(slug);
      efforts.delete(slug);
    },
  };
}
