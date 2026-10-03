/** Pure: how each form of an idea flies. The sim looks a plane's settings up by its stage, so changing stage changes the flight and nothing else.
 *  Paper plane (idea): today's flight, unchanged. Airplane (in progress): faster, can only bank so fast, and starts turning away from an edge early.
 *  Bird (live): flies like a paper plane until its own model arrives. */
import type { Stage } from "./stages";
import type { FlightConfig } from "./motion";

export type FormFlight = {
  /** Cruise speed relative to the paper plane's. */
  readonly cruiseScale: number;
  /** How early edge avoidance starts, relative to the paper plane's margin. A plane that turns wide needs more room. */
  readonly marginScale: number;
  /** Fastest the heading may change, in radians per second. null = free to turn (the paper plane's drift-and-steer flight). */
  readonly maxTurnRate: number | null;
};

export const FORM_FLIGHT: Record<Stage, FormFlight> = {
  idea: { cruiseScale: 1, marginScale: 1, maxTurnRate: null },
  implementation: { cruiseScale: 1.3, marginScale: 4, maxTurnRate: 0.6 },
  live: { cruiseScale: 1, marginScale: 1, maxTurnRate: null },
};

/** The profile's flight settings, scaled for one form. For the paper plane every number comes back unchanged. */
export function configFor(config: FlightConfig, flight: FormFlight): FlightConfig {
  return { ...config, cruise: config.cruise * flight.cruiseScale, boundsMargin: config.boundsMargin * flight.marginScale };
}
