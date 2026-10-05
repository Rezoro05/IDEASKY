/** Pure: which photo a bird shows, and how its body rises and falls. A small bird cruises in bursts: a few quick flaps, then the wings folded
 *  for a moment while it coasts, over and over, rising on the flaps and sinking on the fold. Flying to a perch or taking off it flaps without
 *  pause. In a hand it beats much faster still (a startled, frantic bird). Perched it sits in one of three resting photos, picked by its id. */
import { hashString } from "./random";
import type { WingLook } from "./bird";
import type { FrameId } from "./bird-sprites";
export { FRAME_IDS } from "./bird-sprites";

export const REST_FRAMES: readonly FrameId[] = ["rest-side", "rest-back", "rest-preen"];
export const FLAP_CYCLE: readonly FrameId[] = ["fly-spread", "fly-up", "fly-glide", "fly-up"];
export const HELD_CYCLE: readonly FrameId[] = ["fly-spread", "fly-up"];
/** Full beats per second when flapping to a perch or taking off. */
export const FLAP_HZ = 7;
export const HELD_HZ = 14;
/** Cruising: this many flaps (at CRUISE_HZ), then the wings fold for COAST seconds. */
export const CRUISE = { flaps: 4, hz: 8, coast: 0.5 } as const;
const BURST = CRUISE.flaps / CRUISE.hz;
const PERIOD = BURST + CRUISE.coast;

/** A bird's picture and how far its body is raised: lift runs from -1 (lowest) to 1 (highest), 0 when it isn't flying; the caller scales it to px. */
export type Pose = {
  readonly frame: FrameId;
  readonly lift: number;
  /** Nose up (+) or down (-), -1..1: climbing noses up, sinking noses down. The caller scales it to degrees. */
  readonly pitch: number;
  /** Forward (+) or back (-) along the heading, -1..1: the body lunges on each downstroke and eases between. */
  readonly surge: number;
};
const still = (frame: FrameId): Pose => ({ frame, lift: 0, pitch: 0, surge: 0 });

const offsetOf = (slug: string): number => (hashString(slug) % 1000) / 1000; // each bird starts at its own moment
const beat = (frames: readonly FrameId[], phase: number): FrameId => frames[Math.floor((phase % 1) * frames.length)]!;

export function birdPose(look: WingLook, time: number, slug: string): Pose {
  const off = offsetOf(slug);
  switch (look) {
    case "perch": return still(REST_FRAMES[hashString(slug) % REST_FRAMES.length]!);
    case "held": return still(beat(HELD_CYCLE, time * HELD_HZ + off));
    case "flap": { // a small rise, a nod and a lunge with each beat
      const w = 2 * Math.PI * (time * FLAP_HZ + off);
      return { frame: beat(FLAP_CYCLE, time * FLAP_HZ + off), lift: 0.4 * Math.sin(w - Math.PI / 2), pitch: 0.5 * Math.sin(w), surge: 0.6 * Math.sin(w - Math.PI / 2) };
    }
    case "glide": {
      const at = ((time + off * PERIOD) % PERIOD + PERIOD) % PERIOD;
      const frame = at < BURST ? beat(FLAP_CYCLE, (at / BURST) * CRUISE.flaps) : "fly-glide";
      const w = 2 * Math.PI * (at / PERIOD) - Math.PI / 6; // one wave per burst: climbs through the flaps, sinks through the coast
      const beatW = 2 * Math.PI * ((at / BURST) * CRUISE.flaps);
      const flapping = at < BURST;
      return { frame, lift: Math.sin(w), pitch: Math.cos(w), surge: flapping ? 0.6 * Math.sin(beatW) : 0 }; // each flap lunges it forward (starting and ending at rest, so the coast joins smoothly)
    }
  }
}
