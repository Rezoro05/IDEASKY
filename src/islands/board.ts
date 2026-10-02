/** The public idea board on the page: keeps the notes, flies the newest in the sky, lists them without motion, and opens them as letters. */
import { canRemove, ideaName, ideaNumbers, letterDateLine, newestNotes, noteIdFromSlug, noteSlug, previewLine, NOTE_LIMITS, type Note } from "../lib/notes";
import type { IdeaStore } from "../boundaries/ideaStore";
import { v, type Vec } from "../lib/vec";
import type { Sky } from "./sky";
import { byId, openWithTransition } from "./dom";

export type Board = {
  /** A note this visitor just wrote: shown right away, saved in the background. Resolves to whether the board kept it. */
  post(note: Note): Promise<boolean>;
  has(id: string): boolean;
  nameOf(id: string): string;
  /** While a new note flies up, the sky waits for it instead of spawning a second plane. */
  markInFlight(id: string, flying: boolean): void;
  openLetter(id: string, origin?: Vec): void;
  sync(): void;
};

const NEW_NOTE_SPEED = 40;
const REMOVE_FAILED = "Couldn’t remove it. Try again later.";

export type LetterHooks = { opened(ideaId: string): void; closed(): void };

export function startBoard(opts: { sky: Sky | null; store: Promise<IdeaStore>; random?: () => number; letter?: LetterHooks }): Board {
  const { sky } = opts;
  const rand = opts.random ?? Math.random;
  let all = new Map<string, Note>();
  const unsaved = new Set<string>(), inFlight = new Set<string>();
  let store: IdeaStore | null = null;
  opts.store.then((s) => {
    store = s;
    s.subscribe((notes) => {
      for (const id of unsaved) { const n = all.get(id); if (n) notes.set(id, n); } // keep this visit's unsaved notes
      all = notes;
      sync();
    });
  });

  const nameOf = (id: string) => ideaName(ideaNumbers(all.values()).get(id));

  function sync(): void {
    const shown = newestNotes(all.values(), NOTE_LIMITS.inSky);
    renderList(shown);
    if (!sky) return;
    const keep = new Set(shown.map((n) => noteSlug(n.id)));
    for (const slug of sky.noteSlugs()) if (!keep.has(slug)) sky.remove(slug);
    const b = sky.bounds(), nums = ideaNumbers(all.values());
    for (const n of shown) {
      const name = ideaName(nums.get(n.id)), slug = noteSlug(n.id);
      if (sky.has(slug)) { sky.retag(slug, name, `${name}: open the note`); continue; }
      if (inFlight.has(n.id)) continue;
      const angle = rand() * Math.PI * 2;
      sky.add(slug, {
        tag: name, label: `${name}: open the note`, href: "#", isNote: true,
        from: v(80 + rand() * Math.max(1, b.width - 160), b.height * 0.45 + rand() * Math.max(1, b.height * 0.5 - 60)),
        velocity: v(Math.cos(angle) * NEW_NOTE_SPEED, Math.sin(angle) * NEW_NOTE_SPEED),
      });
    }
  }

  const listWrap = byId("notes-fallback"), list = byId("notes-list");
  function renderList(shown: Note[]): void {
    listWrap.hidden = shown.length === 0;
    const nums = ideaNumbers(all.values());
    list.replaceChildren(...shown.map((n) => {
      const li = document.createElement("li"), a = document.createElement("a");
      a.href = "#"; a.dataset.note = n.id;
      const name = document.createElement("span"); name.className = "name"; name.textContent = ideaName(nums.get(n.id));
      const line = document.createElement("span"); line.className = "line"; line.textContent = previewLine(n.message);
      a.append(name, line); li.append(a); return li;
    }));
  }
  list.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLElement>("a[data-note]");
    if (!a) return;
    e.preventDefault();
    const r = a.getBoundingClientRect();
    openLetter(a.dataset.note!, v(r.left + 40, r.top + r.height / 2));
  });

  /* Letter: a caught note unfolds into a readable paper note */
  const letter = byId("letter"), removeBtn = byId<HTMLButtonElement>("letter-remove");
  let open: Note | null = null, returnFocus: Element | null = null;
  const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function openLetter(id: string, origin?: Vec): void {
    const n = all.get(id);
    if (!n) return;
    open = n; returnFocus = document.activeElement;
    byId("letter-from").textContent = nameOf(n.id);
    byId("letter-date").textContent = letterDateLine(n, dateOf);
    byId("letter-body").textContent = n.message;
    const viewer = store?.viewer();
    removeBtn.hidden = !store || !viewer || !canRemove(n,
      viewer.mode === "public" ? { mode: "public", hasKey: store.ownsKey(n.id) }
        : viewer.mode === "claude" ? { mode: "claude", isOwner: viewer.isOwner, uid: viewer.uid } : { mode: "none" });
    removeBtn.textContent = "Remove this idea";
    const card = letter.querySelector<HTMLElement>(".letter-card")!;
    card.style.setProperty("--dx", origin ? origin.x - innerWidth / 2 + "px" : "0px");
    card.style.setProperty("--dy", origin ? origin.y - innerHeight / 2 + "px" : "0px");
    openWithTransition(letter);
    opts.letter?.opened(n.id);
    byId("letter-close").focus({ preventScroll: true });
  }
  function closeLetter(): void {
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
    async post(note) {
      all.set(note.id, note); unsaved.add(note.id);
      const s = await opts.store;
      const saved = await s.add(note);
      if (saved) unsaved.delete(note.id);
      return saved;
    },
    has: (id) => all.has(id),
    nameOf,
    markInFlight: (id, flying) => { if (flying) inFlight.add(id); else inFlight.delete(id); },
    openLetter,
    sync,
  };
}

export const openPlaneHandler = (board: Board, openIdea: (slug: string, origin: Vec) => void) =>
  (slug: string, origin: Vec): void => {
    if (slug.startsWith("note-")) board.openLetter(noteIdFromSlug(slug), origin);
    else openIdea(slug, origin);
  };
