/** The data the flight simulation moves around. Pure types, shared by the sim and the per-form flight models. */
import type { Vec } from "./vec";
import type { Stage } from "./stages";

/** What a bird is doing. Fleeing the pointer is not a state: it is a push that applies while gliding or taking off.
 *  `n` counts the decisions the bird has made, so each decision draws its own (seeded) random numbers. */
export type BirdState =
  | { readonly mode: "gliding"; readonly until: number; readonly n: number }
  | { readonly mode: "approaching"; readonly target: Vec; readonly n: number }
  | { readonly mode: "perched"; readonly until: number; /** Seconds the pointer has been close and moving. */ readonly alarm: number; readonly n: number }
  | { readonly mode: "takingOff"; readonly until: number; readonly n: number }
  /** In someone's hand. The first free frame after it takes off, with the speed the hand gave it. */
  | { readonly mode: "held"; readonly n: number };

export type Plane = {
  readonly slug: string;
  readonly stage: Stage;
  readonly position: Vec;
  readonly velocity: Vec;
  /** Only birds (stage "live") have one; it starts out unset and the bird model sets it on the first frame. */
  readonly bird?: BirdState;
};

/** The mouse, when there is one: where it is in the field and how fast it is moving (px/s). */
export type PointerInfo = { readonly position: Vec; readonly speed: number };
