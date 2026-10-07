import { describe, it, expect } from "vitest";
import { cageLow, hintPath, hintStart, shouldShowHint } from "../../src/lib/hint";
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
  it("catches above a cage at the bottom of the sky (web: bottom right; phone: bottom centre), inside the sky", () => {
    const desk = hintStart(v(1220, 700), { width: 1280, height: 760 });
    expect(desk.x).toBeLessThan(1220); expect(desk.y).toBeLessThan(700); expect(desk.y).toBeGreaterThanOrEqual(80);
    const phone = hintStart(v(195, 680), { width: 390, height: 780 });
    expect(phone.x).toBeGreaterThanOrEqual(60); expect(phone.y).toBeLessThan(680); expect(phone.y).toBeGreaterThanOrEqual(80);
    expect(cageLow(v(1220, 700), { height: 760 })).toBe(true); expect(cageLow(v(1200, 100), { height: 800 })).toBe(false);
  });
  it("draws a curve that starts at the catch, rises, and ends at the cage", () => {
    expect(hintPath(v(100, 500), v(900, 100))).toBe("M 100 500 Q 500 -100 900 100");
  });
});
