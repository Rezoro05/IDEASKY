/** Your own sky and sea, or everyone's: the Private | Public switch top right, always there.
 *  Signed out, the page is public; choosing Private asks you to sign in first (the sign-in note opens), and signing in opens your own
 *  (empty at first). Signed in, the switch moves between your own and everyone's. The choice is remembered.
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
  /** Private was chosen while signed out: ask to sign in. */
  askToSignIn: () => void;
  say: (text: string) => void;
}): ModeSwitch {
  const root = document.documentElement;
  const mineRadio = byId<HTMLInputElement>("board-mine"), publicRadio = byId<HTMLInputElement>("board-public");
  const remembered = (() => { try { return opts.storage?.getItem(MODE_ITEM); } catch { return null; } })();
  let mode: Mode = "public", user: User | null = null, first = true;
  const owned = new Map<string, Sources>();
  const sourcesFor = (u: User) => { let s = owned.get(u.id); if (!s) { s = opts.ownedBy(u); owned.set(u.id, s); } return s; };

  /** The switch shows the board you are on. */
  function showChoice(): void { mineRadio.checked = mode === "mine"; publicRadio.checked = mode === "public"; }

  function apply(next: Mode): void {
    const changed = next !== mode || first;
    mode = next;
    root.dataset.mode = mode;
    showChoice();
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
    if (wasFirst) { first = false; if (next) { apply(startingMode({ signedIn: true, remembered, openingPublicIdea: opts.openingPublicIdea })); return; } root.dataset.mode = "public"; showChoice(); return; }
    apply(modeAfterSignIn(!!next));
  });

  function choose(next: Mode): void {
    if (next === mode) return;
    if (next === "mine" && !user) { showChoice(); opts.askToSignIn(); return; } // your own board needs you signed in: sign in first
    try { opts.storage?.setItem(MODE_ITEM, next); } catch { /* remembered this visit only */ }
    apply(next);
    opts.say(next === "public" ? "Showing everyone’s ideas and dreams." : "Showing your own ideas and dreams. Only you can see them.");
  }
  mineRadio.addEventListener("change", () => { if (mineRadio.checked) choose("mine"); });
  publicRadio.addEventListener("change", () => { if (publicRadio.checked) choose("public"); });
  return { mode: () => mode, current: () => (mode === "mine" && user ? sourcesFor(user) : opts.everyone) };
}
