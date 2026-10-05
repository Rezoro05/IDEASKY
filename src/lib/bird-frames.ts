/** Pure: which photo a bird shows. Gliding: wings folded in flight. Flying to a perch or taking off: a flap cycle through the flight photos.
 *  In a hand: the same cycle, much faster (a startled, frantic bird). Perched: a resting photo, picked by the bird's name so it keeps its pose. */
import { hashString } from "./random";
import type { WingLook } from "./bird";
import type { FrameId } from "./bird-sprites";
export { FRAME_IDS } from "./bird-sprites";

export const REST_FRAMES: readonly FrameId[] = ["rest-side", "rest-back", "rest-preen"];
export const FLAP_CYCLE: readonly FrameId[] = ["fly-spread", "fly-up", "fly-glide", "fly-up"];
export const HELD_CYCLE: readonly FrameId[] = ["fly-spread", "fly-up"];
/** Full beats per second. */
export const FLAP_HZ = 5;
export const HELD_HZ = 14;

const cycle = (frames: readonly FrameId[], hz: number, time: number, slug: string): FrameId => {
  const phase = time * hz + (hashString(slug) % 1000) / 1000; // each bird starts its beat at its own moment
  return frames[Math.floor((phase % 1) * frames.length)]!;
};

export function birdFrame(look: WingLook, time: number, slug: string): FrameId {
  switch (look) {
    case "glide": return "fly-glide";
    case "flap": return cycle(FLAP_CYCLE, FLAP_HZ, time, slug);
    case "held": return cycle(HELD_CYCLE, HELD_HZ, time, slug);
    case "perch": return REST_FRAMES[hashString(slug) % REST_FRAMES.length]!;
  }
}
