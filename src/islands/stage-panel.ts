/** The stage of an open idea as radios at the top of the letter. Visitors see them read-only; the owner picks the stage
 *  one step away, and the move is asked first in the "Your idea" row.
 *  States: viewing → confirming → moving → viewing (moved) | viewing with an error (not moved). Closing the letter cancels.
 *  Every open gets a token, so an answer that arrives after the letter closed or switched is ignored. */
import { isStage, moveQuestion, stageChoices, type Stage } from "../lib/stages";
import type { Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import { byId } from "./dom";

export type StagePanel = { open(idea: Idea): void; close(): void };

const MOVE_FAILED = "Couldn’t move it just now. Try again in a moment.";

export function startStagePanel(opts: { store: Promise<IdeaStore>; moved: (idea: Idea) => void }): StagePanel {
  const track = byId("stage-track"), radios = [...track.querySelectorAll<HTMLInputElement>("input[type=radio]")];
  const confirm = byId("stage-confirm"), question = byId("stage-question"), yes = byId<HTMLButtonElement>("stage-yes"), cancel = byId<HTMLButtonElement>("stage-cancel"), error = byId("stage-error");
  let idea: Idea | null = null, owner = false, asking: Stage | null = null, token = 0, store: IdeaStore | null = null;

  function render(): void {
    if (!idea) return;
    const choices = stageChoices(idea.stage, asking, owner);
    for (const r of radios) {
      const c = choices.find((x) => x.stage === r.value)!;
      r.checked = c.checked; r.disabled = !c.enabled;
    }
    track.classList.toggle("editable", owner);
    confirm.hidden = asking === null;
    question.textContent = asking ? moveQuestion(asking) : "";
  }

  track.addEventListener("change", (e) => {
    const to = (e.target as HTMLInputElement).value;
    if (!idea || !isStage(to) || to === idea.stage) return;
    asking = to; error.hidden = true; render(); yes.focus();
  });
  cancel.addEventListener("click", () => {
    asking = null; render();
    radios.find((r) => r.checked)?.focus();
  });
  yes.addEventListener("click", async () => {
    if (!idea || !asking || !store) return;
    const mine = token, to = asking, from = idea;
    yes.disabled = cancel.disabled = true;
    const ok = await store.setStage(from, to);
    yes.disabled = cancel.disabled = false;
    if (mine !== token) return;
    asking = null;
    if (ok) { idea = { ...from, stage: to }; opts.moved(idea); }
    else { error.textContent = MOVE_FAILED; error.hidden = false; }
    render();
  });

  return {
    async open(next) {
      const mine = ++token;
      idea = next; asking = null; error.hidden = true; owner = false;
      render();
      store = await opts.store;
      if (mine !== token) return;
      owner = store.ownsKey(next.id);
      render();
    },
    close() { token++; idea = null; asking = null; },
  };
}
