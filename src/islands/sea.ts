/** The Sea of Dreams: keeps the dreams, draws the newest as fish, and lets them swim (pure rules in lib/swim).
 *  Swims only while the sea is in view and nothing covers it. */
import { dreamName, ideaNumbers, newestIdeas, previewLine, type Idea } from "../lib/ideas";
import { fishFacing, fishTransform, spawnFish, stepSwim, type Fish } from "../lib/swim";
import { mulberry32 } from "../lib/random";
import { FISH_SVG } from "../lib/fish-art";
import type { Bounds } from "../lib/sim";
import type { IdeaStore } from "../boundaries/ideaStore";
import type { Categorizer } from "../boundaries/categorizer";
import { BOLT_SCALE, DART_SPEED, boltAway, dartAway, fishDrop, startledBy } from "../lib/net";
import { TOUCH_REACH, nearestWithin, slackFor, type Rect } from "../lib/cage";
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
  /** The whole sea: the mouse over it frightens fish, and it shows when a fish is held (.holding-fish). */
  surface: HTMLElement;
  /** The small net: where a held fish is dropped to open its dream. Measured on each move and drop. */
  net: HTMLElement;
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

  /* The mouse over the sea: fish dart away from it when it moves near (touch has no hover, so it never sets this). */
  const sea = opts.surface;
  let mouse: (PointerInfo & { at: number }) | null = null;
  const local = (e: PointerEvent): Vec => { const r = field.getBoundingClientRect(); return v(e.clientX - r.left, e.clientY - r.top); };
  sea.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const at = performance.now(), position = local(e);
    const speed = mouse ? Math.hypot(position.x - mouse.position.x, position.y - mouse.position.y) / Math.max(8, at - mouse.at) * 1000 : 0;
    mouse = { position, speed: mouse ? speed * 0.6 + mouse.speed * 0.4 : 0, at }; // smoothed, since pointer events come unevenly
  });
  sea.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") mouse = null; });

  /* Catching, as birds are caught in the sky (pure rules in lib/net): a press on a fish holds it; it wriggles and follows the hand.
     Dropped in the small net, it lies there and its dream opens from the net; when the dream closes, it darts out. Let go anywhere
     else, it bolts the way the hand carried it, and fish nearby dart off. */
  let held: { slug: string; pointerId: number; at: Vec; moved: number; velocity: Vec; slack: number } | null = null;
  /** The fish in the net: where it lies, and whether its dream has covered the sea yet (it darts out once the sea shows again). */
  let netted: { slug: string; at: Vec; since: number; covered: boolean } | null = null;
  const centreOf = (el: Element): Vec => { const r = el.getBoundingClientRect(); return v(r.left + r.width / 2, r.top + r.height / 2); };
  const netRect = (): Rect => { const n = opts.net.getBoundingClientRect(), f = field.getBoundingClientRect(); return { x: n.left - f.left, y: n.top - f.top, width: n.width, height: n.height }; };
  const netCentre = (): Vec => { const r = netRect(); return v(r.x + r.width / 2, r.y + r.height * 0.62); }; // inside the bag
  function open(slug: string): void {
    const body = els.get(slug)?.querySelector(".body");
    if (body) opts.onOpen(slug, centreOf(body));
  }
  function setVelocity(slug: string, velocity: Vec): void {
    const i = fish.findIndex((f) => f.slug === slug);
    if (i >= 0) fish[i] = { ...fish[i]!, velocity };
  }
  /** Fish near a splash dart off. */
  function startle(at: Vec, slug: string | null): void {
    for (const s of startledBy(at, fish, slug)) { const f = fish.find((x) => x.slug === s); if (f) setVelocity(s, dartAway(f.position, at, rand())); }
  }
  /** The fish a press takes: the one under it, or on touch the nearest one close by (a fingertip lands near, not on, a swimming fish). */
  function pressedFish(e: PointerEvent): HTMLElement | null {
    const a = (e.target as Element).closest<HTMLElement>(".fish");
    if (a || e.pointerType !== "touch" || (e.target as Element).closest("button, a, input, textarea")) return a;
    const near = nearestWithin(local(e), fish.filter((f) => f.slug !== netted?.slug), TOUCH_REACH);
    return near ? els.get(near.slug) ?? null : null;
  }
  sea.addEventListener("pointerdown", (e) => {
    const a = pressedFish(e);
    if (!a || e.button !== 0 || held || netted?.slug === a.dataset.slug) return;
    e.preventDefault();
    a.setPointerCapture(e.pointerId);
    const now = performance.now();
    held = { slug: a.dataset.slug!, pointerId: e.pointerId, at: local(e), moved: now, velocity: v(0, 0), slack: slackFor(e.pointerType) };
    a.classList.add("held");
    sea.classList.add("holding-fish"); // the net lights up
  });
  sea.addEventListener("pointermove", (e) => {
    if (!held || e.pointerId !== held.pointerId) return;
    const at = local(e), now = performance.now(), dt = Math.max(0.008, (now - held.moved) / 1000);
    const k = Math.min(1, dt / 0.09); // the hand's velocity, smoothed: pointer samples come unevenly
    held = { ...held, at, moved: now, velocity: v(held.velocity.x + ((at.x - held.at.x) / dt - held.velocity.x) * k, held.velocity.y + ((at.y - held.at.y) / dt - held.velocity.y) * k) };
    opts.net.classList.toggle("over", fishDrop(at, netRect(), false, held.slack) === "netted");
  });
  const letGo = (e: PointerEvent) => {
    if (!held || e.pointerId !== held.pointerId) return;
    const h = held, drop = fishDrop(local(e), netRect(), e.type !== "pointerup", h.slack);
    held = null;
    els.get(h.slug)?.classList.remove("held");
    sea.classList.remove("holding-fish"); opts.net.classList.remove("over");
    if (drop === "netted") {
      netted = { slug: h.slug, at: netCentre(), since: performance.now(), covered: false };
      els.get(h.slug)?.classList.add("in-net");
      opts.onOpen(h.slug, centreOf(opts.net)); // the dream opens from the net
      return;
    }
    const still = performance.now() - h.moved > 80;
    setVelocity(h.slug, boltAway(still ? v(0, 0) : h.velocity, rand()));
    startle(h.at, h.slug);
  };
  sea.addEventListener("pointerup", letGo);
  sea.addEventListener("pointercancel", letGo);
  /** Once its dream has closed (the sea shows again), the fish in the net darts out, back toward open water. If the dream never
   *  covered the sea (it couldn't open), it leaves after a moment anyway. */
  function freeFromNet(now: number): void {
    if (!netted) return;
    if (!opts.active()) { netted.covered = true; return; }
    if (!netted.covered && now - netted.since < 1500) return;
    const n = netted, middle = v(size.width / 2, size.height / 2);
    netted = null;
    els.get(n.slug)?.classList.remove("in-net");
    setVelocity(n.slug, dartAway(n.at, v(2 * n.at.x - middle.x, 2 * n.at.y - middle.y), rand(), DART_SPEED * BOLT_SCALE));
  }
  field.addEventListener("click", (e) => { // keyboard Enter on a focused fish (presses are handled above)
    const a = (e.target as Element).closest<HTMLElement>(".fish");
    if (!a) return;
    e.preventDefault();
    if (e.detail === 0) open(a.dataset.slug!);
  });

  let last = performance.now(), time = 0;
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    freeFromNet(now);
    if (opts.active() && fish.length > 0) {
      time += dt;
      const pointer = mouse ? { position: mouse.position, speed: now - mouse.at < MOUSE_STILL_MS ? mouse.speed : 0 } : null;
      const h = held, n = netted, pinned = new Set([h?.slug, n?.slug].filter((x): x is string => !!x));
      fish = stepSwim(fish, { dt, time, bounds: size, still: pinned, pointer });
      if (pinned.size) fish = fish.map((f) => (f.slug === h?.slug ? { ...f, position: h.at, velocity: h.velocity } : f.slug === n?.slug ? { ...f, position: n.at } : f)); // in the hand, or in the net
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
    forget(id) { dreams.delete(id); unsaved.delete(id); if (netted?.slug === id) netted = null; if (held?.slug === id) { held = null; sea.classList.remove("holding-fish"); } sync(); },
    screenPointOf(id) { const body = els.get(id)?.querySelector(".body"); return body ? centreOf(body) : null; },
  };
}
