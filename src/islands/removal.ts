/** The owner's bin on an open idea. Removing is for good, so it's asked first, right under the icon line.
 *  States: idle → asking → removing → removed (the letter closes) | asking with an error (not removed). Closing the letter cancels.
 *  Every open gets a token, so an answer that arrives after the letter closed or switched is ignored. */
import type { Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import { byId } from "./dom";

export type Removal = { open(idea: Idea): void; close(): void; /** Hide the question (another icon was chosen). */ closePanel(): void };

const REMOVE_FAILED = "Couldn’t remove it. Try again later.";

export function startRemoval(opts: {
  store: Promise<IdeaStore>; /** Where dreams live (the same table; a separate store in memory). */ dreamStore?: Promise<IdeaStore>;
  removed: (idea: Idea) => void; /** The question was just opened by the bin. */ opened?: () => void;
}): Removal {
  const bin = byId<HTMLButtonElement>("letter-remove"), confirm = byId("remove-confirm");
  const yes = byId<HTMLButtonElement>("remove-yes"), cancel = byId<HTMLButtonElement>("remove-cancel"), error = byId("remove-error");
  let idea: Idea | null = null, owner = false, asking = false, token = 0, store: IdeaStore | null = null;

  function render(): void {
    bin.hidden = !owner;
    bin.setAttribute("aria-expanded", String(asking));
    confirm.hidden = !asking;
  }

  bin.addEventListener("click", () => {
    if (!idea || !owner) return;
    asking = !asking; error.hidden = true; render();
    if (asking) { opts.opened?.(); cancel.focus(); }
  });
  cancel.addEventListener("click", () => { asking = false; error.hidden = true; render(); bin.focus(); });
  yes.addEventListener("click", async () => {
    if (!idea || !store) return;
    const mine = token, gone = idea;
    yes.disabled = cancel.disabled = true;
    const ok = await store.remove(gone);
    yes.disabled = cancel.disabled = false;
    if (mine !== token) return;
    if (!ok) { error.textContent = REMOVE_FAILED; error.hidden = false; return; }
    asking = false; render();
    opts.removed(gone);
  });

  return {
    async open(next) {
      const mine = ++token;
      idea = next; owner = false; asking = false; error.hidden = true;
      render();
      store = await (next.kind === "dream" && opts.dreamStore ? opts.dreamStore : opts.store);
      if (mine !== token) return;
      owner = store.ownsKey(next.id);
      render();
    },
    close() { token++; idea = null; asking = false; error.hidden = true; render(); },
    closePanel() { asking = false; error.hidden = true; render(); },
  };
}
