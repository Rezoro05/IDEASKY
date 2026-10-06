/** The one canvas under the planes that airplane trails are drawn on. All it knows is how to paint segments (the pure lib/trail decides which). */
import { trailBox, type TrailBox, type TrailSegment } from "../lib/trail";
import type { Bounds } from "../lib/sim";

export type TrailLayer = { draw(segments: readonly TrailSegment[], size: Bounds): void };

export function createTrailLayer(field: HTMLElement): TrailLayer {
  const canvas = document.createElement("canvas");
  canvas.className = "sky-trails";
  canvas.setAttribute("aria-hidden", "true");
  field.prepend(canvas); // first in the field, so the headline stays above it
  const ctx = canvas.getContext("2d");
  let width = 0, height = 0, ratio = 1, painted: TrailBox | null = null;

  /** Resizing the canvas wipes it, so nothing painted is left to clear. */
  function fit(size: Bounds): void {
    const r = window.devicePixelRatio || 1;
    if (size.width === width && size.height === height && r === ratio) return;
    width = size.width; height = size.height; ratio = r;
    canvas.width = Math.max(1, Math.round(width * r));
    canvas.height = Math.max(1, Math.round(height * r));
    ctx?.setTransform(r, 0, 0, r, 0, 0);
    painted = null;
  }

  return {
    draw(segments, size) {
      if (!ctx || (segments.length === 0 && !painted)) return; // nothing there and nothing to wipe
      fit(size);
      if (painted) ctx.clearRect(painted.x, painted.y, painted.w, painted.h);
      ctx.lineCap = "butt"; // round caps overlap where segments meet and show as beads
      for (const s of segments) {
        ctx.strokeStyle = `rgba(255,255,255,${s.alpha.toFixed(3)})`;
        ctx.lineWidth = s.width;
        ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke();
      }
      painted = trailBox(segments);
    },
  };
}
