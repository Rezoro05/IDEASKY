import { describe, it, expect } from "vitest";
import { GRID, perchLines, pickPerch } from "../../src/lib/perches";
import { mulberry32 } from "../../src/lib/random";
import { v, len, sub } from "../../src/lib/vec";

const bounds = { width: 1200, height: 600 };

describe("perch lines", () => {
  it("are the grid's horizontal lines, away from the top and bottom", () => {
    const lines = perchLines(bounds.height, 60);
    expect(lines.length).toBeGreaterThan(10);
    for (const y of lines) {
      expect((y + 0.5) % GRID).toBe(0); // on a grid line
      expect(y).toBeGreaterThanOrEqual(60);
      expect(y).toBeLessThanOrEqual(bounds.height - 60);
    }
    expect(lines).toEqual([...lines].sort((a, b) => a - b));
    expect(new Set(lines).size).toBe(lines.length);
  });
  it("are none when the field is too short for the inset", () => {
    expect(perchLines(100, 60)).toEqual([]);
  });
});

describe("picking a perch", () => {
  it("lands on a perch line, inside the sides, and is the same for the same random source", () => {
    const a = pickPerch(mulberry32(5), bounds, 60, [], 44), b = pickPerch(mulberry32(5), bounds, 60, [], 44);
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    expect(perchLines(bounds.height, 60)).toContain(a!.y);
    expect(a!.x).toBeGreaterThanOrEqual(60);
    expect(a!.x).toBeLessThanOrEqual(bounds.width - 60);
    expect(pickPerch(mulberry32(6), bounds, 60, [], 44)).not.toEqual(a);
  });
  it("keeps its distance from every taken spot", () => {
    const rand = mulberry32(9), taken = [v(300, 95.5), v(340, 95.5), v(600, 191.5)];
    for (let i = 0; i < 200; i++) {
      const spot = pickPerch(rand, bounds, 60, taken, 44);
      if (spot) for (const t of taken) expect(len(sub(spot, t))).toBeGreaterThanOrEqual(44);
    }
  });
  it("says none is free when everything is taken or there is no room", () => {
    const everywhere = perchLines(bounds.height, 60).flatMap((y) => Array.from({ length: 30 }, (_, i) => v(60 + i * 38, y)));
    expect(pickPerch(mulberry32(1), bounds, 60, everywhere, 44)).toBeNull();
    expect(pickPerch(mulberry32(1), { width: 100, height: 600 }, 60, [], 44)).toBeNull();
    expect(pickPerch(mulberry32(1), { width: 1200, height: 100 }, 60, [], 44)).toBeNull();
  });
});
