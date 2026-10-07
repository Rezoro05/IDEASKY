/** The letter: a caught plane unfolds into a readable paper note, and folds back into its plane when closed.
 *  States: closed → open → folding → closed (flying home), or open → closed directly (removed, or no sky to fly home to).
 *  The board owns the ideas; the letter asks it for one. */
import { letterDateLine, type Idea } from "../lib/ideas";
import { LISTS, categoryLabel } from "../lib/categories";
import { FISH_SVG } from "../lib/fish-art";
import type { SeaBoard } from "./sea";
import { v, type Vec } from "../lib/vec";
import type { Sky } from "./sky";
import { byId, cancelPendingOpen, openWithTransition } from "./dom";
import { flyAcrossPage } from "./flier";
import { linkItems } from "./link-list";

export type Letter = {
  open(id: string, origin?: Vec): void;
  /** Someone just commented on this idea: let them see it land, then fold the letter and fly it home. */
  foldAfterComment(ideaId: string): void;
  /** The open idea changed (its owner moved its stage). */
  refresh(idea: Idea): void;
  /** The open idea is gone (its owner removed it): close at once, nothing to fly home to. */
  dismiss(): void;
};
export type LetterHooks = { opened(idea: Idea): void; closed(): void };

const FOLD_MS = 750, RETURN_FLIGHT_MS = 900, PAUSE_AFTER_COMMENT_MS = 1000, FADE_MS = 300;
const dateOf = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function startLetter(opts: {
  sky: Sky | null;
  /** Where dreams swim: a dream's letter folds home to its fish. */
  sea?: SeaBoard | null;
  ideaOf(id: string): Idea | undefined; nameOf(id: string): string;
  hooks?: LetterHooks;
}): Letter {
  const { sky } = opts;
  const letter = byId("letter"), card = letter.querySelector<HTMLElement>(".letter-card")!;
  const links = byId<HTMLUListElement>("letter-links");
  let shown: Idea | null = null, returnFocus: Element | null = null, state: "closed" | "open" | "folding" = "closed", opening = 0;

  function open(id: string, origin?: Vec): void {
    const idea = opts.ideaOf(id);
    if (!idea || state === "folding") return;
    shown = idea; returnFocus = document.activeElement; state = "open"; opening++;
    card.classList.remove("folding");
    card.classList.toggle("is-dream", idea.kind === "dream"); // no stages, no updates
    byId("letter-from").textContent = opts.nameOf(idea.id);
    byId("letter-date").textContent = letterDateLine(idea, dateOf);
    byId("letter-body").textContent = idea.message;
    links.hidden = idea.links.length === 0;
    links.replaceChildren(...linkItems(idea.links));
    showCategories(idea);
    card.style.setProperty("--dx", origin ? origin.x - innerWidth / 2 + "px" : "0px");
    card.style.setProperty("--dy", origin ? origin.y - innerHeight / 2 + "px" : "0px");
    openWithTransition(letter);
    opts.hooks?.opened(idea);
    byId("letter-close").focus({ preventScroll: true });
  }

  /** Category tags under the name and date: shown once Jev has sorted the idea. */
  function showCategories(idea: Idea): void {
    const tags = byId<HTMLUListElement>("letter-cats"), keys = idea.categories ?? [], list = LISTS[idea.kind ?? "idea"];
    tags.hidden = keys.length === 0;
    tags.replaceChildren(...keys.map((k) => { const li = document.createElement("li"); li.textContent = categoryLabel(list, k); return li; }));
  }

  function close(): void {
    cancelPendingOpen(letter);
    letter.classList.remove("open");
    if (state === "open") opts.hooks?.closed();
    shown = null; state = "closed";
    setTimeout(() => { if (!letter.classList.contains("open")) { letter.hidden = true; card.classList.remove("folding"); } }, FADE_MS);
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  }

  /** Every way of closing a letter folds it back into its plane, which flies home and merges into the plane in the sky. */
  function fold(): void {
    const idea = shown, dream = idea?.kind === "dream";
    const homeOf = (id: string) => (dream ? opts.sea?.screenPointOf(id) : sky?.screenPointOf(id)) ?? null;
    const home = idea && homeOf(idea.id);
    if (state !== "open") return;
    if (!idea || !home) { close(); return; }
    state = "folding";
    opts.hooks?.closed();
    cancelPendingOpen(letter);
    const r = card.getBoundingClientRect(), from = v(r.left + r.width / 2, r.top + r.height / 2);
    card.classList.add("folding");
    setTimeout(() => {
      let lastHome = home;
      close();
      flyAcrossPage({
        from, durationMs: RETURN_FLIGHT_MS, scaleAt: (u) => 1 - 0.45 * u, stage: (opts.ideaOf(idea.id) ?? idea).stage,
        ...(dream ? { fish: FISH_SVG } : {}),
        target: () => (lastHome = homeOf(idea.id) ?? lastHome),
      });
    }, FOLD_MS);
  }

  byId("letter-close").addEventListener("click", fold);
  letter.addEventListener("click", (e) => { if (e.target === letter) fold(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state === "open") fold(); });
  return {
    open,
    foldAfterComment(ideaId) {
      const sameOpening = opening;
      setTimeout(() => { if (shown?.id === ideaId && opening === sameOpening) fold(); }, PAUSE_AFTER_COMMENT_MS);
    },
    refresh(idea) { if (shown?.id === idea.id) { shown = idea; if (state === "open") showCategories(idea); } },
    dismiss() { if (state === "open") close(); },
  };
}
