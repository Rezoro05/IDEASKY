import { describe, it, expect } from "vitest";
import { hintPath, hintStart, shouldShowHint } from "../../src/lib/hint";
import { v } from "../../src/lib/vec";

describe("the first-visit hint", () => {
  it("shows once, with motion allowed, when the visit starts in the sky", () => {
    expect(shouldShowHint({ seen: false, reducedMotion: false, hash: "" })).toBe(true);
    expect(shouldShowHint({ seen: true, reducedMotion: false, hash: "" })).toBe(false);
    expect(shouldShowHint({ seen: false, reducedMotion: true, hash: "" })).toBe(false);
    expect(shouldShowHint({ seen: false, reducedMotion: false, hash: "#sea" })).toBe(false);
    expect(shouldShowHint({ seen: false, reducedMotion: false, hash: "#idea-abc123" })).toBe(false);
  });
  it("starts left of and below the cage, inside the sky", () => {
    const desk = hintStart(v(1200, 100), { width: 1280, height: 800 });
    expect(desk.x).toBeLessThan(1200); expect(desk.y).toBeGreaterThan(100);
    const phone = hintStart(v(350, 30), { width: 390, height: 844 });
    expect(phone.x).toBeGreaterThanOrEqual(60); expect(phone.y).toBeLessThanOrEqual(844 - 80);
  });
  it("draws a curve that starts at the catch, rises, and ends at the cage", () => {
    expect(hintPath(v(100, 500), v(900, 100))).toBe("M 100 500 Q 500 -100 900 100");
  });
});
