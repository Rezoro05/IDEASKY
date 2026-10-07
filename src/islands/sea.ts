/** The Sea of Dreams: keeps the dreams, draws the newest as fish, and lets them swim (pure rules in lib/swim).
 *  Swims only while the sea is in view and nothing covers it. */
import { dreamName, ideaNumbers, newestIdeas, type Idea } from "../lib/ideas";
import { fishFacing, fishTransform, spawnFish, stepSwim, type Fish } from "../lib/swim";
import { mulberry32 } from "../lib/random";
import { FISH_SVG } from "../lib/fish-art";
import type { Bounds } from "../lib/sim";
import type { IdeaStore } from "../boundaries/ideaStore";

/** How many fish swim at once (the newest dreams). */
export const DREAMS_IN_SEA = 16;

export type SeaBoard = {
  get(id: string): Idea | undefined;
  nameOf(id: string): string;
  /** Resolves once the sea has its first list of dreams. */
  loaded: Promise<void>;
};

/** A dream's school: its most likely theme (Jev lists them most likely first); none yet = a loner. */
export const schoolOf = (dream: Idea): string => dream.categories?.[0] ?? "";

export function startSea(opts: { field: HTMLElement; store: Promise<IdeaStore>; visitSeed: number; size: number; active: () => boolean }): SeaBoard {
  const { field } = opts;
  let size: Bounds = { width: field.clientWidth, height: field.clientHeight };
  new ResizeObserver(() => { size = { width: field.clientWidth, height: field.clientHeight }; }).observe(field);
  const rand = mulberry32(opts.visitSeed ^ 0x5ea);
  let dreams = new Map<string, Idea>(), fish: Fish[] = [];
  const els = new Map<string, HTMLAnchorElement>(), facing = new Map<string, boolean>();
  let markLoaded = () => {};
  const loaded = new Promise<void>((resolve) => { markLoaded = resolve; });

  const nameOf = (id: string) => dreamName(ideaNumbers(dreams.values()).get(id));

  function makeFish(dream: Idea, name: string): HTMLAnchorElement {
    const a = document.createElement("a");
    a.className = "fish"; a.href = "#"; a.dataset.slug = dream.id; a.dataset.school = schoolOf(dream);
    a.style.setProperty("--s", opts.size + "px");
    a.setAttribute("aria-label", `${name}: open the dream`);
    a.innerHTML = `<span class="body">${FISH_SVG}</span><span class="tag"></span>`;
    a.querySelector(".tag")!.textContent = name;
    field.appendChild(a);
    return a;
  }

  function sync(): void {
    const shown = newestIdeas(dreams.values(), DREAMS_IN_SEA), keep = new Set(shown.map((d) => d.id)), nums = ideaNumbers(dreams.values());
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

  opts.store.then((s) => s.subscribe((all) => { dreams = all; sync(); markLoaded(); }));
  field.addEventListener("click", (e) => { if ((e.target as Element).closest(".fish")) e.preventDefault(); }); // opening a dream comes with the net (step 4)

  let last = performance.now(), time = 0;
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (opts.active() && fish.length > 0) {
      time += dt;
      fish = stepSwim(fish, { dt, time, bounds: size, still: new Set() });
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
  requestAnimationFrame(frame);

  return { get: (id) => dreams.get(id), nameOf, loaded };
}
