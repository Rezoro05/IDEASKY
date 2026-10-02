import { describe, it, expect } from "vitest";
import { arcControl, arcPoint, easeInOut, headingBetween } from "../../src/lib/flight-path";
import { v } from "../../src/lib/vec";

describe("easeInOut", () => {
  it("starts at 0, ends at 1, passes the middle at the middle", () => {
    expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]);
  });
  it("is slow at both ends", () => {
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });
});

describe("arc", () => {
  const start = v(600, 500), end = v(300, 200);
  it("the control point swings left of the start and above both ends", () => {
    expect(arcControl(start, end)).toEqual(v(420, 60));
  });
  it("begins at the start and lands exactly on the target", () => {
    expect(arcPoint(start, end, 0)).toEqual(start);
    expect(arcPoint(start, end, 1)).toEqual(end);
  });
  it("clamps progress outside 0..1", () => {
    expect(arcPoint(start, end, -1)).toEqual(start);
    expect(arcPoint(start, end, 2)).toEqual(end);
  });
  it("rises above both ends on the way", () => {
    expect(arcPoint(start, end, 0.6).y).toBeLessThan(end.y);
  });
});

describe("headingBetween", () => {
  it("points along the motion", () => {
    expect(headingBetween(v(0, 0), v(0, 10), 0)).toBeCloseTo(Math.PI / 2);
  });
  it("keeps the old heading when the plane barely moved", () => {
    expect(headingBetween(v(0, 0), v(0.2, 0.1), 1.25)).toBe(1.25);
  });
});
