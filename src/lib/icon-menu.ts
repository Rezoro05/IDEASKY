/** The icons on an open idea that open something below them: the comment form, the owner's update form, the removal question.
 *  Only one is open at a time. (Like is a saved state and share is a one-off, so neither is part of this.) */
export const PANELS = ["comment", "update", "remove"] as const;
export type Panel = (typeof PANELS)[number];

/** Opening one panel closes the others. */
export const panelsToClose = (opened: Panel): Panel[] => PANELS.filter((p) => p !== opened);
