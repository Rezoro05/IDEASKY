/** Catching a dream: a quick tap on a fish opens it; pressing and holding nets it (it stays put, wriggling) until it is tapped
 *  to open, or the water is tapped to let it go. Pure rules; the sea island measures the press. */

export const NET = {
  /** Holding a fish this long (ms) nets it. */
  holdMs: 450,
  /** A press that moves farther than this (px) is not a tap or a hold. */
  slack: 12,
} as const;

/** Should a press still going on net the fish now? */
export const netsNow = (heldMs: number, moved: number): boolean => heldMs >= NET.holdMs && moved <= NET.slack;

/** What letting go of a press on a fish does: open it, keep it in the net (it was just netted), or nothing (it slid away). */
export function fishRelease(p: { moved: number; nettedBefore: boolean; nettedDuring: boolean }): "open" | "keep" | "none" {
  if (p.moved > NET.slack) return "none";
  if (p.nettedBefore) return "open";
  if (p.nettedDuring) return "keep";
  return "open";
}

/** A tap on open water lets every netted fish go; a drag across the water doesn't. */
export const waterTapReleases = (moved: number): boolean => moved <= NET.slack;
