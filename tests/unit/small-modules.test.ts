import { describe, it, expect } from "vitest";
import { classifyGesture } from "../../src/lib/gesture";
import { motionProfileFor } from "../../src/lib/motion";
import { mulberry32, hashString, seedFor } from "../../src/lib/random";
import { v, clampLen, len } from "../../src/lib/vec";
import { panelsToClose } from "../../src/lib/icon-menu";

describe("classifyGesture", () => {
  const press = { point: v(0, 0), at: 0 };
  it("a short, still press opens", () => expect(classifyGesture(press, { point: v(3, 3), at: 200 })).toBe("open"));
  it("moving 6px or more is a drag", () => expect(classifyGesture(press, { point: v(6, 0), at: 100 })).toBe("drag"));
  it("holding 500ms or more is a drag", () => expect(classifyGesture(press, { point: v(0, 0), at: 500 })).toBe("drag"));
});

describe("motionProfileFor", () => {
  it("reduced motion always wins", () => expect(motionProfileFor({ prefersReducedMotion: true, viewportWidth: 2000 })).toBe("none"));
  it("phones get lite, wider screens full", () => {
    expect(motionProfileFor({ prefersReducedMotion: false, viewportWidth: 639 })).toBe("lite");
    expect(motionProfileFor({ prefersReducedMotion: false, viewportWidth: 640 })).toBe("full");
  });
});

describe("random", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = mulberry32(1), b = mulberry32(1);
    for (let i = 0; i < 100; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it("hashes are stable unsigned ints", () => {
    expect(hashString("econsul")).toBe(hashString("econsul"));
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(seedFor("a", 5)).toBeGreaterThanOrEqual(0);
  });
});

describe("vec", () => {
  it("clampLen keeps direction and caps length", () => {
    expect(len(clampLen(v(30, 40), 10))).toBeCloseTo(10);
    expect(clampLen(v(3, 4), 10)).toEqual(v(3, 4));
  });
});

describe("icon menu panels", () => {
  it("opening one closes the other two", () => {
    expect(panelsToClose("comment")).toEqual(["update", "remove"]);
    expect(panelsToClose("update")).toEqual(["comment", "remove"]);
    expect(panelsToClose("remove")).toEqual(["comment", "update"]);
  });
});
