import { describe, it, expect } from "vitest";
import { formFor } from "../../src/lib/forms";
import { STAGES } from "../../src/lib/stages";

const idsIn = (svg: string): string[] => [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
const refsIn = (svg: string): string[] => [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!);

describe("the drawing for each stage", () => {
  it("is one self-contained svg in the shared box, whatever the stage", () => {
    for (const stage of STAGES) {
      const svg = formFor(stage, "abc123");
      expect(svg.startsWith('<svg viewBox="-30 -30 60 60"')).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).not.toContain("${");
      expect(svg).not.toContain("undefined");
    }
  });
  it("gives every gradient the bird uses an id defined in that same drawing", () => {
    const svg = formFor("live", "abc123"), ids = idsIn(svg);
    expect(refsIn(svg).length).toBeGreaterThan(0);
    for (const ref of refsIn(svg)) expect(ids).toContain(ref);
    expect(new Set(ids).size).toBe(ids.length); // no id twice within one bird
  });
  it("keeps two birds' ids apart, so removing one never breaks the other's colors", () => {
    const a = idsIn(formFor("live", "aaaaaa1")), b = idsIn(formFor("live", "bbbbbb2"));
    expect(a.length).toBeGreaterThan(0);
    for (const id of a) expect(b).not.toContain(id);
  });
  it("draws the wings as their own groups, so they can beat and fold without squashing the body", () => {
    const svg = formFor("live", "abc123");
    expect(svg.match(/<g class="wing wing-(up|down)">/g)).toHaveLength(2);
    expect(svg).toContain('class="bird-body"');
  });
  it("leaves the paper plane and the airplane as they were, whoever asks", () => {
    for (const stage of ["idea", "implementation"] as const) expect(formFor(stage, "a")).toBe(formFor(stage, "b"));
  });
});
