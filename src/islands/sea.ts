/** The Sea of Dreams: keeps the dreams, draws the newest as fish, and lets them swim (pure rules in lib/swim).
 *  Swims only while the sea is in view and nothing covers it. */
import { dreamName, ideaNumbers, newestIdeas, previewLine, type Idea } from "../lib/ideas";
import { fishFacing, fishTransform, spawnFish, stepSwim, type Fish } from "../lib/swim";
import { mulberry32 } from "../lib/random";
import { FISH_SVG } from "../lib/fish-art";
import type { Bounds } from "../lib/sim";
import type { IdeaStore } from "../boundaries/ideaStore";
import type { Categorizer } from "../boundaries/categorizer";
import { NET, bagLength, caughtBy, dartAway, hoopCentre, startledBy, trailAngle } from "../lib/net";
import { HAND_NET_SVG } from "../lib/fish-art";
import { v, type Vec } from "../lib/vec";
import type { PointerInfo } from "../lib/plane";

/** A mouse that hasn't moved for this long counts as still (as in the sky). */
const MOUSE_STILL_MS = 120;

/** How many fish swim at once (the newest dreams). */
export const DREAMS_IN_SEA = 16;

export type SeaBoard = {
  get(id: string): Idea | undefined;
  nameOf(id: string): string;
  /** A dream this visitor just wrote: shown at once, saved and sorted into a theme in the background. Resolves to whether it was saved.
   *  `arriving`: its fish stays hidden until `landed`, while a fish flies down to it from the folded note. */
  post(dream: Idea, opts?: { arriving?: boolean }): Promise<boolean>;
  landed(id: string): void;
  /** Its author removed it. */
  forget(id: string): void;
  /** Where a fish is on screen now (its centre), or null. */
  screenPointOf(id: string): Vec | null;
  /** Resolves once the sea has its first list of dreams. */
  loaded: Promise<void>;
};

/** A dream's school: its most likely theme (Jev lists them most likely first); none yet = a loner. */
export const schoolOf = (dream: Idea): string => dream.categories?.[0] ?? "";

export function startSea(opts: {
  field: HTMLElement; store: Promise<IdeaStore>; visitSeed: number; size: number; active: () => boolean;
  /** The whole sea: pressing anywhere in it dips the hand net. */
  surface: HTMLElement;
  /** With reduced motion: a plain list of dreams instead of fish. */
  list?: HTMLUListElement | null;
  /** Open a dream's letter, unfolding from `origin` (screen point). */
  onOpen: (id: string, origin: Vec) => void;
  /** Sorts a just-saved dream into themes; `changed` hears about the result. */
  categorizer?: Categorizer; changed?: (dream: Idea) => void;
}): SeaBoard {
  const { field } = opts;
  let size: Bounds = { width: field.clientWidth, height: field.clientHeight };
  new ResizeObserver(() => { size = { width: field.clientWidth, height: field.clientHeight }; }).observe(field);
  const rand = mulberry32(opts.visitSeed ^ 0x5ea);
  let dreams = new Map<string, Idea>(), fish: Fish[] = [];
  const unsaved = new Set<string>(), arriving = new Set<string>();
  const els = new Map<string, HTMLAnchorElement>(), facing = new Map<string, boolean>();
  let markLoaded = () => {};
  const loaded = new Promise<void>((resolve) => { markLoaded = resolve; });

  const nameOf = (id: string) => dreamName(ideaNumbers(dreams.values()).get(id));

  function makeFish(dream: Idea, name: string): HTMLAnchorElement {
    const a = document.createElement("a");
    a.className = arriving.has(dream.id) ? "fish arriving" : "fish"; a.href = "#"; a.dataset.slug = dream.id; a.dataset.school = schoolOf(dream);
    a.style.setProperty("--s", opts.size + "px");
    a.setAttribute("aria-label", `${name}: open the dream`);
    a.innerHTML = `<span class="body">${FISH_SVG}</span><span class="tag"></span>`;
    a.querySelector(".tag")!.textContent = name;
    field.appendChild(a);
    return a;
  }

  function renderList(list: HTMLUListElement, shown: Idea[]): void {
    const nums = ideaNumbers(dreams.values());
    list.closest<HTMLElement>("#dreams-fallback")!.hidden = shown.length === 0;
    list.replaceChildren(...shown.map((d) => {
      const li = document.createElement("li"), a = document.createElement("a");
      a.href = "#"; a.dataset.dream = d.id;
      const name = document.createElement("span"); name.className = "name"; name.textContent = dreamName(nums.get(d.id));
      const line = document.createElement("span"); line.className = "line"; line.textContent = previewLine(d.message);
      a.append(name, line); li.append(a); return li;
    }));
  }

  function sync(): void {
    const shown = newestIdeas(dreams.values(), DREAMS_IN_SEA), keep = new Set(shown.map((d) => d.id)), nums = ideaNumbers(dreams.values());
    if (opts.list) { renderList(opts.list, shown); return; }
    for (const [id, el] of els) if (!keep.has(id)) { el.remove(); els.delete(id); facing.delete(id); }
    fish = fish.filter((f) => keep.has(f.slug));
    for (const d of shown) {
      const name = dreamName(nums.get(d.id)), school = schoolOf(d), el = els.get(d.id);
      if (el) { el.dataset.school = school; el.querySelector(".tag")!.textContent = name; el.setAttribute("aria-label", `${name}: open the dream`); }
      else els.set(d.id, makeFish(d, name));
      const i = fish.findIndex((f) => f.slug === d.id);
      if (i < 0) fish.push(spawnFish(d.id, school, size, rand));
      else if (fish[i]!.school !== school) fish[i] = { ...fish[i]!, school }; // a theme arrived: it joins its school
    }
  }

  opts.store.then((s) => s.subscribe((all) => {
    for (const id of unsaved) { const d = dreams.get(id); if (d) all.set(id, d); } // keep this visit's unsaved dreams
    dreams = all; sync(); markLoaded();
  }));
  function sortIntoThemes(id: string): void {
    opts.categorizer?.categorize(id).then((categories) => {
      const d = dreams.get(id);
      if (!categories || !d) return;
      const sorted = { ...d, categories };
      dreams.set(id, sorted); sync(); opts.changed?.(sorted);
    });
  }
  opts.list?.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLElement>("a[data-dream]");
    if (!a) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    opts.onOpen(a.dataset.dream!, v(r.left + 40, r.top + r.height / 2));
  });

  /* Events are heard on the whole sea (the fish layer lets clicks through to the water). */
  const sea = opts.surface;

  /* The mouse over the sea: fish dart away from it when it moves near (touch has no hover, so it never sets this). */
  let mouse: (PointerInfo & { at: number }) | null = null;
  const local = (e: PointerEvent): Vec => { const r = field.getBoundingClientRect(); return v(e.clientX - r.left, e.clientY - r.top); };
  sea.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const at = performance.now(), position = local(e);
    const speed = mouse ? Math.hypot(position.x - mouse.position.x, position.y - mouse.position.y) / Math.max(8, at - mouse.at) * 1000 : 0;
    mouse = { position, speed: mouse ? speed * 0.6 + mouse.speed * 0.4 : 0, at }; // smoothed, since pointer events come unevenly
  });
  sea.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") mouse = null; });

  /* Catching (pure rules in lib/net): pressing in the sea dips a small hand net into the water; the pointer holds its handle. Held,
     it follows the pointer and its bag stretches out behind the rim. On release, a fish inside the hoop is caught: it wriggles in the net as it is lifted, then its
     dream opens. A miss lifts the empty net away, and fish just outside dart off. */
  let caught: { slug: string; at: Vec } | null = null; // the fish in the net, held still there until its dream opens
  /** The net in the water, while pressed: where the hand is, how it moves (for the bag's trail), and which way the bag streams. */
  let netting: { el: HTMLElement; bags: SVGGElement[]; at: Vec; since: number; pointerId: number; last: Vec; speed: Vec; trail: number } | null = null;
  const centreOf = (el: Element): Vec => { const r = el.getBoundingClientRect(); return v(r.left + r.width / 2, r.top + r.height / 2); };
  function open(slug: string): void {
    const body = els.get(slug)?.querySelector(".body");
    if (body) opts.onOpen(slug, centreOf(body));
  }
  /** The hand holds the handle, so the hoop is drawn ahead of it. Each frame the bag swings to stream behind the hand's movement
   *  (sinking when the hand is still) and stretches while held (lib/net). */
  function placeNet(n: NonNullable<typeof netting>, now: number, dt: number): void {
    const hoop = hoopCentre(n.at);
    if (dt > 0) { const raw = v((n.at.x - n.last.x) / dt, (n.at.y - n.last.y) / dt), k = Math.min(1, dt * 12); n.speed = v(n.speed.x + (raw.x - n.speed.x) * k, n.speed.y + (raw.y - n.speed.y) * k); }
    n.last = n.at;
    n.trail = trailAngle(n.trail, n.speed, dt);
    const length = bagLength(now - n.since, Math.hypot(n.speed.x, n.speed.y));
    n.el.style.setProperty("--x", hoop.x + "px"); n.el.style.setProperty("--y", hoop.y + "px");
    n.el.style.setProperty("--bag", length.toFixed(3)); n.el.dataset.trail = n.trail.toFixed(0);
    for (const g of n.bags) g.setAttribute("transform", `rotate(${n.trail.toFixed(1)}) scale(${length.toFixed(3)} 1)`);
  }
  sea.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest("button, a:not(.fish), input, textarea")) return; // controls are not water
    if (e.button !== 0 || caught || netting) return;
    e.preventDefault();
    sea.setPointerCapture(e.pointerId);
    const el = document.createElement("div");
    el.className = "hand-net"; el.setAttribute("aria-hidden", "true");
    el.style.setProperty("--r", NET.radius + "px");
    el.innerHTML = `<div class="hn-art">${HAND_NET_SVG}</div>`;
    const at = local(e);
    netting = { el, bags: [...el.querySelectorAll<SVGGElement>(".hn-bag-g")], at, since: performance.now(), pointerId: e.pointerId, last: at, speed: v(0, 0), trail: 90 };
    placeNet(netting, performance.now(), 0);
    field.appendChild(el);
  });
  sea.addEventListener("pointermove", (e) => {
    if (netting && e.pointerId === netting.pointerId) netting.at = local(e);
  });
  /** The caught fish slides from the hoop into the bag (behind its outer mesh) and stays there, wriggling, as the net lifts. */
  function netFish(n: NonNullable<typeof netting>, fishEl: HTMLElement | undefined): void {
    const art = fishEl?.querySelector("svg"), spot = n.el.querySelector(".hn-catch-g");
    if (!art || !spot || !fishEl) return;
    const flip = Math.abs(n.trail) > 90 ? " scale(1 -1)" : ""; // stay belly-down whichever way the bag streams
    spot.setAttribute("transform", `rotate(${n.trail.toFixed(1)})${flip}`);
    spot.innerHTML = `<g class="hn-catch"><svg x="-20" y="-20" width="40" height="40" viewBox="-32 -32 64 64" overflow="visible">${art.innerHTML}</svg></g>`;
    n.el.style.setProperty("--fish-tint", getComputedStyle(fishEl).getPropertyValue("--fish-tint"));
    fishEl.classList.add("netted"); // the fish is now the one in the net
  }
  const lift = (el: HTMLElement, hit: boolean) => {
    el.classList.add(hit ? "hit" : "miss");
    setTimeout(() => el.remove(), hit ? NET.swoopMs + NET.holdMs + 200 : 420);
  };
  const release = (e: PointerEvent) => {
    if (!netting || e.pointerId !== netting.pointerId) return;
    const n = netting, hoop = hoopCentre(n.at);
    netting = null;
    if (e.type !== "pointerup") { lift(n.el, false); return; }
    const slug = caughtBy(hoop, fish);
    lift(n.el, slug !== null);
    for (const s of startledBy(hoop, fish, slug)) {
      const i = fish.findIndex((f) => f.slug === s);
      if (i >= 0) fish[i] = { ...fish[i]!, velocity: dartAway(fish[i]!.position, hoop, rand()) };
    }
    if (!slug) return;
    caught = { slug, at: hoop };
    const fishEl = els.get(slug);
    netFish(n, fishEl);
    setTimeout(() => {
      fishEl?.classList.remove("netted");
      if (caught?.slug === slug) { open(slug); caught = null; }
    }, NET.swoopMs + NET.holdMs);
  };
  sea.addEventListener("pointerup", release);
  sea.addEventListener("pointercancel", release);
  field.addEventListener("click", (e) => { // keyboard Enter on a focused fish (pointer clicks are handled by the net)
    const a = (e.target as Element).closest<HTMLElement>(".fish");
    if (!a) return;
    e.preventDefault();
    if (e.detail === 0) open(a.dataset.slug!);
  });

  let last = performance.now(), time = 0;
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (netting) placeNet(netting, now, dt); // the held net follows the hand; its bag streams behind and stretches
    if (opts.active() && fish.length > 0) {
      time += dt;
      const pointer = mouse && !caught ? { position: mouse.position, speed: now - mouse.at < MOUSE_STILL_MS ? mouse.speed : 0 } : null; // a fish being pressed doesn't flee the hand
      fish = stepSwim(fish, { dt, time, bounds: size, still: new Set(caught ? [caught.slug] : []), pointer });
      if (caught) { const c = caught; fish = fish.map((f) => (f.slug === c.slug ? { ...f, position: c.at } : f)); } // in the net, where it was caught
      for (const f of fish) {
        const el = els.get(f.slug);
        if (!el) continue;
        const face = fishFacing(f.velocity, facing.get(f.slug) ?? false);
        facing.set(f.slug, face.mirrored);
        el.style.transform = `translate3d(${f.position.x}px, ${f.position.y}px, 0)`;
        (el.firstElementChild as HTMLElement).style.transform = fishTransform(face);
      }
    }
    requestAnimationFrame(frame);
  }
  if (!opts.list) requestAnimationFrame(frame);

  return {
    get: (id) => dreams.get(id), nameOf, loaded,
    async post(dream, how = {}) {
      dreams.set(dream.id, dream); unsaved.add(dream.id);
      if (how.arriving) arriving.add(dream.id);
      sync();
      const saved = await (await opts.store).add(dream);
      if (saved) { unsaved.delete(dream.id); sortIntoThemes(dream.id); }
      return saved;
    },
    landed(id) { arriving.delete(id); els.get(id)?.classList.remove("arriving"); },
    forget(id) { dreams.delete(id); unsaved.delete(id); if (caught?.slug === id) caught = null; sync(); },
    screenPointOf(id) { const body = els.get(id)?.querySelector(".body"); return body ? centreOf(body) : null; },
  };
}
