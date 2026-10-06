/** The browser's speech recognition (Web Speech API), behind a small interface. Never throws: anything that goes wrong ends the session with a reason.
 *  Chrome and Safari send the audio to their own speech service to turn it into text; Firefox has no recognizer, so `supported` is false there. */
import type { Heard } from "../lib/dictation";

/** Why a session ended early: the microphone was refused, nothing was said, or anything else. */
export type SpeechProblem = "denied" | "no-speech" | "failed";
export type Listening = { stop(): void };
export type Speech = {
  readonly supported: boolean;
  /** Starts listening. `onHeard` gets everything heard so far each time it changes; `onEnd` is called once, with a problem or null. */
  listen(opts: { lang: string; onHeard(heard: Heard): void; onEnd(problem: SpeechProblem | null): void }): Listening;
};

/** The parts of a recognizer this module uses (the browser's SpeechRecognition, or a test fake). */
export type Recognizer = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
};
export type RecognizerClass = new () => Recognizer;

export function problemFor(error: string): SpeechProblem | null {
  if (error === "not-allowed" || error === "service-not-allowed") return "denied";
  if (error === "no-speech") return "no-speech";
  if (error === "aborted") return null; // we stopped it
  return "failed";
}

export function speechWith(Recognizer: RecognizerClass | undefined): Speech {
  if (!Recognizer) return { supported: false, listen: ({ onEnd }) => { onEnd("failed"); return { stop() {} }; } };
  return {
    supported: true,
    listen({ lang, onHeard, onEnd }) {
      let problem: SpeechProblem | null = null, ended = false;
      const end = () => { if (!ended) { ended = true; onEnd(problem); } };
      let r: Recognizer;
      try { r = new Recognizer(); } catch { problem = "failed"; end(); return { stop() {} }; }
      r.lang = lang; r.continuous = true; r.interimResults = true;
      r.onresult = (e) => {
        let final = "", interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i]!, text = result[0]?.transcript ?? "";
          if (result.isFinal) final += text; else interim += text;
        }
        onHeard({ final, interim });
      };
      r.onerror = (e) => { problem = problemFor(e.error) ?? problem; };
      r.onend = end;
      try { r.start(); } catch { problem = "failed"; end(); }
      return { stop() { try { r.stop(); } catch { end(); } } };
    },
  };
}

/** The browser's recognizer, if it has one (Safari and older Chrome name it webkitSpeechRecognition). */
export function browserSpeech(win: Window = window): Speech {
  const w = win as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return speechWith(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}
