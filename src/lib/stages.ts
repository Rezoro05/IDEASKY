/** Pure rules for an idea's life: Idea (0) → Implementation (–) → Live (1).
 *  Stored as names; the glyphs are only how they're shown. One ordered list decides next and previous. */

export const STAGES = ["idea", "implementation", "live"] as const;
export type Stage = (typeof STAGES)[number];

const GLYPH: Record<Stage, string> = { idea: "0", implementation: "–", live: "1" };
const LABEL: Record<Stage, string> = { idea: "Idea", implementation: "Implementation", live: "Live" };

export const isStage = (s: unknown): s is Stage => typeof s === "string" && (STAGES as readonly string[]).includes(s);
/** Anything unknown (old rows, bad data) is read as the first stage. */
export const stageOrIdea = (s: unknown): Stage => (isStage(s) ? s : "idea");

export const stageGlyph = (s: Stage): string => GLYPH[s];
export const stageLabel = (s: Stage): string => LABEL[s];

export const nextStage = (s: Stage): Stage | null => STAGES[STAGES.indexOf(s) + 1] ?? null;
export const previousStage = (s: Stage): Stage | null => (STAGES.indexOf(s) > 0 ? STAGES[STAGES.indexOf(s) - 1]! : null);

/** Ideas move one step at a time, forward or back. */
export const isOneStep = (from: Stage, to: Stage): boolean => Math.abs(STAGES.indexOf(from) - STAGES.indexOf(to)) === 1;

/** The question asked before a move. */
export const moveQuestion = (to: Stage): string => `Move this idea to ${LABEL[to]}?`;
