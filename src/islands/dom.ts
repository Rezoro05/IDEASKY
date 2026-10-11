/** Small DOM helpers shared by the islands. */

export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

/** A message about what was typed (or failed to send) belongs to that attempt: once the visitor edits the form, it goes. It comes back if the next send still has the problem. */
export function hideOnEdit(form: HTMLElement, message: HTMLElement): void {
  form.addEventListener("input", () => { message.hidden = true; });
}

const openRequests = new WeakMap<HTMLElement, number>();

/** Show an overlay, then add .open on the next frames so its CSS transition runs. */
export function openWithTransition(el: HTMLElement): void {
  el.hidden = false;
  const request = (openRequests.get(el) ?? 0) + 1;
  openRequests.set(el, request);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (openRequests.get(el) === request) el.classList.add("open"); }));
}

/** An overlay closed before its opening frames ran must not reopen when they do. */
export function cancelPendingOpen(el: HTMLElement): void {
  openRequests.set(el, (openRequests.get(el) ?? 0) + 1);
}


export const prefersReducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function randomBytes(n: number): Uint8Array {
  try { return crypto.getRandomValues(new Uint8Array(n)); }
  catch { return Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256)); }
}

/* Whether a finger, mouse button or pen is pressed on the page right now. */
let pressing = false;
if (typeof addEventListener === "function") {
  addEventListener("pointerdown", () => { pressing = true; }, true);
  for (const t of ["pointerup", "pointercancel"]) addEventListener(t, () => { pressing = false; }, true);
}

/** A bird or fish that took focus: true when it came from the keyboard or a screen reader. When it came during a press (a long
 *  press on a phone focuses the link), it gives the focus straight back, so no ring shows and nothing pauses. */
export function keyboardFocus(el: HTMLElement): boolean {
  if (!pressing) return true;
  el.blur();
  return false;
}

/** Birds and fish are carried with a finger: the phone's own long press (link preview, copy menu, highlight) must never take over,
 *  or it shows a frame and cancels the carry. */
export function keepLongPressAway(area: HTMLElement): void {
  area.addEventListener("contextmenu", (e) => { if ((e.target as Element).closest(".plane, .fish") || area.querySelector(".held")) e.preventDefault(); });
  area.addEventListener("touchstart", (e) => { if ((e.target as Element).closest(".plane, .fish") || area.querySelector(".held")) e.preventDefault(); }, { passive: false });
  area.addEventListener("dragstart", (e) => e.preventDefault());
}
