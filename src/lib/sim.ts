/** Pure flight simulation for the hero sky. No DOM, no clock: time comes in as `dt`. */
import { type Vec, v, add, sub, scale, len, clampLen } from "./vec";
import { mulberry32, seedFor } from "./random";
import type { FlightConfig } from "./motion";

export type Plane = { readonly slug: string; readonly position: Vec; readonly velocity: Vec };
export type World = { readonly planes: readonly Plane[]; readonly visitSeed: number; readonly time: number };
export type Bounds = { readonly width: number; readonly height: number };
export type Held = { readonly slug: string; readonly pointer: Vec };
export type StepInput = { dt: number; bounds: Bounds; held: Held | null; pausedSlugs: ReadonlySet<string> };
export type PlaneMode = "free" | "held" | "paused";

/** Longest step the sim takes in one go, so a slow frame can't tunnel planes through walls. */
export const MAX_DT = 0.05;
/** Planes never get closer than this to an edge of the field. */
export const EDGE_INSET = 8;

export function createWorld(slugs: readonly string[], visitSeed: number, bounds: Bounds, config: FlightConfig): World {
  const rand = mulberry32(visitSeed);
  const planes = slugs.map((slug) => {
    const angle = rand() * Math.PI * 2;
    return {
      slug,
      position: v(
        config.boundsMargin + rand() * Math.max(1, bounds.width - 2 * config.boundsMargin),
        bounds.height * 0.5 + rand() * Math.max(1, bounds.height * 0.5 - config.boundsMargin),
      ),
      velocity: v(Math.cos(angle) * config.cruise, Math.sin(angle) * config.cruise),
    };
  });
  return { planes, visitSeed, time: 0 };
}

export function modeOf(slug: string, input: Pick<StepInput, "held" | "pausedSlugs">): PlaneMode {
  if (input.held && input.held.slug === slug) return "held";
  return input.pausedSlugs.has(slug) ? "paused" : "free";
}

/** A gentle, plane-specific meander around the current heading. */
export function wanderSteer(plane: Plane, world: World, config: FlightConfig): Vec {
  const r = mulberry32(seedFor(plane.slug, world.visitSeed));
  const p1 = r() * 6.28, p2 = r() * 6.28, f1 = 0.13 + r() * 0.1, f2 = 0.31 + r() * 0.15;
  const heading = Math.atan2(plane.velocity.y, plane.velocity.x);
  const turn = (Math.sin(world.time * f1 + p1) + 0.6 * Math.sin(world.time * f2 + p2)) * 0.9;
  const desired = v(Math.cos(heading + turn * 0.05), Math.sin(heading + turn * 0.05));
  return scale(sub(scale(desired, config.cruise), plane.velocity), config.wanderStrength);
}

/** Push away from planes inside the shield radius, harder the closer they are. */
export function separationSteer(plane: Plane, others: readonly Plane[], config: FlightConfig): Vec {
  let push = v(0, 0);
  for (const o of others) {
    const d = sub(plane.position, o.position), dist = len(d);
    if (dist > 0.001 && dist < config.shieldRadius) {
      push = add(push, scale(d, (((config.shieldRadius - dist) / config.shieldRadius) * 90) / dist));
    }
  }
  return push;
}

/** A soft spring back inside the margin. */
export function boundsSteer(plane: Plane, bounds: Bounds, config: FlightConfig): Vec {
  const m = config.boundsMargin, k = 3;
  let fx = 0, fy = 0;
  if (plane.position.x < m) fx = (m - plane.position.x) * k;
  else if (plane.position.x > bounds.width - m) fx = (bounds.width - m - plane.position.x) * k;
  if (plane.position.y < m) fy = (m - plane.position.y) * k;
  else if (plane.position.y > bounds.height - m) fy = (bounds.height - m - plane.position.y) * k;
  return v(fx, fy);
}

/** The hard wall: clamp inside the field and bounce at half speed. */
export function containWithin(plane: Plane, bounds: Bounds): Plane {
  let { x, y } = plane.position, { x: vx, y: vy } = plane.velocity;
  const right = bounds.width - EDGE_INSET, bottom = bounds.height - EDGE_INSET;
  if (x < EDGE_INSET) { x = EDGE_INSET; vx = Math.abs(vx) * 0.5; } else if (x > right) { x = right; vx = -Math.abs(vx) * 0.5; }
  if (y < EDGE_INSET) { y = EDGE_INSET; vy = Math.abs(vy) * 0.5; } else if (y > bottom) { y = bottom; vy = -Math.abs(vy) * 0.5; }
  return { ...plane, position: v(x, y), velocity: v(vx, vy) };
}

export function step(world: World, input: StepInput, config: FlightConfig): World {
  const dt = Math.min(input.dt, MAX_DT);
  const planes = world.planes.map((plane) => {
    const mode = modeOf(plane.slug, input);
    if (mode === "held" && input.held) {
      const moved = scale(sub(input.held.pointer, plane.position), 1 / Math.max(dt, 1e-3));
      return { ...plane, position: input.held.pointer, velocity: add(scale(plane.velocity, 0.6), scale(moved, 0.4)) };
    }
    if (mode === "paused") return plane;
    const others = world.planes.filter((o) => o.slug !== plane.slug);
    const steer = add(add(wanderSteer(plane, world, config), separationSteer(plane, others, config)), boundsSteer(plane, input.bounds, config));
    let velocity = add(plane.velocity, scale(steer, dt));
    if (len(velocity) > config.cruise * 1.5) velocity = scale(velocity, Math.exp(-config.throwDamping * dt));
    velocity = clampLen(velocity, config.maxSpeed);
    return containWithin({ ...plane, position: add(plane.position, scale(velocity, dt)), velocity }, input.bounds);
  });
  return { ...world, planes, time: world.time + dt };
}

export function addPlane(world: World, plane: Plane): World {
  return { ...world, planes: world.planes.filter((p) => p.slug !== plane.slug).concat(plane) };
}

export function removePlane(world: World, slug: string): World {
  return { ...world, planes: world.planes.filter((p) => p.slug !== slug) };
}
