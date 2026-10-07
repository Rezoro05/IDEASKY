import { describe, it, expect } from "vitest";
import { BOLT_SCALE, DART_SPEED, boltAway, dartAway, fishDrop, startledBy } from "../../src/lib/net";
import { CAGE_SLACK } from "../../src/lib/cage";
import { len, v } from "../../src/lib/vec";

const fish = [{ slug: "a", position: v(100, 100) }, { slug: "b", position: v(130, 100) }, { slug: "c", position: v(400, 400) }];
const net = { x: 300, y: 500, width: 50, height: 56 };

describe("dropping a held fish", () => {
  it("in the net (with a little slack, like the cage) nets it: its dream opens", () => {
    expect(fishDrop(v(325, 528), net, false)).toBe("netted");
    expect(fishDrop(v(300 - CAGE_SLACK + 1, 500), net, false)).toBe("netted");
  });
  it("anywhere else lets it go", () => {
    expect(fishDrop(v(100, 100), net, false)).toBe("released");
    expect(fishDrop(v(300 - CAGE_SLACK - 2, 528), net, false)).toBe("released");
  });
  it("never nets a fish when the pointer was taken away rather than let go", () => {
    expect(fishDrop(v(325, 528), net, true)).toBe("released");
  });
});

describe("splashes and darting", () => {
  it("startles the fish near the splash, not the one that made it or ones far away", () => {
    expect(startledBy(v(100, 100), fish, "a")).toEqual(["b"]);
    expect(startledBy(v(250, 250), fish, null)).toEqual([]);
  });
  it("a startled fish darts straight away from the splash", () => {
    const d = dartAway(v(130, 100), v(100, 100), 0.2);
    expect(d.x).toBeCloseTo(DART_SPEED);
    expect(d.y).toBeCloseTo(0);
    expect(len(dartAway(v(100, 100), v(100, 100), 0.9))).toBeCloseTo(DART_SPEED); // right under it: picks a side
  });
  it("a fish let go of bolts the way the hand carried it, much faster than a dart", () => {
    const b = boltAway(v(0, -200), 0.3);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(-DART_SPEED * BOLT_SCALE);
    expect(len(boltAway(v(0, 0), 0.7))).toBeCloseTo(DART_SPEED * BOLT_SCALE); // a still hand: off to a side
  });
});
