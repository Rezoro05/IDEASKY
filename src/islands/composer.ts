/** The Idea Note, in the overlay that "Share Your Idea" opens.
 *  States: closed → editing ⇄ invalid → folding → flying → sent (closed). Saving and emailing run alongside and never hold up the animation. */
import { newRecordId, validateDraft, type Idea } from "../lib/ideas";
import { v, type Vec } from "../lib/vec";
import type { Inbox } from "../boundaries/inbox";
import type { Board } from "./board";
import type { Sky } from "./sky";
import { byId, cancelPendingOpen, hideOnEdit, openWithTransition, randomBytes } from "./dom";
import { flyAcrossPage } from "./flier";
import { startToast } from "./toast";
import { linkRowsIn } from "./link-rows";
import type { Dictation } from "./dictation";
import type { SeaBoard } from "./sea";
import { FISH_SVG } from "../lib/fish-art";

const FOLD_MS = 700, FLIGHT_MS = 1300, SCROLL_WAIT_MS = 3000, THROW_SPEED = 180;
const NOT_SAVED = "The public board couldn’t save your idea just now, so for now only you can see your plane.";
const UP_NO_MOTION = "Your idea is up. Anyone can open it and read it.";
const DREAM_NO_MOTION = "Your dream is in the sea. Anyone can open it and read it.";
const PRIVATE_UP = "Your idea is in your own sky. Only you can see it.";
const PRIVATE_DREAM = "Your dream is in your own sea. Only you can see it.";
const DREAM_NOT_SAVED = "The sea couldn’t keep your dream just now, so for now only you can see your fish.";

/** The same paper for both: the Idea Note (sky) and the Dream Note (sea). Only the words differ. */
type Mode = "idea" | "dream";
const WORDS: Record<Mode, { title: string; field: string; placeholder: string; mic: string; empty: string; ownName: string; ownNamePlaceholder: string }> = {
  idea: { title: "Share your idea", field: "The idea", placeholder: "Share anything on your mind", mic: "Speak your idea", empty: "Write your idea first.", ownName: "Name your idea", ownNamePlaceholder: "Telescope diary" },
  dream: { title: "Share your dream", field: "The dream", placeholder: "Tell a dream you had", mic: "Speak your dream", empty: "Write your dream first.", ownName: "Name your dream", ownNamePlaceholder: "Flying over the school" },
};

export function startComposer(opts: { board: Board; sky: Sky | null; sea?: SeaBoard; inbox: Inbox; reducedMotion: boolean; dictation?: Dictation; now?: () => number;
  /** In your own sky and sea: what you share is private, so it isn't emailed to the site's owner; its name field names it. */
  isPrivate?: () => boolean }): void {
  const { board, sky, inbox } = opts;
  const isPrivate = opts.isPrivate ?? (() => false);
  /** In your own sky: the name typed for the idea or dream ("" = none: it is called Idea1, Dream1…). */
  const ownName = () => field("name").value.trim().slice(0, 40);
  const dictation = opts.dictation ?? { stop() {}, reset() {} };
  const now = opts.now ?? Date.now;
  const form = byId<HTMLFormElement>("note-form"), err = byId("note-error");
  const compose = byId("compose"), slot = byId("note-slot"), ideaBtn = byId("idea-btn"), say = startToast();
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const links = linkRowsIn(byId("note-link-rows"));

  const dreamBtn = document.getElementById("dream-btn");
  let mode: Mode = "idea", opener: HTMLElement = ideaBtn;
  function useWords(m: Mode): void {
    const w = WORDS[m], mic = document.getElementById("note-mic");
    form.setAttribute("aria-label", w.title); compose.setAttribute("aria-label", w.title);
    byId("note-msg-label").textContent = w.field;
    (field("message") as HTMLTextAreaElement).placeholder = w.placeholder;
    if (mic) { mic.dataset.idle = w.mic; mic.querySelector(".mic-label")!.textContent = w.mic; }
    // Your own: the name field names the idea or dream (it labels its bird or fish); public: it is who wrote it.
    byId("note-name-label").textContent = isPrivate() ? w.ownName : "Name";
    (field("name") as HTMLInputElement).placeholder = isPrivate() ? w.ownNamePlaceholder : "Steve Gates";
  }
  function openCompose(m: Mode = "idea"): void {
    mode = m; opener = m === "dream" && dreamBtn ? dreamBtn : ideaBtn;
    dictation.reset(); form.reset(); links.clear(); err.hidden = true; form.classList.remove("folding");
    useWords(m);
    const r = opener.getBoundingClientRect();
    slot.style.setProperty("--dx", r.left + r.width / 2 - innerWidth / 2 + "px");
    slot.style.setProperty("--dy", r.top + r.height / 2 - innerHeight / 2 + "px");
    openWithTransition(compose);
    field("message").focus({ preventScroll: true });
  }
  function closeCompose(returnFocus: boolean): void {
    dictation.reset();
    cancelPendingOpen(compose);
    compose.classList.remove("open"); compose.hidden = true;
    form.classList.remove("folding"); form.reset(); links.clear(); err.hidden = true;
    if (returnFocus) opener.focus({ preventScroll: true });
  }
  ideaBtn.addEventListener("click", () => openCompose("idea"));
  dreamBtn?.addEventListener("click", () => openCompose("dream"));
  byId("note-close").addEventListener("click", () => closeCompose(true));
  compose.addEventListener("click", (e) => { if (e.target === compose) closeCompose(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !compose.hidden) closeCompose(true); });

  function sent(saving: Promise<boolean>, notSaved = NOT_SAVED): void {
    closeCompose(false);
    saving.then((saved) => { if (!saved) say(notSaved); });
  }

  hideOnEdit(form, err);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    dictation.stop();
    const check = validateDraft({ name: field("name").value, email: field("email").value, message: field("message").value, trap: field("_gotcha").value, linkRows: links.typed() });
    if (!check.ok) {
      if (check.reason === "bot") { form.reset(); links.clear(); return; } // bots fill hidden fields: pretend nothing happened
      err.textContent = check.reason === "empty-message" ? WORDS[mode].empty : check.text; err.hidden = false;
      if (check.reason === "bad-link") links.focusRow(check.row);
      else field("message").focus();
      return;
    }
    err.hidden = true;
    if (mode === "dream" && opts.sea) { sendDream(opts.sea, { id: newRecordId(randomBytes(8)), ...check.idea, ...(isPrivate() ? { name: ownName() } : {}), stage: "idea", at: now(), kind: "dream" }, check.email); return; }
    const idea: Idea = { id: newRecordId(randomBytes(8)), ...check.idea, ...(isPrivate() ? { name: ownName() } : {}), stage: "idea", at: now() };
    if (!isPrivate()) inbox.send(idea, check.email, location.href);
    if (opts.reducedMotion || !sky) {
      const saving = board.post(idea);
      board.sync(); sent(saving);
      say(isPrivate() ? PRIVATE_UP : UP_NO_MOTION);
      return;
    }
    const r = form.getBoundingClientRect();
    board.markInFlight(idea.id, true);
    const saving = board.post(idea);
    form.classList.add("folding");
    setTimeout(() => { flyToSky(sky, idea, v(r.left + r.width / 2, r.top + r.height / 2)); sent(saving); }, FOLD_MS);
  });

  /** A dream folds into a fish that swims down to its place in the sea; with reduced motion it simply joins the list. */
  function sendDream(sea: SeaBoard, dream: Idea, email: string): void {
    if (!isPrivate()) inbox.send(dream, email, location.href);
    if (opts.reducedMotion) { sent(sea.post(dream), DREAM_NOT_SAVED); say(isPrivate() ? PRIVATE_DREAM : DREAM_NO_MOTION); return; }
    const r = form.getBoundingClientRect(), start = v(r.left + r.width / 2, r.top + r.height / 2);
    const saving = sea.post(dream, { arriving: true });
    form.classList.add("folding");
    setTimeout(() => {
      sent(saving, DREAM_NOT_SAVED);
      let last = start;
      flyAcrossPage({
        from: start, durationMs: FLIGHT_MS, stage: "idea", fish: FISH_SVG,
        scaleAt: (u) => 0.6 + 0.4 * Math.min(1, u * 3),
        target: () => (last = sea.screenPointOf(dream.id) ?? last),
      }).then(() => sea.landed(dream.id));
    }, FOLD_MS);
  }

  /** A plane climbs from the folded note while the page scrolls up under it, then joins the sky's flight simulation. */
  function flyToSky(sky: Sky, idea: Idea, start: Vec): void {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const landingSpot = (): Vec => {
      const fr = sky.fieldRect();
      return v(fr.left + fr.width * (0.35 + 0.3 * Math.sin(idea.at)), Math.max(80, fr.top + fr.height * 0.62));
    };
    flyAcrossPage({
      from: start, target: landingSpot, durationMs: FLIGHT_MS, stage: "idea",
      scaleAt: (u) => 0.6 + 0.4 * Math.min(1, u * 3),
      mayLand: (elapsed) => window.scrollY < 4 || elapsed > SCROLL_WAIT_MS,
    }).then(({ at, heading }) => {
      board.markInFlight(idea.id, false);
      if (sky.has(idea.id)) sky.remove(idea.id);
      if (!board.has(idea.id)) return;
      const name = board.nameOf(idea.id), fr = sky.fieldRect();
      sky.add(idea.id, { tag: name, label: `${name}: open the idea`, stage: idea.stage, fresh: true,
        from: v(at.x - fr.left, at.y - fr.top), velocity: v(Math.cos(heading) * THROW_SPEED, Math.sin(heading) * THROW_SPEED) });
      board.sync();
    });
  }
}
