/** Pure: what a press on a plane comes to. Birds are caught by the press itself, and the cage decides their fate;
 *  paper planes and airplanes open on a tap and are thrown by a drag, as before. */
import type { Gesture } from "./gesture";
import { FORM_FLIGHT } from "./flight-forms";
import type { Stage } from "./stages";

/** open: show the idea. thrown: sent flying. caged: a bird dropped in the cage (show the idea). released: a bird let go outside it (it flies off). */
export type PressOutcome = "open" | "thrown" | "caged" | "released";

/** Only birds (new ideas, at the Idea stage) are caught, and a press on one catches it at once. */
export const isCatchable = (stage: Stage): boolean => FORM_FLIGHT[stage].kind === "bird";

export type PressEnd = {
  readonly stage: Stage;
  readonly gesture: Gesture;
  readonly overCage: boolean;
  /** The pointer was taken away (pointercancel) rather than let go: never opens or cages anything. */
  readonly canceled: boolean;
};

export function pressOutcome({ stage, gesture, overCage, canceled }: PressEnd): PressOutcome {
  if (isCatchable(stage)) return overCage && !canceled ? "caged" : "released";
  return gesture === "open" && !canceled ? "open" : "thrown";
}
