import { describe, it, expect } from "vitest";
import { DART_SPEED, HANDLE_END, HOOP_UNITS, NET, bagDepth, bagLength, caughtBy, dartAway, dragTilt, easeVelocity, hoopCentre, startledBy, sweptIn, trailAngle } from "../../src/lib/net";
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
  it("the bag trails behind the hand: moving right it streams out to the left, moving up it streams down", () => {
    let a = 90;
    for (let i = 0; i < 60; i++) a = trailAngle(a, v(300, 0), 1 / 60);
    expect(Math.abs(Math.abs(a) - 180)).toBeLessThan(2);
    let b = 0;
    for (let i = 0; i < 60; i++) b = trailAngle(b, v(0, -300), 1 / 60);
    expect(Math.abs(b - 90)).toBeLessThan(2);
  });
  it("still, the bag drifts down slowly, not like a stone; it swings the short way round, smoothly", () => {
    let a = 170;
    for (let i = 0; i < 30; i++) a = trailAngle(a, v(0, 0), 1 / 60);
    expect(a).toBeGreaterThan(120); // half a second on, it is still drifting down
    for (let i = 0; i < 300; i++) a = trailAngle(a, v(0, 0), 1 / 60);
    expect(Math.abs(a - 90)).toBeLessThan(2);
    const one = trailAngle(170, v(0, 0), 1 / 60);
    expect(one).toBeLessThan(170); expect(one).toBeGreaterThan(165); // a step, not a jump
    const across = trailAngle(-170, v(300, 0), 1 / 60); // heading for 180: the short way is through -180, not back through 0
    expect(across).toBeLessThan(-170); expect(across).toBeGreaterThan(-173);
  });
  it("the hand's velocity eases in and out", () => {
    const one = easeVelocity(v(0, 0), v(300, 0), 1 / 60);
    expect(one.x).toBeGreaterThan(30); expect(one.x).toBeLessThan(80);
    let w = v(300, 0);
    for (let i = 0; i < 30; i++) w = easeVelocity(w, v(0, 0), 1 / 60);
    expect(w.x).toBeLessThan(10);
  });
  it("the net leans back against the water, a little", () => {
    expect(dragTilt(v(0, 0))).toBe(0);
    expect(dragTilt(v(300, 0))).toBeLessThan(0);
    expect(dragTilt(v(5000, 0))).toBe(-8);
  });
  it("a moving hoop sweeps in a fish it reaches ahead of it; a still or passing one does not", () => {
    const hoop = v(100, 100), one = [{ slug: "a", position: v(120, 100) }];
    expect(sweptIn(hoop, v(200, 0), one)).toBe("a"); // heading at it
    expect(sweptIn(hoop, v(-200, 0), one)).toBeNull(); // moving away: it is behind, by the rim
    expect(sweptIn(hoop, v(10, 0), one)).toBeNull(); // barely moving
    expect(sweptIn(hoop, v(-200, 0), [{ slug: "b", position: v(108, 100) }])).toBe("b"); // right in the middle
    expect(sweptIn(hoop, v(200, 0), [{ slug: "c", position: v(100 + NET.radius + 2, 100) }])).toBeNull(); // not in the loop yet
  });
  it("the bag is longer while held, and a little longer when the hand moves fast", () => {
    expect(bagLength(0, 0)).toBe(1);
    expect(bagLength(NET.stretchMs, 0)).toBe(NET.bagStretch);
    expect(bagLength(0, 900)).toBeCloseTo(1.35);
    expect(bagLength(0, 5000)).toBeCloseTo(1.35);
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
