/** The Idea Note. One form, two places: the closing section, or the hero overlay ("Share Your Ideas").
 *  States: closed → editing ⇄ invalid → folding → flying → sent. Saving and emailing run alongside and never hold up the animation. */
import { newNoteId, noteSlug, validateDraft, type Note } from "../lib/notes";
import { len, sub, v, type Vec } from "../lib/vec";
import { PLANE_SVG } from "../lib/plane-svg";
import type { Inbox } from "../boundaries/inbox";
import type { Board } from "./board";
import type { Sky } from "./sky";
import { byId, randomBytes } from "./dom";

const FOLD_MS = 700, FLIGHT_MS = 1300, SCROLL_WAIT_MS = 3000, TOAST_MS = 6000, THROW_SPEED = 180;
const NOT_SAVED_HERO = "Rez got your idea. The public board couldn’t save it just now, so for now only you can see your plane.";
const NOT_SAVED_DONE = "Rez got your idea and will reply if you left your email. The public board couldn’t save it just now, so for now only you can see your plane.";
const UP_NO_MOTION = "Your idea is up. Anyone can open it and read it.";

export function startComposer(opts: { board: Board; sky: Sky | null; inbox: Inbox; reducedMotion: boolean; now?: () => number }): void {
  const { board, sky, inbox } = opts;
  const now = opts.now ?? Date.now;
  const form = byId<HTMLFormElement>("note-form"), done = byId("note-done"), doneText = byId("note-done-text"), err = byId("note-error");
  const compose = byId("compose"), slot = byId("note-slot"), home = byId("note-wrap"), ideaBtn = byId("idea-btn"), toast = byId("toast");
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const baseDoneText = doneText.textContent ?? "";
  const inHero = () => slot.contains(form);

  function openCompose(): void {
    form.reset(); err.hidden = true; form.hidden = false; form.classList.remove("folding");
    slot.appendChild(form);
    const r = ideaBtn.getBoundingClientRect();
    slot.style.setProperty("--dx", r.left + r.width / 2 - innerWidth / 2 + "px");
    slot.style.setProperty("--dy", r.top + r.height / 2 - innerHeight / 2 + "px");
    compose.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => compose.classList.add("open")));
    field("message").focus({ preventScroll: true });
  }
  function closeCompose(returnFocus: boolean): void {
    compose.classList.remove("open"); compose.hidden = true;
    form.classList.remove("folding"); form.reset(); err.hidden = true;
    home.insertBefore(form, done); form.hidden = false;
    if (returnFocus) ideaBtn.focus({ preventScroll: true });
  }
  ideaBtn.addEventListener("click", openCompose);
  byId("note-close").addEventListener("click", () => closeCompose(true));
  compose.addEventListener("click", (e) => { if (e.target === compose) closeCompose(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !compose.hidden) closeCompose(true); });

  let toastTimer = 0;
  function say(text: string): void {
    toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, TOAST_MS);
  }

  function sentFromHero(saving: Promise<boolean>): void {
    closeCompose(false);
    saving.then((saved) => { if (!saved) say(NOT_SAVED_HERO); });
  }
  function sentFromSection(saving: Promise<boolean>): void {
    form.hidden = true; form.classList.remove("folding"); done.hidden = false;
    doneText.textContent = baseDoneText;
    saving.then((saved) => { if (!saved) doneText.textContent = NOT_SAVED_DONE; });
    byId("note-again").focus({ preventScroll: true });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const check = validateDraft({ name: field("name").value, email: field("email").value, message: field("message").value, trap: field("_gotcha").value });
    if (!check.ok) {
      if (check.reason === "bot") { form.reset(); return; } // bots fill hidden fields: pretend nothing happened
      err.textContent = check.text; err.hidden = false; field("message").focus(); return;
    }
    err.hidden = true;
    const note: Note = { id: newNoteId(randomBytes(8)), ...check.note, at: now() };
    const fromHero = inHero(), sent = fromHero ? sentFromHero : sentFromSection;
    inbox.send(note, check.email, location.href);
    if (opts.reducedMotion || !sky) {
      const saving = board.post(note);
      board.sync(); sent(saving);
      if (fromHero) say(UP_NO_MOTION);
      return;
    }
    const r = form.getBoundingClientRect();
    board.markInFlight(note.id, true);
    const saving = board.post(note);
    form.classList.add("folding");
    setTimeout(() => { flyToSky(sky, note, v(r.left + r.width / 2, r.top + r.height / 2)); sent(saving); }, FOLD_MS);
  });
  byId("note-again").addEventListener("click", () => {
    form.reset(); done.hidden = true; form.hidden = false; field("message").focus({ preventScroll: true });
  });

  /** A fixed-position plane climbs while the page scrolls up under it, then joins the sky's flight simulation. */
  function flyToSky(sky: Sky, note: Note, start: Vec): void {
    const el = document.createElement("div");
    el.className = "note-flier"; el.innerHTML = PLANE_SVG; el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t0 = performance.now();
    let prev = start, heading = -Math.PI / 2;
    const place = (pt: Vec, ang: number, k: number) => {
      el.style.transform = `translate(${pt.x - 32}px, ${pt.y - 32}px) rotate(${(ang * 180) / Math.PI}deg) scale(${k})`;
    };
    function tick(t: number) {
      const u = Math.min(1, (t - t0) / FLIGHT_MS), fr = sky.fieldRect();
      const end = v(fr.left + fr.width * (0.35 + 0.3 * Math.sin(note.at)), Math.max(80, fr.top + fr.height * 0.62));
      const ctrl = v(start.x - 180, Math.min(start.y, end.y) - 140);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, a = 1 - e;
      const pt = v(a * a * start.x + 2 * a * e * ctrl.x + e * e * end.x, a * a * start.y + 2 * a * e * ctrl.y + e * e * end.y);
      if (len(sub(pt, prev)) > 0.5) heading = Math.atan2(pt.y - prev.y, pt.x - prev.x);
      place(pt, heading, 0.6 + 0.4 * Math.min(1, u * 3));
      const scrolled = window.scrollY < 4 || t - t0 > SCROLL_WAIT_MS;
      if (u < 1 || !scrolled) { prev = pt; requestAnimationFrame(tick); return; }
      el.remove();
      board.markInFlight(note.id, false);
      const slug = noteSlug(note.id);
      if (sky.has(slug)) sky.remove(slug);
      if (!board.has(note.id)) return;
      const name = board.nameOf(note.id);
      sky.add(slug, { tag: name, label: `${name}: open the note`, href: "#", isNote: true, fresh: true,
        from: v(pt.x - fr.left, pt.y - fr.top), velocity: v(Math.cos(heading) * THROW_SPEED, Math.sin(heading) * THROW_SPEED) });
      board.sync();
    }
    requestAnimationFrame(tick);
  }
}
