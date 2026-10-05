import { describe, it, expect } from "vitest";
import { CAGE_SLACK, isOverCage } from "../../src/lib/cage";
import { isCatchable, pressOutcome, type PressEnd } from "../../src/lib/catch";
import { STAGES } from "../../src/lib/stages";
import { v } from "../../src/lib/vec";

const cage = { x: 1000, y: 80, width: 64, height: 64 };

describe("over the cage", () => {
  it("is true inside the drawn cage, edges included", () => {
    expect(isOverCage(v(1032, 112), cage)).toBe(true);
    expect(isOverCage(v(1000, 80), cage)).toBe(true);
    expect(isOverCage(v(1064, 144), cage)).toBe(true);
  });
  it("still counts a little outside, by the slack, and no farther", () => {
    expect(isOverCage(v(1000 - CAGE_SLACK, 112), cage)).toBe(true);
    expect(isOverCage(v(1000 - CAGE_SLACK - 1, 112), cage)).toBe(false);
    expect(isOverCage(v(1032, 144 + CAGE_SLACK), cage)).toBe(true);
    expect(isOverCage(v(1032, 144 + CAGE_SLACK + 1), cage)).toBe(false);
  });
  it("is false well away from it, and honors a different slack", () => {
    expect(isOverCage(v(200, 400), cage)).toBe(false);
    expect(isOverCage(v(990, 112), cage, 0)).toBe(false);
  });
});

describe("which ideas can be caught", () => {
  it("only live ones", () => expect(STAGES.filter(isCatchable)).toEqual(["live"]));
});

describe("how a press ends", () => {
  const end = (over: Partial<PressEnd>): PressEnd => ({ stage: "live", gesture: "drag", overCage: false, canceled: false, ...over });
  it("cages a bird dropped over the cage", () => expect(pressOutcome(end({ overCage: true }))).toBe("caged"));
  it("lets a bird go anywhere else, tap or drag", () => {
    expect(pressOutcome(end({ gesture: "open" }))).toBe("released"); // a tap on a bird does not open it
    expect(pressOutcome(end({ gesture: "drag" }))).toBe("released");
  });
  it("never cages a bird whose pointer was taken away", () => expect(pressOutcome(end({ overCage: true, canceled: true }))).toBe("released"));
  it("opens a paper plane or an airplane on a tap", () => {
    for (const stage of ["idea", "implementation"] as const) expect(pressOutcome(end({ stage, gesture: "open" }))).toBe("open");
  });
  it("throws a paper plane or an airplane on a drag, even one dropped over the cage", () => {
    for (const stage of ["idea", "implementation"] as const) {
      expect(pressOutcome(end({ stage, gesture: "drag" }))).toBe("thrown");
      expect(pressOutcome(end({ stage, gesture: "drag", overCage: true }))).toBe("thrown");
    }
  });
  it("throws rather than opens when a plane's pointer was taken away", () => expect(pressOutcome(end({ stage: "idea", gesture: "open", canceled: true }))).toBe("thrown"));
});
