/** Pure: how the bird turns and where its body sits. It keeps the mirroring (always facing the way it flies) but tilts only part of
 *  the way with the heading, up to a limit, so a climbing bird never stands on its tail; perched or held, it stays upright. */
import { orientationTransform, type Orientation } from "./orientation";
import type { Pose } from "./bird-pose";

export const TILT = { share: 0.6, maxDeg: 22 } as const;
/** How far the body moves, as shares of the plane size (bob: rise at lift 1; surge: lunge at surge 1; seat: how far above its middle the feet are) and degrees (pitch 1). */
export const MOTION = { bob: 0.14, surge: 0.08, pitchDeg: 9, seat: 0.18 } as const;

export function birdOrientation(o: Orientation, upright: boolean): Orientation {
  if (upright) return { rotateDeg: 0, mirrored: o.mirrored };
  const tilt = Math.max(-TILT.maxDeg, Math.min(TILT.maxDeg, o.rotateDeg * TILT.share));
  return { rotateDeg: tilt, mirrored: o.mirrored };
}

/** The CSS transform for a bird's body: raised (or seated on its feet), turned to its heading, then in its own frame lunged forward and nosed up or down. */
export const birdTransform = (o: Orientation, pose: Pose, size: number): string =>
  `translateY(${-(pose.seat * MOTION.seat + (1 - pose.seat) * pose.lift * MOTION.bob) * size}px) ${orientationTransform(o)} translateX(${pose.surge * size * MOTION.surge}px) rotate(${-pose.pitch * MOTION.pitchDeg}deg)`;
