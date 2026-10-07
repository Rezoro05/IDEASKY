/** The mic button in the Idea Note: speak, and the words appear in the idea field.
 *  States: idle → listening → idle, or idle with a message (microphone refused, nothing heard, stopped). Hidden where the browser can't do it. */
import { dictatedText } from "../lib/dictation";
import type { Speech, Listening, SpeechProblem } from "../boundaries/speech";

/** `stop` ends listening; `reset` also clears any message (the note opened or closed). */
export type Dictation = { stop(): void; reset(): void };

const MESSAGES: Record<SpeechProblem, string> = {
  denied: "The microphone is blocked. Allow it for this site in your browser’s settings, then tap the mic again.",
  "no-speech": "Didn’t catch anything. Tap the mic and try again.",
  failed: "Dictation stopped. You can keep typing, or tap the mic to try again.",
};

export function startDictation(opts: { speech: Speech; button: HTMLButtonElement; field: HTMLTextAreaElement; status: HTMLElement; lang: string }): Dictation {
  const { speech, button, field, status } = opts;
  if (!speech.supported) { button.closest<HTMLElement>(".note-dictate")!.hidden = true; return { stop() {}, reset() {} }; }
  let session: Listening | null = null;

  const show = (listening: boolean) => {
    button.setAttribute("aria-pressed", String(listening));
    button.querySelector(".mic-label")!.textContent = listening ? "Listening… tap to stop" : (button.dataset.idle ?? "Speak your idea"); // the Dream Note says "Speak your dream"
    button.closest(".note-dictate")!.classList.toggle("listening", listening);
  };
  function stop(): void { session?.stop(); }
  function start(): void {
    const before = field.value;
    status.hidden = true;
    show(true);
    session = speech.listen({
      lang: opts.lang,
      onHeard(heard) {
        field.value = dictatedText(before, heard, field.maxLength > 0 ? field.maxLength : Infinity);
        field.setSelectionRange(field.value.length, field.value.length);
        field.dispatchEvent(new Event("input", { bubbles: true })); // the form's own listeners (error message, counters) see the change
      },
      onEnd(problem) {
        session = null;
        show(false);
        if (problem) { status.textContent = MESSAGES[problem]; status.hidden = false; }
      },
    });
  }
  button.addEventListener("click", () => (session ? stop() : start()));
  field.addEventListener("input", (e) => { if (e.isTrusted) stop(); }); // typing takes over from speaking
  return { stop, reset() { stop(); status.hidden = true; } };
}
