import { describe, it, expect } from "vitest";
import { planeView, MIN_SPEED_FOR_HEADING, type PlaneMemory, type ViewContext } from "../../src/lib/plane-view";
import { BIRD } from "../../src/lib/bird";
import type { BirdState, Plane } from "../../src/lib/plane";
import type { Stage } from "../../src/lib/stages";
import { trailBox } from "../../src/lib/trail";
import { v, type Vec } from "../../src/lib/vec";

const ctx = (over: Partial<ViewContext> = {}): ViewContext => ({ time: 10, dt: 1 / 60, size: 60, birdCruise: 60, trailSeconds: 1.5, ...over });
const plane = (stage: Stage, velocity: Vec = v(50, 0), bird?: BirdState, position: Vec = v(100, 200)): Plane => ({ slug: "p", stage, position, velocity, ...(bird ? { bird } : {}) });
const gliding: BirdState = { mode: "gliding", until: 20, n: 1 };
const perched: BirdState = { mode: "perched", until: 20, alarm: 0, n: 1 };

describe("planeView: every plane", () => {
  it("places the plane where it is", () => {
    expect(planeView(plane("implementation"), {}, ctx()).place).toBe("translate3d(100px, 200px, 0)");
  });
  it("faces the way it flies, and keeps its last facing when nearly still", () => {
    const flying = planeView(plane("implementation", v(-50, 0)), {}, ctx());
    expect(flying.memory.facing?.mirrored).toBe(true);
    const still = planeView(plane("implementation", v(MIN_SPEED_FOR_HEADING / 2, 0)), flying.memory, ctx());
    expect(still.memory.facing).toEqual(flying.memory.facing);
  });
  it("has no facing, and so no body transform, until it has moved or been given one", () => {
    expect(planeView(plane("implementation", v(0, 0)), {}, ctx()).body).toBeNull();
  });
});

describe("planeView: paper planes and airplanes", () => {
  it("have no wings, wing look or legs", () => {
    const view = planeView(plane("implementation"), {}, ctx());
    expect(view).toMatchObject({ look: null, wing: null, legsDown: false });
    expect(view.memory.change).toBeUndefined();
  });
  it("only airplanes leave a trail, and it grows frame by frame", () => {
    expect(planeView(plane("implementation"), {}, ctx()).memory.trail).toBeUndefined();
    const first = planeView(plane("live"), {}, ctx());
    const second = planeView(plane("live", v(50, 0), undefined, v(110, 200)), first.memory, ctx({ time: 10.1 }));
    expect(second.memory.trail!.length).toBeGreaterThan(first.memory.trail!.length);
  });
  it("an airplane that becomes another form drops its trail", () => {
    const air = planeView(plane("live"), {}, ctx());
    expect(planeView(plane("implementation"), air.memory, ctx()).memory.trail).toBeUndefined();
  });
});

describe("planeView: birds", () => {
  it("start a wing look that blends from nothing, and set their wings", () => {
    const view = planeView(plane("idea", v(50, 0), gliding), {}, ctx());
    expect(view.look).toBe("glide");
    expect(view.memory.change).toEqual({ look: "glide", from: null, since: 10 });
    expect(view.wing).not.toBeNull();
  });
  it("keep the moment a look began while it lasts, and blend from it when it changes", () => {
    const glide = planeView(plane("idea", v(50, 0), gliding), {}, ctx());
    expect(planeView(plane("idea", v(50, 0), gliding), glide.memory, ctx({ time: 11 })).memory.change!.since).toBe(10);
    expect(planeView(plane("idea", v(0, 0), perched), glide.memory, ctx({ time: 11 })).memory.change).toEqual({ look: "perch", from: "glide", since: 11 });
  });
  it("ease their wing effort toward what the flight needs, not jump to it", () => {
    const diving = plane("idea", v(0, 80), gliding); // straight down: needs no effort
    expect(planeView(diving, { effort: 1 }, ctx()).memory.effort).toBeLessThan(1);
    expect(planeView(diving, { effort: 1 }, ctx()).memory.effort).toBeGreaterThan(0.9);
  });
  it("sit upright when perched, however they last faced", () => {
    const tilted: PlaneMemory = { facing: { rotateDeg: 40, mirrored: false } };
    expect(planeView(plane("idea", v(0, 0), perched), tilted, ctx()).body).not.toMatch(/rotate\(40/);
  });
  it("put their legs down only near the end of the landing", () => {
    const target = v(300, 200);
    const far = plane("idea", v(50, 0), { mode: "approaching", target, n: 1 }, v(300 - BIRD.flareRadius * 0.9, 200));
    const near = plane("idea", v(50, 0), { mode: "approaching", target, n: 1 }, v(300 - BIRD.flareRadius * 0.2, 200));
    expect(planeView(far, {}, ctx()).legsDown).toBe(false);
    expect(planeView(near, {}, ctx()).legsDown).toBe(true);
  });
  it("a bird that becomes a plane forgets its wing look", () => {
    const bird = planeView(plane("idea", v(50, 0), gliding), {}, ctx());
    expect(planeView(plane("implementation"), bird.memory, ctx()).memory.change).toBeUndefined();
  });
});

describe("trailBox", () => {
  it("is nothing for no segments", () => {
    expect(trailBox([])).toBeNull();
  });
  it("covers every segment, padded by the widest line", () => {
    const box = trailBox([{ from: v(10, 20), to: v(30, 25), alpha: 0.3, width: 2 }, { from: v(30, 25), to: v(50, 10), alpha: 0.2, width: 1 }])!;
    expect(box.x).toBeLessThanOrEqual(10 - 2);
    expect(box.y).toBeLessThanOrEqual(10 - 2);
    expect(box.x + box.w).toBeGreaterThanOrEqual(50 + 2);
    expect(box.y + box.h).toBeGreaterThanOrEqual(25 + 2);
  });
});
