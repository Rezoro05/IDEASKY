/** Pure: how each form of an idea flies. The sim looks a plane's settings up by its stage, so changing stage changes the flight and nothing else.
 *  Bird (idea, the first stage): its own states (lib/bird): glide, perch, rest, take off, flee; caught rather than tapped.
 *  Paper plane (in progress): free drift-and-steer flight. Airplane (live): faster, can only bank so fast, starts turning away from an edge early, leaves a trail. */
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
  /** Whether the form leaves a faint trail behind it (how long: FlightConfig.trailSeconds). */
  readonly trails: boolean;
};

export const FORM_FLIGHT: Record<Stage, FormFlight> = {
  idea: { kind: "bird", cruiseScale: 1, marginScale: 1, maxTurnRate: null, trails: false },
  implementation: { kind: "drift", cruiseScale: 1, marginScale: 1, maxTurnRate: null, trails: false },
  live: { kind: "banked", cruiseScale: 1.3, marginScale: 4, maxTurnRate: 0.6, trails: true },
};

/** The stage whose form is the bird (the one that is caught and has its own flight states), and the one whose form drifts freely. */
export const BIRD_STAGE = (Object.keys(FORM_FLIGHT) as Stage[]).find((s) => FORM_FLIGHT[s].kind === "bird")!;
export const DRIFT_STAGE = (Object.keys(FORM_FLIGHT) as Stage[]).find((s) => FORM_FLIGHT[s].kind === "drift")!;

/** The profile's flight settings, scaled for one form. For the paper plane every number comes back unchanged. */
export function configFor(config: FlightConfig, flight: FormFlight): FlightConfig {
  return { ...config, cruise: config.cruise * flight.cruiseScale, boundsMargin: config.boundsMargin * flight.marginScale };
}
