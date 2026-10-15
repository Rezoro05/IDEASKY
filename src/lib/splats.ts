/** Gaussian splats as plain data: each splat is a soft coloured blob with a centre, a 3D shape (covariance) and a group.
 *  The group says what the splat belongs to (the skyline, kelp, a jellyfish…), so the renderer can animate and switch whole groups. */

export const GROUP = { skyline: 0, seabed: 1, rocks: 2, kelp: 3, jellies: 4, whale: 5, snow: 6, shafts: 7 } as const;
export type Group = (typeof GROUP)[keyof typeof GROUP];
export const GROUP_COUNT = 8;

/** Per splat: centre (x, y, z), covariance (xx, xy, xz, yy, yz, zz), colour (r, g, b, a in 0..1),
 *  group, phase (0..2π: where it is in its own motion; phase / 2π also ranks it for "amount"), and amp (how far it moves). */
export type SplatSet = {
  count: number;
  centers: Float32Array;
  covs: Float32Array;
  colors: Float32Array;
  groups: Uint8Array;
  phases: Float32Array;
  amps: Float32Array;
};

export type Rgba = readonly [number, number, number, number];
export type Shape = {
  /** Radii (standard deviations) along the splat's own axes. */
  scale: readonly [number, number, number];
  /** Rotation as a unit quaternion (x, y, z, w). Leave out for none. */
  rotation?: readonly [number, number, number, number];
};
export type SplatSpec = { at: readonly [number, number, number]; color: Rgba; shape: Shape; group: Group; phase?: number; amp?: number };

/** The covariance R·S·Sᵀ·Rᵀ of a splat with radii `scale` turned by quaternion `rotation`, as its six distinct entries. */
export function covariance(shape: Shape): [number, number, number, number, number, number] {
  const [sx, sy, sz] = shape.scale;
  const [x, y, z, w] = shape.rotation ?? [0, 0, 0, 1];
  const r = [
    1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
  ];
  const m = [r[0]! * sx, r[1]! * sy, r[2]! * sz, r[3]! * sx, r[4]! * sy, r[5]! * sz, r[6]! * sx, r[7]! * sy, r[8]! * sz]; // M = R·S
  const dot = (i: number, j: number) => m[i * 3]! * m[j * 3]! + m[i * 3 + 1]! * m[j * 3 + 1]! + m[i * 3 + 2]! * m[j * 3 + 2]!; // (M·Mᵀ)ᵢⱼ
  return [dot(0, 0), dot(0, 1), dot(0, 2), dot(1, 1), dot(1, 2), dot(2, 2)];
}

/** A quaternion turning by `angle` radians about the unit axis (x, y, z). */
export function aroundAxis(x: number, y: number, z: number, angle: number): [number, number, number, number] {
  const s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

/** Collects splats into one set. Grows as needed; `done()` trims it to size. */
export function splatBuilder(capacity = 1024) {
  let cap = Math.max(1, capacity), n = 0;
  let centers = new Float32Array(cap * 3), covs = new Float32Array(cap * 6), colors = new Float32Array(cap * 4);
  let groups = new Uint8Array(cap), phases = new Float32Array(cap), amps = new Float32Array(cap);
  function grow(): void {
    cap *= 2;
    const more = <T extends Float32Array | Uint8Array>(a: T, k: number): T => { const b = new (a.constructor as new (n: number) => T)(cap * k); b.set(a); return b; };
    centers = more(centers, 3); covs = more(covs, 6); colors = more(colors, 4); groups = more(groups, 1); phases = more(phases, 1); amps = more(amps, 1);
  }
  return {
    add(s: SplatSpec): void {
      if (n === cap) grow();
      centers.set(s.at, n * 3);
      covs.set(covariance(s.shape), n * 6);
      colors.set(s.color, n * 4);
      groups[n] = s.group; phases[n] = s.phase ?? 0; amps[n] = s.amp ?? 0;
      n++;
    },
    get count(): number { return n; },
    done(): SplatSet {
      return { count: n, centers: centers.slice(0, n * 3), covs: covs.slice(0, n * 6), colors: colors.slice(0, n * 4), groups: groups.slice(0, n), phases: phases.slice(0, n), amps: amps.slice(0, n) };
    },
  };
}

/** One set made of several, in order. */
export function joinSplats(sets: readonly SplatSet[]): SplatSet {
  const n = sets.reduce((sum, s) => sum + s.count, 0);
  const out: SplatSet = { count: n, centers: new Float32Array(n * 3), covs: new Float32Array(n * 6), colors: new Float32Array(n * 4), groups: new Uint8Array(n), phases: new Float32Array(n), amps: new Float32Array(n) };
  let at = 0;
  for (const s of sets) {
    out.centers.set(s.centers, at * 3); out.covs.set(s.covs, at * 6); out.colors.set(s.colors, at * 4);
    out.groups.set(s.groups, at); out.phases.set(s.phases, at); out.amps.set(s.amps, at);
    at += s.count;
  }
  return out;
}
