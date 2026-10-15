/** Splats blend correctly only when drawn far to near. This orders them by distance from the camera with a counting sort
 *  (one pass to count, one to place): fast enough for a few hundred thousand splats each time the camera has moved. */

/** The camera-space depth row of a model-view matrix (column-major): depth = a·x + b·y + c·z + d. */
export type DepthRow = readonly [number, number, number, number];
export const depthRow = (modelView: Float32Array): DepthRow => [modelView[2]!, modelView[6]!, modelView[10]!, modelView[14]!];

const BUCKETS = 65536;

export type Sorter = { order: Uint32Array; sort(centers: Float32Array, row: DepthRow): Uint32Array };

export function depthSorter(count: number): Sorter {
  const order = new Uint32Array(count), keys = new Uint16Array(count), counts = new Uint32Array(BUCKETS);
  return {
    order,
    sort(centers, [a, b, c, d]) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < count; i++) {
        const z = a * centers[i * 3]! + b * centers[i * 3 + 1]! + c * centers[i * 3 + 2]! + d;
        if (z < lo) lo = z;
        if (z > hi) hi = z;
      }
      const scale = hi > lo ? (BUCKETS - 1) / (hi - lo) : 0;
      counts.fill(0);
      for (let i = 0; i < count; i++) {
        // Camera space looks down −z: the most negative depth is the farthest and is drawn first.
        const z = a * centers[i * 3]! + b * centers[i * 3 + 1]! + c * centers[i * 3 + 2]! + d;
        const k = ((z - lo) * scale) | 0;
        keys[i] = k;
        counts[k]!++;
      }
      for (let k = 1; k < BUCKETS; k++) counts[k]! += counts[k - 1]!;
      for (let i = count - 1; i >= 0; i--) order[--counts[keys[i]!]!] = i;
      return order;
    },
  };
}

/** Whether the camera turned or moved enough since the last sort for the order to have changed visibly. */
export function needsResort(last: DepthRow | null, now: DepthRow, within = 0.002, moveWithin = 1): boolean {
  if (!last) return true;
  return Math.abs(last[0] - now[0]) > within || Math.abs(last[1] - now[1]) > within || Math.abs(last[2] - now[2]) > within || Math.abs(last[3] - now[3]) > moveWithin;
}
