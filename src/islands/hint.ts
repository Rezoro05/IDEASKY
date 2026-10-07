/** The first-visit hint, drawn like a blueprint over the sky: a ghost hand presses a ghost bird, drags it along a dashed curve into
 *  the real cage, and lets go. It plays twice, then fades; any press or key ends it at once. Shown once per browser (lib/hint). */
import { HINT, HINT_SEEN_KEY, hintPath, hintStart, shouldShowHint } from "../lib/hint";
import { formFor } from "../lib/forms";
import { v } from "../lib/vec";

const HAND = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ht-line" d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15c0 3.5-2.5 6-6 6h-1c-2.6 0-4-1.2-5.3-3.2L4.2 14.6a1.4 1.4 0 0 1 2.2-1.7L7 13.7"/></svg>`;

function seen(store: Storage | null): boolean { try { return store?.getItem(HINT_SEEN_KEY) === "1"; } catch { return true; } }
function markSeen(store: Storage | null): void { try { store?.setItem(HINT_SEEN_KEY, "1"); } catch { /* private mode: it may show again */ } }

export function startCageHint(opts: { field: HTMLElement; cage: HTMLElement; reducedMotion: boolean; store: Storage | null; inSky: () => boolean }): void {
  if (!shouldShowHint({ seen: seen(opts.store), reducedMotion: opts.reducedMotion, hash: location.hash })) return;
  setTimeout(() => {
    if (!opts.inSky() || document.documentElement.classList.contains("sky-covered")) return; // the visitor is already busy elsewhere
    const f = opts.field.getBoundingClientRect(), c = opts.cage.getBoundingClientRect();
    const end = v(c.left - f.left + c.width / 2, c.top - f.top + c.height * 0.55);
    const start = hintStart(end, { width: f.width, height: f.height }), path = hintPath(start, end);
    markSeen(opts.store);

    const el = document.createElement("div");
    el.className = "cage-hint-tour"; el.setAttribute("aria-hidden", "true");
    el.style.setProperty("--loop", HINT.loopMs + "ms"); el.style.setProperty("--loops", String(HINT.loops));
    el.innerHTML =
      `<svg class="ht-plan" width="${f.width}" height="${f.height}" viewBox="0 0 ${f.width} ${f.height}">` +
      `<path class="ht-track" d="${path}"/>` +
      `<circle class="ht-mark" cx="${start.x}" cy="${start.y}" r="34"/>` +
      `<circle class="ht-mark ht-target" cx="${end.x}" cy="${end.y}" r="34"/>` +
      `<text class="ht-label" x="${start.x - 26}" y="${start.y + 56}">1 · PRESS A BIRD</text>` +
      `<text class="ht-label" x="${(start.x + end.x) / 2 - 30}" y="${Math.min(start.y, end.y) + 16}">2 · DRAG</text>` +
      `<text class="ht-label ht-end" x="${end.x + 30}" y="${end.y + 58}">3 · DROP IN THE CAGE</text>` +
      `</svg>` +
      `<div class="ht-ghost" style="offset-path: path('${path}')"><span class="ht-bird">${formFor("idea")}</span><span class="ht-hand">${HAND}</span></div>`;
    opts.field.appendChild(el);

    const finish = () => { el.classList.add("leaving"); setTimeout(() => el.remove(), 500); removeEventListener("pointerdown", finish, true); removeEventListener("keydown", finish, true); };
    addEventListener("pointerdown", finish, true); // any press or key: the visitor has started, the hint steps aside
    addEventListener("keydown", finish, true);
    setTimeout(finish, HINT.loopMs * HINT.loops);
  }, HINT.delayMs);
}
