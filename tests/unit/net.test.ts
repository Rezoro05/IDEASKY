import { describe, it, expect } from "vitest";
import { DART_SPEED, NET, caughtBy, dartAway, netReach, startledBy } from "../../src/lib/net";
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
  it("held down, the hoop stretches open a little, easing out, and no further", () => {
    expect(netReach(0)).toBe(NET.radius);
    expect(netReach(NET.stretchMs / 2)).toBeGreaterThan((NET.radius + NET.stretched) / 2); // eases out: most of the stretch comes early
    expect(netReach(NET.stretchMs)).toBe(NET.stretched);
    expect(netReach(NET.stretchMs * 5)).toBe(NET.stretched);
    expect(netReach(-10)).toBe(NET.radius);
  });
  it("a stretched hoop reaches a fish a fresh one would miss", () => {
    const one = [{ slug: "z", position: v(0, 45) }];
    expect(caughtBy(v(0, 0), one, netReach(0))).toBeNull();
    expect(caughtBy(v(0, 0), one, netReach(NET.stretchMs))).toBe("z");
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
