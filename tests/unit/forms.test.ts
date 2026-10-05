import { describe, it, expect } from "vitest";
import { formFor } from "../../src/lib/forms";

describe("the drawing for each stage", () => {
  it("draws every form as one self-contained svg in the shared box", () => {
    for (const stage of ["implementation", "live", "idea"] as const) {
      const svg = formFor(stage);
      expect(svg.startsWith('<svg viewBox="-30 -30 60 60"')).toBe(true);
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
});
