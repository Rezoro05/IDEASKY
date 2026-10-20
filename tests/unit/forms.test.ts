import { describe, it, expect } from "vitest";
import { formFor } from "../../src/lib/forms";
import { LINE_BOX } from "../../src/lib/line-art";
import { FISH_SVG, fishSvg, patternFor } from "../../src/lib/fish-art";

describe("the drawing for each stage", () => {
  it("draws every form as one self-contained svg in the shared box", () => {
    for (const stage of ["implementation", "live", "idea"] as const) {
      const svg = formFor(stage);
      expect(svg.startsWith(`<svg viewBox="${LINE_BOX}"`)).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).not.toContain("${");
      expect(svg).not.toContain("undefined");
    }
  });
  it("draws the bird with a near and a far wing the sky can move, and legs for perching", () => {
    const svg = formFor("idea");
    expect(svg.match(/class="bw bw-(near|far)"/g)).toEqual(['class="bw bw-far"', 'class="bw bw-near"']); // far wing first, so the body covers it
    expect(svg).toContain('class="bird-legs"');
  });
  it("uses no pictures: the bird is shapes only", () => {
    expect(formFor("idea")).not.toMatch(/<img|\.webp|\.png/);
  });
  it("gives the same drawing whoever asks", () => {
    for (const stage of ["implementation", "live", "idea"] as const) expect(formFor(stage)).toBe(formFor(stage));
  });
  it("draws every part as a raised line: shadow, underside, line, highlight", () => {
    for (const svg of [formFor("idea"), formFor("live"), FISH_SVG]) {
      const n = (c: string) => svg.split(`class="${c}"`).length - 1;
      expect(n("ln-main")).toBeGreaterThan(0);
      expect([n("ln-shadow"), n("ln-under"), n("ln-light")]).toEqual([n("ln-main"), n("ln-main"), n("ln-main")]);
    }
  });
});

describe("the fish", () => {
  it("has a tail that can sway, a spiral eye, and one of three patterns", () => {
    for (const p of ["scales", "lines", "fins"] as const) {
      const svg = fishSvg(p);
      expect(svg).toContain('class="fish-tail"');
      expect(svg.startsWith(`<svg viewBox="${LINE_BOX}"`)).toBe(true);
    }
    expect(new Set([fishSvg("scales"), fishSvg("lines"), fishSvg("fins")]).size).toBe(3);
  });
  it("gives a dream the same pattern every visit, and uses all three across dreams", () => {
    expect(patternFor("dream0001")).toBe(patternFor("dream0001"));
    expect(new Set(Array.from({ length: 30 }, (_, i) => patternFor("d" + i))).size).toBe(3);
  });
});
