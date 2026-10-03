/** The stage of an open idea as a progress bar under its name. Everyone sees how far along it is; the owner drags the knob
 *  (or picks a stage with the keyboard or a click on its name) one stage at a time, and it moves at once, no question asked.
 *  States: viewing → (dragging →) moving → viewing (moved) | viewing with an error (not moved; the knob returns to the real stage).
 *  Closing the letter cancels. Every open gets a token, so an answer that arrives after the letter closed or switched is ignored. */
import { isStage, stageChoices, type Stage } from "../lib/stages";
import { fractionAt, knobFraction, settledStage, stageFraction } from "../lib/stage-bar";
import type { Idea } from "../lib/ideas";
import type { IdeaStore } from "../boundaries/ideaStore";
import { byId } from "./dom";

export type StagePanel = { open(idea: Idea): void; close(): void };

const MOVE_FAILED = "Couldn’t move it just now. Try again in a moment.";

export function startStagePanel(opts: { store: Promise<IdeaStore>; moved: (idea: Idea) => void }): StagePanel {
  const track = byId("stage-track"), error = byId("stage-error");
  const bar = track.querySelector<HTMLElement>(".stage-bar")!;
  const radios = [...track.querySelectorAll<HTMLInputElement>("input[type=radio]")];
  const labels = [...track.querySelectorAll<HTMLElement>("label[data-stage]")];
  let idea: Idea | null = null, owner = false, moving = false, dragging = false, pointer = 0, token = 0, store: IdeaStore | null = null;

  const placeKnob = (fraction: number): void => { track.style.setProperty("--pos", String(fraction)); };
  const markTarget = (stage: Stage | null): void => { for (const l of labels) l.classList.toggle("target", l.dataset.stage === stage); };

  function render(): void {
    if (!idea) return;
    const choices = stageChoices(idea.stage, owner);
    for (const r of radios) {
      const c = choices.find((x) => x.stage === r.value)!;
      r.checked = c.checked; r.disabled = !c.enabled;
    }
    track.classList.toggle("editable", owner);
    track.classList.remove("dragging");
    markTarget(null);
    placeKnob(stageFraction(idea.stage));
  }

  async function moveTo(to: Stage): Promise<void> {
    if (!idea || !store || moving || to === idea.stage) { render(); return; }
    const mine = token, from = idea;
    moving = true; error.hidden = true;
    placeKnob(stageFraction(to));
    const ok = await store.setStage(from, to);
    if (mine !== token) return;
    moving = false;
    if (ok) { idea = { ...from, stage: to }; opts.moved(idea); }
    else { error.textContent = MOVE_FAILED; error.hidden = false; }
    render();
  }

  /** The knob follows the pointer along the bar, no further than one stage from where the idea is; the stage it would settle on lights up. */
  function follow(e: PointerEvent): void {
    if (!idea) return;
    const rect = bar.getBoundingClientRect();
    pointer = fractionAt(e.clientX, rect.left, rect.width);
    placeKnob(knobFraction(idea.stage, pointer));
    markTarget(settledStage(idea.stage, pointer));
  }

  bar.addEventListener("pointerdown", (e) => {
    if (!idea || !owner || moving || e.button !== 0) return;
    dragging = true; track.classList.add("dragging");
    bar.setPointerCapture(e.pointerId);
    e.preventDefault();
    follow(e);
  });
  bar.addEventListener("pointermove", (e) => { if (dragging) follow(e); });
  bar.addEventListener("pointerup", () => {
    if (!dragging || !idea) return;
    dragging = false; track.classList.remove("dragging"); // the knob eases onto its stop
    void moveTo(settledStage(idea.stage, pointer));
  });
  bar.addEventListener("pointercancel", () => { dragging = false; render(); });

  track.addEventListener("change", (e) => {
    const to = (e.target as HTMLInputElement).value;
    if (isStage(to)) void moveTo(to);
  });

  return {
    async open(next) {
      const mine = ++token;
      idea = next; moving = false; dragging = false; error.hidden = true; owner = false;
      render();
      store = await opts.store;
      if (mine !== token) return;
      owner = store.ownsKey(next.id);
      render();
    },
    close() { token++; idea = null; moving = false; dragging = false; },
  };
}
