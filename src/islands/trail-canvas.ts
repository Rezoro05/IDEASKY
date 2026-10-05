/** The one canvas under the planes that airplane trails are drawn on. All it knows is how to paint segments (the pure lib/trail decides which). */
import type { TrailSegment } from "../lib/trail";

export type TrailLayer = { draw(segments: readonly TrailSegment[]): void };

export function createTrailLayer(field: HTMLElement): TrailLayer {
  const canvas = document.createElement("canvas");
  canvas.className = "sky-trails";
  canvas.setAttribute("aria-hidden", "true");
  field.prepend(canvas); // first in the field, so the headline stays above it
  const ctx = canvas.getContext("2d");
  let width = 0, height = 0, ratio = 1, drawnSomething = false;

  function fit(): void {
    const w = field.clientWidth, h = field.clientHeight, r = window.devicePixelRatio || 1;
    if (w === width && h === height && r === ratio) return;
    width = w; height = h; ratio = r;
    canvas.width = Math.max(1, Math.round(w * r));
    canvas.height = Math.max(1, Math.round(h * r));
    ctx?.setTransform(r, 0, 0, r, 0, 0);
  }

  return {
    draw(segments) {
      if (!ctx || (segments.length === 0 && !drawnSomething)) return; // nothing there and nothing to wipe
      fit();
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "butt"; // round caps overlap where segments meet and show as beads
      for (const s of segments) {
        ctx.strokeStyle = `rgba(255,255,255,${s.alpha.toFixed(3)})`;
        ctx.lineWidth = s.width;
        ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke();
      }
      drawnSomething = segments.length > 0;
    },
  };
}
