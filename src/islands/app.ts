/** Wires the pure parts to the page. Every feature lights up on its own; if one fails, the rest of the page still works. */
import { DEMO_IDEAS, PUBLIC_BOARD } from "../content/site";
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
import { memoryUpdates, supabaseUpdates, type UpdateStore } from "../boundaries/updateStore";
import { startSky, type Sky } from "./sky";
import { startBoard } from "./board";
import { startLetter } from "./letter";
import { startComposer } from "./composer";
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
import { startCageHint } from "./hint";
import { startDictation } from "./dictation";
import { browserSpeech } from "../boundaries/speech";
import { noCategorizer, supabaseCategorizer } from "../boundaries/categorizer";
import { memoryAuth, supabaseAuth, type Auth } from "../boundaries/auth";
import { supabaseAccountPosts } from "../boundaries/accountPosts";
import { startAccount, type Account } from "./account";
import { startModeSwitch, type Sources } from "./mode-switch";
import { startGoPublic, type GoPublic } from "./go-public";
import { startBrowse } from "./browse";
import { memoryPrivateStore, privateCategorizer, privateUpdates, supabasePrivateStore } from "../boundaries/privateStore";
import type { User } from "../lib/account";
import type { Scenes } from "./scene";

function safeStorage(): Storage | null { try { return window.localStorage; } catch { return null; } }

let leaving = false;
addEventListener("pagehide", () => { leaving = true; });
addEventListener("pageshow", () => { leaving = false; }); // back/forward cache brings the page back

async function sha256Hex(text: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

type Stores = { ideas: IdeaStore; dreams: IdeaStore; comments: CommentStore; commentLikes: CommentLikeStore; likes: LikeStore; updates: UpdateStore };

/** Supabase when a board is configured; otherwise everything lives in memory for this visit. */
function chooseStores(auth: Auth): Stores {
  if (!PUBLIC_BOARD.url) {
    const ideas = memoryStore(DEMO_IDEAS ? demoIdeas(Date.now()) : []);
    return { ideas, dreams: memoryStore(DEMO_IDEAS ? demoDreams(Date.now()) : []), comments: memoryComments(), commentLikes: memoryCommentLikes(), likes: memoryLikes(), updates: memoryUpdates((id) => ideas.ownsKey(id)) };
  }
  const base = { url: PUBLIC_BOARD.url, key: PUBLIC_BOARD.key, fetch: window.fetch.bind(window), randomBytes, sha256Hex };
  const likeKeys = browserKeyStore(safeStorage(), LIKES_ITEM), ideaKeys = browserKeyStore(safeStorage());
  const likerId = likerIdFrom(likeKeys, randomBytes); // one liker id for ideas and comments alike
  // Signed in, public posts belong to your account (and this browser's earlier ones join it): manageable from any browser.
  const account = supabaseAccountPosts({ ...base, auth, ideaKeys });
  return {
    ideas: supabaseStore({ ...base, keys: ideaKeys, account }),
    dreams: supabaseStore({ ...base, keys: ideaKeys, kind: "dream", account }),
    updates: supabaseUpdates({ ...base, ideaKeys, account }),
    comments: supabaseComments({ ...base, keys: browserKeyStore(safeStorage(), COMMENT_KEYS_ITEM) }),
    likes: supabaseLikes({ ...base, keys: likeKeys, likerId, pageIsLeaving: () => leaving }),
    commentLikes: supabaseCommentLikes({ ...base, keys: browserKeyStore(safeStorage(), COMMENT_LIKES_ITEM), likerId, pageIsLeaving: () => leaving }),
  };
}

/** Supabase sign-in when a board is configured; otherwise (local runs, the preview) a pretend sign-in that lasts the visit. */
function chooseAuth(): Auth {
  if (!PUBLIC_BOARD.url) return memoryAuth();
  return supabaseAuth({ url: PUBLIC_BOARD.url, key: PUBLIC_BOARD.key, fetch: window.fetch.bind(window), storage: safeStorage() });
}

/** A signed-in visitor's own ideas and dreams: in Supabase (only they can read them), or in memory for the visit (local runs, the preview). */
function ownSources(auth: Auth): (user: User) => Sources {
  return () => {
    const own = { stages: true, named: true }; // your own ideas show their stages, and go by the names you give them
    if (!PUBLIC_BOARD.url) return { ideas: { store: Promise.resolve(memoryPrivateStore(memoryStore())), ...own }, dreams: { store: Promise.resolve(memoryPrivateStore(memoryStore())), ...own }, updates: Promise.resolve(memoryUpdates(() => true)) };
    const base = { url: PUBLIC_BOARD.url, key: PUBLIC_BOARD.key, fetch: window.fetch.bind(window), token: () => auth.token() };
    const categorizer = privateCategorizer(base);
    return {
      ideas: { store: Promise.resolve(supabasePrivateStore({ ...base, kind: "idea" })), categorizer, ...own },
      dreams: { store: Promise.resolve(supabasePrivateStore({ ...base, kind: "dream" })), categorizer, ...own },
      updates: Promise.resolve(privateUpdates(base)),
    };
  };
}

/** The 3D scenes once started (startBackgrounds), so a change of board can rebuild them. */
let scenesNow: () => Scenes | null = () => null;

/** Your own sky and sea have their own backgrounds: San Francisco over the water (scripts/draw-san-francisco.mjs) and a sunken ship below.
 *  Everyone's keep New York and the deep sea. The picture changes at once (with or without the 3D scenes); the scenes are built again. */
function startBoardBackgrounds(): void {
  const root = document.documentElement, picture = document.querySelector<HTMLImageElement>(".skyline");
  if (!picture) return;
  const mine = () => root.dataset.mode === "mine";
  const avif = picture.parentElement?.querySelector<HTMLSourceElement>("source[type='image/avif']") ?? null;
  let shownMine: boolean | null = null;
  const showBackgrounds = () => {
    if (mine() === shownMine) return;
    const first = shownMine === null;
    shownMine = mine();
    if (first && !shownMine) return; // New York is already there
    const name = shownMine ? "sf-skyline" : "skyline";
    if (avif) avif.srcset = `${name}.avif`;
    picture.src = `${name}.webp`;
    root.dataset.city = shownMine ? "san-francisco" : "new-york";
    scenesNow()?.rebuild();
  };
  picture.addEventListener("load", () => scenesNow()?.rebuild()); // the new picture is in: build the sky from it
  new MutationObserver(showBackgrounds).observe(root, { attributes: true, attributeFilter: ["data-mode"] });
  showBackgrounds();
}

/** The 3D backgrounds are their own script, fetched once the page is up and idle (or at once for #studio): the first view never waits for them. */
function loadBackgrounds(): void {
  let asked = false;
  const load = () => {
    if (asked) return;
    asked = true;
    import("./backgrounds").then((m) => m.startBackgrounds({ started: (scenes) => { scenesNow = scenes; } }))
      .catch(() => { /* offline or blocked: the pictures stay, which is the designed fallback */ });
  };
  if (location.hash === "#studio") load();
  else {
    const whenIdle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 400));
    const picture = document.querySelector<HTMLImageElement>(".skyline");
    (picture ? picture.decode().catch(() => undefined) : Promise.resolve()).then(() => whenIdle(load));
  }
  addEventListener("hashchange", () => { if (location.hash === "#studio") load(); });
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
    const overlays = [byId("compose"), byId("letter"), byId("browse")];
    const markCovered = () => document.documentElement.classList.toggle("sky-covered", overlays.some((o) => o.classList.contains("open")));
    startCageHint({ field: byId("field"), cage: byId("cage"), reducedMotion, store: safeStorage(), inSky: () => document.documentElement.dataset.depth !== "sea" });
    const watcher = new MutationObserver(markCovered);
    for (const o of overlays) watcher.observe(o, { attributes: true, attributeFilter: ["class"] });
  }

  startDepth({
    root: document.documentElement, world: byId("world"), sky: byId("sky-part"), sea: byId("sea"),
    dive: byId("dive-btn"), surface: byId("surface-btn"), seaTitle: byId("sea-title"), reducedMotion,
    blocked: () => document.documentElement.classList.contains("sky-covered"),
  });

  if (profile !== "none") loadBackgrounds();
  startBoardBackgrounds();

  const auth = chooseAuth();
  const stores = Promise.resolve(chooseStores(auth));
  /** Likes on many ideas or dreams at once: on the public board a liked one flies or swims a little bigger. */
  const likeCounts = (ids: string[]) => stores.then((s) => s.likes.counts(ids));
  let isMine = () => false; // set once the mode switch starts (below)
  let currentUpdates = () => stores.then((s) => s.updates);
  let goPublic: GoPublic = { open() {}, close() {} }; // set once the mode switch starts (below)
  const categorizer = PUBLIC_BOARD.url ? supabaseCategorizer({ url: PUBLIC_BOARD.url, key: PUBLIC_BOARD.key, fetch: window.fetch.bind(window) }) : noCategorizer;
  const sea = startSea({
    field: byId("sea-field"), surface: byId("sea"), net: byId("fish-net"), list: profile === "none" ? byId<HTMLUListElement>("dreams-list") : null,
    store: stores.then((s) => s.dreams), visitSeed: new Uint32Array(randomBytes(4).buffer)[0]!,
    size: FLIGHT_CONFIGS[profile === "none" ? "lite" : profile].planeSize,
    active: () => document.documentElement.dataset.depth === "sea" && !document.documentElement.classList.contains("sky-covered"),
    onOpen: (id, origin) => letter.open(id, origin),
    categorizer, likeCounts, changed: (dream) => letter.refresh(dream),
  });
  let commentPosted = (_ideaId: string) => {};
  /** The icons that open something below them: choosing one closes the other two. */
  const closers: Record<Panel, () => void> = { comment: () => thread.closePanel(), update: () => updates.closePanel(), remove: () => removal.closePanel() };
  const opened = (panel: Panel) => () => { for (const other of panelsToClose(panel)) closers[other](); };
  const thread = startThread({ store: stores.then((s) => s.comments), likes: stores.then((s) => s.commentLikes), posted: (id) => commentPosted(id), opened: opened("comment") });
  const likes = startLikes({ store: stores.then((s) => s.likes), counted: (id, count) => { board.setLikes(id, count); sea.setLikes(id, count); } });
  let ideaMoved = (_idea: Idea) => {};
  const updates = startUpdates({ store: () => currentUpdates(), opened: opened("update") });
  const stage = startStagePanel({ store: () => board.store(), moved: (idea) => ideaMoved(idea) });
  const ideaStore = stores.then((s) => s.ideas);
  const removal = startRemoval({
    store: () => board.store(), dreamStore: () => sea.store(),
    removed: (idea) => { if (idea.kind === "dream") sea.forget(idea.id); else board.forget(idea.id); letter.dismiss(); }, opened: opened("remove"),
  });
  const share = startShare({ linkTo: (id) => ideaLink(location.href, id), nav: navigator });
  const board = startBoard({ sky, store: ideaStore, openIdea: (id, origin) => letter.open(id, origin), categorizer, likeCounts, changed: (idea) => letter.refresh(idea) });
  /** A letter shows an idea from the sky or a dream from the sea; dreams have no stages and no updates. */
  const recordOf = (id: string) => board.get(id) ?? sea.get(id);
  const nameOfRecord = (id: string) => (board.has(id) ? board.nameOf(id) : sea.nameOf(id));
  const letter = startLetter({
    sky, sea, ideaOf: recordOf, nameOf: nameOfRecord, stagesShown: () => board.stagesShown(), isPrivate: () => isMine(),
    hooks: {
      opened: (idea) => {
        if (isMine()) { // your own: no likes, comments or sharing; only you see it. Ideas have their stages and your updates
          removal.open(idea); goPublic.open(idea);
          if (idea.kind === "dream") { stage.close(); updates.close(); } else { stage.open(idea); updates.open(idea.id); }
          return;
        }
        goPublic.close();
        thread.open(idea.id); likes.open(idea.id); removal.open(idea); share.open(idea.id);
        if (idea.kind === "dream") { stage.close(); updates.close(); } else { stage.open(idea); updates.open(idea.id); }
      },
      closed: () => { thread.close(); likes.close(); stage.close(); updates.close(); removal.close(); share.close(); goPublic.close(); forgetLink(); },
    },
  });
  startBrowse({ ideas: board, dreams: sea, open: (id, origin) => letter.open(id, origin), stagesShown: () => board.stagesShown(), isPrivate: () => isMine() });
  ideaMoved = (idea) => { board.update(idea); letter.refresh(idea); };
  commentPosted = letter.foldAfterComment;
  openPlane = letter.open;
  const dictation = startDictation({ speech: browserSpeech(), button: byId<HTMLButtonElement>("note-mic"), field: byId<HTMLTextAreaElement>("note-msg"), status: byId("note-mic-status"), lang: navigator.language || "en-US" });
  startComposer({ board, sky, sea, reducedMotion, dictation, isPrivate: () => isMine() });
  const say = startToast();
  const modes = startModeSwitch({
    auth, board, sea, storage: safeStorage(), say,
    everyone: { ideas: { store: ideaStore, categorizer, likeCounts }, dreams: { store: stores.then((s) => s.dreams), categorizer, likeCounts }, updates: stores.then((s) => s.updates) },
    ownedBy: ownSources(auth),
    openingPublicIdea: !!linkedIdeaId(location.hash),
    switching: () => letter.dismiss(),
    askToSignIn: () => account.open(),
  });
  isMine = () => modes.mode() === "mine";
  goPublic = startGoPublic({
    isMine, say,
    ownStore: (item) => (item.kind === "dream" ? sea.store() : board.store()),
    publicStore: (item) => stores.then((s) => (item.kind === "dream" ? s.dreams : s.ideas)),
    changed: (item) => { if (item.kind === "dream") sea.update(item); else board.update(item); letter.refresh(item); },
  });
  currentUpdates = () => modes.current().updates;
  const account: Account = startAccount({ auth, say });
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
