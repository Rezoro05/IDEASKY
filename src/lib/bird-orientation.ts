/** Pure: how a photographed bird turns. The photos are side views, so unlike the flat forms they must not rotate all the way
 *  with the heading (a bird climbing at 60° would be a bird on its tail). It keeps the mirroring (always facing the way it flies)
 *  and tilts only part of the way, up to a limit; perched or held, it stays upright. */
import type { Orientation } from "./orientation";

export const TILT = { share: 0.6, maxDeg: 30 } as const;

export function birdOrientation(o: Orientation, upright: boolean): Orientation {
  if (upright) return { rotateDeg: 0, mirrored: o.mirrored };
  const tilt = Math.max(-TILT.maxDeg, Math.min(TILT.maxDeg, o.rotateDeg * TILT.share));
  return { rotateDeg: tilt, mirrored: o.mirrored };
}
