/** Pure: how to draw a plane (art faces right) so it points along its heading and never flies upside down.
 *  Heading left → mirror the art and rotate less. Near straight up or down it keeps its facing until it is clearly
 *  past vertical, so a climbing plane doesn't flicker between mirrored and not. */

export type Orientation = { rotateDeg: number; mirrored: boolean };

/** How far past vertical (degrees) a plane must turn before it flips to face the other way. */
export const FLIP_MARGIN_DEG = 15;

/** Any angle → (-180, 180]. */
export const normalizeDeg = (deg: number): number => {
  const d = ((deg % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
};

/** headingDeg: screen angle of travel (0 = right, 90 = down). */
export function orientationFor(headingDeg: number, wasMirrored: boolean, margin = FLIP_MARGIN_DEG): Orientation {
  const h = normalizeDeg(headingDeg), sideways = Math.abs(h); // 0 = straight right, 180 = straight left
  const mirrored = wasMirrored ? sideways > 90 - margin : sideways > 90 + margin;
  return { mirrored, rotateDeg: mirrored ? normalizeDeg(h - 180) : h };
}

export const orientationTransform = (o: Orientation): string =>
  `rotate(${o.rotateDeg}deg)${o.mirrored ? " scaleX(-1)" : ""}`;
