/** Pure 2D vector helpers. */
export type Vec = { readonly x: number; readonly y: number };

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => v(a.x + b.x, a.y + b.y);
export const sub = (a: Vec, b: Vec): Vec => v(a.x - b.x, a.y - b.y);
export const scale = (a: Vec, k: number): Vec => v(a.x * k, a.y * k);
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const clampLen = (a: Vec, max: number): Vec => {
  const l = len(a);
  return l > max ? scale(a, max / l) : a;
};
export const headingDeg = (a: Vec): number => (Math.atan2(a.y, a.x) * 180) / Math.PI;
