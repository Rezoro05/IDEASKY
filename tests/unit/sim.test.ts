import { describe, it, expect } from "vitest";
import { createWorld, step, modeOf, boundsSteer, separationSteer, containWithin, addPlane, removePlane, EDGE_INSET, MAX_DT, type World, type StepInput } from "../../src/lib/sim";
import { FLIGHT_CONFIGS } from "../../src/lib/motion";
import { v, len } from "../../src/lib/vec";

const config = FLIGHT_CONFIGS.full;
const bounds = { width: 1200, height: 600 };
const none = new Set<string>();
const input = (over: Partial<StepInput> = {}): StepInput => ({ dt: 1 / 60, bounds, held: null, pausedSlugs: none, ...over });
const run = (w: World, frames: number, over: Partial<StepInput> = {}): World => {
  for (let i = 0; i < frames; i++) w = step(w, input(over), config);
  return w;
};

describe("createWorld", () => {
  it("places every plane inside the field at cruise speed", () => {
    const w = createWorld(["a", "b", "c"], 42, bounds, config);
    expect(w.planes.map((p) => p.slug)).toEqual(["a", "b", "c"]);
    for (const p of w.planes) {
      expect(p.position.x).toBeGreaterThanOrEqual(0);
      expect(p.position.x).toBeLessThanOrEqual(bounds.width);
      expect(p.position.y).toBeGreaterThanOrEqual(bounds.height * 0.5);
      expect(len(p.velocity)).toBeCloseTo(config.cruise, 6);
    }
  });
  it("is reproducible from its seed", () => {
    expect(createWorld(["a", "b"], 7, bounds, config)).toEqual(createWorld(["a", "b"], 7, bounds, config));
    expect(createWorld(["a", "b"], 7, bounds, config)).not.toEqual(createWorld(["a", "b"], 8, bounds, config));
  });
});

describe("modeOf", () => {
  it("held wins over paused", () => {
    const held = { slug: "a", pointer: v(0, 0) };
    expect(modeOf("a", { held, pausedSlugs: new Set(["a"]) })).toBe("held");
    expect(modeOf("b", { held, pausedSlugs: new Set(["b"]) })).toBe("paused");
    expect(modeOf("c", { held, pausedSlugs: new Set() })).toBe("free");
  });
});

describe("steering", () => {
  it("bounds steer pushes back inward only outside the margin", () => {
    const at = (x: number, y: number) => ({ slug: "a", position: v(x, y), velocity: v(0, 0) });
    expect(boundsSteer(at(600, 300), bounds, config)).toEqual(v(0, 0));
    expect(boundsSteer(at(10, 300), bounds, config).x).toBeGreaterThan(0);
    expect(boundsSteer(at(1190, 300), bounds, config).x).toBeLessThan(0);
    expect(boundsSteer(at(600, 590), bounds, config).y).toBeLessThan(0);
  });
  it("separation pushes apart within the shield and ignores planes outside it", () => {
    const a = { slug: "a", position: v(100, 100), velocity: v(0, 0) };
    expect(separationSteer(a, [{ slug: "b", position: v(150, 100), velocity: v(0, 0) }], config).x).toBeLessThan(0);
    expect(separationSteer(a, [{ slug: "b", position: v(100 + config.shieldRadius + 1, 100), velocity: v(0, 0) }], config)).toEqual(v(0, 0));
  });
  it("containWithin clamps and bounces at half speed", () => {
    const p = containWithin({ slug: "a", position: v(-20, 700), velocity: v(-100, 50) }, bounds);
    expect(p.position).toEqual(v(EDGE_INSET, bounds.height - EDGE_INSET));
    expect(p.velocity).toEqual(v(50, -25));
  });
});

describe("step", () => {
  it("leaves paused planes exactly where they are", () => {
    const w0 = createWorld(["a", "b"], 3, bounds, config);
    const w1 = step(w0, input({ pausedSlugs: new Set(["a"]) }), config);
    expect(w1.planes[0]).toEqual(w0.planes[0]);
    expect(w1.planes[1]).not.toEqual(w0.planes[1]);
  });
  it("a held plane follows the pointer", () => {
    const w0 = createWorld(["a"], 3, bounds, config);
    const w1 = step(w0, input({ held: { slug: "a", pointer: v(321, 123) } }), config);
    expect(w1.planes[0]!.position).toEqual(v(321, 123));
  });
  it("caps a long frame at MAX_DT", () => {
    const w = step(createWorld(["a"], 3, bounds, config), input({ dt: 2 }), config);
    expect(w.time).toBeCloseTo(MAX_DT, 9);
  });
  it("never exceeds max speed", () => {
    const w0 = addPlane(createWorld([], 1, bounds, config), { slug: "x", position: v(600, 300), velocity: v(99999, 0) });
    expect(len(step(w0, input(), config).planes[0]!.velocity)).toBeLessThanOrEqual(config.maxSpeed + 1e-6);
  });
});

describe("add / remove planes", () => {
  it("adding an existing slug replaces it; removing drops it", () => {
    let w = createWorld(["a"], 1, bounds, config);
    w = addPlane(w, { slug: "a", position: v(1, 2), velocity: v(0, 0) });
    expect(w.planes).toHaveLength(1);
    expect(w.planes[0]!.position).toEqual(v(1, 2));
    expect(removePlane(w, "a").planes).toHaveLength(0);
  });
});

/* Functional: behavior that emerges over many frames */
describe("flight, over time", () => {
  const slugs = ["econsul", "ephoto", "greencard", "momo", "note-aaaaaa", "note-bbbbbb"];
  it("planes never leave the field", () => {
    for (const seed of [1, 99, 12345, 2 ** 31]) {
      const w = run(createWorld(slugs, seed, bounds, config), 1800);
      for (const p of w.planes) {
        expect(p.position.x).toBeGreaterThanOrEqual(EDGE_INSET);
        expect(p.position.x).toBeLessThanOrEqual(bounds.width - EDGE_INSET);
        expect(p.position.y).toBeGreaterThanOrEqual(EDGE_INSET);
        expect(p.position.y).toBeLessThanOrEqual(bounds.height - EDGE_INSET);
      }
    }
  });
  it("no two planes stay inside each other's shield", () => {
    let w = createWorld(slugs, 5, bounds, config);
    const overlapFrames = new Map<string, number>();
    for (let f = 0; f < 3600; f++) {
      w = step(w, input(), config);
      for (const a of w.planes) for (const b of w.planes) if (a.slug < b.slug) {
        const key = a.slug + b.slug, close = len(v(a.position.x - b.position.x, a.position.y - b.position.y)) < config.shieldRadius * 0.4;
        overlapFrames.set(key, close ? (overlapFrames.get(key) ?? 0) + 1 : 0);
        expect(overlapFrames.get(key)).toBeLessThan(240); // never stuck together for 4 seconds
      }
    }
  });
  it("the same seed gives the same flight", () => {
    const a = run(createWorld(slugs, 77, bounds, config), 600);
    const b = run(createWorld(slugs, 77, bounds, config), 600);
    expect(a).toEqual(b);
  });
  it("a thrown plane carries its velocity, then settles back to cruise", () => {
    let w = createWorld(["a"], 9, bounds, config);
    let pointer = w.planes[0]!.position; // grab it where it is
    for (let i = 0; i < 12; i++) { pointer = v(pointer.x + 15, pointer.y); w = step(w, input({ held: { slug: "a", pointer } }), config); }
    const release = w.planes[0]!;
    expect(release.velocity.x).toBeGreaterThan(300);
    const after = step(w, input(), config).planes[0]!;
    expect(after.position.x).toBeGreaterThan(release.position.x + 3);
    w = run(w, 900);
    expect(len(w.planes[0]!.velocity)).toBeLessThan(config.cruise * 2);
  });
});
