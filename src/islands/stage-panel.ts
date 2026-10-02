/** The stage of an open idea, and for its owner the buttons to move it one step, each asked first inside the letter.
 *  States: viewing → confirming → moving → viewing (moved) | viewing with an error (not moved). Closing the letter cancels.
 *  Every open gets a token, so an answer that arrives after the letter closed or switched is ignored. */
import { moveQuestion, nextStage, previousStage, stageLabel, type Stage } from "../lib/stages";
import type { Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import { byId } from "./dom";

export type StagePanel = { open(idea: Idea): void; close(): void };

const MOVE_FAILED = "Couldn’t move it just now. Try again in a moment.";

export function startStagePanel(opts: { store: Promise<IdeaStore>; moved: (idea: Idea) => void }): StagePanel {
  const track = byId("stage-track"), moves = byId("stage-moves"), back = byId<HTMLButtonElement>("stage-back"), forward = byId<HTMLButtonElement>("stage-forward");
  const confirm = byId("stage-confirm"), question = byId("stage-question"), yes = byId<HTMLButtonElement>("stage-yes"), cancel = byId<HTMLButtonElement>("stage-cancel"), error = byId("stage-error");
  let idea: Idea | null = null, owner = false, asking: Stage | null = null, token = 0, store: IdeaStore | null = null;

  function render(): void {
    if (!idea) return;
    for (const li of track.querySelectorAll<HTMLElement>("li")) {
      if (li.dataset.stage === idea.stage) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    }
    const prev = previousStage(idea.stage), next = nextStage(idea.stage);
    moves.hidden = !owner || asking !== null;
    back.hidden = !prev; forward.hidden = !next;
    back.textContent = prev ? `← ${stageLabel(prev)}` : ""; forward.textContent = next ? `→ ${stageLabel(next)}` : "";
    confirm.hidden = asking === null;
    question.textContent = asking ? moveQuestion(asking) : "";
  }

  function ask(to: Stage | null): void {
    if (!to) return;
    asking = to; error.hidden = true; render(); yes.focus();
  }
  back.addEventListener("click", () => ask(idea && previousStage(idea.stage)));
  forward.addEventListener("click", () => ask(idea && nextStage(idea.stage)));
  cancel.addEventListener("click", () => { asking = null; render(); (forward.hidden ? back : forward).focus(); });
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
