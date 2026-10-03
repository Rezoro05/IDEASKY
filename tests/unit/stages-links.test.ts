import { describe, it, expect } from "vitest";
import { STAGES, isOneStep, isStage, stageChoices, stageLabel, stageOrIdea } from "../../src/lib/stages";
import { fractionAt, knobFraction, settledStage, stageFraction } from "../../src/lib/stage-bar";
import { checkLinkRows, cleanLink, cleanLinks, siteName, webAddress, LINK_LIMITS } from "../../src/lib/links";

describe("stages", () => {
  it("run in order, shown as 0 / – / 1", () => {
    expect(STAGES).toEqual(["idea", "implementation", "live"]);
    expect(STAGES.map(stageLabel)).toEqual(["Idea", "In Progress", "Live"]);
  });
  describe("the stage radios", () => {
    const view = (cs: ReturnType<typeof stageChoices>) => cs.map((c) => `${c.checked ? "●" : "○"}${c.enabled ? "" : "x"}`).join(" ");
    it("show the current stage; visitors can't pick", () => {
      expect(view(stageChoices("implementation", false))).toBe("○x ●x ○x");
    });
    it("let the owner pick one step either way, never a jump", () => {
      expect(view(stageChoices("idea", true))).toBe("● ○ ○x");
      expect(view(stageChoices("implementation", true))).toBe("○ ● ○");
      expect(view(stageChoices("live", true))).toBe("○x ○ ●");
    });
  });
  it("only single steps are moves", () => {
    expect(isOneStep("idea", "implementation")).toBe(true);
    expect(isOneStep("live", "implementation")).toBe(true);
    expect(isOneStep("idea", "live")).toBe(false);
    expect(isOneStep("idea", "idea")).toBe(false);
  });
  it("unknown values read as the first stage", () => {
    expect(isStage("live")).toBe(true);
    expect([undefined, null, "", "LIVE", "done", 2].map(stageOrIdea)).toEqual(Array(6).fill("idea"));
  });
});

describe("web addresses", () => {
  it("accepts http and https, and plain domains as https", () => {
    expect(webAddress("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(webAddress("http://example.com")).toBe("http://example.com/");
    expect(webAddress(" example.com/x ")).toBe("https://example.com/x");
    expect(webAddress("www.example.co.uk")).toBe("https://www.example.co.uk/");
  });
  it("rejects anything that could run script or isn't a web address", () => {
    for (const bad of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,hi", "ftp://example.com", "mailto:a@b.co",
      "/relative/path", "just words", "localhost", "https://", "", "http://exa mple.com", "x".repeat(LINK_LIMITS.url + 1)]) {
      expect(webAddress(bad), bad).toBeNull();
    }
  });
  it("site names drop www", () => {
    expect(siteName("https://www.example.com/x")).toBe("example.com");
    expect(siteName("https://docs.example.com")).toBe("docs.example.com");
  });
});

describe("links", () => {
  it("an empty title becomes the site's name; long titles are cut", () => {
    expect(cleanLink({ title: "  ", url: "https://www.example.com/a" })).toEqual({ title: "example.com", url: "https://www.example.com/a" });
    expect(cleanLink({ title: "t".repeat(200), url: "example.com" })!.title).toHaveLength(LINK_LIMITS.title);
  });
  it("untrusted lists: junk dropped, order kept, at most five, duplicates allowed", () => {
    const good = { title: "A", url: "https://a.com" };
    expect(cleanLinks([good, { url: "javascript:x" }, null, "x", good, good, good, good, good])).toEqual(Array(5).fill({ title: "A", url: "https://a.com/" }));
    expect(cleanLinks("not a list")).toEqual([]);
  });
  it("typed rows: blanks skipped, a bad address names its row", () => {
    expect(checkLinkRows([{ title: "", url: "" }, { title: "Demo", url: "demo.app" }])).toEqual({ ok: true, links: [{ title: "Demo", url: "https://demo.app/" }] });
    expect(checkLinkRows([{ title: "Demo", url: "demo.app" }, { title: "Oops", url: "not a link" }])).toMatchObject({ ok: false, row: 1 });
    expect(checkLinkRows([{ title: "Title only", url: "" }])).toMatchObject({ ok: false, row: 0 });
  });
});

describe("the stage progress bar", () => {
  it("puts the stages at the left end, the middle and the right end", () => {
    expect(STAGES.map(stageFraction)).toEqual([0, 0.5, 1]);
  });
  it("turns a pointer position into a fraction along the bar, never outside it", () => {
    expect(fractionAt(150, 100, 200)).toBe(0.25);
    expect(fractionAt(50, 100, 200)).toBe(0);
    expect(fractionAt(900, 100, 200)).toBe(1);
    expect(fractionAt(150, 100, 0)).toBe(0);
  });
  it("lets the knob follow the pointer but stops it one stage away", () => {
    expect(knobFraction("idea", 0.9)).toBe(0.5);
    expect(knobFraction("idea", 0.3)).toBe(0.3);
    expect(knobFraction("implementation", 0)).toBe(0);
    expect(knobFraction("implementation", 1)).toBe(1);
    expect(knobFraction("live", 0.1)).toBe(0.5);
    expect(knobFraction("live", 2)).toBe(1);
  });
  it("settles on the nearest stage, one step at most", () => {
    expect(settledStage("idea", 0.2)).toBe("idea");
    expect(settledStage("idea", 0.3)).toBe("implementation");
    expect(settledStage("idea", 1)).toBe("implementation"); // no jump to Live
    expect(settledStage("implementation", 0.1)).toBe("idea");
    expect(settledStage("implementation", 0.9)).toBe("live");
    expect(settledStage("implementation", 0.6)).toBe("implementation");
    expect(settledStage("live", 0)).toBe("implementation");
  });
});
