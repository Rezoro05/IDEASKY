import { describe, it, expect } from "vitest";
import { SWIM, fishFacing, fishTransform, isFrightened, spawnFish, stepSwim, swimArea, type Fish } from "../../src/lib/swim";
import { BIRD } from "../../src/lib/bird";
import { mulberry32 } from "../../src/lib/random";
import { len, sub, v } from "../../src/lib/vec";

const bounds = { width: 1200, height: 800 };
const dt = 1 / 60;
const NONE = new Set<string>();

/** Runs the sea for `seconds` (functional: emergent behaviour over many frames, no branching in the test). */
function swimFor(start: Fish[], seconds: number, still: ReadonlySet<string> = NONE): Fish[] {
  let fish = start, time = 0;
  for (let f = 0; f < seconds * 60; f++) { fish = stepSwim(fish, { dt, time, bounds, still }); time += dt; }
  return fish;
}
const sea = (schools: string[], seed = 7): Fish[] => { const r = mulberry32(seed); return schools.map((s, i) => spawnFish(`dream${i}`, s, bounds, r)); };
const middleOf = (fish: Fish[]) => v(fish.reduce((a, f) => a + f.position.x, 0) / fish.length, fish.reduce((a, f) => a + f.position.y, 0) / fish.length);
const spread = (fish: Fish[]) => { const m = middleOf(fish); return fish.reduce((a, f) => a + len(sub(f.position, m)), 0) / fish.length; };

describe("swimming", () => {
  it("fish stay in the water, below the headline band (functional, 60 s)", () => {
    const area = swimArea(bounds);
    for (const f of swimFor(sea(["", "", "", "flying", "flying", "water"]), 60)) {
      expect(f.position.y).toBeGreaterThanOrEqual(area.top);
      expect(f.position.y).toBeLessThanOrEqual(area.bottom);
      expect(f.position.x).toBeGreaterThanOrEqual(area.left);
      expect(f.position.x).toBeLessThanOrEqual(area.right);
    }
  });
  it("fish keep a pace between the slowest and fastest", () => {
    for (const f of swimFor(sea(["", "a", "a", "b"]), 20)) {
      expect(len(f.velocity)).toBeGreaterThanOrEqual(SWIM.slowest - 1e-6);
      expect(len(f.velocity)).toBeLessThanOrEqual(SWIM.fastest + 1e-6);
    }
  });
  it("fish of one theme gather into a school; strangers don't (functional, 40 s)", () => {
    const start = sea(["flying", "flying", "flying", "flying", "", "", "", ""], 3);
    const end = swimFor(start, 40);
    const school = end.filter((f) => f.school === "flying"), loners = end.filter((f) => f.school === "");
    expect(spread(school)).toBeLessThan(spread(start.filter((f) => f.school === "flying")));
    expect(spread(school)).toBeLessThan(spread(loners));
  });
  it("school mates head the same way", () => {
    const school = swimFor(sea(["water", "water", "water"], 11), 40);
    const dirs = school.map((f) => Math.atan2(f.velocity.y, f.velocity.x));
    const spreadDeg = (Math.max(...dirs) - Math.min(...dirs)) * 180 / Math.PI;
    expect(spreadDeg).toBeLessThan(60);
  });
  it("no two fish swim into each other (personal space, after settling)", () => {
    const end = swimFor(sea(["a", "a", "a", "a", "a", "a"], 5), 30);
    for (const f of end) for (const o of end) if (f !== o) expect(len(sub(f.position, o.position))).toBeGreaterThan(SWIM.personalSpace * 0.4);
  });
  it("a fish let go above the water swims down into it without jumping (functional, 8 s)", () => {
    const area = swimArea(bounds);
    let fish: Fish[] = [{ slug: "n", school: "", position: v(1150, 90), velocity: v(-40, 0) }], time = 0, biggestStep = 0;
    for (let f = 0; f < 8 * 60; f++) {
      const next = stepSwim(fish, { dt, time, bounds, still: NONE });
      biggestStep = Math.max(biggestStep, len(sub(next[0]!.position, fish[0]!.position)));
      fish = next; time += dt;
    }
    expect(fish[0]!.position.y).toBeGreaterThanOrEqual(area.top);
    expect(biggestStep).toBeLessThan(SWIM.cruise * SWIM.fleeSpeedScale * dt + 1e-6);
  });
  it("a netted fish holds still while the others swim", () => {
    const start = sea(["", "", ""]);
    const end = swimFor(start, 5, new Set(["dream1"]));
    expect(end[1]!.position).toEqual(start[1]!.position);
    expect(end[0]!.position).not.toEqual(start[0]!.position);
  });
  it("is the same every time for the same start", () => {
    expect(swimFor(sea(["a", "b"]), 3)).toEqual(swimFor(sea(["a", "b"]), 3));
  });
});

describe("fish flee the mouse, like birds", () => {
  const fishAt = (x: number, y: number): Fish => ({ slug: "f", school: "", position: v(x, y), velocity: v(SWIM.cruise, 0) });
  it("only a moving mouse within the birds' alarm radius frightens a fish", () => {
    expect(isFrightened(v(600, 500), { position: v(650, 500), speed: 300 })).toBe(true);
    expect(isFrightened(v(600, 500), { position: v(650, 500), speed: BIRD.alarmSpeed - 1 })).toBe(false); // a creeping mouse
    expect(isFrightened(v(600, 500), { position: v(600 + BIRD.alarmRadius + 1, 500), speed: 300 })).toBe(false);
    expect(isFrightened(v(600, 500), null)).toBe(false);
  });
  it("a fish darts away from a quick mouse, faster than it ever cruises, then calms down (functional)", () => {
    let fish: Fish[] = [fishAt(600, 500)], time = 0, fastest = 0;
    const mouse = { position: v(560, 500), speed: 400 };
    for (let i = 0; i < 30; i++) { fish = stepSwim(fish, { dt, time, bounds, still: NONE, pointer: mouse }); time += dt; fastest = Math.max(fastest, len(fish[0]!.velocity)); }
    expect(fish[0]!.position.x).toBeGreaterThan(600); // away from the mouse on its left
    expect(fastest).toBeGreaterThan(SWIM.fastest);
    expect(fastest).toBeLessThanOrEqual(SWIM.cruise * SWIM.fleeSpeedScale + 1e-6);
    fish = swimFor(fish, 20);
    expect(len(fish[0]!.velocity)).toBeLessThanOrEqual(SWIM.fastest + 1e-6);
  });
  it("a netted fish stays in the net, however the mouse moves", () => {
    const start = [fishAt(600, 500)];
    const end = stepSwim(start, { dt, time: 0, bounds, still: new Set(["f"]), pointer: { position: v(590, 500), speed: 500 } });
    expect(end[0]!.position).toEqual(start[0]!.position);
  });
});

describe("how a fish faces", () => {
  it("faces right swimming right, mirrored swimming left, keeps its facing when nearly still", () => {
    expect(fishFacing(v(30, 0), true).mirrored).toBe(false);
    expect(fishFacing(v(-30, 0), false).mirrored).toBe(true);
    expect(fishFacing(v(1, 0), true).mirrored).toBe(true);
  });
  it("tilts with its climb or dive, but never more than the limit, and never upside down", () => {
    expect(fishFacing(v(30, 10), false).tiltDeg).toBeGreaterThan(0);
    expect(fishFacing(v(2.5, 300), false).tiltDeg).toBe(22);
    expect(fishFacing(v(-30, 10), false).tiltDeg).toBeLessThan(0); // mirrored art: the tilt flips with it
    expect(fishTransform({ mirrored: true, tiltDeg: -10 })).toBe("rotate(-10.0deg) scaleX(-1)");
  });
});
