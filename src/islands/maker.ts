/** The round "R" at the bottom left: pressing it opens or closes the little "Folded by REZ · Send a note" card.
 *  A press anywhere else, or Escape, closes it. While the feedback note is open the card stays, so closing the note returns
 *  focus to "Send a note", where the visitor was. */
import { byId } from "./dom";

export function startMaker(): void {
  const button = byId<HTMLButtonElement>("maker-btn"), card = byId("maker-card"), maker = byId("maker"), note = byId("feedback");
  const isOpen = () => !card.hidden;
  function set(open: boolean): void {
    card.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }
  button.addEventListener("click", () => set(!isOpen()));
  document.addEventListener("pointerdown", (e) => {
    if (isOpen() && note.hidden && !maker.contains(e.target as Node)) set(false);
  }, true); // capture: seen before the note closes itself, so closing the note never closes the card too
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen() && note.hidden) { set(false); button.focus({ preventScroll: true }); }
  }, true);
}
