import { describe, it, expect } from "vitest";
import { CAGE_SLACK, TOUCH_REACH, TOUCH_SLACK, isOverCage, nearestWithin, slackFor } from "../../src/lib/cage";
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
  it("only birds: new ideas, at the Idea stage", () => expect(STAGES.filter(isCatchable)).toEqual(["idea"]));
});

describe("how a press ends", () => {
  const end = (over: Partial<PressEnd>): PressEnd => ({ stage: "idea", gesture: "drag", overCage: false, canceled: false, ...over });
  it("cages a bird dropped over the cage", () => expect(pressOutcome(end({ overCage: true }))).toBe("caged"));
  it("lets a bird go anywhere else, tap or drag", () => {
    expect(pressOutcome(end({ gesture: "open" }))).toBe("released"); // a tap on a bird does not open it
    expect(pressOutcome(end({ gesture: "drag" }))).toBe("released");
  });
  it("never cages a bird whose pointer was taken away", () => expect(pressOutcome(end({ overCage: true, canceled: true }))).toBe("released"));
  it("opens a paper plane or an airplane on a tap", () => {
    for (const stage of ["implementation", "live"] as const) expect(pressOutcome(end({ stage, gesture: "open" }))).toBe("open");
  });
  it("throws a paper plane or an airplane on a drag, even one dropped over the cage", () => {
    for (const stage of ["implementation", "live"] as const) {
      expect(pressOutcome(end({ stage, gesture: "drag" }))).toBe("thrown");
      expect(pressOutcome(end({ stage, gesture: "drag", overCage: true }))).toBe("thrown");
    }
  });
  it("throws rather than opens when a plane's pointer was taken away", () => expect(pressOutcome(end({ stage: "implementation", gesture: "open", canceled: true }))).toBe("thrown"));
});

describe("catching with a fingertip", () => {
  const birds = [{ slug: "a", position: { x: 100, y: 100 } }, { slug: "b", position: { x: 118, y: 100 } }, { slug: "c", position: { x: 300, y: 300 } }];
  it("a press near a bird takes the nearest one within reach", () => {
    expect(nearestWithin({ x: 112, y: 104 }, birds, TOUCH_REACH)?.slug).toBe("b");
    expect(nearestWithin({ x: 100, y: 100 - TOUCH_REACH + 1 }, birds, TOUCH_REACH)?.slug).toBe("a");
  });
  it("a press in open sky takes nothing", () => {
    expect(nearestWithin({ x: 200, y: 200 }, birds, TOUCH_REACH)).toBeNull();
    expect(nearestWithin({ x: 0, y: 0 }, [], TOUCH_REACH)).toBeNull();
  });
  it("a finger drops into the cage from a wider edge than a mouse", () => {
    const cage = { x: 200, y: 600, width: 40, height: 45 }, near = { x: 200 - 24, y: 620 };
    expect(slackFor("touch")).toBe(TOUCH_SLACK); expect(slackFor("mouse")).toBe(CAGE_SLACK); expect(slackFor("pen")).toBe(CAGE_SLACK);
    expect(isOverCage(near, cage, slackFor("touch"))).toBe(true);
    expect(isOverCage(near, cage, slackFor("mouse"))).toBe(false);
  });
});
