/** The stage of an open idea as a row of radios under its name. Visitors see it read-only; the owner picks the stage one step away
 *  and it moves at once, no question asked.
 *  States: viewing → moving → viewing (moved) | viewing with an error (not moved; the radios return to the real stage). Closing the letter cancels.
 *  Every open gets a token, so an answer that arrives after the letter closed or switched is ignored. */
import { isStage, stageChoices } from "../lib/stages";
import type { Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import { byId } from "./dom";

export type StagePanel = { open(idea: Idea): void; close(): void };

const MOVE_FAILED = "Couldn’t move it just now. Try again in a moment.";

export function startStagePanel(opts: { store: Promise<IdeaStore>; moved: (idea: Idea) => void }): StagePanel {
  const track = byId("stage-track"), radios = [...track.querySelectorAll<HTMLInputElement>("input[type=radio]")], error = byId("stage-error");
  let idea: Idea | null = null, owner = false, moving = false, token = 0, store: IdeaStore | null = null;

  function render(): void {
    if (!idea) return;
    const choices = stageChoices(idea.stage, owner);
    for (const r of radios) {
      const c = choices.find((x) => x.stage === r.value)!;
      r.checked = c.checked; r.disabled = !c.enabled;
    }
    track.classList.toggle("editable", owner);
  }

  track.addEventListener("change", async (e) => {
    const to = (e.target as HTMLInputElement).value;
    if (!idea || !store || moving || !isStage(to) || to === idea.stage) return;
    const mine = token, from = idea;
    moving = true; error.hidden = true;
    const ok = await store.setStage(from, to);
    if (mine !== token) return;
    moving = false;
    if (ok) { idea = { ...from, stage: to }; opts.moved(idea); }
    else { error.textContent = MOVE_FAILED; error.hidden = false; }
    render();
  });

  return {
    async open(next) {
      const mine = ++token;
      idea = next; moving = false; error.hidden = true; owner = false;
      render();
      store = await opts.store;
      if (mine !== token) return;
      owner = store.ownsKey(next.id);
      render();
    },
    close() { token++; idea = null; moving = false; },
  };
}
