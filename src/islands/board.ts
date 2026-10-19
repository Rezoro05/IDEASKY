/** The public idea board on the page: keeps the ideas, flies the newest in the sky, and lists them when motion is reduced. */
import { ideaName, ideaNumbers, newestIdeas, previewLine, IDEA_LIMITS, type Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import type { Categorizer } from "../boundaries/categorizer";
import { needsSorting } from "../lib/categories";
import { v, type Vec } from "../lib/vec";
import { shownStage } from "../lib/stages";
import { SHOW_STAGES } from "../content/site";
import type { Sky } from "./sky";
import { byId } from "./dom";

export type Board = {
  /** An idea this visitor just wrote: shown right away, saved in the background. Resolves to whether the board kept it. */
  post(idea: Idea): Promise<boolean>;
  get(id: string): Idea | undefined;
  has(id: string): boolean;
  nameOf(id: string): string;
  /** While a new idea flies up, the sky waits for it instead of spawning a second plane. */
  markInFlight(id: string, flying: boolean): void;
  /** An idea changed (its owner moved its stage): keep it, and redraw its plane. */
  update(idea: Idea): void;
  /** Its owner removed it. */
  forget(id: string): void;
  sync(): void;
  /** Resolves once the board has its first list of ideas (so a link to one can be opened). */
  loaded: Promise<void>;
  /** Show another source's ideas instead (public ⇄ private): the sky empties and fills again from it. */
  use(source: Source): void;
  /** The store shown now. */
  store(): Promise<IdeaStore>;
};

const NEW_IDEA_SPEED = 40;
/** At most this many old ideas are sent for sorting per load, so a visit never sends a burst. */
const RESORT_PER_LOAD = 6;

/** Where the board's ideas come from: the public store, or the signed-in visitor's private one; each with its own sorter. */
export type Source = { store: Promise<IdeaStore>; categorizer?: Categorizer };

export function startBoard(opts: {
  sky: Sky | null; store: Promise<IdeaStore>; random?: () => number; openIdea: (id: string, origin: Vec) => void;
  /** Sorts a just-saved idea into categories; `changed` hears about the result. */
  categorizer?: Categorizer; changed?: (idea: Idea) => void;
}): Board {
  const { sky } = opts;
  const rand = opts.random ?? Math.random;
  let all = new Map<string, Idea>();
  const unsaved = new Set<string>(), inFlight = new Set<string>();
  let markLoaded = () => {};
  const loaded = new Promise<void>((resolve) => { markLoaded = resolve; });
  /** The source shown now; `gen` counts switches, so an answer from a source no longer shown is ignored. */
  let source: Source = { store: opts.store, categorizer: opts.categorizer }, gen = 0;
  const asked = new Set<string>();
  function listen(): void {
    const g = ++gen;
    source.store.then((s) => s.subscribe((ideas) => {
      if (g !== gen) return;
      for (const id of unsaved) { const n = all.get(id); if (n) ideas.set(id, n); } // keep this visit's unsaved ideas
      all = ideas;
      sync();
      markLoaded();
      sortTheUnsorted();
    }));
  }
  listen();

  /** Ideas shown without categories (never sorted, or sorted with none under the old rule) are sorted now, once per visit, a few at a time. */
  function sortTheUnsorted(): void {
    const due = newestIdeas(all.values(), IDEA_LIMITS.inSky).filter((n) => needsSorting(n.categories) && !unsaved.has(n.id) && !asked.has(n.id)).slice(0, RESORT_PER_LOAD);
    for (const n of due) { asked.add(n.id); sortIntoCategories(n.id); }
  }

  const nameOf = (id: string) => ideaName(ideaNumbers(all.values()).get(id));

  /** An idea's flock: its most likely category (Jev lists them most likely first), as a dream's school is its main theme; none yet = a loner. */
  const flockOf = (idea: Idea): string => idea.categories?.[0] ?? "";

  function sync(): void {
    const shown = newestIdeas(all.values(), IDEA_LIMITS.inSky);
    renderList(shown);
    if (!sky) return;
    const keep = new Set(shown.map((n) => n.id));
    for (const id of sky.slugs()) if (!keep.has(id)) sky.remove(id);
    const b = sky.bounds(), nums = ideaNumbers(all.values());
    for (const n of shown) {
      const name = ideaName(nums.get(n.id));
      if (sky.has(n.id)) { sky.retag(n.id, name, `${name}: open the idea`); sky.reform(n.id, shownStage(n.stage, SHOW_STAGES)); sky.flock(n.id, flockOf(n)); continue; }
      if (inFlight.has(n.id)) continue;
      const angle = rand() * Math.PI * 2;
      sky.add(n.id, {
        tag: name, label: `${name}: open the idea`, stage: shownStage(n.stage, SHOW_STAGES), flock: flockOf(n),
        from: v(80 + rand() * Math.max(1, b.width - 160), b.height * 0.45 + rand() * Math.max(1, b.height * 0.5 - 60)),
        velocity: v(Math.cos(angle) * NEW_IDEA_SPEED, Math.sin(angle) * NEW_IDEA_SPEED),
      });
    }
  }

  const listWrap = byId("ideas-fallback"), list = byId("ideas-list");
  function renderList(shown: Idea[]): void {
    listWrap.hidden = shown.length === 0;
    const nums = ideaNumbers(all.values());
    list.replaceChildren(...shown.map((n) => {
      const li = document.createElement("li"), a = document.createElement("a");
      a.href = "#"; a.dataset.idea = n.id;
      const name = document.createElement("span"); name.className = "name"; name.textContent = ideaName(nums.get(n.id));
      const line = document.createElement("span"); line.className = "line"; line.textContent = previewLine(n.message);
      a.append(name, line); li.append(a); return li;
    }));
  }
  list.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLElement>("a[data-idea]");
    if (!a) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    opts.openIdea(a.dataset.idea!, v(r.left + 40, r.top + r.height / 2));
  });

  function sortIntoCategories(id: string): void {
    asked.add(id);
    const g = gen;
    source.categorizer?.categorize(id).then((categories) => {
      const idea = all.get(id);
      if (!categories || !idea || g !== gen) return;
      const sorted = { ...idea, categories };
      all.set(id, sorted);
      sync(); // it joins its flock
      opts.changed?.(sorted);
    });
  }

  return {
    async post(idea) {
      all.set(idea.id, idea); unsaved.add(idea.id);
      const g = gen, s = await source.store;
      const saved = await s.add(idea);
      if (saved && g === gen) { unsaved.delete(idea.id); sortIntoCategories(idea.id); }
      return saved;
    },
    get: (id) => all.get(id),
    has: (id) => all.has(id),
    nameOf,
    markInFlight: (id, flying) => { if (flying) inFlight.add(id); else inFlight.delete(id); },
    update(idea) { if (all.has(idea.id)) { all.set(idea.id, idea); sync(); } },
    forget(id) { all.delete(id); unsaved.delete(id); sync(); },
    sync,
    loaded,
    store: () => source.store,
    use(next) {
      source = next;
      all = new Map(); unsaved.clear(); inFlight.clear(); asked.clear();
      sync();
      listen();
    },
  };
}
