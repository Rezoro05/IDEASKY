import { describe, expect, it } from "vitest";
import { GROUP, aroundAxis, covariance, joinSplats, splatBuilder } from "../../src/lib/splats";
import { farness, sampleDepth, skylineSplats } from "../../src/lib/skyline-splats";
import { SEA_FLOOR_Y, deepSea, fishSchools, floorAt, kelp, rockSpots, whale, wreck, wreckSea } from "../../src/lib/deep-sea";
import { CONTROLS, DEFAULTS, accept, changedFrom, detailFor, getPath, mergeSettings, presetSettings, PRESETS, setPath } from "../../src/lib/scene-settings";
import { STILL, cameraTarget, drift, focalFor, follow, viewFor } from "../../src/lib/scene-camera";
import { multiply, transformPoint } from "../../src/lib/mat4";
import { depthRow, depthSorter, needsResort } from "../../src/lib/splat-sort";
import { mulberry32 } from "../../src/lib/random";

const close = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) < eps;

describe("splats", () => {
  it("a round splat's covariance is its radius squared on the diagonal", () => {
    expect(covariance({ scale: [2, 2, 2] })).toEqual([4, 0, 0, 4, 0, 4]);
  });
  it("turning a long splat a quarter turn about z swaps its long axis from x to y", () => {
    const [xx, xy, , yy] = covariance({ scale: [3, 1, 1], rotation: aroundAxis(0, 0, 1, Math.PI / 2) });
    expect(close(xx, 1)).toBe(true); expect(close(yy, 9)).toBe(true); expect(close(xy, 0)).toBe(true);
  });
  it("collects past its first capacity and joins sets in order", () => {
    const b = splatBuilder(1);
    for (let i = 0; i < 5; i++) b.add({ at: [i, 0, 0], color: [1, 1, 1, 1], shape: { scale: [1, 1, 1] }, group: GROUP.snow, phase: i });
    const one = b.done();
    expect(one.count).toBe(5);
    const both = joinSplats([one, one]);
    expect(both.count).toBe(10);
    expect(both.centers[3 * 7]).toBe(2);
    expect(both.phases[9]).toBe(4);
  });
});

describe("skyline splats", () => {
  it("dark navy buildings look near; pale haze and clear sky look far", () => {
    expect(farness(38, 76, 120)).toBeLessThan(0.1);
    expect(farness(220, 230, 240)).toBeGreaterThan(0.9);
    expect(farness(102, 177, 233)).toBe(1); // the picture's top sky
  });
  it("the water comes toward the viewer as it comes down; buildings stay behind the picture plane", () => {
    const opts = { horizon: 0.8, depth: 1 };
    expect(sampleDepth(0.8, 0, opts)).toBe(0);
    expect(sampleDepth(1, 0, opts)).toBeGreaterThan(200);
    expect(sampleDepth(0.5, 0, opts)).toBeLessThan(0);
    expect(sampleDepth(0.5, 1, opts)).toBeLessThan(sampleDepth(0.5, 0, opts));
    expect(sampleDepth(0.5, 1, { horizon: 0.8, depth: 0 })).toBeCloseTo(0);
  });
  it("one splat per sample, in picture pixels from the bottom centre, the top melting away", () => {
    const cols = 4, rows = 20, data = new Array(cols * rows * 4).fill(0).map((_, k) => (k % 4 === 3 ? 255 : 60));
    const set = skylineSplats({ data, cols, rows }, { imageWidth: 400, imageHeight: 500, horizon: 0.8, depth: 1, rand: mulberry32(1) });
    expect(set.count).toBe(80);
    expect([...set.centers.slice(0, 2)]).toEqual([-150, 487.5]); // first sample: top left
    expect(set.colors[3]).toBeCloseTo(0.25); // the top melts into the sky
    expect(set.colors[4 * cols * 4 + 3]).toBe(1); // by a tenth of the way down it is solid
    expect(set.amps[79]).toBeGreaterThan(0); // the bottom row is water: it shimmers
    expect(set.amps[0]).toBe(0);
    expect([...set.groups].every((g) => g === GROUP.skyline)).toBe(true);
  });
});

describe("deep sea", () => {
  it("the same seed draws the same sea", () => {
    const a = deepSea(mulberry32(5), 0.3), b = deepSea(mulberry32(5), 0.3);
    expect(a.count).toBe(b.count);
    expect(a.centers.slice(0, 300)).toEqual(b.centers.slice(0, 300));
  });
  it("has every element, and less detail draws fewer splats", () => {
    const low = deepSea(mulberry32(5), 0.3), high = deepSea(mulberry32(5), 1);
    for (const g of [GROUP.seabed, GROUP.rocks, GROUP.kelp, GROUP.jellies, GROUP.whale, GROUP.snow, GROUP.shafts]) expect([...low.groups].includes(g)).toBe(true);
    expect(high.count).toBeGreaterThan(low.count * 1.8);
  });
  it("kelp is rooted on the seabed, and sways more toward its tip", () => {
    const rand = mulberry32(3), set = kelp(rand, 1, []);
    const ys = [...Array(set.count).keys()].map((i) => set.centers[i * 3 + 1]!);
    const lowest = ys.indexOf(Math.min(...ys)), highest = ys.indexOf(Math.max(...ys));
    expect(ys[lowest]).toBeCloseTo(floorAt(set.centers[0]!, set.centers[2]!), 0);
    expect(set.amps[lowest]).toBeLessThan(1);
    expect(set.amps[highest]).toBeGreaterThan(20);
  });
  it("the whale moves as one: all its splats share one phase", () => {
    const w = whale(mulberry32(2), 200);
    expect(new Set(w.phases).size).toBe(1);
    expect([...w.groups].every((g) => g === GROUP.whale)).toBe(true);
  });
  it("rocks sit on the seabed, away from the viewer", () => {
    for (const s of rockSpots(mulberry32(9), 20)) { expect(s.z).toBeLessThan(-300); expect(floorAt(s.x, s.z)).toBeLessThan(SEA_FLOOR_Y + 60); }
  });});

describe("your own sea: the sunken ship", () => {
  it("the same seed draws the same wreck; less detail draws fewer splats", () => {
    const a = wreckSea(mulberry32(1849), 0.4), b = wreckSea(mulberry32(1849), 0.4), high = wreckSea(mulberry32(1849), 1);
    expect(a.count).toBe(b.count);
    expect(a.centers.slice(0, 300)).toEqual(b.centers.slice(0, 300));
    expect(high.count).toBeGreaterThan(a.count * 1.5);
  });
  it("has the seabed, rocks with the ship, kelp, fish, snow and light, and no jellyfish", () => {
    const set = wreckSea(mulberry32(1849), 0.4), groups = new Set(set.groups);
    for (const g of [GROUP.seabed, GROUP.rocks, GROUP.kelp, GROUP.whale, GROUP.snow, GROUP.shafts]) expect(groups.has(g)).toBe(true);
    expect(groups.has(GROUP.jellies)).toBe(false);
  });
  it("the ship lies on the seabed, still, far from the viewer: part buried, its mast rising well above the sand", () => {
    const w = wreck(mulberry32(4), 3000);
    expect(w.count).toBe(3000);
    expect([...w.groups].every((g) => g === GROUP.rocks)).toBe(true);
    expect([...w.amps].every((a) => a === 0)).toBe(true); // the renderer leaves it in place
    const ys = [...Array(w.count).keys()].map((i) => w.centers[i * 3 + 1]!), zs = [...Array(w.count).keys()].map((i) => w.centers[i * 3 + 2]!);
    expect(Math.min(...ys)).toBeLessThan(SEA_FLOOR_Y + 20); // in the sand
    expect(Math.max(...ys)).toBeGreaterThan(SEA_FLOOR_Y + 450); // the mainmast
    expect(Math.max(...zs)).toBeLessThan(-500);
  });
  it("each school of fish moves as one: one phase per school", () => {
    const f = fishSchools(mulberry32(6), 3, 20);
    expect(f.count).toBe(3 * 20 * 5);
    expect(new Set(f.phases).size).toBe(3);
    expect([...f.groups].every((g) => g === GROUP.whale)).toBe(true);
  });
});

describe("scene settings", () => {
  it("lets through only known settings, clamped", () => {
    const s = mergeSettings(DEFAULTS, { sky: { camera: { mode: "drift", range: 9999, nonsense: 1 } }, sea: { on: "yes" }, quality: "ultra", extra: true });
    expect(s.sky.camera.mode).toBe("drift");
    expect(s.sky.camera.range).toBe(140);
    expect(s.sea.on).toBe(true); // "yes" isn't a boolean
    expect(s.quality).toBe("auto");
    expect(getPath(s, "extra")).toBeUndefined();
    expect(mergeSettings(DEFAULTS, null)).toEqual(DEFAULTS);
  });
  it("every control points at a real default that it accepts as is", () => {
    for (const c of CONTROLS) expect(accept(c, getPath(DEFAULTS, c.path)), c.path).toEqual(getPath(DEFAULTS, c.path));
  });
  it("copies only what changed", () => {
    const s = setPath(setPath(DEFAULTS, "sea.elements.whale.on", false), "sky.look.blur", 2);
    expect(changedFrom(DEFAULTS, s)).toEqual({ sea: { elements: { whale: { on: false } } }, sky: { look: { blur: 2 } } });
    expect(changedFrom(DEFAULTS, DEFAULTS)).toEqual({});
    expect(DEFAULTS.sea.elements.whale.on).toBe(true); // setPath copies, never changes the original
  });
  it("presets are changes on the defaults; Picture only turns both scenes off", () => {
    for (const name of Object.keys(PRESETS)) expect(() => presetSettings(name)).not.toThrow();
    const p = presetSettings("Picture only");
    expect([p.sky.on, p.sea.on]).toEqual([false, false]);
    expect(presetSettings("Still").sky.camera.mode).toBe("still");
  });
  it("auto quality: low on phones and small machines, high only on big ones", () => {
    expect(detailFor("auto", { width: 390, cores: 8, memory: 8 }).detail).toBe(0.4);
    expect(detailFor("auto", { width: 1440, cores: 8, memory: 8 }).detail).toBe(0.7);
    expect(detailFor("auto", { width: 2560, cores: 12, memory: 16 }).detail).toBe(1);
    expect(detailFor("high", { width: 390, cores: 2, memory: 2 }).detail).toBe(1);
  });
});

describe("scene camera", () => {
  const camera = { ...DEFAULTS.sky.camera };
  it("still stays still; drift stays within its range", () => {
    expect(cameraTarget({ ...camera, mode: "still" }, 12, { x: 1, y: 1 })).toEqual(STILL);
    for (let t = 0; t < 200; t += 3.7) { const p = drift(t, 30, 1); expect(Math.abs(p.x)).toBeLessThanOrEqual(30); expect(Math.abs(p.y)).toBeLessThanOrEqual(30); }
  });
  it("parallax leans toward the pointer, and drifts when there is no pointer (a phone)", () => {
    const right = cameraTarget({ ...camera, mode: "parallax", range: 40 }, 0, { x: 1, y: 0 });
    expect(right.x).toBe(40);
    expect(cameraTarget({ ...camera, mode: "parallax" }, 5, null)).toEqual(drift(5, camera.range * 0.5, camera.speed));
  });
  it("follow eases toward the target, faster with less smoothing, and never overshoots", () => {
    const target = { x: 10, y: 0, z: 0 };
    const slow = follow(STILL, target, 1 / 60, 0.95), fast = follow(STILL, target, 1 / 60, 0.5);
    expect(slow.x).toBeCloseTo(0.5); expect(fast.x).toBeCloseTo(5);
    expect(follow(STILL, target, 10, 0.9).x).toBeLessThanOrEqual(10);
  });
  it("a still camera shows the picture plane at 1:1: a point lands on its own screen pixel", () => {
    const w = 1200, h = 800, v = viewFor(STILL, { zoom: 1, tilt: 0, turn: 0.75 }, w, h);
    const clip = transformPoint(multiply(v.proj, v.view), [300, -200, 0]);
    expect(close((clip[0] / clip[3]) * (w / 2), 300, 1e-2)).toBe(true);
    expect(close((clip[1] / clip[3]) * (h / 2), -200, 1e-2)).toBe(true);
    expect(v.focal).toBeCloseTo(focalFor(h));
  });
  it("with turn 1 the middle of the picture stays put while the camera moves", () => {
    const v = viewFor({ x: 50, y: 20, z: 0 }, { zoom: 1, tilt: 0, turn: 1 }, 1000, 1000);
    const clip = transformPoint(multiply(v.proj, v.view), [0, 0, 0]);
    expect(close(clip[0] / clip[3], 0)).toBe(true);
    expect(close(clip[1] / clip[3], 0)).toBe(true);
  });
});

describe("splat sort", () => {
  it("orders far to near", () => {
    const centers = new Float32Array([0, 0, -5, 0, 0, -50, 0, 0, -1, 0, 0, -20]);
    const order = depthSorter(4).sort(centers, [0, 0, 1, 0]);
    expect([...order]).toEqual([1, 3, 0, 2]);
  });
  it("reads depth from a model-view matrix, and resorts only after a real change", () => {
    const m = new Float32Array(16); m[2] = 0.1; m[6] = 0.2; m[10] = 0.9; m[14] = -800;
    const row = depthRow(m);
    expect(row).toEqual([m[2], m[6], m[10], m[14]]);
    expect(needsResort(null, row)).toBe(true);
    expect(needsResort(row, [row[0] + 0.0001, row[1], row[2], row[3] + 0.5])).toBe(false);
    expect(needsResort(row, [row[0] + 0.01, row[1], row[2], row[3]])).toBe(true);
  });
});
