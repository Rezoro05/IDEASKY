import { describe, it, expect } from "vitest";
import { formFor } from "../../src/lib/forms";
import { FRAME_IDS } from "../../src/lib/bird-sprites";

describe("the drawing for each stage", () => {
  it("draws the paper plane and the airplane as one self-contained svg in the shared box", () => {
    for (const stage of ["idea", "implementation"] as const) {
      const svg = formFor(stage);
      expect(svg.startsWith('<svg viewBox="-30 -30 60 60"')).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).not.toContain("${");
      expect(svg).not.toContain("undefined");
    }
  });
  it("draws the bird as one image per photo, each with its size and anchor, and a relative address (the page's base decides where from)", () => {
    const html = formFor("live");
    for (const id of FRAME_IDS) expect(html).toMatch(new RegExp(`data-frame="${id}" src="birds/${id}\\.webp" width="\\d+" height="\\d+"`));
    expect(html.match(/<img /g)).toHaveLength(FRAME_IDS.length);
    expect(html).toContain("--ax:");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("${");
  });
  it("gives the same drawing whoever asks", () => {
    for (const stage of ["idea", "implementation", "live"] as const) expect(formFor(stage)).toBe(formFor(stage));
  });
});
