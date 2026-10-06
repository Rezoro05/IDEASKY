/** How one plane looks this frame: where it is, which way it faces, what a bird does with its wings, its trail.
 *  Pure: the sky passes in the plane and what it remembered from the last frame, and writes the answer to the page. */
import type { Plane } from "./plane";
import { landingFlare, wingEffort, wingLook, type WingLook } from "./bird";
import { blendedPose, nextEffort, type LookChange } from "./bird-pose";
import { birdOrientation, birdTransform } from "./bird-orientation";
import { orientationFor, orientationTransform, type Orientation } from "./orientation";
import { FORM_FLIGHT } from "./flight-forms";
import { TRAIL, extendTrail, tailPoint, type TrailPoint } from "./trail";
import { headingDeg, len } from "./vec";

/** Planes keep their last heading when they slow below this speed (px/s), so they don't spin in place. */
export const MIN_SPEED_FOR_HEADING = 6;
/** A bird puts its legs down for the last part of its landing flare. */
const LEGS_DOWN_FLARE = 0.5;

/** What the sky keeps per plane between frames, so the look changes smoothly. */
export type PlaneMemory = {
  readonly facing?: Orientation;
  /** A bird only: what it is doing with its wings and since when, so a change blends in. */
  readonly change?: LookChange;
  /** A bird only: how hard its wings work now; it eases toward what the flight needs. */
  readonly effort?: number;
  /** Airplanes only: the recent tail positions the trail is drawn from. */
  readonly trail?: readonly TrailPoint[];
};

export type ViewContext = { readonly time: number; readonly dt: number; readonly size: number; readonly birdCruise: number; readonly trailSeconds: number };

export type PlaneView = {
  /** CSS transform for the plane (its place in the field). */
  readonly place: string;
  /** CSS transform for the drawing inside it (facing, and a bird's body motion); null until it has a facing. */
  readonly body: string | null;
  /** A bird's wing look, for CSS (data-state); null for planes. */
  readonly look: WingLook | null;
  readonly legsDown: boolean;
  /** The wing hinge, 1 fully up to -1 fully down; null when there are no wings to set. */
  readonly wing: number | null;
  readonly memory: PlaneMemory;
};

export function planeView(plane: Plane, was: PlaneMemory, ctx: ViewContext): PlaneView {
  const facing = len(plane.velocity) > MIN_SPEED_FOR_HEADING ? orientationFor(headingDeg(plane.velocity), was.facing?.mirrored ?? false) : was.facing;
  const trail = FORM_FLIGHT[plane.stage].trails
    ? extendTrail(was.trail ?? [], tailPoint(plane.position, plane.velocity, ctx.size * TRAIL.tailOffset), ctx.time, ctx.trailSeconds)
    : undefined;
  const look = wingLook(plane);
  const change: LookChange | undefined = !look ? undefined : was.change?.look === look ? was.change : { look, from: was.change?.look ?? null, since: ctx.time };
  const effort = change ? nextEffort(was.effort ?? 1, wingEffort(plane, ctx.birdCruise), ctx.dt) : was.effort;
  const flare = landingFlare(plane);
  const pose = change ? blendedPose(change, ctx.time, plane.slug, effort, flare) : null;
  const shown = facing && look ? birdOrientation(facing, look === "perch" || look === "held") : facing; // a bird tilts only part of the way, and sits upright
  return {
    place: `translate3d(${plane.position.x}px, ${plane.position.y}px, 0)`,
    body: shown ? (pose ? birdTransform(shown, pose, ctx.size) : orientationTransform(shown)) : null,
    look,
    legsDown: flare > LEGS_DOWN_FLARE,
    wing: pose ? pose.wing : null,
    memory: { facing, change, effort, trail },
  };
}
