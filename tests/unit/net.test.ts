import { describe, it, expect } from "vitest";
import { DART_SPEED, HANDLE_END, HOOP_UNITS, NET, bagDepth, caughtBy, dartAway, hoopCentre, startledBy } from "../../src/lib/net";
import { len, v } from "../../src/lib/vec";

const fish = [{ slug: "a", position: v(100, 100) }, { slug: "b", position: v(130, 100) }, { slug: "c", position: v(400, 400) }];

describe("the hand net", () => {
  it("catches the fish nearest the click, if it is inside the net", () => {
    expect(caughtBy(v(125, 100), fish)).toBe("b");
    expect(caughtBy(v(102, 98), fish)).toBe("a");
  });
  it("catches nothing when no fish is inside its small reach", () => {
    expect(caughtBy(v(300, 300), fish)).toBeNull();
    expect(caughtBy(v(400 + NET.radius + 1, 400), fish)).toBeNull();
    expect(caughtBy(v(400 + NET.radius, 400), fish)).toBe("c");
  });
  it("held down, only the bag stretches, easing out, and no further", () => {
    expect(bagDepth(0)).toBe(1);
    expect(bagDepth(NET.stretchMs / 2)).toBeGreaterThan((1 + NET.bagStretch) / 2); // most of the stretch comes early
    expect(bagDepth(NET.stretchMs)).toBe(NET.bagStretch);
    expect(bagDepth(NET.stretchMs * 5)).toBe(NET.bagStretch);
    expect(bagDepth(-10)).toBe(1);
  });
  it("the pointer holds the end of the handle: the hoop is ahead of it, up and to the left", () => {
    const c = hoopCentre(v(500, 400));
    expect(c.x).toBeCloseTo(500 - HANDLE_END.x * NET.radius / HOOP_UNITS);
    expect(c.y).toBeCloseTo(400 - HANDLE_END.y * NET.radius / HOOP_UNITS);
    expect(c.x).toBeLessThan(500); expect(c.y).toBeLessThan(400);
  });
  it("startles the fish near the splash, not the one caught or ones far away", () => {
    expect(startledBy(v(100, 100), fish, "a")).toEqual(["b"]);
    expect(startledBy(v(250, 250), fish, null)).toEqual([]);
  });
  it("a startled fish darts straight away from the splash", () => {
    const d = dartAway(v(130, 100), v(100, 100), 0.2);
    expect(d.x).toBeCloseTo(DART_SPEED);
    expect(d.y).toBeCloseTo(0);
    expect(len(dartAway(v(100, 100), v(100, 100), 0.9))).toBeCloseTo(DART_SPEED); // right under it: picks a side
  });
});
