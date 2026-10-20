/** The public idea board on the page: keeps the ideas, flies the newest in the sky, and lists them when motion is reduced. */
import { ANONYMOUS, ideaName, newestIdeas, previewLine, IDEA_LIMITS, type Idea } from "../lib/ideas";
import { OLDER_PAGE, recordNumbers } from "../lib/browse";
import { likeScale } from "../lib/likes";
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
  /** Whether ideas show their stages now (your own sky does; the public build may not). */
  stagesShown(): boolean;
  /** Every idea loaded so far, the sky's and older ones (for browsing). */
  records(): Idea[];
  /** Fetch the next page of older ideas: "more" if there may be more still, "end" when there are none, "failed" if it couldn't. */
  loadOlder(): Promise<"more" | "end" | "failed">;
  /** Could there be older ideas than those loaded? */
  mayHaveOlder(): boolean;
  /** Someone here liked or unliked it: its new count (it grows or shrinks a little). */
  setLikes(id: string, count: number): void;
};

const NEW_IDEA_SPEED = 40;
/** At most this many old ideas are sent for sorting per load, so a visit never sends a burst. */
const RESORT_PER_LOAD = 6;

/** Where the board's ideas come from: the public store, or the signed-in visitor's private one; each with its own sorter. */
export type Source = {
  store: Promise<IdeaStore>; categorizer?: Categorizer;
  /** Your own: each idea flies as its stage's form (bird, paper plane, airplane), whatever the public build shows. */
  stages?: boolean;
  /** Your own: an idea is labelled with the name you gave it (Idea1… when none). */
  named?: boolean;
  /** The public board: likes per idea, so a liked one flies a little bigger. Your own has no likes. */
  likeCounts?: (ids: string[]) => Promise<Map<string, number> | null>;
};

/** What a bird or fish is called: the name you gave it in your own sky and sea, else its number (Idea1, Dream1…). */
export const labelOf = (record: Idea, numbered: string, named: boolean | undefined): string =>
  named && record.name && record.name !== ANONYMOUS ? record.name : numbered;

export function startBoard(opts: {
  sky: Sky | null; store: Promise<IdeaStore>; random?: () => number; openIdea: (id: string, origin: Vec) => void;
  /** Sorts a just-saved idea into categories; `changed` hears about the result. */
  categorizer?: Categorizer; changed?: (idea: Idea) => void;
  /** The public board's likes (a liked idea flies a little bigger). */
  likeCounts?: Source["likeCounts"];
}): Board {
  const { sky } = opts;
  const rand = opts.random ?? Math.random;
  let all = new Map<string, Idea>();
  const unsaved = new Set<string>(), inFlight = new Set<string>();
  let markLoaded = () => {};
  const loaded = new Promise<void>((resolve) => { markLoaded = resolve; });
  /** The source shown now; `gen` counts switches, so an answer from a source no longer shown is ignored. */
  let source: Source = { store: opts.store, categorizer: opts.categorizer, likeCounts: opts.likeCounts }, gen = 0;
  const asked = new Set<string>();
  /** Older ideas fetched for browsing: kept apart from the sky's, so the sky never changes. `base` = how many older ones aren't loaded. */
  let older = new Map<string, Idea>(), base = 0, olderDone = false;
  const numbers = () => recordNumbers([...all.values(), ...older.values()], base);
  /** Likes per idea (the public board only), and the ids already asked about, so each is asked once per visit. */
  let likes = new Map<string, number>(), likesAsked = new Set<string>();
  function askLikes(ids: string[]): void {
    const g = gen, due = ids.filter((id) => !likesAsked.has(id) && !unsaved.has(id));
    if (!source.likeCounts || due.length === 0) return;
    for (const id of due) likesAsked.add(id);
    source.likeCounts(due).then((counts) => {
      if (!counts || g !== gen) return;
      for (const [id, n] of counts) likes.set(id, n);
      sync();
    });
  }
  function listen(): void {
    const g = ++gen;
    let counted = false;
    source.store.then((s) => s.subscribe((ideas) => {
      if (g !== gen) return;
      const fromStore = ideas.size;
      for (const id of unsaved) { const n = all.get(id); if (n) ideas.set(id, n); } // keep this visit's unsaved ideas
      all = ideas;
      sync();
      markLoaded();
      sortTheUnsorted();
      if (counted) return;
      counted = true;
      if (!s.older || !s.total) { olderDone = true; return; } // everything is loaded already
      s.total().then((t) => { // numbers count from the oldest of all, so loading older ones never renumbers the sky
        if (g !== gen || t === null) return;
        base = Math.max(0, t - fromStore - older.size);
        if (base === 0) olderDone = true;
        sync();
      });
    }));
  }
  listen();

  /** Ideas shown without categories (never sorted, or sorted with none under the old rule) are sorted now, once per visit, a few at a time. */
  function sortTheUnsorted(): void {
    const due = newestIdeas(all.values(), IDEA_LIMITS.inSky).filter((n) => needsSorting(n.categories) && !unsaved.has(n.id) && !asked.has(n.id)).slice(0, RESORT_PER_LOAD);
    for (const n of due) { asked.add(n.id); sortIntoCategories(n.id); }
  }

  const nameOf = (id: string) => { const n = all.get(id) ?? older.get(id); const numbered = ideaName(numbers().get(id)); return n ? labelOf(n, numbered, source.named) : numbered; };
  const stageOf = (n: Idea) => shownStage(n.stage, source.stages ?? SHOW_STAGES);

  /** An idea's flock: its most likely category (Jev lists them most likely first), as a dream's school is its main theme; none yet = a loner. */
  const flockOf = (idea: Idea): string => idea.categories?.[0] ?? "";

  function sync(): void {
    const shown = newestIdeas(all.values(), IDEA_LIMITS.inSky);
    renderList(shown);
    if (!sky) return;
    const keep = new Set(shown.map((n) => n.id));
    for (const id of sky.slugs()) if (!keep.has(id)) sky.remove(id);
    const b = sky.bounds(), nums = numbers();
    for (const n of shown) {
      const name = labelOf(n, ideaName(nums.get(n.id)), source.named);
      if (sky.has(n.id)) { sky.retag(n.id, name, `${name}: open the idea`); sky.reform(n.id, stageOf(n)); sky.flock(n.id, flockOf(n)); sky.grow(n.id, likeScale(likes.get(n.id) ?? 0)); continue; }
      if (inFlight.has(n.id)) continue;
      const angle = rand() * Math.PI * 2;
      sky.add(n.id, {
        tag: name, label: `${name}: open the idea`, stage: stageOf(n), flock: flockOf(n),
        from: v(80 + rand() * Math.max(1, b.width - 160), b.height * 0.45 + rand() * Math.max(1, b.height * 0.5 - 60)),
        velocity: v(Math.cos(angle) * NEW_IDEA_SPEED, Math.sin(angle) * NEW_IDEA_SPEED),
      });
      sky.grow(n.id, likeScale(likes.get(n.id) ?? 0));
    }
    askLikes(shown.map((n) => n.id));
  }

  const listWrap = byId("ideas-fallback"), list = byId("ideas-list");
  function renderList(shown: Idea[]): void {
    listWrap.hidden = shown.length === 0;
    const nums = numbers();
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
    get: (id) => all.get(id) ?? older.get(id),
    has: (id) => all.has(id) || older.has(id),
    nameOf,
    markInFlight: (id, flying) => { if (flying) inFlight.add(id); else inFlight.delete(id); },
    update(idea) { if (all.has(idea.id)) { all.set(idea.id, idea); sync(); } else if (older.has(idea.id)) older.set(idea.id, idea); },
    forget(id) { all.delete(id); older.delete(id); unsaved.delete(id); sync(); },
    sync,
    loaded,
    store: () => source.store,
    stagesShown: () => source.stages ?? SHOW_STAGES,
    records: () => [...all.values(), ...older.values()],
    mayHaveOlder: () => !olderDone,
    setLikes(id, count) { if (!source.likeCounts) return; likes.set(id, count); likesAsked.add(id); sync(); },
    async loadOlder() {
      const g = gen, s = await source.store, oldest = Math.min(...[...all.values(), ...older.values()].map((n) => n.at));
      if (!s.older || olderDone || !Number.isFinite(oldest)) { olderDone = true; return "end"; }
      const page = await s.older(oldest, OLDER_PAGE);
      if (g !== gen) return "end";
      if (!page) return "failed";
      for (const n of page) if (!all.has(n.id)) older.set(n.id, n);
      base = Math.max(0, base - page.length);
      if (page.length < OLDER_PAGE || base === 0) olderDone = true;
      return olderDone ? "end" : "more";
    },
    use(next) {
      source = next;
      all = new Map(); older = new Map(); base = 0; olderDone = false; likes = new Map(); likesAsked = new Set(); unsaved.clear(); inFlight.clear(); asked.clear();
      sync();
      listen();
    },
  };
}
