import { describe, it, expect } from "vitest";
import { birdFrame, FLAP_HZ, HELD_HZ, FRAME_IDS, REST_FRAMES, FLAP_CYCLE, HELD_CYCLE } from "../../src/lib/bird-frames";
import { BIRD_SPRITES } from "../../src/lib/bird-sprites";
import { birdOrientation, TILT } from "../../src/lib/bird-orientation";

const framesOver = (look: "flap" | "held", slug: string, seconds: number, step = 0.01) => {
  const seen: string[] = [];
  for (let t = 0; t < seconds; t += step) seen.push(birdFrame(look, t, slug));
  return seen;
};

describe("which photo a bird shows", () => {
  it("glides on the wings-folded flight photo, whatever the time", () => {
    for (const t of [0, 1.3, 99]) expect(birdFrame("glide", t, "abc")).toBe("fly-glide");
  });
  it("sits in one of the resting photos, the same one every time for the same bird", () => {
    for (const slug of ["a", "b", "c", "abc123", "zzz"]) {
      const f = birdFrame("perch", 0, slug);
      expect(REST_FRAMES).toContain(f);
      expect(birdFrame("perch", 55, slug)).toBe(f);
    }
  });
  it("gives different birds different resting poses (all three get used)", () => {
    const used = new Set(Array.from({ length: 60 }, (_, i) => birdFrame("perch", 0, `idea-${i}`)));
    expect(used.size).toBe(REST_FRAMES.length);
  });
  it("beats its wings through the whole flap cycle while flying to a perch or taking off", () => {
    expect(new Set(framesOver("flap", "abc", 2))).toEqual(new Set(FLAP_CYCLE));
  });
  it("beats about FLAP_HZ times a second", () => {
    const seen = framesOver("flap", "abc", 4, 0.005);
    const downs = seen.filter((f, i) => f === FLAP_CYCLE[0] && seen[i - 1] !== FLAP_CYCLE[0]).length;
    expect(downs / 4).toBeGreaterThan(FLAP_HZ * 0.85);
    expect(downs / 4).toBeLessThan(FLAP_HZ * 1.15 + 0.5);
  });
  it("beats much faster in a hand than in the air", () => {
    expect(HELD_HZ).toBeGreaterThan(FLAP_HZ * 2);
    expect(new Set(framesOver("held", "abc", 1))).toEqual(new Set(HELD_CYCLE));
  });
  it("doesn't start every bird's wings at the same moment", () => {
    const starts = new Set(["a", "b", "c", "d", "e", "f", "g"].map((s) => birdFrame("flap", 0.01, s)));
    expect(starts.size).toBeGreaterThan(1);
  });
  it("only ever names a photo that has a sprite", () => {
    for (const id of FRAME_IDS) expect(BIRD_SPRITES[id].w).toBeGreaterThan(0);
    for (const f of [...FLAP_CYCLE, ...HELD_CYCLE, ...REST_FRAMES]) expect(FRAME_IDS).toContain(f);
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
