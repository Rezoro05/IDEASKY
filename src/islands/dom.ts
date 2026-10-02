/** Small DOM helpers shared by the islands. */
import { v, type Vec } from "../lib/vec";

export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

/** Show an overlay, then add .open on the next frames so its CSS transition runs. */
export function openWithTransition(el: HTMLElement): void {
  el.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("open")));
}

export function closeAfterTransition(el: HTMLElement, ms: number): void {
  el.classList.remove("open");
  setTimeout(() => { if (!el.classList.contains("open")) el.hidden = true; }, ms);
}

export const pointOf = (r: DOMRect, dx: number, dy: number): Vec => v(r.left + dx, r.top + dy);
export const prefersReducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function randomBytes(n: number): Uint8Array {
  try { return crypto.getRandomValues(new Uint8Array(n)); }
  catch { return Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)); }
}
