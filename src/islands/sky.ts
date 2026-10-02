/** The hero sky: renders the pure flight simulation, and turns pointer and keyboard input into held/paused planes. */
import { createWorld, step, addPlane, removePlane, type Bounds, type Held, type World } from "../lib/sim";
import { classifyGesture, movedFarEnough, type PointerMark } from "../lib/gesture";
import type { FlightConfig } from "../lib/motion";
import { isNoteSlug } from "../lib/notes";
import { PLANE_SVG } from "../lib/plane-svg";
import { headingDeg, len, v, type Vec } from "../lib/vec";

export type PlaneSpec = { tag: string; label: string; href: string; from?: Vec; velocity?: Vec; fresh?: boolean; isNote?: boolean };
export type Sky = {
  has(slug: string): boolean;
  noteSlugs(): string[];
  bounds(): Bounds;
  fieldRect(): DOMRect;
  add(slug: string, spec: PlaneSpec): void;
  retag(slug: string, tag: string, label: string): void;
  remove(slug: string): void;
};

/** Planes keep their last heading when they slow below this speed, so they don't spin in place. */
const MIN_SPEED_FOR_HEADING = 6;
const FRESH_GLOW_MS = 7000;

export function startSky(opts: {
  field: HTMLElement;
  config: FlightConfig;
  visitSeed: number;
  ideas: readonly { slug: string; spec: PlaneSpec }[];
  isVisible: () => boolean;
  onOpen: (slug: string, origin: Vec) => void;
}): Sky {
  const { field, config } = opts;
  const bounds = (): Bounds => ({ width: field.clientWidth, height: field.clientHeight });
  let world: World = createWorld(opts.ideas.map((i) => i.slug), opts.visitSeed, bounds(), config);
  const els = new Map<string, HTMLAnchorElement>(), angles = new Map<string, number>();
  const pausedSlugs = new Set<string>(); // keyboard focus only; hover just recolors
  let held: Held | null = null, press: (PointerMark & { slug: string }) | null = null, suppressClick = false;

  function makePlane(slug: string, spec: PlaneSpec): HTMLAnchorElement {
    const a = document.createElement("a");
    a.className = "plane" + (spec.isNote ? " note-p" : "") + (spec.fresh ? " fresh" : "");
    a.href = spec.href;
    a.dataset.slug = slug;
    a.style.setProperty("--s", config.planeSize + "px");
    a.setAttribute("aria-label", spec.label);
    a.innerHTML = `<span class="body">${PLANE_SVG}</span><span class="tag"></span>`;
    a.querySelector(".tag")!.textContent = spec.tag;
    a.addEventListener("focus", () => pausedSlugs.add(slug));
    a.addEventListener("blur", () => pausedSlugs.delete(slug));
    field.appendChild(a);
    els.set(slug, a);
    return a;
  }
  for (const { slug, spec } of opts.ideas) { makePlane(slug, spec); angles.set(slug, 0); }

  const local = (e: PointerEvent): Vec => { const r = field.getBoundingClientRect(); return v(e.clientX - r.left, e.clientY - r.top); };
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
    if (opts.isVisible()) {
      world = step(world, { dt, bounds: bounds(), held, pausedSlugs }, config);
      for (const p of world.planes) {
        const el = els.get(p.slug);
        if (!el) continue;
        if (len(p.velocity) > MIN_SPEED_FOR_HEADING) angles.set(p.slug, headingDeg(p.velocity));
        el.style.transform = `translate3d(${p.position.x}px, ${p.position.y}px, 0)`;
        (el.firstElementChild as HTMLElement).style.transform = `rotate(${angles.get(p.slug)}deg)`;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    has: (slug) => els.has(slug),
    noteSlugs: () => [...els.keys()].filter(isNoteSlug),
    bounds,
    fieldRect: () => field.getBoundingClientRect(),
    add(slug, spec) {
      const a = makePlane(slug, spec);
      const velocity = spec.velocity ?? v(0, 0);
      angles.set(slug, headingDeg(velocity));
      world = addPlane(world, { slug, position: spec.from ?? v(0, 0), velocity });
      if (spec.fresh) setTimeout(() => a.classList.remove("fresh"), FRESH_GLOW_MS);
    },
    retag(slug, tag, label) {
      const a = els.get(slug);
      if (!a) return;
      const t = a.querySelector(".tag")!;
      if (t.textContent !== tag) t.textContent = tag;
      a.setAttribute("aria-label", label);
    },
    remove(slug) {
      world = removePlane(world, slug);
      pausedSlugs.delete(slug);
      els.get(slug)?.remove();
      els.delete(slug);
      angles.delete(slug);
    },
  };
}
