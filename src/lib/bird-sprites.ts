/** The photographed bluebird: six cut-out photos (public/birds/<id>.webp, made by scripts/art/photo-bird). All face right.
 *  w, h: the picture's size in px at the scale it was packed (the bird is drawn at SIZE_AT_SCALE of the plane size).
 *  ax, ay: the point of the picture that sits on the plane's position, as a share of its width and height:
 *  the body's centre for the flight photos (all three share one box and anchor, so the body stays put as the wings change),
 *  the belly line (or the feet) for the resting ones, so a resting bird sits on its perch line. */
export const FRAME_IDS = ["rest-side", "rest-back", "rest-preen", "fly-glide", "fly-up", "fly-spread"] as const;
export type FrameId = (typeof FRAME_IDS)[number];
export type Sprite = { readonly w: number; readonly h: number; readonly ax: number; readonly ay: number };

export const BIRD_SPRITES: Record<FrameId, Sprite> = {
  "rest-side": { w: 432, h: 362, ax: 0.494, ay: 0.7539 },
  "rest-back": { w: 317, h: 398, ax: 0.4943, ay: 0.7082 },
  "rest-preen": { w: 404, h: 373, ax: 0.3383, ay: 0.9946 },
  "fly-glide": { w: 413, h: 397, ax: 0.4205, ay: 0.6698 },
  "fly-up": { w: 413, h: 397, ax: 0.4205, ay: 0.6698 },
  "fly-spread": { w: 413, h: 397, ax: 0.4205, ay: 0.6698 },
};

/** The plane size (--s) maps to this many picture px: a flight photo's body is about this wide, so the bird is about as big as the other forms. */
export const SIZE_AT_SCALE = 330;

/** How far a cruising bird rises and sinks (lift 1), as a share of the plane size. */
export const BOB_SHARE = 0.2;
/** How far the body lunges forward on a flap (surge 1), as a share of the plane size, and how far it noses up or down (pitch 1), in degrees. */
export const SURGE_SHARE = 0.09;
export const PITCH_DEG = 7;
