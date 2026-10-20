/** The deep sea, made of splats: a sandy seabed with rock ridges and kelp, glowing jellyfish, a whale far off,
 *  marine snow drifting down and light shafts from the surface. Pure and seeded: the same seed draws the same sea.
 *  Units: the screen is 1000 tall at z = 0 (y = 500 top, -500 bottom, 0 centre); z is toward the viewer, so the deep is negative z.
 *  Each piece has its own group, and its motion comes from phase and amp (the renderer animates by group).
 *  Your own sea (the private board) is another sea in the same style: a sunken ship on the seabed, rocks and kelp around it, schools of fish, light from above. */
import { GROUP, aroundAxis, joinSplats, splatBuilder, type Rgba, type SplatSet } from "./splats";
import type { Rand } from "./random";

export const SEA_FLOOR_Y = -520;
export const SEA_FAR_Z = -3200;
const TAU = Math.PI * 2;

const between = (rand: Rand, lo: number, hi: number) => lo + (hi - lo) * rand();
const mix = (a: Rgba, b: Rgba, t: number): Rgba => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];

/** The seabed's height at (x, z): long low dunes. */
export function floorAt(x: number, z: number): number {
  return SEA_FLOOR_Y + 30 * Math.sin(x * 0.004 + z * 0.002) + 18 * Math.sin(x * 0.011 - z * 0.005);
}
/** How wide the seabed must be at depth z to fill a wide screen. */
const halfWidthAt = (z: number) => 1300 + Math.abs(z) * 1.2;

export function seabed(rand: Rand, count: number): SplatSet {
  const b = splatBuilder(count);
  const sand: Rgba = [0.3, 0.4, 0.5, 0.9], shade: Rgba = [0.13, 0.21, 0.32, 0.9];
  for (let n = 0; n < count; n++) {
    const z = 120 + (SEA_FAR_Z - 120) * rand() ** 1.6; // more near the viewer, where a gap would show
    const x = between(rand, -1, 1) * halfWidthAt(z);
    const r = 12 + Math.abs(z - 120) * 0.014;
    b.add({ at: [x, floorAt(x, z), z], color: mix(sand, shade, rand() * 0.6), shape: { scale: [r * 1.4, r * 0.35, r * 1.4] }, group: GROUP.seabed, phase: rand() * TAU });
  }
  return b.done();
}

export type Spot = { x: number; z: number };
/** Where the rock ridges sit: spread across the seabed, none right in front of the viewer. */
export function rockSpots(rand: Rand, count: number): Spot[] {
  return Array.from({ length: count }, () => { const z = between(rand, -350, -2600); return { x: between(rand, -0.85, 0.85) * halfWidthAt(z) * 0.7, z }; });
}

export function rocks(rand: Rand, spots: readonly Spot[], perRock: number): SplatSet {
  const b = splatBuilder(spots.length * perRock);
  const dark: Rgba = [0.12, 0.17, 0.24, 1], lit: Rgba = [0.36, 0.45, 0.52, 1];
  for (const spot of spots) {
    const w = between(rand, 90, 320), h = between(rand, 60, 260), d = between(rand, 70, 200), phase = rand() * TAU;
    const base = floorAt(spot.x, spot.z);
    for (let n = 0; n < perRock; n++) {
      const a = rand() * TAU, up = rand() ** 0.7; // a lumpy dome: points on its surface, more near the top
      const lump = 0.82 + 0.18 * Math.sin(a * 3 + phase) * Math.cos(up * 5);
      const ring = Math.sqrt(1 - up * up) * lump;
      const r = between(rand, 10, 24);
      b.add({
        at: [spot.x + Math.cos(a) * w * ring, base + up * h * lump, spot.z + Math.sin(a) * d * ring],
        color: mix(dark, lit, up * 0.8 * rand()), // lit from above
        shape: { scale: [r, r * 0.8, r] }, group: GROUP.rocks, phase,
      });
    }
  }
  return b.done();
}

export function kelp(rand: Rand, strands: number, spots: readonly Spot[]): SplatSet {
  const b = splatBuilder(strands * 60);
  const stem: Rgba = [0.24, 0.36, 0.16, 0.85], tip: Rgba = [0.5, 0.58, 0.24, 0.6];
  for (let s = 0; s < strands; s++) {
    const near = spots.length && rand() < 0.7 ? spots[Math.floor(rand() * spots.length)]! : null; // most kelp grows by the rocks
    const z = near ? near.z + between(rand, -120, 120) : between(rand, -250, -2200);
    const x = near ? near.x + between(rand, -260, 260) : between(rand, -0.8, 0.8) * halfWidthAt(z) * 0.7;
    const height = between(rand, 260, 720), lean = between(rand, -0.25, 0.25), phase = rand() * TAU;
    const steps = Math.round(height / 14);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, y = floorAt(x, z) + t * height, sx = x + lean * height * t * t;
      const sway = 46 * t ** 1.5; // the root holds; the tip sways most
      b.add({ at: [sx, y, z], color: mix(stem, tip, t), shape: { scale: [5, 11, 5] }, group: GROUP.kelp, phase: phase + t * 1.1, amp: sway });
      if (k % 2 === 0 && k > 1) { // a blade on alternating sides
        const side = k % 4 === 0 ? 1 : -1, angle = side * between(rand, 0.5, 0.9);
        b.add({ at: [sx + side * 14, y + 6, z], color: mix(stem, tip, t * 0.8 + 0.2), shape: { scale: [4, 22, 3], rotation: aroundAxis(0, 0, 1, angle) }, group: GROUP.kelp, phase: phase + t * 1.1, amp: sway * 1.1 });
      }
    }
  }
  return b.done();
}

const JELLY_GLOWS: readonly Rgba[] = [[1, 0.62, 0.86, 0.5], [0.55, 0.9, 1, 0.5], [0.78, 0.66, 1, 0.5], [1, 0.82, 0.62, 0.5]];

export function jellies(rand: Rand, count: number, detail: number): SplatSet {
  const b = splatBuilder(count * detail);
  for (let j = 0; j < count; j++) {
    const glow = JELLY_GLOWS[j % JELLY_GLOWS.length]!, phase = rand() * TAU;
    const cx = between(rand, -900, 900), cy = between(rand, -120, 300), cz = between(rand, -300, -1500), r = between(rand, 34, 64);
    const bell = Math.round(detail * 0.6);
    for (let n = 0; n < bell; n++) { // the bell: a dome, brighter at its rim
      const a = rand() * TAU, up = rand(), ring = Math.sqrt(1 - up * up);
      const c = mix(glow, [1, 1, 1, 0.75], up * 0.4);
      b.add({ at: [cx + Math.cos(a) * r * ring, cy + up * r * 0.75, cz + Math.sin(a) * r * ring], color: c, shape: { scale: [r * 0.16, r * 0.12, r * 0.16] }, group: GROUP.jellies, phase, amp: 26 });
    }
    const arms = 7, perArm = Math.max(2, Math.round((detail - bell) / arms));
    for (let a = 0; a < arms; a++) { // tentacles trail below, fading out
      const ang = (a / arms) * TAU, len = between(rand, 120, 260), ax = Math.cos(ang) * r * 0.7, az = Math.sin(ang) * r * 0.7;
      for (let k = 0; k < perArm; k++) {
        const t = k / perArm;
        b.add({ at: [cx + ax * (1 - t * 0.5), cy - t * len, cz + az * (1 - t * 0.5)], color: [glow[0], glow[1], glow[2], 0.4 * (1 - t)], shape: { scale: [2.4, 7, 2.4] }, group: GROUP.jellies, phase: phase + t * 0.9, amp: 26 });
      }
    }
  }
  return b.done();
}

/** One whale, swimming toward +x, far out in the blue. All its splats share one phase, so it moves as one. */
export function whale(rand: Rand, detail: number): SplatSet {
  const b = splatBuilder(detail);
  const cx = 0, cy = 180, cz = -2600, length = 1400, girth = 170;
  const back: Rgba = [0.08, 0.13, 0.22, 0.95], belly: Rgba = [0.2, 0.28, 0.38, 0.95];
  const phase = 0.18; // how far through its pass it starts: in view soon after the first dive
  const body = Math.round(detail * 0.8);
  for (let n = 0; n < body; n++) {
    const t = rand(); // 0 tail … 1 head
    const thick = girth * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) * (t < 0.3 ? 0.45 + t * 1.8 : 1);
    const a = rand() * TAU;
    const x = cx + (t - 0.5) * length, y = cy + Math.cos(a) * thick * 0.75 - (1 - t) * 30, z = cz + Math.sin(a) * thick;
    b.add({ at: [x, y, z], color: mix(back, belly, (1 - Math.cos(a)) / 2), shape: { scale: [26, 20, 20] }, group: GROUP.whale, phase, amp: 1 });
  }
  const rest = detail - body;
  for (let n = 0; n < rest; n++) { // the flukes at the tail and a long pectoral fin
    const fluke = n < rest * 0.6, s = rand(), side = rand() < 0.5 ? -1 : 1;
    const at: [number, number, number] = fluke
      ? [cx - length * 0.5 - s * 120, cy - 30 + side * s * 20, cz + side * s * 170]
      : [cx + length * 0.15 - s * 160, cy - 60 - s * 120, cz + side * 60];
    b.add({ at, color: back, shape: { scale: [20, 12, 20] }, group: GROUP.whale, phase, amp: 1 });
  }
  return b.done();
}

export function snow(rand: Rand, count: number): SplatSet {
  const b = splatBuilder(count);
  for (let n = 0; n < count; n++) {
    const z = between(rand, 260, -2400), r = between(rand, 1.6, 3.6);
    b.add({ at: [between(rand, -1, 1) * halfWidthAt(z) * 0.8, between(rand, -560, 560), z], color: [0.92, 0.96, 1, between(rand, 0.3, 0.75)], shape: { scale: [r, r, r] }, group: GROUP.snow, phase: rand() * TAU, amp: rand() });
  }
  return b.done();
}

export function shafts(rand: Rand, count: number): SplatSet {
  const b = splatBuilder(count * 8);
  for (let s = 0; s < count; s++) {
    const z = between(rand, -400, -1700), x = between(rand, -1, 1) * halfWidthAt(z) * 0.6, phase = rand() * TAU, width = between(rand, 40, 90);
    const tilt = aroundAxis(0, 0, 1, -0.26); // slanting like the light in the sky picture
    for (let k = 0; k < 8; k++) { // from the surface down, fading
      const t = k / 8;
      b.add({ at: [x + t * 240 * 0.26, 640 - t * 820, z], color: [0.8, 0.93, 1, 0.13 * (1 - t * 0.85)], shape: { scale: [width, 150, width * 0.6], rotation: tilt }, group: GROUP.shafts, phase, amp: 30 });
    }
  }
  return b.done();
}

/** How many splats each piece gets at full detail; quality scales them down. */
export const SEA_DETAIL = { seabed: 26000, rocks: 14, perRock: 520, kelp: 28, jellies: 5, perJelly: 520, whale: 2600, snow: 3200, shafts: 9 } as const;

export function deepSea(rand: Rand, quality: number): SplatSet {
  const q = Math.min(1, Math.max(0.2, quality)), d = SEA_DETAIL;
  const spots = rockSpots(rand, d.rocks);
  return joinSplats([
    seabed(rand, Math.round(d.seabed * q)),
    rocks(rand, spots, Math.round(d.perRock * q)),
    kelp(rand, d.kelp, spots),
    jellies(rand, d.jellies, Math.round(d.perJelly * Math.max(q, 0.5))),
    whale(rand, Math.round(d.whale * Math.max(q, 0.5))),
    snow(rand, Math.round(d.snow * q)),
    shafts(rand, d.shafts),
  ]);
}

/** A sailing ship sunk on the seabed: the hull on its side, half in the sand, its stern broken open to the ribs, the mainmast leaning,
 *  the foremast snapped, a yard fallen across the sand. Still (the rocks' group: the renderer leaves it in place). */
export function wreck(rand: Rand, detail: number): SplatSet {
  const b = splatBuilder(detail);
  const cx = 160, cz = -1250, L = 1450, B = 330, D = 300;
  const heel = 0.42, pitch = 0.1, yaw = 0.38; // lying over to one side, the bow a little up, turned toward the viewer
  const wood: Rgba = [0.24, 0.2, 0.16, 0.97], lit: Rgba = [0.55, 0.46, 0.34, 0.97], weed: Rgba = [0.2, 0.34, 0.2, 0.92], sand: Rgba = [0.3, 0.4, 0.5, 0.9];
  const floor = floorAt(cx, cz), sinkTo = floor + D * 0.72;
  /** From the ship's own frame (x along the keel toward the bow, y up from the deck, z across) to the scene. */
  const place = (x: number, y: number, z: number): [number, number, number] => {
    const y1 = y * Math.cos(heel) - z * Math.sin(heel), z1 = y * Math.sin(heel) + z * Math.cos(heel); // roll
    const x2 = x * Math.cos(pitch) - y1 * Math.sin(pitch), y2 = x * Math.sin(pitch) + y1 * Math.cos(pitch); // bow up
    const x3 = x2 * Math.cos(yaw) - z1 * Math.sin(yaw), z3 = x2 * Math.sin(yaw) + z1 * Math.cos(yaw); // turn
    return [cx + x3, sinkTo + y2, cz + z3];
  };
  const colorAt = (y: number, up: number): Rgba => {
    const c = mix(wood, lit, Math.max(0, up) * 0.8 * rand());
    if (y < floor + 24) return mix(c, sand, Math.min(1, (floor + 24 - y) / 40)); // where it sinks into the sand
    return rand() < 0.12 ? weed : c;
  };
  const halfBeam = (u: number) => (B / 2) * Math.pow(Math.max(0, 1 - u * u), u > 0 ? 0.75 : 0.25); // a sharp bow, a full stern
  const hull = Math.round(detail * 0.62);
  for (let n = 0; n < hull; n++) {
    const u = rand() * 2 - 1, a = rand() * Math.PI; // along the keel; around the hull from one rail (0) under the keel to the other (π)
    if (u < -0.45 && (u * 12.5 - Math.floor(u * 12.5)) > 0.3 && a > 0.5 && a < 2.6) continue; // the stern is broken open: only its ribs remain
    const w = halfBeam(u), at = place(u * L / 2, -D * Math.sin(a) * (0.6 + 0.4 * Math.sqrt(1 - u * u)), w * Math.cos(a));
    const r = between(rand, 10, 16);
    b.add({ at, color: colorAt(at[1], Math.cos(a) * Math.sin(heel) + 0.3), shape: { scale: [r * 1.5, r, r] }, group: GROUP.rocks });
  }
  const deck = Math.round(detail * 0.14);
  for (let n = 0; n < deck; n++) { // planks across the deck, with gaps where it has fallen in
    const u = between(rand, -0.4, 0.92), z = (rand() * 2 - 1) * halfBeam(u) * 0.95;
    if (Math.sin(u * 23) > 0.55) continue;
    const at = place(u * L / 2, 0, z);
    b.add({ at, color: colorAt(at[1], 0.6), shape: { scale: [16, 3, 7] }, group: GROUP.rocks });
  }
  const spar = (from: [number, number, number], to: [number, number, number], count: number, r: number) => {
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1), at = place(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t);
      b.add({ at, color: colorAt(at[1], 0.4), shape: { scale: [r, r, r] }, group: GROUP.rocks });
    }
  };
  const mastSplats = Math.round(detail * 0.06);
  spar([30, 0, 0], [80, 560, 0], mastSplats, 9); // the mainmast, leaning with the hull
  spar([70, 470, 0], [190, 250, 30], Math.round(mastSplats * 0.35), 6); // its yard, hanging from one end
  spar([300, 0, 0], [318, 210, 0], Math.round(mastSplats * 0.4), 8); // the foremast, snapped
  spar([-260, 0, 0], [-250, 120, 0], Math.round(mastSplats * 0.2), 7); // a stump at the stern
  const fallen = Math.round(detail * 0.05);
  for (let k = 0; k < fallen; k++) { // a yard fallen onto the sand beside the ship
    const t = k / fallen, x = cx - 420 + t * 520, z = cz + 360 - t * 160;
    b.add({ at: [x, floorAt(x, z) + 8, z], color: mix(wood, sand, 0.3), shape: { scale: [7, 7, 7] }, group: GROUP.rocks });
  }
  const left = detail - b.count;
  for (let k = 0; k < left; k++) { // barnacles and weed on the rail
    const u = between(rand, -0.9, 0.95), at = place(u * L / 2, between(rand, -20, 6), halfBeam(u) * (rand() < 0.5 ? 1 : -1));
    b.add({ at, color: rand() < 0.5 ? weed : [0.55, 0.55, 0.5, 0.9], shape: { scale: [5, 5, 5] }, group: GROUP.rocks });
  }
  return b.done();
}

/** Schools of small silver fish crossing the sea toward +x (the whale's group and motion: each school moves as one, by its phase). */
export function fishSchools(rand: Rand, schools: number, fishPer: number): SplatSet {
  const b = splatBuilder(schools * fishPer * 5);
  for (let s = 0; s < schools; s++) {
    const phase = 0.12 + s * 0.41, cy = between(rand, -120, 200), cz = between(rand, -700, -1700);
    const silver: Rgba = [0.62, 0.74, 0.84, 0.92], back: Rgba = [0.22, 0.34, 0.46, 0.92];
    for (let f = 0; f < fishPer; f++) {
      const x = between(rand, -1, 1) * 260, y = cy + between(rand, -1, 1) * 90 * Math.sqrt(rand()), z = cz + between(rand, -1, 1) * 180;
      const size = between(rand, 0.7, 1.2);
      for (let k = 0; k < 4; k++) b.add({ at: [x + (k - 1.5) * 9 * size, y, z], color: mix(silver, back, k === 3 ? 0.6 : rand() * 0.4), shape: { scale: [8 * size, 4 * size * (1 - Math.abs(k - 1.2) * 0.2), 3 * size] }, group: GROUP.whale, phase, amp: 1 });
      b.add({ at: [x - 26 * size, y, z], color: back, shape: { scale: [3 * size, 6 * size, 2 * size] }, group: GROUP.whale, phase, amp: 1 }); // the tail
    }
  }
  return b.done();
}

/** How many splats each piece of your own sea gets at full detail. */
export const WRECK_DETAIL = { seabed: 26000, rocks: 9, perRock: 420, kelp: 14, wreck: 11000, schools: 3, fishPer: 70, snow: 3200, shafts: 11 } as const;

/** Your own sea: the sunken ship, with rocks and kelp around it, schools of fish, and light from above. No whale, no jellyfish. */
export function wreckSea(rand: Rand, quality: number): SplatSet {
  const q = Math.min(1, Math.max(0.2, quality)), d = WRECK_DETAIL;
  const spots = rockSpots(rand, d.rocks).filter((s) => Math.hypot(s.x - 160, (s.z + 1250) * 0.7) > 520); // none inside the ship
  return joinSplats([
    seabed(rand, Math.round(d.seabed * q)),
    rocks(rand, spots, Math.round(d.perRock * q)),
    wreck(rand, Math.round(d.wreck * Math.max(q, 0.5))),
    kelp(rand, d.kelp, spots),
    fishSchools(rand, d.schools, Math.round(d.fishPer * Math.max(q, 0.6))),
    snow(rand, Math.round(d.snow * q)),
    shafts(rand, d.shafts),
  ]);
}
