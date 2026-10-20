/** Sharing your own idea or dream on the public board: the globe on its letter (only in your own sky and sea).
 *  It asks first, with an optional name; then a copy is posted on the public board, as any visitor's post is (the board emails the site's owner,
 *  sorted into categories there), and your own keeps the copy's id: its letter then says "On the public board", with "Take it down".
 *  States: idle → asking → sharing → shared | asking with an error;  shared → taking down → idle | shared with an error.
 *  Taking down needs this browser's key for the copy (as removing any public post does). */
import { ANONYMOUS, IDEA_LIMITS, newRecordId, type Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import type { PrivateStore } from "../boundaries/privateStore";
import { byId, randomBytes } from "./dom";

export type GoPublic = { open(item: Idea): void; close(): void };

const SAYS = {
  failed: "Couldn’t share it just now. Try again in a moment.",
  downFailed: "Couldn’t take it down here. It can only be taken down from the browser it was shared from.",
  shared: (kind: "idea" | "dream") => kind === "dream" ? "Shared in the public sea. Anyone can open it now." : "Shared in the public sky. Anyone can catch it now.",
  down: "Taken down from the public board.",
};

const isPrivateStore = (s: IdeaStore): s is PrivateStore => typeof (s as Partial<PrivateStore>).markShared === "function";

export function startGoPublic(opts: {
  isMine: () => boolean;
  /** Where the item lives now (your own store), and the public board for its kind. */
  ownStore: (item: Idea) => Promise<IdeaStore>;
  publicStore: (item: Idea) => Promise<IdeaStore>;
  /** The item changed (shared or taken down): keep it and redraw. */
  changed: (item: Idea) => void;
  say: (text: string) => void;
  now?: () => number;
}): GoPublic {
  const now = opts.now ?? Date.now;
  const button = byId<HTMLButtonElement>("go-public-btn"), panel = byId("go-public"), ask = byId("go-public-ask"), done = byId("go-public-done");
  const name = byId<HTMLInputElement>("go-public-name"), yes = byId<HTMLButtonElement>("go-public-yes"), down = byId<HTMLButtonElement>("go-public-down");
  const error = byId("go-public-error");
  let item: Idea | null = null, asking = false, token = 0;

  function render(): void {
    const show = !!item && opts.isMine();
    button.hidden = !show; panel.hidden = !show;
    if (!show || !item) return;
    const shared = !!item.publicId;
    button.setAttribute("aria-expanded", String(asking));
    button.classList.toggle("is-on", shared);
    button.title = shared ? "On the public board" : "Share on the public board";
    ask.hidden = !asking || shared;
    done.hidden = !shared;
  }
  const fail = (text: string) => { error.textContent = text; error.hidden = false; };

  button.addEventListener("click", () => {
    if (!item) return;
    if (item.publicId) { asking = false; render(); down.focus(); return; }
    asking = !asking; error.hidden = true; name.value = ""; render();
    if (asking) name.focus();
  });
  byId("go-public-cancel").addEventListener("click", () => { asking = false; error.hidden = true; render(); button.focus(); });

  yes.addEventListener("click", async () => {
    if (!item || item.publicId) return;
    const mine = ++token, original = item;
    const copy: Idea = {
      id: newRecordId(randomBytes(8)), name: name.value.trim().slice(0, IDEA_LIMITS.name) || ANONYMOUS, message: original.message,
      links: original.links, stage: "idea", at: now(), ...(original.kind === "dream" ? { kind: "dream" as const } : {}),
    };
    yes.disabled = true;
    const posted = await (await opts.publicStore(original)).add(copy);
    const own = await opts.ownStore(original);
    const marked = posted && isPrivateStore(own) && await own.markShared(original.id, copy.id);
    yes.disabled = false;
    if (mine !== token) return;
    if (!posted) { fail(SAYS.failed); return; }
    // Posted even if remembering it failed: it is public now, so say so and show it as shared for this visit.
    const shared = { ...original, publicId: copy.id };
    item = shared; asking = false; error.hidden = true; render();
    opts.changed(shared);
    opts.say(SAYS.shared(original.kind === "dream" ? "dream" : "idea"));
    if (!marked) console.warn("shared, but not remembered on your own board");
  });

  down.addEventListener("click", async () => {
    if (!item?.publicId) return;
    const mine = ++token, original = item, publicId = item.publicId;
    down.disabled = true;
    const removed = await (await opts.publicStore(original)).remove({ ...original, id: publicId });
    const own = await opts.ownStore(original);
    const unmarked = removed && isPrivateStore(own) && await own.markShared(original.id, null);
    down.disabled = false;
    if (mine !== token) return;
    if (!removed) { fail(SAYS.downFailed); return; }
    const { publicId: _gone, ...rest } = original;
    item = rest; error.hidden = true; render();
    opts.changed(rest);
    opts.say(SAYS.down);
    if (!unmarked) console.warn("taken down, but not forgotten on your own board");
  });

  return {
    open(next) { item = next; asking = false; token++; error.hidden = true; render(); },
    close() { item = null; asking = false; token++; render(); },
  };
}
