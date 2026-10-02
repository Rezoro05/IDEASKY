/** The public idea board on the page: keeps the ideas, flies the newest in the sky, lists them without motion, and opens them as letters. */
import { ideaName, ideaNumbers, letterDateLine, newestIdeas, previewLine, IDEA_LIMITS, type Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import { v, type Vec } from "../lib/vec";
import type { Sky } from "./sky";
import { byId, cancelPendingOpen, openWithTransition } from "./dom";

export type Board = {
  /** An idea this visitor just wrote: shown right away, saved in the background. Resolves to whether the board kept it. */
  post(idea: Idea): Promise<boolean>;
  has(id: string): boolean;
  nameOf(id: string): string;
  /** While a new idea flies up, the sky waits for it instead of spawning a second plane. */
  markInFlight(id: string, flying: boolean): void;
  openLetter(id: string, origin?: Vec): void;
  sync(): void;
};

const NEW_IDEA_SPEED = 40;
const REMOVE_FAILED = "Couldn’t remove it. Try again later.";

export type LetterHooks = { opened(ideaId: string): void; closed(): void };

export function startBoard(opts: { sky: Sky | null; store: Promise<IdeaStore>; random?: () => number; letter?: LetterHooks }): Board {
  const { sky } = opts;
  const rand = opts.random ?? Math.random;
  let all = new Map<string, Idea>();
  const unsaved = new Set<string>(), inFlight = new Set<string>();
  let store: IdeaStore | null = null;
  opts.store.then((s) => {
    store = s;
    s.subscribe((ideas) => {
      for (const id of unsaved) { const n = all.get(id); if (n) ideas.set(id, n); } // keep this visit's unsaved ideas
      all = ideas;
      sync();
    });
  });

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
      if (sky.has(n.id)) { sky.retag(n.id, name, `${name}: open the idea`); continue; }
      if (inFlight.has(n.id)) continue;
      const angle = rand() * Math.PI * 2;
      sky.add(n.id, {
        tag: name, label: `${name}: open the idea`,
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
    openLetter(a.dataset.idea!, v(r.left + 40, r.top + r.height / 2));
  });

  /* Letter: a caught plane unfolds into a readable paper note */
  const letter = byId("letter"), removeBtn = byId<HTMLButtonElement>("letter-remove");
  let open: Idea | null = null, returnFocus: Element | null = null;
  const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function openLetter(id: string, origin?: Vec): void {
    const n = all.get(id);
    if (!n) return;
    open = n; returnFocus = document.activeElement;
    byId("letter-from").textContent = nameOf(n.id);
    byId("letter-date").textContent = letterDateLine(n, dateOf);
    byId("letter-body").textContent = n.message;
    removeBtn.hidden = !store?.ownsKey(n.id);
    removeBtn.textContent = "Remove this idea";
    const card = letter.querySelector<HTMLElement>(".letter-card")!;
    card.style.setProperty("--dx", origin ? origin.x - innerWidth / 2 + "px" : "0px");
    card.style.setProperty("--dy", origin ? origin.y - innerHeight / 2 + "px" : "0px");
    openWithTransition(letter);
    opts.letter?.opened(n.id);
    byId("letter-close").focus({ preventScroll: true });
  }
  function closeLetter(): void {
    cancelPendingOpen(letter);
    letter.classList.remove("open"); open = null;
    opts.letter?.closed();
    setTimeout(() => { if (!letter.classList.contains("open")) letter.hidden = true; }, 300);
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  }
  byId("letter-close").addEventListener("click", closeLetter);
  byId("letter-refold").addEventListener("click", closeLetter);
  letter.addEventListener("click", (e) => { if (e.target === letter) closeLetter(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !letter.hidden) closeLetter(); });
  removeBtn.addEventListener("click", async () => {
    const n = open;
    if (!n || !store) return;
    removeBtn.disabled = true;
    const ok = await store.remove(n);
    removeBtn.disabled = false;
    if (!ok) { removeBtn.textContent = REMOVE_FAILED; return; }
    all.delete(n.id); unsaved.delete(n.id);
    sync(); closeLetter();
  });

  return {
    async post(idea) {
      all.set(idea.id, idea); unsaved.add(idea.id);
      const s = await opts.store;
      const saved = await s.add(idea);
      if (saved) unsaved.delete(idea.id);
      return saved;
    },
    has: (id) => all.has(id),
    nameOf,
    markInFlight: (id, flying) => { if (flying) inFlight.add(id); else inFlight.delete(id); },
    openLetter,
    sync,
  };
}
