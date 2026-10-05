/** The share icon on an open idea: shares a link that opens that idea (lib/idea-link).
 *  A short note next to the icon says what happened, then clears. */
import { shareLink, type ShareNav, type ShareOutcome } from "../boundaries/share";
import { SITE } from "../content/site";
import { byId } from "./dom";

export type Share = { open(ideaId: string): void; close(): void };

const NOTE: Record<ShareOutcome, string> = { shared: "", cancelled: "", copied: "Link copied", failed: "Couldn’t copy" };
const NOTE_MS = 2000;

export function startShare(opts: { linkTo: (ideaId: string) => string; nav: ShareNav; touchFirst?: () => boolean }): Share {
  const button = byId<HTMLButtonElement>("share-btn"), note = byId("share-status");
  const touchFirst = opts.touchFirst ?? (() => matchMedia("(pointer: coarse)").matches);
  let timer = 0, token = 0, shown: string | null = null;

  function say(text: string): void {
    clearTimeout(timer); note.textContent = text;
    if (text) timer = window.setTimeout(() => { note.textContent = ""; }, NOTE_MS);
  }

  button.addEventListener("click", async () => {
    if (!shown) return;
    const mine = token;
    const outcome = await shareLink({ title: SITE.name, url: opts.linkTo(shown) }, opts.nav, touchFirst());
    if (mine === token) say(NOTE[outcome]);
  });

  return { open(ideaId) { token++; shown = ideaId; say(""); }, close() { token++; shown = null; say(""); } };
}
