/** Pure rules for an idea's life: Idea → In Progress → Live. (Stored as "implementation"; only the label changed.)
 *  One ordered list decides which moves are one step. */

export const STAGES = ["idea", "implementation", "live"] as const;
export type Stage = (typeof STAGES)[number];

const LABEL: Record<Stage, string> = { idea: "Idea", implementation: "In Progress", live: "Live" };

export const isStage = (s: unknown): s is Stage => typeof s === "string" && (STAGES as readonly string[]).includes(s);
/** Anything unknown (old rows, bad data) is read as the first stage. */
export const stageOrIdea = (s: unknown): Stage => (isStage(s) ? s : "idea");

export const stageLabel = (s: Stage): string => LABEL[s];

/** The form an idea takes in the sky. With stages hidden (the public board, owner's choice 2026-10-07) every idea is a bird,
 *  whatever stage is stored; the stages stay in the data for when they come back. */
export const shownStage = (s: Stage, stagesShown: boolean): Stage => (stagesShown ? s : "idea");

/** Ideas move one step at a time, forward or back. */
export const isOneStep = (from: Stage, to: Stage): boolean => Math.abs(STAGES.indexOf(from) - STAGES.indexOf(to)) === 1;


export type StageChoice = { stage: Stage; checked: boolean; enabled: boolean };

/** The stage radios: the current stage is checked. Only the owner may pick, and only a stage one step away (or the current one). */
export function stageChoices(current: Stage, owner: boolean): StageChoice[] {
  return STAGES.map((stage) => ({ stage, checked: stage === current, enabled: owner && (stage === current || isOneStep(current, stage)) }));
}
