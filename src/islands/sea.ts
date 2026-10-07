/** The Sea of Dreams: keeps the dreams, draws the newest as fish, and lets them swim (pure rules in lib/swim).
 *  Swims only while the sea is in view and nothing covers it. */
import { dreamName, ideaNumbers, newestIdeas, previewLine, type Idea } from "../lib/ideas";
import { fishFacing, fishTransform, spawnFish, stepSwim, type Fish } from "../lib/swim";
import { mulberry32 } from "../lib/random";
import { FISH_SVG } from "../lib/fish-art";
import type { Bounds } from "../lib/sim";
import type { IdeaStore } from "../boundaries/ideaStore";
import type { Categorizer } from "../boundaries/categorizer";
import { fishRelease, netsNow, waterTapReleases, NET } from "../lib/net";
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
  let mouse: (PointerInfo & { at: number }) | null = null;
  const local = (e: PointerEvent): Vec => { const r = field.getBoundingClientRect(); return v(e.clientX - r.left, e.clientY - r.top); };
  field.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const at = performance.now(), position = local(e);
    const speed = mouse ? Math.hypot(position.x - mouse.position.x, position.y - mouse.position.y) / Math.max(8, at - mouse.at) * 1000 : 0;
    mouse = { position, speed: mouse ? speed * 0.6 + mouse.speed * 0.4 : 0, at }; // smoothed, since pointer events come unevenly
  });
  field.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") mouse = null; });

  /* Tap to open; press and hold to net (pure rules in lib/net). A netted fish holds still and wriggles until tapped or let go. */
  const netted = new Set<string>();
  let press: { slug: string | null; point: Vec; at: number; nettedBefore: boolean; nettedDuring: boolean; timer: number } | null = null, suppressClick = false;
  const setNetted = (slug: string, on: boolean) => { if (on) netted.add(slug); else netted.delete(slug); els.get(slug)?.classList.toggle("netted", on); };
  const centreOf = (el: Element): Vec => { const r = el.getBoundingClientRect(); return v(r.left + r.width / 2, r.top + r.height / 2); };
  const moved = (e: PointerEvent) => (press ? Math.hypot(e.clientX - press.point.x, e.clientY - press.point.y) : 0);
  function open(slug: string): void {
    const body = els.get(slug)?.querySelector(".body");
    setNetted(slug, false); // caught and read: it swims off again once the letter closes
    if (body) opts.onOpen(slug, centreOf(body));
  }
  field.addEventListener("pointerdown", (e) => {
    const a = (e.target as Element).closest<HTMLElement>(".fish"), slug = a?.dataset.slug ?? null;
    if (a) { e.preventDefault(); a.setPointerCapture(e.pointerId); }
    press = { slug, point: v(e.clientX, e.clientY), at: performance.now(), nettedBefore: !!slug && netted.has(slug), nettedDuring: false, timer: 0 };
    if (slug && !netted.has(slug)) {
      const p = press;
      p.timer = window.setTimeout(() => { if (press === p && netsNow(performance.now() - p.at, 0)) { p.nettedDuring = true; setNetted(slug, true); } }, NET.holdMs);
    }
  });
  field.addEventListener("pointermove", (e) => { if (press?.timer && moved(e) > NET.slack) { clearTimeout(press.timer); press.timer = 0; } });
  const endPress = (e: PointerEvent) => {
    if (!press) return;
    const p = press, distance = moved(e);
    press = null; clearTimeout(p.timer);
    if (e.type !== "pointerup") return;
    if (!p.slug) { if (waterTapReleases(distance)) for (const s of [...netted]) setNetted(s, false); return; }
    suppressClick = true;
    if (fishRelease({ moved: distance, nettedBefore: p.nettedBefore, nettedDuring: p.nettedDuring }) === "open") open(p.slug);
  };
  field.addEventListener("pointerup", endPress);
  field.addEventListener("pointercancel", endPress);
  field.addEventListener("click", (e) => { // keyboard Enter, or a click without pointer events
    const a = (e.target as Element).closest<HTMLElement>(".fish");
    if (!a) return;
    e.preventDefault();
    if (suppressClick) { suppressClick = false; return; }
    open(a.dataset.slug!);
  });

  let last = performance.now(), time = 0;
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (opts.active() && fish.length > 0) {
      time += dt;
      const pointer = mouse && !press ? { position: mouse.position, speed: now - mouse.at < MOUSE_STILL_MS ? mouse.speed : 0 } : null; // a fish being pressed doesn't flee the hand
      fish = stepSwim(fish, { dt, time, bounds: size, still: netted, pointer });
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
    forget(id) { dreams.delete(id); unsaved.delete(id); netted.delete(id); sync(); },
    screenPointOf(id) { const body = els.get(id)?.querySelector(".body"); return body ? centreOf(body) : null; },
  };
}
