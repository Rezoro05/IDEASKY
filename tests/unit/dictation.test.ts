import { describe, it, expect } from "vitest";
import { dictatedText } from "../../src/lib/dictation";
import { problemFor, speechWith, type Recognizer } from "../../src/boundaries/speech";

describe("dictatedText", () => {
  const heard = (final: string, interim = "") => ({ final, interim });
  it("fills an empty field, starting with a capital", () => {
    expect(dictatedText("", heard("a bike lane map"), 600)).toBe("A bike lane map");
  });
  it("adds spoken words after what was typed, one space between", () => {
    expect(dictatedText("Night markets  ", heard("in every borough"), 600)).toBe("Night markets in every borough");
  });
  it("starts a new sentence with a capital", () => {
    expect(dictatedText("Night markets.", heard("open late"), 600)).toBe("Night markets. Open late");
  });
  it("shows the words still being heard after the settled ones", () => {
    expect(dictatedText("", heard("a map of ", "quiet cafes"), 600)).toBe("A map of quiet cafes");
  });
  it("never goes past the limit", () => {
    expect(dictatedText("abc", heard("defgh"), 6)).toBe("abc de");
  });
  it("leaves the field as it was when nothing has been heard yet", () => {
    expect(dictatedText("Typed", heard("", "  "), 600)).toBe("Typed");
  });
});

describe("speech boundary", () => {
  class FakeRecognizer implements Recognizer {
    static last: FakeRecognizer | null = null;
    lang = ""; continuous = false; interimResults = false;
    onresult: Recognizer["onresult"] = null; onerror: Recognizer["onerror"] = null; onend: Recognizer["onend"] = null;
    started = false; stopped = false;
    constructor() { FakeRecognizer.last = this; }
    start() { this.started = true; }
    stop() { this.stopped = true; this.onend?.(); }
    say(parts: { text: string; isFinal: boolean }[]) {
      this.onresult?.({ results: parts.map((p) => Object.assign([{ transcript: p.text }], { isFinal: p.isFinal })) });
    }
  }

  it("is unsupported without a recognizer, and says so if asked to listen", () => {
    const speech = speechWith(undefined);
    expect(speech.supported).toBe(false);
    let ended: unknown = "not yet";
    speech.listen({ lang: "en", onHeard: () => {}, onEnd: (p) => { ended = p; } });
    expect(ended).toBe("failed");
  });
  it("listens continuously in the given language, with words in progress", () => {
    speechWith(FakeRecognizer).listen({ lang: "ka-GE", onHeard: () => {}, onEnd: () => {} });
    expect(FakeRecognizer.last).toMatchObject({ lang: "ka-GE", continuous: true, interimResults: true, started: true });
  });
  it("hands over all settled words and the words still in progress", () => {
    const heard: unknown[] = [];
    speechWith(FakeRecognizer).listen({ lang: "en", onHeard: (h) => heard.push(h), onEnd: () => {} });
    FakeRecognizer.last!.say([{ text: "night markets ", isFinal: true }, { text: "in every", isFinal: false }]);
    expect(heard.at(-1)).toEqual({ final: "night markets ", interim: "in every" });
  });
  it("ends once, with no problem when stopped", () => {
    const ends: unknown[] = [];
    const listening = speechWith(FakeRecognizer).listen({ lang: "en", onHeard: () => {}, onEnd: (p) => ends.push(p) });
    listening.stop();
    FakeRecognizer.last!.onend?.();
    expect(ends).toEqual([null]);
  });
  it("ends with the reason when something went wrong", () => {
    const ends: unknown[] = [];
    speechWith(FakeRecognizer).listen({ lang: "en", onHeard: () => {}, onEnd: (p) => ends.push(p) });
    FakeRecognizer.last!.onerror?.({ error: "not-allowed" });
    FakeRecognizer.last!.onend?.();
    expect(ends).toEqual(["denied"]);
  });
  it("names the problems people can act on", () => {
    expect(problemFor("not-allowed")).toBe("denied");
    expect(problemFor("service-not-allowed")).toBe("denied");
    expect(problemFor("no-speech")).toBe("no-speech");
    expect(problemFor("aborted")).toBeNull();
    expect(problemFor("network")).toBe("failed");
  });
  it("ends with a failure if the recognizer won't start", () => {
    class Broken extends FakeRecognizer { override start() { throw new Error("busy"); } }
    const ends: unknown[] = [];
    speechWith(Broken).listen({ lang: "en", onHeard: () => {}, onEnd: (p) => ends.push(p) });
    expect(ends).toEqual(["failed"]);
  });
});
