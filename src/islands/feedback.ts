/** The feedback note, in the overlay the footer's "Feedback" opens. It goes to the owner's email only.
 *  States: closed → editing ⇄ invalid → sending → folding → closed (sent) | sending → editing with an error (text kept).
 *  With no inbox set up (local runs) it says so instead of pretending to send. */
import { validateFeedbackDraft } from "../lib/feedback";
import type { Inbox } from "../boundaries/inbox";
import { byId, cancelPendingOpen, hideOnEdit, openWithTransition } from "./dom";

const FOLD_MS = 700;
const THANKS = "Thanks. Your feedback is on its way.";
const NOT_CONNECTED = "Feedback isn’t connected to an email yet.";
const FAILED = "Couldn’t send your feedback just now. Try again in a moment.";
const FAILED_AFTER_CLOSE = "Your feedback didn’t go through. Open Feedback to try again.";

export function startFeedback(opts: { inbox: Inbox; say: (text: string) => void; reducedMotion: boolean }): void {
  const overlay = byId("feedback"), slot = byId("feedback-slot"), button = byId("feedback-btn");
  const form = byId<HTMLFormElement>("feedback-form"), err = byId("feedback-error"), send = form.querySelector<HTMLButtonElement>(".feedback-send")!;
  const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  let attempt = 0;

  function open(): void {
    form.reset(); err.hidden = true; send.disabled = false; form.classList.remove("folding");
    const r = button.getBoundingClientRect();
    slot.style.setProperty("--dx", r.left + r.width / 2 - innerWidth / 2 + "px");
    slot.style.setProperty("--dy", r.top + r.height / 2 - innerHeight / 2 + "px");
    openWithTransition(overlay);
    field("message").focus({ preventScroll: true });
  }
  function close(returnFocus: boolean): void {
    attempt++;
    cancelPendingOpen(overlay);
    overlay.classList.remove("open"); overlay.hidden = true;
    form.classList.remove("folding"); form.reset(); err.hidden = true; send.disabled = false;
    if (returnFocus) button.focus({ preventScroll: true });
  }
  const isOpen = () => !overlay.hidden;
  button.addEventListener("click", open);
  byId("feedback-close").addEventListener("click", () => close(true));
  overlay.addEventListener("click", (e) => { if (e.target === overlay && !form.classList.contains("folding")) close(true); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen() && !form.classList.contains("folding")) close(true); });

  hideOnEdit(form, err);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    const check = validateFeedbackDraft({ message: field("message").value, email: field("email").value, trap: field("_gotcha").value });
    if (!check.ok) {
      if (check.reason === "bot") { form.reset(); return; } // bots fill hidden fields: pretend nothing happened
      err.textContent = check.text; err.hidden = false; field("message").focus();
      return;
    }
    if (!opts.inbox.configured) { err.textContent = NOT_CONNECTED; err.hidden = false; return; }
    err.hidden = true; send.disabled = true;
    const mine = ++attempt;
    const ok = await opts.inbox.sendFeedback(check.feedback, location.href);
    const stillHere = mine === attempt && isOpen(); // closed (or reopened) while sending: don't touch the new form
    if (!ok) {
      if (stillHere) { send.disabled = false; err.textContent = FAILED; err.hidden = false; }
      else opts.say(FAILED_AFTER_CLOSE);
      return;
    }
    opts.say(THANKS);
    if (!stillHere) return;
    if (opts.reducedMotion) { close(false); return; }
    form.classList.add("folding");
    setTimeout(() => { if (mine === attempt) close(false); }, FOLD_MS);
  });
}
