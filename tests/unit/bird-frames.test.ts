import { describe, it, expect } from "vitest";
import { birdPose, FLAP_HZ, HELD_HZ, FRAME_IDS, REST_FRAMES, FLAP_CYCLE, HELD_CYCLE } from "../../src/lib/bird-frames";
import { BIRD_SPRITES } from "../../src/lib/bird-sprites";
import { birdOrientation, TILT } from "../../src/lib/bird-orientation";


const posesOver = (look: "glide" | "flap" | "held", slug: string, seconds: number, step = 0.005) => {
  const out = [];
  for (let t = 0; t < seconds; t += step) out.push(birdPose(look, t, slug));
  return out;
};
const frames = (look: "glide" | "flap" | "held", slug: string, seconds: number, step = 0.005) => posesOver(look, slug, seconds, step).map((p) => p.frame);

describe("which photo a bird shows", () => {
  it("cruises in bursts like a small bird: a few quick flaps, then wings folded for a moment, over and over", () => {
    const seen = frames("glide", "abc", 6);
    expect(new Set(seen)).toEqual(new Set([...FLAP_CYCLE, "fly-glide"]));
    const folded = seen.filter((f) => f === "fly-glide").length / seen.length;
    expect(folded).toBeGreaterThan(0.3); // folded for a good part of the time...
    expect(folded).toBeLessThan(0.7); // ...but it is not the frozen pose it was
  });
  it("folds its wings for a spell of at least a quarter second between bursts, many times over", () => {
    const step = 0.005, seen = frames("glide", "abc", 8, step);
    const runs: number[] = []; let run = 0;
    for (const f of seen) { if (f === "fly-glide") run++; else { if (run) runs.push(run * step); run = 0; } }
    const spells = runs.filter((r) => r >= 0.2);
    expect(Math.max(...runs)).toBeGreaterThanOrEqual(0.25);
    expect(spells.length).toBeGreaterThanOrEqual(5);
  });
  it("sits in one of the resting photos, the same one every time for the same bird", () => {
    for (const slug of ["a", "b", "c", "abc123", "zzz"]) {
      const f = birdPose("perch", 0, slug).frame;
      expect(REST_FRAMES).toContain(f);
      expect(birdPose("perch", 55, slug).frame).toBe(f);
    }
  });
  it("gives different birds different resting poses (all three get used)", () => {
    expect(new Set(Array.from({ length: 60 }, (_, i) => birdPose("perch", 0, `idea-${i}`).frame)).size).toBe(REST_FRAMES.length);
  });
  it("beats its wings through the whole flap cycle, without pause, while flying to a perch or taking off", () => {
    const seen = frames("flap", "abc", 2);
    expect(new Set(seen)).toEqual(new Set(FLAP_CYCLE));
    expect(seen.filter((f) => f === "fly-glide").length / seen.length, "the wings fold only in the cycle's own step").toBeLessThan(0.3);
  });
  it("beats about FLAP_HZ times a second", () => {
    const seen = frames("flap", "abc", 4);
    const beats = seen.filter((f, i) => f === FLAP_CYCLE[0] && seen[i - 1] !== FLAP_CYCLE[0]).length;
    expect(beats / 4).toBeGreaterThan(FLAP_HZ * 0.85);
    expect(beats / 4).toBeLessThan(FLAP_HZ * 1.15 + 0.5);
  });
  it("beats much faster in a hand than in the air", () => {
    expect(HELD_HZ).toBeGreaterThan(FLAP_HZ * 1.5);
    expect(new Set(frames("held", "abc", 1))).toEqual(new Set(HELD_CYCLE));
  });
  it("doesn't start every bird's wings at the same moment", () => {
    expect(new Set(["a", "b", "c", "d", "e", "f", "g"].map((s) => birdPose("flap", 0.01, s).frame)).size).toBeGreaterThan(1);
  });
  it("only ever names a photo that has a sprite", () => {
    for (const id of FRAME_IDS) expect(BIRD_SPRITES[id].w).toBeGreaterThan(0);
    for (const f of [...FLAP_CYCLE, ...HELD_CYCLE, ...REST_FRAMES]) expect(FRAME_IDS).toContain(f);
  });
});

describe("how a bird's body rises and falls", () => {
  it("bobs up and down in cruising flight, staying within its limit and rising as well as falling", () => {
    const lifts = posesOver("glide", "abc", 6).map((p) => p.lift);
    expect(Math.max(...lifts)).toBeGreaterThan(0.5);
    expect(Math.min(...lifts)).toBeLessThan(-0.5);
    for (const l of lifts) expect(Math.abs(l)).toBeLessThanOrEqual(1);
  });
  it("moves smoothly: it never jumps between one moment and the next", () => {
    const lifts = posesOver("glide", "abc", 6, 0.004).map((p) => p.lift);
    for (let i = 1; i < lifts.length; i++) expect(Math.abs(lifts[i]! - lifts[i - 1]!)).toBeLessThan(0.1);
  });
  it("rises on the downstroke of a flap in cruising flight (the body lifts as the wings push)", () => {
    const poses = posesOver("glide", "abc", 6);
    const beating = poses.filter((p) => p.frame === "fly-spread").map((p) => p.lift);
    expect(beating.reduce((a, b) => a + b, 0) / beating.length).toBeGreaterThan(0);
  });
  it("bobs only a little while flapping to a perch, and not at all perched or held", () => {
    expect(Math.max(...posesOver("flap", "abc", 2).map((p) => Math.abs(p.lift)))).toBeLessThanOrEqual(0.5);
    expect(birdPose("perch", 3, "abc").lift).toBe(0);
    expect(Math.max(...posesOver("held", "abc", 1).map((p) => Math.abs(p.lift)))).toBe(0);
  });
});

describe("the sprite table", () => {
  it("keeps every anchor inside its picture", () => {
    for (const id of FRAME_IDS) { const s = BIRD_SPRITES[id]; expect(s.ax).toBeGreaterThan(0); expect(s.ax).toBeLessThan(1); expect(s.ay).toBeGreaterThan(0); expect(s.ay).toBeLessThan(1); }
  });
  it("shares one box and one anchor across the flight photos, so the body doesn't jump when the wings change", () => {
    const [a, b, c] = [BIRD_SPRITES["fly-glide"], BIRD_SPRITES["fly-up"], BIRD_SPRITES["fly-spread"]];
    expect([b.w, c.w, b.h, c.h, b.ax, c.ax, b.ay, c.ay]).toEqual([a.w, a.w, a.h, a.h, a.ax, a.ax, a.ay, a.ay]);
  });
});

describe("how a photographed bird turns", () => {
  it("keeps the photo's mirroring (so it never flies backwards) but tilts only part of the way with the heading", () => {
    const o = birdOrientation({ rotateDeg: 20, mirrored: false }, false);
    expect(o.mirrored).toBe(false);
    expect(o.rotateDeg).toBeCloseTo(20 * TILT.share, 5);
    expect(birdOrientation({ rotateDeg: -20, mirrored: true }, false)).toEqual({ rotateDeg: -20 * TILT.share, mirrored: true });
  });
  it("never tilts further than the limit", () => {
    expect(birdOrientation({ rotateDeg: 89, mirrored: false }, false).rotateDeg).toBe(TILT.maxDeg);
    expect(birdOrientation({ rotateDeg: -89, mirrored: false }, false).rotateDeg).toBe(-TILT.maxDeg);
  });
  it("sits upright on a perch and while held", () => {
    expect(birdOrientation({ rotateDeg: 40, mirrored: true }, true)).toEqual({ rotateDeg: 0, mirrored: true });
  });
});
