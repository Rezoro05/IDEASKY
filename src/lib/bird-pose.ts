/** Pure: how a bird's wings and body move, moment by moment. Every value changes smoothly with time (no frames to swap).
 *  A small bird cruises in bursts: a few beats, then wings folded while it coasts, rising through the beats and sinking through the coast.
 *  Flying to a perch or taking off, it beats without pause. In a hand it beats much faster (startled). Perched, it sits with wings folded. */
import { hashString } from "./random";
import type { WingLook } from "./bird";

/** Beats per second flying to a perch or taking off, and in a hand. */
export const FLAP_HZ = 6;
export const HELD_HZ = 13;
/** Cruising: this many beats (at hz), then the wings stay folded for `coast` seconds. */
export const CRUISE = { flaps: 3, hz: 6, coast: 0.6 } as const;
/** The wing value of a folded wing (laid along the back). */
export const FOLDED = 0.12;
const BURST = CRUISE.flaps / CRUISE.hz;
const PERIOD = BURST + CRUISE.coast;

/** wing: 1 fully up, -1 fully down. lift: body raised (1) or sunk (-1). pitch: nose up (1) or down (-1). surge: lunged forward (1) or back (-1).
 *  seat: 1 on a perch (its feet go on the line), 0 in the air, between while it settles. The page scales these to px and degrees. */
export type Pose = { readonly wing: number; readonly lift: number; readonly pitch: number; readonly surge: number; readonly seat: number };

const offsetOf = (slug: string): number => (hashString(slug) % 1000) / 1000; // each bird keeps its own rhythm
/** One beat, starting and ending folded: up, then a full downstroke, then back to folded. p in [0, 1). */
const stroke = (p: number): number => FOLDED + (1 - FOLDED) * Math.sin(2 * Math.PI * p) * (Math.sin(2 * Math.PI * p) > 0 ? 1 : (1 + FOLDED) / (1 - FOLDED));
const frac = (x: number): number => x - Math.floor(x);
const ease = (k: number): number => k * k * (3 - 2 * k);

/** A gliding wing: held open (a little above level, as seen from the side). */
export const SPREAD = 0.3;
/** How quickly effort follows what the bird needs (seconds to cover about two thirds of a change). */
export const EFFORT_SECONDS = 0.5;

/** The pose for a way of flying, at an effort from 0 (gliding: wings held open, body steady) to 1 (beating fully, as `activePose`). */
export function birdPose(look: WingLook, time: number, slug: string, effort = 1, flare = 0): Pose {
  const base = effortPose(look, time, slug, effort);
  if (flare <= 0 || look === "perch" || look === "held") return base;
  // landing: nose up, braking, quick high beats that never sweep fully down (back-pedalling onto the perch)
  const f = ease(Math.min(1, flare)), off = offsetOf(slug);
  const mix = (a: number, b: number) => a + (b - a) * f;
  return { wing: mix(base.wing, 0.55 + 0.4 * Math.cos(2 * Math.PI * (FLARE_HZ * time + off))), lift: mix(base.lift, 0), pitch: mix(base.pitch, 1), surge: mix(base.surge, -0.4), seat: 0 };
}
/** Beats per second while flaring to land. */
const FLARE_HZ = 9;

function effortPose(look: WingLook, time: number, slug: string, effort: number): Pose {
  const active = activePose(look, time, slug);
  if (look === "perch" || look === "held" || effort >= 1) return active;
  const off = offsetOf(slug), e = Math.max(0, effort);
  const soar: Pose = { wing: SPREAD + 0.03 * Math.sin(2 * Math.PI * (0.6 * time + off)), lift: 0.1 * Math.sin(2 * Math.PI * (0.25 * time + off)), pitch: 0, surge: 0, seat: 0 }; // tiny trims, no beats
  const mix = (a: number, b: number) => a + (b - a) * e;
  return { wing: mix(soar.wing, active.wing), lift: mix(soar.lift, active.lift), pitch: mix(soar.pitch, active.pitch), surge: mix(soar.surge, active.surge), seat: 0 };
}

/** Effort eases toward what the bird needs, so the wings never switch from gliding to beating at once. */
export const nextEffort = (current: number, needed: number, dt: number): number => needed + (current - needed) * Math.exp(-dt / EFFORT_SECONDS);

function activePose(look: WingLook, time: number, slug: string): Pose {
  const off = offsetOf(slug);
  switch (look) {
    case "perch": return { wing: FOLDED, lift: 0, pitch: 0, surge: 0, seat: 1 };
    case "held": return { wing: Math.cos(2 * Math.PI * (time * HELD_HZ + off)), lift: 0, pitch: 0, surge: 0, seat: 0 };
    case "flap": {
      const p = frac(time * FLAP_HZ + off), w = 2 * Math.PI * p;
      return { wing: stroke(p), lift: 0.35 * Math.sin(w - Math.PI / 2), pitch: 0.4 * Math.sin(w - Math.PI), surge: 0.6 * (1 - Math.cos(w)) - 0.6, seat: 0 }; // lunges on the downstroke
    }
    case "glide": {
      const at = frac(time / PERIOD + off) * PERIOD;
      const flapping = at < BURST;
      const p = frac((at / BURST) * CRUISE.flaps);
      const wave = 2 * Math.PI * (at / PERIOD) - Math.PI / 4; // one rise and fall per burst
      return { wing: flapping ? stroke(p) : FOLDED, lift: Math.sin(wave), pitch: Math.cos(wave), surge: flapping ? 0.5 * (1 - Math.cos(2 * Math.PI * p)) : 0, seat: 0 }; // each downstroke lunges it forward; at rest between beats
    }
  }
}

/** How long a change from one way of flying to another takes to blend in (seconds). */
export const BLEND_SECONDS = 0.35;
/** What the bird is doing now, what it was doing before (null: nothing), and when it changed. */
export type LookChange = { readonly look: WingLook; readonly from: WingLook | null; readonly since: number };

/** The pose, eased from the old way of flying into the new one over BLEND_SECONDS, so a bird never snaps from one pose to another. */
export function blendedPose(change: LookChange, time: number, slug: string, effort = 1, flare = 0): Pose {
  const now = birdPose(change.look, time, slug, effort, flare);
  const k = (time - change.since) / BLEND_SECONDS;
  if (!change.from || k >= 1) return now;
  const was = birdPose(change.from, time, slug, effort, flare), e = ease(Math.max(0, k));
  const mix = (a: number, b: number) => a + (b - a) * e;
  return { wing: mix(was.wing, now.wing), lift: mix(was.lift, now.lift), pitch: mix(was.pitch, now.pitch), surge: mix(was.surge, now.surge), seat: mix(was.seat, now.seat) };
}
