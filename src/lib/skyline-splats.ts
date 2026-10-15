/** The skyline picture turned into splats: one soft blob per sample of the picture, pushed back or brought forward by how far it looks.
 *  The picture is painted with atmosphere: near buildings are dark navy, far ones pale and hazy, the sky clear blue.
 *  So lightness (and the sky's blue) stands in for distance; the water below the horizon comes toward the viewer. */
import { GROUP, splatBuilder, type SplatSet } from "./splats";
import type { Rand } from "./random";

export type Pixels = { data: ArrayLike<number>; cols: number; rows: number };
export type SkylineOptions = {
  /** The picture's real size in pixels; splat positions are in these pixels, origin at the bottom centre, y up, z toward the viewer. */
  imageWidth: number; imageHeight: number;
  /** Where the water starts, as a share of the height from the top. */
  horizon: number;
  /** 1 = the painted depth; 0 = flat as the picture; more = deeper. */
  depth: number;
  rand: Rand;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** How far away a colour looks: 0 = a near, dark building; 1 = the far haze and the sky. */
export function farness(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, light = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  const byLight = clamp01((light - 0.3) / 0.5);
  const sky = b > r ? clamp01((sat - 0.45) / 0.25) * clamp01((light - 0.5) / 0.1) : 0;
  return Math.max(byLight, sky);
}

/** Distance in picture pixels for a sample at row fraction v with the given farness (negative = behind the picture plane). */
export function sampleDepth(v: number, far: number, opts: Pick<SkylineOptions, "horizon" | "depth">): number {
  if (v >= opts.horizon) return opts.depth * 260 * ((v - opts.horizon) / (1 - opts.horizon)); // the water, nearer as it comes down
  return -opts.depth * (40 + 560 * far);
}

/** A box blur of the depth grid, so neighbouring samples move together and the picture stretches instead of tearing. */
function smoothed(grid: Float32Array, cols: number, rows: number, radius: number): Float32Array {
  const out = new Float32Array(grid.length);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let sum = 0, n = 0;
    for (let dj = -radius; dj <= radius; dj++) for (let di = -radius; di <= radius; di++) {
      const x = i + di, y = j + dj;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      sum += grid[y * cols + x]!; n++;
    }
    out[j * cols + i] = sum / n;
  }
  return out;
}

export function skylineSplats(pixels: Pixels, opts: SkylineOptions): SplatSet {
  const { cols, rows, data } = pixels;
  const cell = opts.imageWidth / cols, cellY = opts.imageHeight / rows;
  const depth = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const v = (j + 0.5) / rows;
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4;
      depth[j * cols + i] = sampleDepth(v, farness(data[k]!, data[k + 1]!, data[k + 2]!), opts);
    }
  }
  const z = smoothed(depth, cols, rows, 2);
  const b = splatBuilder(cols * rows);
  const radius = Math.max(cell, cellY) * 0.62;
  for (let j = 0; j < rows; j++) {
    const v = (j + 0.5) / rows;
    const water = v >= opts.horizon;
    const fadeIn = clamp01(v / 0.1); // the picture's top melts into the sky, as the photo's mask did
    for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4;
      const zk = water ? depth[j * cols + i]! : z[j * cols + i]!; // the water keeps its clean slope
      b.add({
        at: [(i + 0.5) * cell - opts.imageWidth / 2, opts.imageHeight - (j + 0.5) * cellY, zk],
        color: [data[k]! / 255, data[k + 1]! / 255, data[k + 2]! / 255, (data[k + 3]! / 255) * fadeIn],
        shape: { scale: [radius, radius, radius * 0.5] },
        group: GROUP.skyline,
        phase: opts.rand() * Math.PI * 2,
        amp: water ? cell * 0.6 : 0, // the water shimmers sideways; buildings hold still
      });
    }
  }
  return b.done();
}
