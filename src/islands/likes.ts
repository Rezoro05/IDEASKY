/** The heart on an open idea. Tapping shows the change at once and saves it behind; if saving fails, it goes back.
 *  Every open gets a token, so answers that arrive after the letter closed or switched are ignored. */
import { likeButtonLabel, likeCountText, toggled, type LikeState } from "../lib/likes";
import type { LikeStore } from "../boundaries/likeStore";
import { byId } from "./dom";

export type Likes = { open(ideaId: string): void; close(): void };

export function startLikes(opts: { store: Promise<LikeStore> }): Likes {
  const button = byId<HTMLButtonElement>("like-btn"), countEl = byId("like-count");
  let ideaId: string | null = null, token = 0, state: LikeState = { liked: false, count: 0 }, countKnown = false, store: LikeStore | null = null;

  function render(): void {
    button.setAttribute("aria-pressed", String(state.liked));
    button.setAttribute("aria-label", likeButtonLabel(state));
    countEl.textContent = likeCountText(countKnown ? state.count : null);
  }

  async function open(id: string): Promise<void> {
    const mine = ++token;
    ideaId = id;
    store = await opts.store;
    if (mine !== token) return;
    state = { liked: store.likedHere(id), count: 0 }; countKnown = false;
    render();
    const count = await store.count(id);
    if (mine !== token || count === null) return;
    state = { ...state, count: Math.max(count, state.liked ? 1 : 0) }; countKnown = true; // a tap may have landed before the count did
    render();
  }

  button.addEventListener("click", async () => {
    if (!ideaId || !store) return;
    const mine = token, before = state, id = ideaId;
    state = toggled(state);
    render();
    const saved = await (state.liked ? store.like(id) : store.unlike(id));
    if (mine !== token || saved) return;
    state = before;
    render();
  });

  return {
    open: (id) => { void open(id); },
    close: () => { token++; ideaId = null; },
  };
}
