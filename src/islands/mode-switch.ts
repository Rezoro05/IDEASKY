/** Your own sky and sea, or everyone's. Signed out, the page is public. Signing in opens your own (empty at first), and a "Public"
 *  button appears next to your initial: pressed, it shows everyone's ideas and dreams; pressed again, yours. The choice is remembered.
 *  Everything you share while in your own sky and sea is private (boundaries/privateStore); the database lets only you see it. */
import { modeAfterSignIn, startingMode, type Mode } from "../lib/mode";
import type { User } from "../lib/account";
import type { Auth } from "../boundaries/auth";
import type { Board, Source } from "./board";
import type { SeaBoard } from "./sea";
import { HERO, SEA } from "../content/site";
import { byId } from "./dom";
import type { UpdateStore } from "../boundaries/updateStore";

export type Sources = { ideas: Source; dreams: Source; /** Owners' updates on ideas. */ updates: Promise<UpdateStore> };
export type ModeSwitch = { mode(): Mode; /** The sources shown now. */ current(): Sources };

const MODE_ITEM = "skyofideas.mode";

export function startModeSwitch(opts: {
  auth: Auth; board: Board; sea: SeaBoard;
  everyone: Sources;
  /** The signed-in visitor's own ideas and dreams (made once per visitor). */
  ownedBy: (user: User) => Sources;
  /** A link to a public idea is being opened (#idea-…): start in public. */
  openingPublicIdea: boolean;
  storage: Storage | null;
  /** The letter is about to show another set: close any open one. */
  switching: () => void;
  say: (text: string) => void;
}): ModeSwitch {
  const root = document.documentElement, button = byId<HTMLButtonElement>("account-public");
  const remembered = (() => { try { return opts.storage?.getItem(MODE_ITEM); } catch { return null; } })();
  let mode: Mode = "public", user: User | null = null, first = true;
  const owned = new Map<string, Sources>();
  const sourcesFor = (u: User) => { let s = owned.get(u.id); if (!s) { s = opts.ownedBy(u); owned.set(u.id, s); } return s; };

  function apply(next: Mode): void {
    const changed = next !== mode || first;
    mode = next;
    root.dataset.mode = mode;
    button.hidden = !user;
    button.setAttribute("aria-pressed", String(mode === "public"));
    button.title = mode === "public" ? "Showing everyone's ideas and dreams. Press for your own." : "Showing your own ideas and dreams. Press for everyone's.";
    byId("hero-lede").textContent = mode === "mine" ? HERO.mineLede : HERO.lede;
    byId("sea-lede").textContent = mode === "mine" ? SEA.mineLede : SEA.lede;
    if (!changed) return;
    opts.switching();
    const sources = mode === "mine" && user ? sourcesFor(user) : opts.everyone;
    opts.board.use(sources.ideas);
    opts.sea.use(sources.dreams);
  }

  opts.auth.onChange((next) => {
    const wasFirst = first;
    user = next;
    if (wasFirst) { first = false; if (next) { apply(startingMode({ signedIn: true, remembered, openingPublicIdea: opts.openingPublicIdea })); return; } root.dataset.mode = "public"; button.hidden = true; return; }
    apply(modeAfterSignIn(!!next));
  });

  button.addEventListener("click", () => {
    const next: Mode = mode === "public" ? "mine" : "public";
    try { opts.storage?.setItem(MODE_ITEM, next); } catch { /* remembered this visit only */ }
    apply(next);
    opts.say(next === "public" ? "Showing everyone’s ideas and dreams." : "Showing your own ideas and dreams. Only you can see them.");
  });
  return { mode: () => mode, current: () => (mode === "mine" && user ? sourcesFor(user) : opts.everyone) };
}
