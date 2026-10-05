import { describe, it, expect } from "vitest";
import { BIRD, flyBird, grabbed, isScaredBy, perchSpotOf, perchSpots, wingLook, type BirdContext } from "../../src/lib/bird";
import type { BirdState, Plane, PointerInfo } from "../../src/lib/plane";
import { createWorld, setStage, step, type World, type StepInput } from "../../src/lib/sim";
import { FORM_FLIGHT, configFor } from "../../src/lib/flight-forms";
import { FLIGHT_CONFIGS } from "../../src/lib/motion";
import { GRID, perchLines } from "../../src/lib/perches";
import { v, len, sub, type Vec } from "../../src/lib/vec";

const profile = FLIGHT_CONFIGS.full;
const config = configFor(profile, FORM_FLIGHT.live);
const bounds = { width: 1200, height: 600 };
const dt = 1 / 60;
const ctx = (over: Partial<BirdContext> = {}): BirdContext => ({ dt, time: 100, visitSeed: 1, bounds, config, steer: v(0, 0), pointer: null, taken: [], ...over });
const bird = (state: BirdState | undefined, position: Vec = v(600, 300), velocity: Vec = v(40, 0)): Plane => ({ slug: "b", stage: "live", position, velocity, ...(state ? { bird: state } : {}) });
const moving = (position: Vec, speed = 300): PointerInfo => ({ position, speed });
/** Runs one bird, frame by frame, until `until(plane)` or `max` seconds pass. */
const fly = (plane: Plane, over: (t: number) => Partial<BirdContext>, until: (p: Plane) => boolean, max = 60): { plane: Plane; time: number } => {
  let time = 100;
  for (let f = 0; f < max * 60 && !until(plane); f++) { plane = flyBird(plane, ctx({ time, ...over(time) })); time += dt; }
  return { plane, time };
};

describe("a bird's first frame", () => {
  it("starts gliding, with a glide of 6 to 14 seconds", () => {
    const out = flyBird(bird(undefined), ctx());
    expect(out.bird).toMatchObject({ mode: "gliding", n: 1 });
    const until = (out.bird as { until: number }).until;
    expect(until).toBeGreaterThanOrEqual(100 + BIRD.glide[0]);
    expect(until).toBeLessThanOrEqual(100 + BIRD.glide[1]);
  });
  it("is the same for the same bird, seed and moment", () => {
    expect(flyBird(bird(undefined), ctx())).toEqual(flyBird(bird(undefined), ctx()));
    expect(flyBird(bird(undefined), ctx({ visitSeed: 2 }))).not.toEqual(flyBird(bird(undefined), ctx()));
  });
});

describe("gliding", () => {
  it("keeps gliding until its time is up", () => {
    const out = flyBird(bird({ mode: "gliding", until: 110, n: 1 }), ctx({ time: 109.9 }));
    expect(out.bird).toMatchObject({ mode: "gliding", until: 110 });
  });
  it("then heads for a free perch on a grid line, away from the spots already taken", () => {
    const taken = [v(300, 95.5), v(340, 95.5)];
    const out = flyBird(bird({ mode: "gliding", until: 110, n: 1 }), ctx({ time: 110, taken }));
    expect(out.bird?.mode).toBe("approaching");
    const target = (out.bird as { target: Vec }).target;
    expect(perchLines(bounds.height, config.boundsMargin)).toContain(target.y);
    for (const t of taken) expect(len(sub(target, t))).toBeGreaterThanOrEqual(BIRD.perchSpacing);
  });
  it("looks again in a couple of seconds when no perch is free", () => {
    const out = flyBird(bird({ mode: "gliding", until: 110, n: 1 }), ctx({ time: 110, bounds: { width: 100, height: 600 } }));
    expect(out.bird).toMatchObject({ mode: "gliding", until: 110 + BIRD.retry });
  });
});

describe("approaching a perch", () => {
  const target = v(500, 3 * GRID * 3 - 0.5);
  it("flaps over, never faster than its approach speed, and lands exactly on the spot, still", () => {
    let seen = 0;
    const { plane, time } = fly(bird({ mode: "approaching", target, n: 2 }, v(100, 100), v(30, 10)), () => ({}), (p) => p.bird?.mode === "perched");
    expect(plane.bird?.mode).toBe("perched");
    expect(plane.position).toEqual(target);
    expect(plane.velocity).toEqual(v(0, 0));
    expect(time).toBeLessThan(100 + 30);
    const rest = (plane.bird as { until: number }).until - time;
    expect(rest).toBeGreaterThanOrEqual(BIRD.rest[0] - 0.05);
    expect(rest).toBeLessThanOrEqual(BIRD.rest[1] + 0.05);
    let p = bird({ mode: "approaching", target, n: 2 }, v(100, 100), v(30, 10)), t = 100;
    for (let f = 0; f < 600 && p.bird?.mode === "approaching"; f++) { p = flyBird(p, ctx({ time: t })); t += dt; seen = Math.max(seen, len(p.velocity)); }
    expect(seen).toBeLessThanOrEqual(config.cruise * BIRD.approachScale + 1e-6);
  });
  it("gives the perch up and glides on if the pointer scares it", () => {
    const here = v(300, 300);
    const out = flyBird(bird({ mode: "approaching", target, n: 2 }, here), ctx({ pointer: moving(v(330, 300)) }));
    expect(out.bird?.mode).toBe("gliding");
    expect(perchSpotOf(out)).toBeNull();
  });
});

describe("perched", () => {
  const spot = v(500, 287.5);
  const rest = (alarm = 0): BirdState => ({ mode: "perched", until: 110, alarm, n: 3 });
  it("sits still on its spot while it is quiet, even with edges and neighbours pushing", () => {
    const out = flyBird(bird(rest(), spot, v(0, 0)), ctx({ time: 105, steer: v(500, -500) }));
    expect(out.position).toEqual(spot);
    expect(out.velocity).toEqual(v(0, 0));
    expect(out.bird?.mode).toBe("perched");
  });
  it("takes off when its rest is over", () => {
    const out = flyBird(bird(rest(), spot, v(0, 0)), ctx({ time: 110 }));
    expect(out.bird).toMatchObject({ mode: "takingOff", until: 110 + BIRD.takeOff });
    expect(len(out.velocity)).toBeGreaterThan(0);
  });
  it("is startled only after a moving pointer has stayed close for a moment", () => {
    const near = moving(v(540, 287.5));
    let p = bird(rest(), spot, v(0, 0)), t = 105;
    for (let f = 0; f < Math.floor(BIRD.startle / dt) - 1; f++) { p = flyBird(p, ctx({ time: t, pointer: near })); t += dt; }
    expect(p.bird?.mode).toBe("perched");
    for (let f = 0; f < 3; f++) { p = flyBird(p, ctx({ time: t, pointer: near })); t += dt; }
    expect(p.bird?.mode).toBe("takingOff");
  });
  it("flies off away from the pointer that startled it", () => {
    const pointer = moving(v(540, 287.5));
    const out = flyBird(bird(rest(BIRD.startle), spot, v(0, 0)), ctx({ time: 105, pointer }));
    expect(out.bird?.mode).toBe("takingOff");
    expect(out.velocity.x).toBeLessThan(0); // the pointer is to its right
  });
  it("forgets a scare that stopped: a pointer that leaves resets the alarm", () => {
    const out = flyBird(bird(rest(0.2), spot, v(0, 0)), ctx({ time: 105 }));
    expect(out.bird).toMatchObject({ mode: "perched", alarm: 0 });
  });
  it("ignores a pointer that is still, or too far away", () => {
    for (const pointer of [moving(v(520, 287.5), BIRD.alarmSpeed - 1), moving(v(500 + BIRD.alarmRadius + 5, 287.5))]) {
      let p = bird(rest(), spot, v(0, 0)), t = 105;
      for (let f = 0; f < 120; f++) { p = flyBird(p, ctx({ time: t, pointer })); t += dt; }
      expect(p.bird?.mode).toBe("perched");
    }
  });
});

describe("taking off", () => {
  it("flaps on for a moment, then glides", () => {
    const start = bird({ mode: "takingOff", until: 101.2, n: 4 }, v(500, 287.5), v(50, -20));
    expect(flyBird(start, ctx({ time: 101 })).bird?.mode).toBe("takingOff");
    expect(flyBird(start, ctx({ time: 101.2 })).bird).toMatchObject({ mode: "gliding" });
  });
});

describe("fleeing the pointer", () => {
  const glide = (): BirdState => ({ mode: "gliding", until: 200, n: 1 });
  const awayAfter = (pointer: PointerInfo | null): number => {
    const out = flyBird(bird(glide(), v(600, 300), v(0, 0)), ctx({ pointer }));
    return out.velocity.x; // the pointer, if any, is to the left
  };
  it("pushes a bird away from a moving pointer inside the alarm radius, harder the closer it is", () => {
    expect(awayAfter(moving(v(560, 300)))).toBeGreaterThan(0);
    expect(awayAfter(moving(v(590, 300)))).toBeGreaterThan(awayAfter(moving(v(500, 300))));
  });
  it("ignores a pointer that is still, outside the radius, or absent", () => {
    expect(awayAfter(moving(v(560, 300), BIRD.alarmSpeed - 1))).toBe(0);
    expect(awayAfter(moving(v(600 - BIRD.alarmRadius - 1, 300)))).toBe(0);
    expect(awayAfter(null)).toBe(0);
  });
  it("never gets faster than a scared bird's top speed, which a fast mouse beats", () => {
    let p = bird(glide(), v(600, 300), v(0, 0)), peak = 0;
    for (let f = 0; f < 300; f++) { p = flyBird(p, ctx({ time: 100 + f * dt, pointer: moving(sub(p.position, v(40, 0))) })); peak = Math.max(peak, len(p.velocity)); }
    expect(peak).toBeLessThanOrEqual(config.cruise * BIRD.fleeSpeedScale + 1e-6);
    expect(peak).toBeGreaterThan(config.cruise * 1.5);
    expect(config.cruise * BIRD.fleeSpeedScale).toBeLessThan(BIRD.alarmSpeed * 2); // a mouse moving at 160 px/s already outruns it
  });
  it("knows who is scared", () => {
    expect(isScaredBy(v(0, 0), moving(v(100, 0)))).toBe(true);
    expect(isScaredBy(v(0, 0), moving(v(100, 0), 10))).toBe(false);
    expect(isScaredBy(v(0, 0), null)).toBe(false);
  });
});

describe("being picked up", () => {
  it("makes a bird glide afterwards, whatever it was doing", () => {
    for (const state of [{ mode: "perched", until: 110, alarm: 0, n: 3 }, { mode: "approaching", target: v(1, 1), n: 3 }, { mode: "takingOff", until: 105, n: 3 }] as BirdState[]) {
      const out = grabbed(bird(state), 100, 1);
      expect(out.bird).toMatchObject({ mode: "gliding" });
      expect(perchSpotOf(out)).toBeNull();
    }
  });
});

describe("how the wings look", () => {
  it("is still gliding, beating while flying to a perch or taking off, folded when perched, and nothing for a bird with no state yet", () => {
    expect(wingLook(bird({ mode: "gliding", until: 1, n: 1 }))).toBe("glide");
    expect(wingLook(bird({ mode: "approaching", target: v(1, 1), n: 1 }))).toBe("flap");
    expect(wingLook(bird({ mode: "takingOff", until: 1, n: 1 }))).toBe("flap");
    expect(wingLook(bird({ mode: "perched", until: 1, alarm: 0, n: 1 }))).toBe("perch");
    expect(wingLook(bird(undefined))).toBeNull();
  });
});

describe("perch spots", () => {
  it("are the ones perched on or flown to, not the bird's own", () => {
    const planes: Plane[] = [
      { ...bird({ mode: "perched", until: 1, alarm: 0, n: 1 }, v(10, 20)), slug: "p" },
      { ...bird({ mode: "approaching", target: v(30, 40), n: 1 }), slug: "q" },
      { ...bird({ mode: "gliding", until: 1, n: 1 }), slug: "g" },
      { ...bird({ mode: "perched", until: 1, alarm: 0, n: 1 }, v(50, 60)), slug: "me" },
    ];
    expect(perchSpots(planes, "me")).toEqual([v(10, 20), v(30, 40)]);
  });
});

/* Functional: a flock in the sim, over two simulated minutes */
describe("birds in the sky", () => {
  const input = (over: Partial<StepInput> = {}): StepInput => ({ dt, bounds, held: null, pausedSlugs: new Set(), ...over });
  const flock = (seed: number): World => {
    let w = createWorld(["a", "b", "c", "d", "e"], seed, bounds, profile);
    for (const s of ["a", "b", "c", "d", "e"]) w = setStage(w, s, "live");
    return w;
  };
  const record = (seed: number) => {
    let w = flock(seed);
    const perches = new Map<string, number>(), flights = new Map<string, number>(), seenPerched = new Set<string>();
    const log: { x: number; y: number }[][] = [];
    for (let f = 0; f < 7200; f++) {
      w = step(w, input(), profile);
      const perched = w.planes.filter((p) => p.bird?.mode === "perched");
      for (const p of w.planes) {
        const mode = p.bird?.mode, key = p.slug;
        if (mode === "perched" && !seenPerched.has(key)) { seenPerched.add(key); perches.set(key, (perches.get(key) ?? 0) + 1); }
        if (mode !== "perched") { if (seenPerched.delete(key)) flights.set(key, (flights.get(key) ?? 0) + 1); }
        expect(p.position.x).toBeGreaterThanOrEqual(0);
        expect(p.position.x).toBeLessThanOrEqual(bounds.width);
        expect(p.position.y).toBeGreaterThanOrEqual(0);
        expect(p.position.y).toBeLessThanOrEqual(bounds.height);
      }
      for (const p of perched) expect((p.position.y + 0.5) % GRID, `${p.slug} perched off the grid at frame ${f}`).toBe(0);
      for (const a of perched) for (const b of perched) if (a.slug < b.slug) expect(len(sub(a.position, b.position)), `${a.slug}/${b.slug} too close at frame ${f}`).toBeGreaterThanOrEqual(BIRD.perchSpacing - 1e-6);
      if (f % 600 === 0) log.push(w.planes.map((p) => ({ x: p.position.x, y: p.position.y })));
    }
    return { w, perches, flights, log };
  };
  it("stay in the field, perch only on grid lines and never closer than the spacing, and each lands and takes off again", () => {
    for (const seed of [1, 99, 12345]) {
      const { perches, flights } = record(seed);
      for (const slug of ["a", "b", "c", "d", "e"]) {
        expect(perches.get(slug) ?? 0, `${slug} landed (seed ${seed})`).toBeGreaterThanOrEqual(2);
        expect(flights.get(slug) ?? 0, `${slug} took off again (seed ${seed})`).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it("fly the same way for the same seed", () => {
    expect(record(7).log).toEqual(record(7).log);
  });
  it("take off when a moving pointer comes through, and a held bird glides when let go", () => {
    let w = flock(3);
    for (let f = 0; f < 1800; f++) w = step(w, input(), profile); // let some settle on perches
    const target = w.planes.find((p) => p.bird?.mode === "perched") ?? w.planes[0]!;
    let held = w;
    for (let f = 0; f < 10; f++) held = step(held, input({ held: { slug: target.slug, pointer: v(600, 300) } }), profile);
    expect(held.planes.find((p) => p.slug === target.slug)!.bird?.mode).toBe("gliding");
    const perchedNow = w.planes.find((p) => p.bird?.mode === "perched");
    expect(perchedNow, "some bird should have landed by now").toBeDefined();
    let swept = w;
    for (let f = 0; f < 30; f++) swept = step(swept, input({ pointer: moving(perchedNow!.position, 400) }), profile); // half a second of a mouse sweeping past
    expect(swept.planes.find((p) => p.slug === perchedNow!.slug)!.bird?.mode).not.toBe("perched");
  });
});
