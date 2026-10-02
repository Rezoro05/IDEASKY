/** Pure, seeded randomness: the same seed always gives the same sequence. */
export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Each plane gets its own stable personality for one visit. */
export const seedFor = (slug: string, visitSeed: number): number => (hashString(slug) ^ visitSeed) >>> 0;
