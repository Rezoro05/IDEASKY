/** Sharing a link: the phone's share sheet where there is one and the device is touch-first, otherwise the clipboard.
 *  Never throws; the outcome says what happened so the page can say it. */
export type ShareNav = {
  share?: (data: { title?: string; url: string }) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
};
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export async function shareLink(link: { title: string; url: string }, nav: ShareNav, touchFirst: boolean): Promise<ShareOutcome> {
  if (touchFirst && nav.share) {
    try { await nav.share(link); return "shared"; }
    catch (e) { if ((e as { name?: string })?.name === "AbortError") return "cancelled"; /* fall back to copying */ }
  }
  if (!nav.clipboard) return "failed";
  try { await nav.clipboard.writeText(link.url); return "copied"; } catch { return "failed"; }
}
