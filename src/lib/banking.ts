/** Pure: how a plane that can only bank so fast changes direction (the airplane).
 *  Speed eases toward cruise on its own. Only the sideways part of the steering turns the plane, so an edge ahead
 *  never brakes it: it banks away instead, at no more than `maxTurnRate`. */
import { type Vec, v, len } from "./vec";

export type Banking = {
  readonly cruise: number;
  /** How quickly speed eases back to cruise, per second. */
  readonly settle: number;
  /** Radians per second. */
  readonly maxTurnRate: number;
};

/** Slowest speed the turn is figured at, as a share of cruise, so a plane at a standstill doesn't spin on the spot. */
const MIN_TURN_SPEED = 0.5;

export function bank(velocity: Vec, steer: Vec, b: Banking, dt: number): Vec {
  const speed = len(velocity);
  const heading = speed > 1e-6 ? Math.atan2(velocity.y, velocity.x) : 0;
  const ux = Math.cos(heading), uy = Math.sin(heading);
  const push = len(steer);
  let sideways = ux * steer.y - uy * steer.x; // positive: the push lies toward a larger heading angle
  // Pushed from straight ahead or behind there is no sideways part to follow; commit to one direction rather than stall.
  if (ux * steer.x + uy * steer.y < 0 && Math.abs(sideways) < 0.25 * push) sideways = push;
  const rate = Math.max(-b.maxTurnRate, Math.min(b.maxTurnRate, sideways / Math.max(speed, MIN_TURN_SPEED * b.cruise)));
  const turned = heading + rate * dt;
  const newSpeed = speed + (b.cruise - speed) * Math.min(1, b.settle * dt);
  return v(Math.cos(turned) * newSpeed, Math.sin(turned) * newSpeed);
}
