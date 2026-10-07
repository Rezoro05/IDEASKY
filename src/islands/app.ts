/** Wires the pure parts to the page. Every feature lights up on its own; if one fails, the rest of the page still works. */
import { DEMO_IDEAS, FORMSPREE_ENDPOINT, PUBLIC_BOARD } from "../content/site";
import { demoIdeas } from "../content/demo-ideas";
import { demoDreams } from "../content/demo-dreams";
import { startSea } from "./sea";
import { FLIGHT_CONFIGS, motionProfileFor } from "../lib/motion";
import { memoryStore, supabaseStore, toHex, type IdeaStore } from "../boundaries/ideaStore";
import type { Idea } from "../lib/ideas";
import { browserKeyStore, COMMENT_KEYS_ITEM, COMMENT_LIKES_ITEM, LIKES_ITEM } from "../boundaries/keyStore";
import { memoryCommentLikes, supabaseCommentLikes, type CommentLikeStore } from "../boundaries/commentLikeStore";
import { likerIdFrom, memoryLikes, supabaseLikes, type LikeStore } from "../boundaries/likeStore";
import { memoryComments, supabaseComments, type CommentStore } from "../boundaries/commentStore";
import { inboxFor } from "../boundaries/inbox";
import { memoryUpdates, supabaseUpdates, type UpdateStore } from "../boundaries/updateStore";
import { startSky, type Sky } from "./sky";
import { startBoard } from "./board";
import { startLetter } from "./letter";
import { startComposer } from "./composer";
import { startFeedback } from "./feedback";
import { startToast } from "./toast";
import { startThread } from "./thread";
import { startLikes } from "./likes";
import { startStagePanel } from "./stage-panel";
import { startUpdates } from "./updates";
import { startRemoval } from "./removal";
import { panelsToClose, type Panel } from "../lib/icon-menu";
import { startShare } from "./share";
import { ideaLink, linkedIdeaId } from "../lib/idea-link";
import { byId, prefersReducedMotion, randomBytes } from "./dom";
import { hideLoaderWhenReady } from "./loader";
import { startDepth } from "./depth";
import { startDictation } from "./dictation";
import { browserSpeech } from "../boundaries/speech";
import { noCategorizer, supabaseCategorizer } from "../boundaries/categorizer";

function safeStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }

let leaving = false;
addEventListener("pagehide", () => { leaving = true; });
addEventListener("pageshow", () => { leaving = false; }); // back/forward cache brings the page back

async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

type Stores = { ideas: IdeaStore; dreams: IdeaStore; comments: CommentStore; commentLikes: CommentLikeStore; likes: LikeStore; updates: UpdateStore };

/** Supabase when a board is configured; otherwise everything lives in memory for this visit. */
function chooseStores(): Stores {
  if (!PUBLIC_BOARD.url) {
    const ideas = memoryStore(DEMO_IDEAS ? demoIdeas(Date.now()) : []);
    return { ideas, dreams: memoryStore(DEMO_IDEAS ? demoDreams(Date.now()) : []), comments: memoryComments(), commentLikes: memoryCommentLikes(), likes: memoryLikes(), updates: memoryUpdates((id) => ideas.ownsKey(id)) };
  }
  const base = { url: PUBLIC_BOARD.url, key: PUBLIC_BOARD.key, fetch: window.fetch.bind(window), randomBytes, sha256Hex };
  const likeKeys = browserKeyStore(safeStorage(), LIKES_ITEM), ideaKeys = browserKeyStore(safeStorage());
  const likerId = likerIdFrom(likeKeys, randomBytes); // one liker id for ideas and comments alike
  return {
    ideas: supabaseStore({ ...base, keys: ideaKeys }),
    dreams: supabaseStore({ ...base, keys: ideaKeys, kind: "dream" }),
    updates: supabaseUpdates({ ...base, ideaKeys }),
    comments: supabaseComments({ ...base, keys: browserKeyStore(safeStorage(), COMMENT_KEYS_ITEM) }),
    likes: supabaseLikes({ ...base, keys: likeKeys, likerId, pageIsLeaving: () => leaving }),
    commentLikes: supabaseCommentLikes({ ...base, keys: browserKeyStore(safeStorage(), COMMENT_LIKES_ITEM), likerId, pageIsLeaving: () => leaving }),
  };
}

export function startSite(): void {
  hideLoaderWhenReady({ loader: document.querySelector(".loader"), picture: document.querySelector(".skyline") });
  const reducedMotion = prefersReducedMotion();
  const profile = motionProfileFor({ prefersReducedMotion: reducedMotion, viewportWidth: innerWidth });

  let sky: Sky | null = null;
  let openPlane: (id: string, origin: { x: number; y: number }) => void = () => {};
  if (profile === "none") {
    byId("fallback").hidden = false;
  } else {
    sky = startSky({
      field: byId("field"),
      cage: byId("cage"),
      config: FLIGHT_CONFIGS[profile],
      visitSeed: new Uint32Array(randomBytes(4).buffer)[0]!,
      onOpen: (id, origin) => openPlane(id, origin),
      covered: () => document.documentElement.classList.contains("sky-covered") || document.documentElement.dataset.depth === "sea", // under an overlay, or out of view in the sea
    });
    const overlays = [byId("compose"), byId("letter"), byId("feedback")];
    const markCovered = () => document.documentElement.classList.toggle("sky-covered", overlays.some((o) => o.classList.contains("open")));
    const watcher = new MutationObserver(markCovered);
    for (const o of overlays) watcher.observe(o, { attributes: true, attributeFilter: ["class"] });
  }

  startDepth({
    root: document.documentElement, world: byId("world"), sky: byId("sky-part"), sea: byId("sea"),
    dive: byId("dive-btn"), surface: byId("surface-btn"), seaTitle: byId("sea-title"), reducedMotion,
    blocked: () => document.documentElement.classList.contains("sky-covered"),
  });

  const stores = Promise.resolve(chooseStores());
  const categorizer = PUBLIC_BOARD.url ? supabaseCategorizer({ url: PUBLIC_BOARD.url, key: PUBLIC_BOARD.key, fetch: window.fetch.bind(window) }) : noCategorizer;
  const sea = startSea({
    field: byId("sea-field"), surface: byId("sea"), list: profile === "none" ? byId<HTMLUListElement>("dreams-list") : null,
    store: stores.then((s) => s.dreams), visitSeed: new Uint32Array(randomBytes(4).buffer)[0]!,
    size: FLIGHT_CONFIGS[profile === "none" ? "lite" : profile].planeSize,
    active: () => document.documentElement.dataset.depth === "sea" && !document.documentElement.classList.contains("sky-covered"),
    onOpen: (id, origin) => letter.open(id, origin),
    categorizer, changed: (dream) => letter.refresh(dream),
  });
  const inbox = inboxFor(FORMSPREE_ENDPOINT, window.fetch.bind(window));
  let nameOf = (id: string) => id;
  let commentPosted = (_ideaId: string) => {};
  /** The icons that open something below them: choosing one closes the other two. */
  const closers: Record<Panel, () => void> = { comment: () => thread.closePanel(), update: () => updates.closePanel(), remove: () => removal.closePanel() };
  const opened = (panel: Panel) => () => { for (const other of panelsToClose(panel)) closers[other](); };
  const thread = startThread({ store: stores.then((s) => s.comments), likes: stores.then((s) => s.commentLikes), inbox, ideaNameOf: (id) => nameOf(id), posted: (id) => commentPosted(id), opened: opened("comment") });
  const likes = startLikes({ store: stores.then((s) => s.likes) });
  let ideaMoved = (_idea: Idea) => {};
  const updates = startUpdates({ store: stores.then((s) => s.updates), opened: opened("update") });
  const stage = startStagePanel({ store: stores.then((s) => s.ideas), moved: (idea) => ideaMoved(idea) });
  const ideaStore = stores.then((s) => s.ideas);
  const removal = startRemoval({
    store: ideaStore, dreamStore: stores.then((s) => s.dreams),
    removed: (idea) => { if (idea.kind === "dream") sea.forget(idea.id); else board.forget(idea.id); letter.dismiss(); }, opened: opened("remove"),
  });
  const share = startShare({ linkTo: (id) => ideaLink(location.href, id), nav: navigator });
  const board = startBoard({ sky, store: ideaStore, openIdea: (id, origin) => letter.open(id, origin), categorizer, changed: (idea) => letter.refresh(idea) });
  /** A letter shows an idea from the sky or a dream from the sea; dreams have no stages and no updates. */
  const recordOf = (id: string) => board.get(id) ?? sea.get(id);
  const nameOfRecord = (id: string) => (board.has(id) ? board.nameOf(id) : sea.nameOf(id));
  const letter = startLetter({
    sky, sea, ideaOf: recordOf, nameOf: nameOfRecord,
    hooks: {
      opened: (idea) => {
        thread.open(idea.id); likes.open(idea.id); removal.open(idea); share.open(idea.id);
        if (idea.kind === "dream") { stage.close(); updates.close(); } else { stage.open(idea); updates.open(idea.id); }
      },
      closed: () => { thread.close(); likes.close(); stage.close(); updates.close(); removal.close(); share.close(); forgetLink(); },
    },
  });
  ideaMoved = (idea) => { board.update(idea); letter.refresh(idea); };
  nameOf = nameOfRecord;
  commentPosted = letter.foldAfterComment;
  openPlane = letter.open;
  const dictation = startDictation({ speech: browserSpeech(), button: byId<HTMLButtonElement>("note-mic"), field: byId<HTMLTextAreaElement>("note-msg"), status: byId("note-mic-status"), lang: navigator.language || "en-US" });
  startComposer({ board, sky, sea, reducedMotion, inbox, dictation });
  const say = startToast();
  startFeedback({ inbox, say, reducedMotion });
  board.sync();

  /** A link to one idea (#idea-<id>) opens it once the board has loaded; a link to one that is gone says so. */
  function openLinked(): void {
    const id = linkedIdeaId(location.hash);
    if (!id) return;
    if (recordOf(id)) letter.open(id);
    else { say("That idea isn’t on the board anymore."); forgetLink(); }
  }
  /** Take the idea link off the address once its letter closes, so a reload doesn't open it again. */
  function forgetLink(): void {
    if (linkedIdeaId(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  }
  const bothLoaded = Promise.all([board.loaded, sea.loaded]);
  bothLoaded.then(openLinked);
  addEventListener("hashchange", () => bothLoaded.then(openLinked));
}
