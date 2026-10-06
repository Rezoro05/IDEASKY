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

const FOLD_MS = 700, FLIGHT_MS = 1300, SCROLL_WAIT_MS = 3000, THROW_SPEED = 180;
const NOT_SAVED = "The public board couldn’t save your idea just now, so for now only you can see your plane.";
const UP_NO_MOTION = "Your idea is up. Anyone can open it and read it.";

export function startComposer(opts: { board: Board; sky: Sky | null; inbox: Inbox; reducedMotion: boolean; dictation?: Dictation; now?: () => number }): void {
  const { board, sky, inbox } = opts;
  const dictation = opts.dictation ?? { stop() {}, reset() {} };
  const now = opts.now ?? Date.now;
  const form = byId<HTMLFormElement>("note-form"), err = byId("note-error");
  const compose = byId("compose"), slot = byId("note-slot"), ideaBtn = byId("idea-btn"), say = startToast();
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const links = linkRowsIn(byId("note-link-rows"));

  function openCompose(): void {
    dictation.reset(); form.reset(); links.clear(); err.hidden = true; form.classList.remove("folding");
    const r = ideaBtn.getBoundingClientRect();
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
    if (returnFocus) ideaBtn.focus({ preventScroll: true });
  }
  ideaBtn.addEventListener("click", openCompose);
  byId("note-close").addEventListener("click", () => closeCompose(true));
  compose.addEventListener("click", (e) => { if (e.target === compose) closeCompose(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !compose.hidden) closeCompose(true); });

  function sent(saving: Promise<boolean>): void {
    closeCompose(false);
    saving.then((saved) => { if (!saved) say(NOT_SAVED); });
  }

  hideOnEdit(form, err);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    dictation.stop();
    const check = validateDraft({ name: field("name").value, email: field("email").value, message: field("message").value, trap: field("_gotcha").value, linkRows: links.typed() });
    if (!check.ok) {
      if (check.reason === "bot") { form.reset(); links.clear(); return; } // bots fill hidden fields: pretend nothing happened
      err.textContent = check.text; err.hidden = false;
      if (check.reason === "bad-link") links.focusRow(check.row);
      else field("message").focus();
      return;
    }
    err.hidden = true;
    const idea: Idea = { id: newRecordId(randomBytes(8)), ...check.idea, stage: "idea", at: now() };
    inbox.send(idea, check.email, location.href);
    if (opts.reducedMotion || !sky) {
      const saving = board.post(idea);
      board.sync(); sent(saving);
      say(UP_NO_MOTION);
      return;
    }
    const r = form.getBoundingClientRect();
    board.markInFlight(idea.id, true);
    const saving = board.post(idea);
    form.classList.add("folding");
    setTimeout(() => { flyToSky(sky, idea, v(r.left + r.width / 2, r.top + r.height / 2)); sent(saving); }, FOLD_MS);
  });

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
