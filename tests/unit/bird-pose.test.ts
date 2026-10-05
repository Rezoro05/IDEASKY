import { describe, it, expect } from "vitest";
import { birdPose, blendedPose, nextEffort, BLEND_SECONDS, SPREAD, EFFORT_SECONDS, CRUISE, FLAP_HZ, HELD_HZ, FOLDED, type Pose } from "../../src/lib/bird-pose";
import { birdOrientation, birdTransform, TILT, MOTION } from "../../src/lib/bird-orientation";

type Moving = "glide" | "flap" | "held";
const over = (look: Moving, seconds: number, slug = "abc", step = 0.004): Pose[] => {
  const out: Pose[] = [];
  for (let t = 0; t < seconds; t += step) out.push(birdPose(look, t, slug));
  return out;
};
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
/** Beats: how many times the wing passes its highest point. */
const beats = (poses: Pose[]) => poses.filter((p, i) => i > 1 && poses[i - 1]!.wing >= poses[i - 2]!.wing && poses[i - 1]!.wing > p.wing && poses[i - 1]!.wing > 0.5).length;

describe("the wing, moving smoothly", () => {
  it("never jumps from one moment to the next, in any kind of flight", () => {
    for (const look of ["glide", "flap", "held"] as const) {
      const poses = over(look, 4, "abc", 0.001); // fine steps: the hand beat is fast
      for (let i = 1; i < poses.length; i++) for (const k of ["wing", "lift", "pitch", "surge"] as const) expect(Math.abs(poses[i]![k] - poses[i - 1]![k]), `${look} ${k}`).toBeLessThan(0.12);
    }
  });
  it("stays within its range: 1 fully up, -1 fully down", () => {
    for (const look of ["glide", "flap", "held"] as const) for (const p of over(look, 3)) { expect(p.wing).toBeLessThanOrEqual(1); expect(p.wing).toBeGreaterThanOrEqual(-1); }
  });
  it("cruises in bursts: a few beats, then the wings rest folded for a moment", () => {
    const poses = over("glide", 6);
    const folded = poses.filter((p) => Math.abs(p.wing - FOLDED) < 0.02).length / poses.length;
    expect(folded).toBeGreaterThan(0.2);
    expect(folded).toBeLessThan(0.6);
    const period = CRUISE.flaps / CRUISE.hz + CRUISE.coast;
    expect(beats(poses) / (6 / period)).toBeCloseTo(CRUISE.flaps, 0);
  });
  it("beats about FLAP_HZ times a second, without pause, flying to a perch or taking off", () => {
    expect(beats(over("flap", 4)) / 4).toBeCloseTo(FLAP_HZ, 0);
  });
  it("beats much faster, and full stroke, in a hand", () => {
    const poses = over("held", 2);
    expect(beats(poses) / 2).toBeCloseTo(HELD_HZ, 0);
    expect(Math.max(...poses.map((p) => p.wing))).toBeGreaterThan(0.95);
    expect(Math.min(...poses.map((p) => p.wing))).toBeLessThan(-0.95);
  });
  it("sits with its wings folded and its feet on the line", () => {
    const p = birdPose("perch", 3, "abc");
    expect(p).toMatchObject({ wing: FOLDED, lift: 0, pitch: 0, surge: 0, seat: 1 });
    expect(birdPose("glide", 3, "abc").seat).toBe(0);
  });
  it("doesn't start every bird's wings at the same moment", () => {
    expect(new Set(["a", "b", "c", "d", "e", "f"].map((s) => birdPose("flap", 0.05, s).wing.toFixed(2))).size).toBeGreaterThan(2);
  });
});

describe("wings that work only as hard as they need to", () => {
  const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
  const wings = (look: "glide" | "flap", effort: number) => { const out: number[] = []; for (let t = 0; t < 4; t += 0.004) out.push(birdPose(look, t, "abc", effort).wing); return out; };
  it("holds its wings open and nearly still when it needs no effort (gliding down)", () => {
    for (const look of ["glide", "flap"] as const) {
      const w = wings(look, 0);
      expect(range(w), look).toBeLessThan(0.12);
      expect(Math.abs(w.reduce((a, b) => a + b, 0) / w.length - SPREAD), look).toBeLessThan(0.05);
    }
  });
  it("beats fully at full effort, exactly as before, and in between at half effort", () => {
    for (const look of ["glide", "flap"] as const) {
      expect(birdPose(look, 1.234, "abc", 1)).toEqual(birdPose(look, 1.234, "abc"));
      const half = range(wings(look, 0.5)), full = range(wings(look, 1)), none = range(wings(look, 0));
      expect(half).toBeGreaterThan(none); expect(half).toBeLessThan(full);
    }
  });
  it("keeps the body steady while gliding: no lunge, little bob", () => {
    for (let t = 0; t < 3; t += 0.01) { const p = birdPose("glide", t, "abc", 0); expect(p.surge).toBe(0); expect(Math.abs(p.lift)).toBeLessThan(0.2); }
  });
  it("leaves perched and held birds as they are", () => {
    expect(birdPose("perch", 2, "abc", 0)).toEqual(birdPose("perch", 2, "abc", 1));
    expect(birdPose("held", 2, "abc", 0)).toEqual(birdPose("held", 2, "abc", 1));
  });
});

describe("flaring to land", () => {
  it("noses up, brakes and back-pedals with high beats that never reach full down", () => {
    for (let t = 0; t < 2; t += 0.005) {
      const p = birdPose("flap", t, "abc", 1, 1);
      expect(p.pitch).toBeGreaterThan(0.9);
      expect(p.surge).toBeLessThan(0);
      expect(p.wing).toBeGreaterThan(0.05);
    }
  });
  it("changes nothing with no flare, and changes smoothly as the flare grows", () => {
    expect(birdPose("flap", 1.1, "abc", 1, 0)).toEqual(birdPose("flap", 1.1, "abc", 1));
    for (let f = 0; f < 1; f += 0.01) {
      const a = birdPose("flap", 0.7, "abc", 1, f), b = birdPose("flap", 0.7, "abc", 1, f + 0.01);
      for (const k of ["wing", "pitch", "surge", "lift"] as const) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.05);
    }
  });
});

describe("effort changes gradually", () => {
  it("moves toward what is needed without overshooting or jumping, and gets there within a couple of time constants", () => {
    let e = 0; const dt = 1 / 60;
    for (let t = 0; t < EFFORT_SECONDS * 4; t += dt) { const n = nextEffort(e, 1, dt); expect(n).toBeGreaterThanOrEqual(e); expect(n).toBeLessThanOrEqual(1); expect(n - e).toBeLessThan(0.05); e = n; }
    expect(e).toBeGreaterThan(0.95);
    expect(nextEffort(0.8, 0, dt)).toBeLessThan(0.8);
  });
});

describe("changing from one way of flying to another", () => {
  const keys = ["wing", "lift", "pitch", "surge", "seat"] as const;
  const looks = ["glide", "flap", "held", "perch"] as const;
  it("blends smoothly from the old pose to the new one: no jump at the change, none during the blend, and fully new after it", () => {
    for (const from of looks) for (const to of looks) {
      if (from === to) continue;
      const since = 10.37, step = 0.001;
      const before = birdPose(from, since - step, "abc");
      let prev = blendedPose({ look: to, from, since }, since, "abc");
      for (const k of keys) expect(Math.abs(prev[k] - before[k]), `${from}->${to} ${k} at the change`).toBeLessThan(0.13);
      for (let t = since + step; t < since + BLEND_SECONDS + 0.1; t += step) {
        const now = blendedPose({ look: to, from, since }, t, "abc");
        for (const k of keys) expect(Math.abs(now[k] - prev[k]), `${from}->${to} ${k} at ${t - since}`).toBeLessThan(0.13);
        prev = now;
      }
      expect(blendedPose({ look: to, from, since }, since + BLEND_SECONDS + 0.01, "abc")).toEqual(birdPose(to, since + BLEND_SECONDS + 0.01, "abc"));
    }
  });
  it("is just the pose when there was nothing before", () => {
    expect(blendedPose({ look: "glide", from: null, since: 0 }, 1.3, "abc")).toEqual(birdPose("glide", 1.3, "abc"));
  });
});

describe("the body, moving with the wings", () => {
  it("rises through a burst of flaps and sinks through the folded coast", () => {
    const poses = over("glide", 6);
    expect(mean(poses.filter((p) => Math.abs(p.wing - FOLDED) >= 0.02).map((p) => p.lift))).toBeGreaterThan(mean(poses.filter((p) => Math.abs(p.wing - FOLDED) < 0.02).map((p) => p.lift)));
  });
  it("noses up while climbing and down while sinking", () => {
    const poses = over("glide", 6);
    const climbing = poses.filter((p, i) => i > 0 && p.lift > poses[i - 1]!.lift).map((p) => p.pitch);
    const sinking = poses.filter((p, i) => i > 0 && p.lift < poses[i - 1]!.lift).map((p) => p.pitch);
    expect(mean(climbing)).toBeGreaterThan(0.2);
    expect(mean(sinking)).toBeLessThan(-0.2);
  });
  it("lunges forward on the downstroke", () => {
    const poses = over("flap", 3);
    const down = poses.filter((p, i) => i > 0 && p.wing < poses[i - 1]!.wing).map((p) => p.surge);
    const up = poses.filter((p, i) => i > 0 && p.wing > poses[i - 1]!.wing).map((p) => p.surge);
    expect(mean(down)).toBeGreaterThan(mean(up));
  });
  it("holds still on a perch; in a hand the page shakes it instead", () => {
    for (const look of ["perch", "held"] as const) { const p = birdPose(look, 1.7, "abc"); expect([p.lift, p.pitch, p.surge]).toEqual([0, 0, 0]); }
  });
});

describe("how the bird turns", () => {
  it("tilts only part of the way with its heading, up to a limit, and keeps its mirroring", () => {
    expect(birdOrientation({ rotateDeg: 20, mirrored: true }, false)).toEqual({ rotateDeg: 20 * TILT.share, mirrored: true });
    expect(birdOrientation({ rotateDeg: 89, mirrored: false }, false).rotateDeg).toBe(TILT.maxDeg);
    expect(birdOrientation({ rotateDeg: -89, mirrored: false }, false).rotateDeg).toBe(-TILT.maxDeg);
  });
  it("sits upright on a perch and while held", () => {
    expect(birdOrientation({ rotateDeg: 40, mirrored: true }, true)).toEqual({ rotateDeg: 0, mirrored: true });
  });
});

describe("the transform that puts the body where its pose says", () => {
  const flying: Pose = { wing: 0, lift: 1, pitch: 1, surge: 1, seat: 0 };
  it("raises the body, turns it, then lunges and noses up in its own frame (so a mirrored bird lunges the way it faces)", () => {
    const t = birdTransform({ rotateDeg: 10, mirrored: true }, flying, 50);
    expect(t.startsWith(`translateY(${-50 * MOTION.bob}px)`)).toBe(true);
    expect(t.indexOf("rotate(10deg)")).toBeGreaterThan(0);
    expect(t.indexOf("scaleX(-1)")).toBeLessThan(t.indexOf("translateX("));
    expect(t.endsWith(`rotate(${-MOTION.pitchDeg}deg)`)).toBe(true);
  });
  it("lifts a seated bird so its feet, not its middle, are on the perch line", () => {
    const t = birdTransform({ rotateDeg: 0, mirrored: false }, { wing: FOLDED, lift: 0, pitch: 0, surge: 0, seat: 1 }, 50);
    expect(t.startsWith(`translateY(${-50 * MOTION.seat}px)`)).toBe(true);
  });
});
