import { describe, it, expect } from "vitest";
import { createWorld, step, setStage, addPlane, EDGE_INSET, type World, type StepInput } from "../../src/lib/sim";
import { FORM_FLIGHT, configFor } from "../../src/lib/flight-forms";
import { bank } from "../../src/lib/banking";
import { FLIGHT_CONFIGS, type FlightConfig } from "../../src/lib/motion";
import { v, len, type Vec } from "../../src/lib/vec";
import { mulberry32 } from "../../src/lib/random";

const dt = 1 / 60;
const AIRPLANE = FORM_FLIGHT.implementation;
const MAX_TURN = AIRPLANE.maxTurnRate!;
const none = new Set<string>();
const input = (bounds: { width: number; height: number }, over: Partial<StepInput> = {}): StepInput => ({ dt, bounds, held: null, pausedSlugs: none, ...over });
/** The angle between two headings, 0 to π. */
const turnBetween = (a: Vec, b: Vec): number => {
  let d = Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x);
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
};
/** Planes scattered through the part of the field an airplane has room to turn in (inside its early-turn margin), with the seed's headings. */
const airborne = (slugs: string[], seed: number, bounds: { width: number; height: number }, config: FlightConfig, stages: (i: number) => "idea" | "implementation" = () => "implementation"): World => {
  const margin = config.boundsMargin * AIRPLANE.marginScale, rand = mulberry32(seed + 1000);
  const made = createWorld(slugs, seed, bounds, config);
  let w: World = { ...made, planes: made.planes.map((p) => ({ ...p, position: v(margin + rand() * (bounds.width - 2 * margin), margin + rand() * (bounds.height - 2 * margin)) })) };
  slugs.forEach((slug, i) => { w = setStage(w, slug, stages(i)); });
  return w;
};

describe("the paper plane's settings", () => {
  it("leave the profile's flight exactly as it is", () => {
    for (const config of Object.values(FLIGHT_CONFIGS)) {
      expect(configFor(config, FORM_FLIGHT.idea)).toEqual(config);
      expect(configFor(config, FORM_FLIGHT.live)).toEqual(config); // the bird flies like a paper plane until its own model arrives
    }
  });
  it("only the airplane is limited in how fast it turns", () => {
    expect(FORM_FLIGHT.idea.maxTurnRate).toBeNull();
    expect(AIRPLANE.maxTurnRate).toBeGreaterThan(0);
    expect(AIRPLANE.cruiseScale).toBeGreaterThan(1);
  });
});

describe("banking", () => {
  const b = { cruise: 50, settle: 1.6, maxTurnRate: 0.6 };
  it("flies straight when nothing pushes it", () => {
    const out = bank(v(50, 0), v(0, 0), b, dt);
    expect(out.x).toBeCloseTo(50, 9);
    expect(out.y).toBeCloseTo(0, 9);
  });
  it("turns toward a sideways push, by no more than its turn rate", () => {
    const toward = bank(v(50, 0), v(0, 500), b, dt); // push toward +y: heading angle grows
    expect(Math.atan2(toward.y, toward.x)).toBeCloseTo(b.maxTurnRate * dt, 9);
    const away = bank(v(50, 0), v(0, -500), b, dt);
    expect(Math.atan2(away.y, away.x)).toBeCloseTo(-b.maxTurnRate * dt, 9);
    const gentle = bank(v(50, 0), v(0, 5), b, dt); // a light push turns it less than the limit
    expect(Math.atan2(gentle.y, gentle.x)).toBeGreaterThan(0);
    expect(Math.atan2(gentle.y, gentle.x)).toBeLessThan(b.maxTurnRate * dt);
  });
  it("pushed from straight behind (a wall dead ahead), it turns rather than stalling", () => {
    const out = bank(v(50, 0), v(-300, 0), b, dt);
    expect(Math.abs(Math.atan2(out.y, out.x))).toBeCloseTo(b.maxTurnRate * dt, 9);
    expect(len(out)).toBeCloseTo(50, 6); // and does not brake against the wall
  });
  it("eases its speed to cruise, from a standstill or from a throw", () => {
    let slow: Vec = v(0, 0), fast: Vec = v(400, 0);
    for (let i = 0; i < 600; i++) { slow = bank(slow, v(0, 0), b, dt); fast = bank(fast, v(0, 0), b, dt); }
    expect(len(slow)).toBeCloseTo(50, 1);
    expect(len(fast)).toBeCloseTo(50, 1);
  });
});

describe("the airplane in the sky", () => {
  const fields = [
    { name: "full", config: FLIGHT_CONFIGS.full, bounds: { width: 1280, height: 800 } },
    { name: "lite", config: FLIGHT_CONFIGS.lite, bounds: { width: 390, height: 700 } },
  ];
  const slugs = ["a", "b", "c", "d"];

  for (const { name, config, bounds } of fields) {
    it(`started with room to turn, never turns faster than its limit and never touches the hard wall (${name})`, () => {
      for (const seed of [1, 99, 12345]) {
        let w = airborne(slugs, seed, bounds, config);
        for (let f = 0; f < 7200; f++) { // two simulated minutes
          const next = step(w, input(bounds), config);
          next.planes.forEach((p, i) => {
            const before = w.planes[i]!;
            expect(turnBetween(before.velocity, p.velocity), `${name} seed ${seed} frame ${f}`).toBeLessThanOrEqual(MAX_TURN * dt + 1e-6);
            expect(p.position.x, `${name} seed ${seed} frame ${f} x`).toBeGreaterThan(EDGE_INSET + 1);
            expect(p.position.x).toBeLessThan(bounds.width - EDGE_INSET - 1);
            expect(p.position.y).toBeGreaterThan(EDGE_INSET + 1);
            expect(p.position.y).toBeLessThan(bounds.height - EDGE_INSET - 1);
          });
          w = next;
        }
      }
    });

    it(`settles at its own cruise speed (${name})`, () => {
      let w = airborne(slugs, 7, bounds, config);
      for (let f = 0; f < 900; f++) w = step(w, input(bounds), config);
      const cruise = config.cruise * AIRPLANE.cruiseScale;
      for (const p of w.planes) expect(len(p.velocity)).toBeGreaterThan(cruise * 0.95), expect(len(p.velocity)).toBeLessThan(cruise * 1.05);
    });

    it(`shares a sky with paper planes without anyone leaving it (${name})`, () => {
      let w = airborne(["p1", "a1", "p2", "a2", "p3", "a3"], 5, bounds, config, (i) => (i % 2 ? "implementation" : "idea"));
      for (let f = 0; f < 3600; f++) w = step(w, input(bounds), config);
      for (const p of w.planes) {
        expect(p.position.x).toBeGreaterThanOrEqual(EDGE_INSET);
        expect(p.position.x).toBeLessThanOrEqual(bounds.width - EDGE_INSET);
        expect(p.position.y).toBeGreaterThanOrEqual(EDGE_INSET);
        expect(p.position.y).toBeLessThanOrEqual(bounds.height - EDGE_INSET);
      }
    });
  }

  it("a held airplane follows the pointer, and a paused one stays put", () => {
    const { config, bounds } = fields[0]!;
    const w0 = airborne(["a", "b"], 3, bounds, config);
    const held = step(w0, input(bounds, { held: { slug: "a", pointer: v(321, 123) } }), config);
    expect(held.planes[0]!.position).toEqual(v(321, 123));
    const paused = step(w0, input(bounds, { pausedSlugs: new Set(["a"]) }), config);
    expect(paused.planes[0]).toEqual(w0.planes[0]);
  });

  it("changing stage keeps position and velocity, then the new form's rules take over", () => {
    const { config, bounds } = fields[0]!;
    const w0 = createWorld(["a", "b"], 11, bounds, config);
    const w1 = setStage(w0, "a", "implementation");
    expect(w1.planes[0]).toEqual({ ...w0.planes[0], stage: "implementation" });
    expect(w1.planes[1]).toEqual(w0.planes[1]);
    let w = w1;
    for (let f = 0; f < 900; f++) w = step(w, input(bounds), config);
    expect(len(w.planes[0]!.velocity)).toBeGreaterThan(config.cruise * 1.25); // the airplane picked up its faster cruise
    const back = setStage(w, "a", "idea");
    expect(back.planes[0]!.position).toEqual(w.planes[0]!.position);
    expect(back.planes[0]!.velocity).toEqual(w.planes[0]!.velocity);
  });

  it("an idea added straight to the sky at a standstill still gets going", () => {
    const { config, bounds } = fields[0]!;
    let w = addPlane(createWorld([], 1, bounds, config), { slug: "x", stage: "implementation", position: v(600, 400), velocity: v(0, 0) });
    for (let f = 0; f < 600; f++) w = step(w, input(bounds), config);
    expect(len(w.planes[0]!.velocity)).toBeGreaterThan(config.cruise);
  });
});

describe("trails", () => {
  it("only the airplane leaves one", () => {
    expect(FORM_FLIGHT.implementation.trails).toBe(true);
    expect(FORM_FLIGHT.idea.trails).toBe(false);
    expect(FORM_FLIGHT.live.trails).toBe(false);
  });
  it("is shorter on phones, but still there", () => {
    expect(FLIGHT_CONFIGS.lite.trailSeconds).toBeGreaterThan(0);
    expect(FLIGHT_CONFIGS.lite.trailSeconds).toBeLessThan(FLIGHT_CONFIGS.full.trailSeconds);
  });
});
