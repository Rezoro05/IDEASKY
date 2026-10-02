import { describe, it, expect } from "vitest";
import { normalizeDeg, orientationFor, orientationTransform, FLIP_MARGIN_DEG } from "../../src/lib/orientation";

describe("normalizeDeg", () => {
  it("wraps into (-180, 180]", () => {
    expect([0, 180, 181, -181, 360, 540, -90].map(normalizeDeg)).toEqual([0, 180, -179, 179, 0, 180, -90]);
  });
});

describe("orientationFor", () => {
  it("flying right: art as drawn, rotated to the heading", () => {
    expect(orientationFor(20, false)).toEqual({ mirrored: false, rotateDeg: 20 });
  });
  it("flying left: mirrored, so it stays upright", () => {
    expect(orientationFor(180, false)).toEqual({ mirrored: true, rotateDeg: 0 });
    expect(orientationFor(160, false)).toEqual({ mirrored: true, rotateDeg: -20 }); // heading down-left: nose dips
    expect(orientationFor(-160, false)).toEqual({ mirrored: true, rotateDeg: 20 }); // heading up-left: nose lifts
  });
  it("the drawn nose always ends up pointing along the heading", () => {
    for (const h of [-170, -120, -45, 0, 45, 120, 170]) {
      for (const was of [false, true]) {
        const o = orientationFor(h, was);
        const noseDeg = normalizeDeg(o.mirrored ? 180 + o.rotateDeg : o.rotateDeg); // art nose faces 0°; mirroring turns it to 180°
        expect(noseDeg).toBeCloseTo(normalizeDeg(h));
      }
    }
  });
  it("near vertical it keeps its facing until clearly past it", () => {
    const justPast = 90 + FLIP_MARGIN_DEG - 1, wellPast = 90 + FLIP_MARGIN_DEG + 1;
    expect(orientationFor(justPast, false).mirrored).toBe(false);
    expect(orientationFor(wellPast, false).mirrored).toBe(true);
    expect(orientationFor(180 - justPast, true).mirrored).toBe(true);
    expect(orientationFor(180 - wellPast, true).mirrored).toBe(false);
    expect(orientationFor(-90, true).mirrored).toBe(true); // straight up: no change either way
    expect(orientationFor(-90, false).mirrored).toBe(false);
  });
});

describe("orientationTransform", () => {
  it("adds a mirror only when mirrored", () => {
    expect(orientationTransform({ rotateDeg: 10, mirrored: false })).toBe("rotate(10deg)");
    expect(orientationTransform({ rotateDeg: -20, mirrored: true })).toBe("rotate(-20deg) scaleX(-1)");
  });
});
