import { describe, it, expect } from "vitest";
import { FLOCK, flockCall, flockSteer, isAloft } from "../../src/lib/flock";
import { flyBird, type BirdContext } from "../../src/lib/bird";
import type { Plane } from "../../src/lib/plane";
import { addPlane, createWorld, setFlock, step, type World } from "../../src/lib/sim";
import { FORM_FLIGHT, configFor } from "../../src/lib/flight-forms";
import { FLIGHT_CONFIGS } from "../../src/lib/motion";
import { pickPerchBeside, perchLines } from "../../src/lib/perches";
import { mulberry32 } from "../../src/lib/random";
import { len, sub, v } from "../../src/lib/vec";

const bird = (slug: string, flock: string, x: number, y: number, extra: Partial<Plane> = {}): Plane =>
  ({ slug, stage: "idea", flock, position: v(x, y), velocity: v(30, 0), bird: { mode: "gliding", until: 100, n: 1, from: 0 }, ...extra });
const config = configFor(FLIGHT_CONFIGS.full, FORM_FLIGHT.idea);
const bounds = { width: 1200, height: 800 };
const ctx = (over: Partial<BirdContext> = {}): BirdContext =>
  ({ dt: 0.016, time: 10, visitSeed: 1, bounds, config, steer: v(0, 0), pointer: null, taken: [], ...over });

describe("flocks in the air", () => {
  it("a bird is drawn toward its flock and takes up its heading; other flocks and loners pull on nothing", () => {
    const me = bird("a", "tech", 100, 400);
    const mates = [bird("b", "tech", 300, 400, { velocity: v(0, -30) }), bird("c", "tech", 300, 420, { velocity: v(0, -30) })];
    const pull = flockSteer(me, mates);
    expect(pull.x).toBeGreaterThan(0); // toward them
    expect(pull.y).toBeLessThan(0); // turning up with them
    expect(flockSteer(me, [bird("d", "health", 300, 400)])).toEqual(v(0, 0));
    expect(flockSteer(bird("e", "", 100, 400), [bird("f", "", 300, 400)])).toEqual(v(0, 0)); // no category yet: a loner
  });
  it("only mates in the air steer the flock (not one perched or in a hand)", () => {
    const perched = bird("b", "tech", 300, 400, { velocity: v(0, 0), bird: { mode: "perched", until: 50, alarm: 0, n: 2 } });
    expect(isAloft(perched)).toBe(false);
    expect(flockSteer(bird("a", "tech", 100, 400), [perched])).toEqual(v(0, 0));
  });
});

describe("landing and leaving together", () => {
  it("a mate landing calls the flock down beside it, on the same wire", () => {
    const target = v(600, perchLines(800, config.boundsMargin)[5]!);
    const landing = bird("b", "tech", 560, 300, { bird: { mode: "approaching", target, n: 3 } });
    const call = flockCall(bird("a", "tech", 200, 200), [landing]);
    expect(call.landing).toEqual(target);
    const next = flyBird(bird("a", "tech", 200, 200), ctx({ flock: call, taken: [target] }));
    expect(next.bird?.mode).toBe("approaching");
    const spot = (next.bird as { target: { x: number; y: number } }).target;
    expect(spot.y).toBe(target.y);
    expect(Math.abs(spot.x - target.x)).toBeLessThanOrEqual(FLOCK.besideReach);
    expect(len(sub(spot, target))).toBeGreaterThanOrEqual(44); // never on top of it
  });
  it("but not straight after its own take-off", () => {
    const call = { landing: v(600, 319.5), leaving: null };
    const justUp = bird("a", "tech", 200, 200, { bird: { mode: "gliding", until: 100, n: 1, from: 9 } });
    expect(flyBird(justUp, ctx({ flock: call })).bird?.mode).toBe("gliding");
  });
  it("a perched bird goes with a mate taking off close by, heading roughly the same way", () => {
    const sitting = bird("a", "tech", 500, 319.5, { velocity: v(0, 0), bird: { mode: "perched", until: 100, alarm: 0, n: 4 } });
    const leaving = bird("b", "tech", 560, 310, { velocity: v(0, -40), bird: { mode: "takingOff", until: 11, n: 5 } });
    const call = flockCall(sitting, [leaving]);
    expect(call.leaving).toEqual(v(0, -40));
    const next = flyBird(sitting, ctx({ flock: call }));
    expect(next.bird?.mode).toBe("takingOff");
    expect(next.velocity.y).toBeLessThan(0);
    const far = bird("c", "tech", 500 + FLOCK.liftRadius + 50, 310, { bird: { mode: "takingOff", until: 11, n: 5 } });
    expect(flockCall(sitting, [far]).leaving).toBeNull(); // too far to notice
  });
  it("beside: a free spot within reach on the nearest wires, or none", () => {
    const near = v(600, 319.5), spot = pickPerchBeside(mulberry32(3), near, 170, bounds, 60, [near], 44)!;
    expect(Math.abs(spot.y - near.y)).toBeLessThanOrEqual(32);
    expect(Math.abs(spot.x - near.x)).toBeLessThanOrEqual(170);
    const crowded = Array.from({ length: 200 }, (_, i) => v(60 + i * 6, near.y - 64 + (i % 5) * 32));
    expect(pickPerchBeside(mulberry32(3), near, 170, bounds, 60, crowded, 44)).toBeNull();
  });
});

describe("a whole sky", () => {
  /** Mean distance between birds of one flock, and between birds of different flocks, over the last stretch of a run. */
  function spread(world: World, seconds: number): { mates: number; strangers: number } {
    let w = world, mates = 0, strangers = 0, nm = 0, ns = 0;
    for (let t = 0; t < seconds; t += 0.05) {
      w = step(w, { dt: 0.05, bounds, held: null, pausedSlugs: new Set() }, FLIGHT_CONFIGS.full);
      if (t < seconds / 2) continue;
      for (const a of w.planes) for (const b of w.planes) {
        if (a.slug >= b.slug) continue;
        const d = len(sub(a.position, b.position));
        if (a.flock === b.flock) { mates += d; nm++; } else { strangers += d; ns++; }
      }
    }
    return { mates: mates / nm, strangers: strangers / ns };
  }
  it("birds of one category end up together, far closer than birds of different ones", () => {
    let world = createWorld([], 42, bounds, FLIGHT_CONFIGS.full);
    const rand = mulberry32(9), flocks = ["tech", "tech", "tech", "health", "health", "health"];
    flocks.forEach((flock, i) => { world = addPlane(world, { slug: `b${i}`, stage: "idea", flock, position: v(100 + rand() * 1000, 100 + rand() * 600), velocity: v(30 * (rand() - 0.5), 30 * (rand() - 0.5)) }); });
    const { mates, strangers } = spread(world, 120);
    expect(mates).toBeLessThan(strangers * 0.7);
  });
  it("setFlock moves an idea into its category's flock", () => {
    let world = createWorld([], 1, bounds, FLIGHT_CONFIGS.full);
    world = addPlane(world, { slug: "x", stage: "idea", position: v(1, 1), velocity: v(0, 0) });
    expect(setFlock(world, "x", "science").planes[0]!.flock).toBe("science");
  });
});
