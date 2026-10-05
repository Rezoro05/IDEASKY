import { describe, it, expect } from "vitest";
import { TRAIL, extendTrail, tailPoint, trailSegments, type TrailPoint } from "../../src/lib/trail";
import { v } from "../../src/lib/vec";

const SECONDS = 1.5;
/** A plane flying right at `speed` px/s, one frame every 1/60 s, for `frames` frames. */
const fly = (frames: number, speed = 55, start: TrailPoint[] = []): TrailPoint[] => {
  let t = start;
  const t0 = start.length ? start[start.length - 1]!.time : 0, x0 = start.length ? start[start.length - 1]!.position.x : 0;
  for (let f = 1; f <= frames; f++) t = extendTrail(t, v(x0 + (speed * f) / 60, 100), t0 + f / 60, SECONDS);
  return t;
};

describe("tail point", () => {
  it("is behind the plane, opposite its heading", () => expect(tailPoint(v(100, 50), v(10, 0), 25)).toEqual(v(75, 50)));
  it("is the plane's own position when it isn't moving", () => expect(tailPoint(v(100, 50), v(0, 0), 25)).toEqual(v(100, 50)));
  it("follows a diagonal heading by the given distance", () => {
    const p = tailPoint(v(0, 0), v(3, 4), 10);
    expect(p.x).toBeCloseTo(-6); expect(p.y).toBeCloseTo(-8);
  });
});

describe("extending a trail", () => {
  it("records a point only after the plane has moved the minimum spacing", () => {
    const t = fly(60); // one second at 55 px/s: 55 px
    expect(t.length).toBeGreaterThan(8);
    for (let i = 1; i < t.length; i++) expect(t[i]!.position.x - t[i - 1]!.position.x).toBeGreaterThanOrEqual(TRAIL.spacing);
  });
  it("does not add a point while the plane is still", () => {
    const t = fly(30), last = t[t.length - 1]!;
    expect(extendTrail(t, last.position, last.time + 0.05, SECONDS)).toEqual(t);
  });
  it("drops points older than the trail's length", () => {
    const t = fly(300); // five seconds
    const newest = t[t.length - 1]!.time;
    for (const p of t) expect(newest - p.time).toBeLessThanOrEqual(SECONDS + 1e-9);
  });
  it("is empty for a length of 0 or less", () => {
    expect(extendTrail(fly(30), v(500, 100), 5, 0)).toEqual([]);
    expect(extendTrail([], v(0, 0), 0, -1)).toEqual([]);
  });
  it("starts afresh when the plane jumps (thrown or dropped in), so no streak is drawn", () => {
    const t = fly(30);
    const jumped = extendTrail(t, v(900, 400), 1, SECONDS);
    expect(jumped).toEqual([{ position: v(900, 400), time: 1 }]);
  });
  it("does not change the trail it was given", () => {
    const t = fly(30), copy = [...t];
    extendTrail(t, v(500, 100), 2, SECONDS);
    expect(t).toEqual(copy);
  });
});

describe("trail segments", () => {
  it("has none until there are two points", () => {
    expect(trailSegments([], 0, SECONDS)).toEqual([]);
    expect(trailSegments([{ position: v(0, 0), time: 0 }], 0, SECONDS)).toEqual([]);
  });
  it("is brightest and thickest at the newest end, fading and thinning towards the old end", () => {
    const t = fly(90), now = t[t.length - 1]!.time, segs = trailSegments(t, now, SECONDS);
    expect(segs.length).toBe(t.length - 1);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i]!.alpha).toBeGreaterThan(segs[i - 1]!.alpha);
      expect(segs[i]!.width).toBeGreaterThan(segs[i - 1]!.width);
    }
    expect(segs[segs.length - 1]!.alpha).toBeLessThanOrEqual(TRAIL.maxAlpha);
    expect(segs[segs.length - 1]!.width).toBeLessThanOrEqual(TRAIL.headWidth);
    expect(segs[0]!.alpha).toBeGreaterThan(0);
  });
  it("joins each point to the one before it", () => {
    const t = fly(30), segs = trailSegments(t, t[t.length - 1]!.time, SECONDS);
    segs.forEach((s, i) => { expect(s.from).toEqual(t[i]!.position); expect(s.to).toEqual(t[i + 1]!.position); });
  });
  it("fades away entirely once the plane has stopped for the trail's length", () => {
    const t = fly(60);
    expect(trailSegments(t, t[t.length - 1]!.time + SECONDS + 0.1, SECONDS)).toEqual([]);
  });
  it("is as long in distance as the plane flew in the trail's time", () => {
    const t = fly(300), segs = trailSegments(t, t[t.length - 1]!.time, SECONDS);
    const reach = segs[segs.length - 1]!.to.x - segs[0]!.from.x;
    expect(reach).toBeGreaterThan(55 * SECONDS * 0.85);
    expect(reach).toBeLessThanOrEqual(55 * SECONDS + 1);
  });
});
