/** Pure: how each form of an idea flies. The sim looks a plane's settings up by its stage, so changing stage changes the flight and nothing else.
 *  Paper plane (idea): today's flight, unchanged. Airplane (in progress): faster, can only bank so fast, and starts turning away from an edge early.
 *  Bird (live): glides at the paper plane's speed and has its own states (lib/bird): perch, rest, take off, flee. */
import type { Stage } from "./stages";
import type { FlightConfig } from "./motion";

export type FormFlight = {
  /** Which flight rule the form uses: free drift (paper plane), banked turns (airplane), or the bird's own states. */
  readonly kind: "drift" | "banked" | "bird";
  /** Cruise speed relative to the paper plane's. */
  readonly cruiseScale: number;
  /** How early edge avoidance starts, relative to the paper plane's margin. A plane that turns wide needs more room. */
  readonly marginScale: number;
  /** Fastest the heading may change, in radians per second. null = free to turn (the paper plane's drift-and-steer flight). */
  readonly maxTurnRate: number | null;
};

export const FORM_FLIGHT: Record<Stage, FormFlight> = {
  idea: { kind: "drift", cruiseScale: 1, marginScale: 1, maxTurnRate: null },
  implementation: { kind: "banked", cruiseScale: 1.3, marginScale: 4, maxTurnRate: 0.6 },
  live: { kind: "bird", cruiseScale: 1, marginScale: 1, maxTurnRate: null },
};

/** The profile's flight settings, scaled for one form. For the paper plane every number comes back unchanged. */
export function configFor(config: FlightConfig, flight: FormFlight): FlightConfig {
  return { ...config, cruise: config.cruise * flight.cruiseScale, boundsMargin: config.boundsMargin * flight.marginScale };
}
