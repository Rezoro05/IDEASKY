/** About: clicking a stop on the path drops down its story. One panel; the same stop again closes it. On phones the panel sits under the stop. */
import { stopById } from "../content/stops";
import { stopPanelHtml } from "../lib/views";
import { byId } from "./dom";

const PHONE_LAYOUT = "(max-width: 760px)";

export function startPathPanel(follow: (target: string, from: DOMRect) => void): void {
  const panel = byId("stop-panel"), inner = byId("stop-inner"), line = document.querySelector<HTMLElement>(".lineage");
  if (!line) return;
  const narrow = matchMedia(PHONE_LAYOUT);
  let current: HTMLElement | null = null;
  const place = (btn: HTMLElement) => { if (narrow.matches) btn.closest("li")!.after(panel); else line.after(panel); };
  const close = () => { panel.classList.remove("open"); current?.setAttribute("aria-expanded", "false"); current = null; };

  document.querySelectorAll<HTMLElement>(".node-btn").forEach((btn) => btn.addEventListener("click", () => {
    if (current === btn) { close(); return; }
    current?.setAttribute("aria-expanded", "false");
    current = btn; btn.setAttribute("aria-expanded", "true");
    const stop = stopById(btn.dataset.stop!);
    if (!stop) return;
    inner.innerHTML = stopPanelHtml(stop);
    place(btn);
    panel.classList.remove("open"); void panel.offsetWidth; panel.classList.add("open"); // restart the drop-down
  }));
  narrow.addEventListener("change", () => { if (current) place(current); });

  // Links inside panels and the eConsul branches: go to a view or open an idea
  document.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>(".panel-link");
    if (b) follow(b.dataset.target!, b.getBoundingClientRect());
  });
}
