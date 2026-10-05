/** Pure: how a photographed bird turns. The photos are side views, so unlike the flat forms they must not rotate all the way
 *  with the heading (a bird climbing at 60° would be a bird on its tail). It keeps the mirroring (always facing the way it flies)
 *  and tilts only part of the way, up to a limit; perched or held, it stays upright. */
import { orientationTransform, type Orientation } from "./orientation";
import type { Pose } from "./bird-frames";
import { BOB_SHARE, PITCH_DEG, SURGE_SHARE } from "./bird-sprites";

export const TILT = { share: 0.6, maxDeg: 22 } as const;

export function birdOrientation(o: Orientation, upright: boolean): Orientation {
  if (upright) return { rotateDeg: 0, mirrored: o.mirrored };
  const tilt = Math.max(-TILT.maxDeg, Math.min(TILT.maxDeg, o.rotateDeg * TILT.share));
  return { rotateDeg: tilt, mirrored: o.mirrored };
}

/** The CSS transform for a bird's body: raised or sunk, turned to its heading, then (in its own frame, so mirroring doesn't matter) lunged forward and nosed up or down. */
export const birdTransform = (o: Orientation, pose: Pose, planeSize: number): string =>
  `translateY(${-pose.lift * planeSize * BOB_SHARE}px) ${orientationTransform(o)} translateX(${pose.surge * planeSize * SURGE_SHARE}px) rotate(${-pose.pitch * PITCH_DEG}deg)`;
