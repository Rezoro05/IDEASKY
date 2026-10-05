/** Pure: how a bird flies. It glides, flaps over to a perch on a grid line, rests, and takes off again. It flees a moving mouse.
 *  States and their moves (see BirdState):
 *    gliding → approaching   its glide is over and a perch is free (none free: look again shortly)
 *    approaching → perched   it arrives, or → gliding if the pointer scares it off
 *    perched → takingOff     its rest is over, or the pointer has been close and moving for a moment
 *    takingOff → gliding     the take-off is over
 *  No clock and no DOM: time, the random source (seeded per bird and decision) and the pointer all come in. */
import { type Vec, v, add, sub, scale, len, clampLen } from "./vec";
import { mulberry32, seedFor, type Rand } from "./random";
import type { FlightConfig } from "./motion";
import type { BirdState, Plane, PointerInfo } from "./plane";
import { pickPerch } from "./perches";

/** Every number that sets the bird's pace and nerve, in one place. Times in seconds, distances in px. */
export const BIRD = {
  glide: [6, 14],
  rest: [4, 10],
  /** How long to wait before looking for a perch again when none was free. */
  retry: 2,
  takeOff: 1.2,
  /** How long the pointer must be close and moving before a perched bird takes off. */
  startle: 0.25,
  alarmRadius: 140,
  /** A pointer slower than this (px/s) frightens nothing. */
  alarmSpeed: 80,
  /** How hard the pointer pushes a bird right next to it (px/s²), fading to nothing at the alarm radius. */
  fleeAccel: 320,
  /** A scared bird's top speed, in cruise speeds: a fast sweep of the mouse beats it. */
  fleeSpeedScale: 2.2,
  approachScale: 1.2,
  /** Closest two perched (or perching) birds may be. */
  perchSpacing: 44,
  /** Close enough to the perch to land. */
  arrive: 3,
} as const;

export type BirdContext = {
  readonly dt: number;
  readonly time: number;
  readonly visitSeed: number;
  readonly bounds: { readonly width: number; readonly height: number };
  /** This form's flight settings (cruise speed, margin, throw damping). */
  readonly config: FlightConfig;
  /** Wandering, neighbours and edges, as for any gliding plane. */
  readonly steer: Vec;
  readonly pointer: PointerInfo | null;
  /** Perch spots already taken by other birds, perched or on their way. */
  readonly taken: readonly Vec[];
};

const decision = (plane: Plane, n: number, visitSeed: number): Rand => mulberry32(seedFor(`${plane.slug}#${n}`, visitSeed));
const between = (rand: Rand, [lo, hi]: readonly [number, number]): number => lo + rand() * (hi - lo);
type Gliding = Extract<BirdState, { mode: "gliding" }>;
const glide = (plane: Plane, n: number, time: number, visitSeed: number): Gliding =>
  ({ mode: "gliding", until: time + between(decision(plane, n, visitSeed), BIRD.glide), n: n + 1 });
const randomHeading = (rand: Rand): Vec => { const a = rand() * Math.PI * 2; return v(Math.cos(a), Math.sin(a)); };

/** The spot a bird has claimed (perched on, or flying to), if any. */
export const perchSpotOf = (plane: Plane): Vec | null =>
  plane.bird?.mode === "approaching" ? plane.bird.target : plane.bird?.mode === "perched" ? plane.position : null;

export const perchSpots = (planes: readonly Plane[], exceptSlug: string): Vec[] =>
  planes.flatMap((p) => { const spot = p.slug === exceptSlug ? null : perchSpotOf(p); return spot ? [spot] : []; });

/** A moving pointer close to the bird. */
export const isScaredBy = (position: Vec, pointer: PointerInfo | null): boolean =>
  pointer !== null && pointer.speed >= BIRD.alarmSpeed && len(sub(position, pointer.position)) < BIRD.alarmRadius;

const awayFrom = (position: Vec, pointer: PointerInfo): Vec => {
  const d = sub(position, pointer.position), l = len(d);
  return l > 1e-6 ? scale(d, 1 / l) : v(1, 0);
};

/** How the wings should look: still while gliding, beating while flying to a perch or taking off, folded on a perch. Null for anything that isn't a bird yet. */
export type WingLook = "glide" | "flap" | "perch";
export function wingLook(plane: Plane): WingLook | null {
  switch (plane.bird?.mode) {
    case "gliding": return "glide";
    case "approaching": case "takingOff": return "flap";
    case "perched": return "perch";
    default: return null;
  }
}

/** The bird was picked up. When it is let go it glides. */
export function grabbed(plane: Plane, time: number, visitSeed: number): Plane {
  return { ...plane, bird: glide(plane, plane.bird?.n ?? 0, time, visitSeed) };
}

export function flyBird(plane: Plane, ctx: BirdContext): Plane {
  const state = plane.bird ?? glide(plane, 0, ctx.time, ctx.visitSeed);
  const scared = isScaredBy(plane.position, ctx.pointer);
  switch (state.mode) {
    case "gliding": return gliding(plane, state, scared, ctx);
    case "approaching": return scared ? gliding(plane, glide(plane, state.n, ctx.time, ctx.visitSeed), true, ctx) : approaching(plane, state, ctx);
    case "perched": return perched(plane, state, scared, ctx);
    case "takingOff": return takingOff(plane, state, scared, ctx);
  }
}

/** Free flight: the usual steering plus, when scared, a push away from the pointer and a higher top speed. */
function drift(plane: Plane, scared: boolean, ctx: BirdContext): Vec {
  const { config, dt } = ctx;
  let push = v(0, 0);
  if (scared && ctx.pointer) {
    const fade = 1 - len(sub(plane.position, ctx.pointer.position)) / BIRD.alarmRadius;
    push = scale(awayFrom(plane.position, ctx.pointer), BIRD.fleeAccel * fade);
  }
  let velocity = add(plane.velocity, scale(add(ctx.steer, push), dt));
  if (len(velocity) > config.cruise * 1.5) velocity = scale(velocity, Math.exp(-config.throwDamping * dt));
  if (scared) velocity = clampLen(velocity, config.cruise * BIRD.fleeSpeedScale);
  return clampLen(velocity, config.maxSpeed);
}

const flown = (plane: Plane, velocity: Vec, bird: BirdState, dt: number): Plane =>
  ({ ...plane, position: add(plane.position, scale(velocity, dt)), velocity, bird });

function gliding(plane: Plane, state: Gliding, scared: boolean, ctx: BirdContext): Plane {
  const velocity = drift(plane, scared, ctx);
  if (ctx.time < state.until) return flown(plane, velocity, state, ctx.dt);
  const spot = pickPerch(decision(plane, state.n, ctx.visitSeed), ctx.bounds, ctx.config.boundsMargin, ctx.taken, BIRD.perchSpacing);
  const next: BirdState = spot ? { mode: "approaching", target: spot, n: state.n + 1 } : { mode: "gliding", until: ctx.time + BIRD.retry, n: state.n + 1 };
  return flown(plane, velocity, next, ctx.dt);
}

function approaching(plane: Plane, state: Extract<BirdState, { mode: "approaching" }>, ctx: BirdContext): Plane {
  const { dt, config } = ctx;
  const to = sub(state.target, plane.position), distance = len(to);
  const wanted = Math.max(8, Math.min(config.cruise * BIRD.approachScale, distance * 1.5)); // slows as it nears the perch
  const desired = distance > 1e-6 ? scale(to, wanted / distance) : v(0, 0);
  const velocity = add(plane.velocity, scale(sub(desired, plane.velocity), Math.min(1, 4 * dt)));
  if (distance <= BIRD.arrive || len(velocity) * dt >= distance) { // lands exactly on the line, never overshooting it
    const rest = between(decision(plane, state.n, ctx.visitSeed), BIRD.rest);
    return { ...plane, position: state.target, velocity: v(0, 0), bird: { mode: "perched", until: ctx.time + rest, alarm: 0, n: state.n + 1 } };
  }
  return flown(plane, velocity, state, dt);
}

function perched(plane: Plane, state: Extract<BirdState, { mode: "perched" }>, scared: boolean, ctx: BirdContext): Plane {
  const alarm = scared ? state.alarm + ctx.dt : 0;
  if (alarm < BIRD.startle && ctx.time < state.until) return { ...plane, velocity: v(0, 0), bird: { ...state, alarm } };
  const rand = decision(plane, state.n, ctx.visitSeed);
  const heading = scared && ctx.pointer ? awayFrom(plane.position, ctx.pointer) : randomHeading(rand);
  const speed = ctx.config.cruise * (scared ? BIRD.fleeSpeedScale * 0.8 : 1.3);
  return { ...plane, velocity: scale(heading, speed), bird: { mode: "takingOff", until: ctx.time + BIRD.takeOff, n: state.n + 1 } };
}

function takingOff(plane: Plane, state: Extract<BirdState, { mode: "takingOff" }>, scared: boolean, ctx: BirdContext): Plane {
  const velocity = drift(plane, scared, ctx);
  const next: BirdState = ctx.time < state.until ? state : glide(plane, state.n, ctx.time, ctx.visitSeed);
  return flown(plane, velocity, next, ctx.dt);
}
