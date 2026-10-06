/** The public idea board on the page: keeps the ideas, flies the newest in the sky, and lists them when motion is reduced. */
import { ideaName, ideaNumbers, newestIdeas, previewLine, IDEA_LIMITS, type Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import type { Categorizer } from "../boundaries/categorizer";
import { v, type Vec } from "../lib/vec";
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
};

const NEW_IDEA_SPEED = 40;

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
  opts.store.then((s) => s.subscribe((ideas) => {
    for (const id of unsaved) { const n = all.get(id); if (n) ideas.set(id, n); } // keep this visit's unsaved ideas
    all = ideas;
    sync();
    markLoaded();
  }));

  const nameOf = (id: string) => ideaName(ideaNumbers(all.values()).get(id));

  function sync(): void {
    const shown = newestIdeas(all.values(), IDEA_LIMITS.inSky);
    renderList(shown);
    if (!sky) return;
    const keep = new Set(shown.map((n) => n.id));
    for (const id of sky.slugs()) if (!keep.has(id)) sky.remove(id);
    const b = sky.bounds(), nums = ideaNumbers(all.values());
    for (const n of shown) {
      const name = ideaName(nums.get(n.id));
      if (sky.has(n.id)) { sky.retag(n.id, name, `${name}: open the idea`); sky.reform(n.id, n.stage); continue; }
      if (inFlight.has(n.id)) continue;
      const angle = rand() * Math.PI * 2;
      sky.add(n.id, {
        tag: name, label: `${name}: open the idea`, stage: n.stage,
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
    opts.categorizer?.categorize(id).then((categories) => {
      const idea = all.get(id);
      if (!categories || !idea) return;
      const sorted = { ...idea, categories };
      all.set(id, sorted);
      opts.changed?.(sorted);
    });
  }

  return {
    async post(idea) {
      all.set(idea.id, idea); unsaved.add(idea.id);
      const s = await opts.store;
      const saved = await s.add(idea);
      if (saved) { unsaved.delete(idea.id); sortIntoCategories(idea.id); }
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
  };
}
