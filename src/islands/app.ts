/** Wires the pure parts to the page. Every feature lights up on its own; if one fails, the rest of the page still works. */
import { FORMSPREE_ENDPOINT, PUBLIC_BOARD } from "../content/site";
import { FLIGHT_CONFIGS, motionProfileFor } from "../lib/motion";
import { memoryStore, supabaseStore, toHex, type IdeaStore } from "../boundaries/ideaStore";
import type { Idea } from "../lib/ideas";
import { browserKeyStore, COMMENT_KEYS_ITEM, LIKES_ITEM } from "../boundaries/keyStore";
import { likerIdFrom, memoryLikes, supabaseLikes, type LikeStore } from "../boundaries/likeStore";
import { memoryComments, supabaseComments, type CommentStore } from "../boundaries/commentStore";
import { inboxFor } from "../boundaries/inbox";
import { startSky, type Sky } from "./sky";
import { startBoard } from "./board";
import { startComposer } from "./composer";
import { startThread } from "./thread";
import { startLikes } from "./likes";
import { startStagePanel } from "./stage-panel";
import { byId, prefersReducedMotion, randomBytes } from "./dom";

function safeStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }

let leaving = false;
addEventListener("pagehide", () => { leaving = true; });
addEventListener("pageshow", () => { leaving = false; }); // back/forward cache brings the page back

async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

type Stores = { ideas: IdeaStore; comments: CommentStore; likes: LikeStore };

/** Supabase when a board is configured; otherwise everything lives in memory for this visit. */
function chooseStores(): Stores {
  if (!PUBLIC_BOARD.url) return { ideas: memoryStore(), comments: memoryComments(), likes: memoryLikes() };
  const base = { url: PUBLIC_BOARD.url, key: PUBLIC_BOARD.key, fetch: window.fetch.bind(window), randomBytes, sha256Hex };
  const likeKeys = browserKeyStore(safeStorage(), LIKES_ITEM);
  return {
    ideas: supabaseStore({ ...base, keys: browserKeyStore(safeStorage()) }),
    comments: supabaseComments({ ...base, keys: browserKeyStore(safeStorage(), COMMENT_KEYS_ITEM) }),
    likes: supabaseLikes({ ...base, keys: likeKeys, likerId: likerIdFrom(likeKeys, randomBytes), pageIsLeaving: () => leaving }),
  };
}

export function startSite(): void {
  const reducedMotion = prefersReducedMotion();
  const profile = motionProfileFor({ prefersReducedMotion: reducedMotion, viewportWidth: innerWidth });

  let sky: Sky | null = null;
  let openPlane: (id: string, origin: { x: number; y: number }) => void = () => {};
  if (profile === "none") {
    byId("fallback").hidden = false;
  } else {
    sky = startSky({
      field: byId("field"),
      config: FLIGHT_CONFIGS[profile],
      visitSeed: new Uint32Array(randomBytes(4).buffer)[0]!,
      onOpen: (id, origin) => openPlane(id, origin),
      covered: () => document.documentElement.classList.contains("sky-covered"),
    });
    const overlays = [byId("compose"), byId("letter")];
    const markCovered = () => document.documentElement.classList.toggle("sky-covered", overlays.some((o) => o.classList.contains("open")));
    const watcher = new MutationObserver(markCovered);
    for (const o of overlays) watcher.observe(o, { attributes: true, attributeFilter: ["class"] });
  }

  const stores = Promise.resolve(chooseStores());
  const inbox = inboxFor(FORMSPREE_ENDPOINT, window.fetch.bind(window));
  let nameOf = (id: string) => id;
  let commentPosted = (_ideaId: string) => {};
  const thread = startThread({ store: stores.then((s) => s.comments), inbox, ideaNameOf: (id) => nameOf(id), posted: (id) => commentPosted(id) });
  const likes = startLikes({ store: stores.then((s) => s.likes) });
  let ideaMoved = (_idea: Idea) => {};
  const stage = startStagePanel({ store: stores.then((s) => s.ideas), moved: (idea) => ideaMoved(idea) });
  const board = startBoard({ sky, store: stores.then((s) => s.ideas), letter: {
    opened: (idea) => { thread.open(idea.id); likes.open(idea.id); stage.open(idea); },
    closed: () => { thread.close(); likes.close(); stage.close(); },
  } });
  ideaMoved = board.update;
  nameOf = board.nameOf;
  commentPosted = board.foldAfterComment;
  openPlane = board.openLetter;
  startComposer({ board, sky, reducedMotion, inbox });
  board.sync();
}
