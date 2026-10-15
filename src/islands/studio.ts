/** The studio: the owner's control center for the 3D backgrounds, at …/#studio. Hidden from visitors (nothing links to it).
 *  Every change shows at once and is kept in this browser; "Copy settings" gives the changes as text, to be made the site's defaults.
 *  Built from CONTROLS (lib/scene-settings), so a new setting shows up here by being added there. */
import { CONTROLS, PRESETS, accept, changedFrom, getPath, mergeSettings, setPath, type Control, type Settings, type Tab } from "../lib/scene-settings";
import type { SceneStatus, SettingsSource } from "./scene";

const TABS: { id: Tab; label: string; depth: "sky" | "sea" | null }[] = [
  { id: "sky", label: "Sky", depth: "sky" }, { id: "sea", label: "Sea", depth: "sea" }, { id: "deep", label: "Deep sea", depth: "sea" }, { id: "general", label: "General", depth: null },
];
const CAMERA_HELP: Record<string, string> = { still: "Holds still", drift: "Floats slowly by itself", parallax: "Leans toward the mouse (drifts on phones)", both: "Drifts and leans toward the mouse" };

const CSS = `
.studio { position: fixed; z-index: 60; top: 12px; right: 12px; bottom: 12px; width: min(340px, calc(100vw - 24px)); display: flex; flex-direction: column;
  background: rgba(12, 18, 30, .86); color: #E9EEF7; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.6);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); font: 400 13px/1.4 var(--font-body); overflow: hidden; }
.studio[data-min] { bottom: auto; }
.studio[data-min] .studio-body, .studio[data-min] .studio-foot, .studio[data-min] .studio-tabs { display: none; }
@media (max-width: 560px) { .studio { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 62svh; } }
.studio-head { display: flex; align-items: center; gap: 8px; padding: 12px 12px 10px 16px; }
.studio-title { font: 500 11px/1 var(--font-mono); letter-spacing: .12em; text-transform: uppercase; }
.studio-stat { margin-left: auto; font: 400 11px/1 var(--font-mono); color: rgba(233,238,247,.6); white-space: nowrap; }
.studio button { font: inherit; color: inherit; cursor: pointer; }
.studio-icon { width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; font-size: 16px !important; line-height: 1; }
.studio-icon:hover, .studio-icon:focus-visible { background: rgba(255,255,255,.1); outline: none; }
.studio-tabs { display: flex; gap: 2px; padding: 0 10px; border-bottom: 1px solid rgba(255,255,255,.1); }
.studio-tab { flex: 1; padding: 8px 4px 9px; border: 0; border-bottom: 2px solid transparent; background: none; color: rgba(233,238,247,.6) !important; font: 500 12px/1 var(--font-body) !important; }
.studio-tab[aria-selected="true"] { color: #fff !important; border-bottom-color: #8FA2FF; }
.studio-body { flex: 1; overflow: auto; padding: 6px 16px 14px; overscroll-behavior: contain; }
.studio-group { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.07); }
.studio-group:first-child { border-top: 0; margin-top: 4px; }
.studio-group h3 { margin: 0 0 6px; font: 500 10px/1 var(--font-mono); letter-spacing: .12em; text-transform: uppercase; color: rgba(233,238,247,.5); }
.studio-row { display: grid; grid-template-columns: 96px 1fr 44px; align-items: center; gap: 10px; min-height: 30px; }
.studio-row label { color: rgba(233,238,247,.85); }
.studio-row output { text-align: right; font: 400 11px/1 var(--font-mono); color: rgba(233,238,247,.7); }
.studio input[type=range] { width: 100%; accent-color: #8FA2FF; }
.studio-switch { grid-column: 2 / 4; justify-self: start; }
.studio input[type=checkbox] { width: 34px; height: 20px; appearance: none; border-radius: 10px; background: rgba(255,255,255,.18); position: relative; cursor: pointer; transition: background .2s; }
.studio input[type=checkbox]::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .2s; }
.studio input[type=checkbox]:checked { background: #5D73F5; }
.studio input[type=checkbox]:checked::after { transform: translateX(14px); }
.studio input:focus-visible { outline: 2px solid #8FA2FF; outline-offset: 2px; }
.studio-seg { grid-column: 2 / 4; display: flex; gap: 2px; padding: 2px; border-radius: 7px; background: rgba(255,255,255,.08); }
.studio-seg button { flex: 1; padding: 6px 2px; border: 0; border-radius: 5px; background: none; font-size: 12px !important; text-transform: capitalize; }
.studio-seg button[aria-pressed="true"] { background: #5D73F5; color: #fff; }
.studio-help { margin: 4px 0 0 106px; font-size: 11.5px; color: rgba(233,238,247,.55); }
.studio-foot { padding: 10px 16px 14px; border-top: 1px solid rgba(255,255,255,.1); }
.studio-presets { display: flex; flex-wrap: wrap; gap: 6px; }
.studio-presets button, .studio-actions button { padding: 6px 10px; border: 1px solid rgba(255,255,255,.18); border-radius: 6px; background: none; font-size: 12px !important; }
.studio-presets button:hover, .studio-actions button:hover { background: rgba(255,255,255,.08); }
.studio-actions { display: flex; gap: 6px; margin-top: 10px; }
.studio-actions .primary { background: #5D73F5; border-color: #5D73F5; color: #fff; }
.studio-copy { width: 100%; height: 76px; margin-top: 8px; padding: 6px 8px; resize: vertical; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: rgba(0,0,0,.3); color: #E9EEF7; font: 400 11px/1.4 var(--font-mono); }
.studio-note { margin: 8px 0 0; font-size: 11.5px; color: rgba(233,238,247,.55); }
`;

const fmt = (c: Control & { kind: "range" }, v: number) => (c.step >= 1 ? String(Math.round(v)) : v.toFixed(c.step >= 0.1 ? 1 : 2));
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e: HTMLElementTagNameMap[K] = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};

export function startStudio(opts: {
  source: SettingsSource & { set(s: Settings): void; clear(): void };
  defaults: Settings;
  status: () => SceneStatus[];
  closed: () => void;
}): void {
  const { source } = opts;
  if (!document.getElementById("studio-css")) document.head.append(el("style", { id: "studio-css", textContent: CSS }));
  const root = document.documentElement;
  let tab: Tab = root.dataset.depth === "sea" ? "sea" : "sky";

  const stat = el("span", { className: "studio-stat" });
  const minimize = el("button", { className: "studio-icon", type: "button", title: "Fold the studio", ariaLabel: "Fold the studio", textContent: "–" });
  const close = el("button", { className: "studio-icon", type: "button", title: "Close", ariaLabel: "Close the studio", textContent: "×" });
  const tabs = el("div", { className: "studio-tabs", role: "tablist" });
  const body = el("div", { className: "studio-body", role: "tabpanel" });
  const copyBox = el("textarea", { className: "studio-copy", readOnly: true, hidden: true, ariaLabel: "Settings to send" });
  const note = el("p", { className: "studio-note", textContent: "Changes show at once and stay in this browser. Copy settings and send them to make them everyone's." });
  const presets = el("div", { className: "studio-presets" }, ...Object.keys(PRESETS).map((name) => {
    const b = el("button", { type: "button", textContent: name });
    b.addEventListener("click", () => source.set(mergeSettings(opts.defaults, PRESETS[name])));
    return b;
  }));
  const copy = el("button", { type: "button", className: "primary", textContent: "Copy settings" });
  const reset = el("button", { type: "button", textContent: "Reset" });
  const panel = el("aside", { className: "studio", ariaLabel: "Studio: 3D background controls" },
    el("div", { className: "studio-head" }, el("span", { className: "studio-title", textContent: "Studio" }), stat, minimize, close),
    tabs, body,
    el("div", { className: "studio-foot" }, presets, el("div", { className: "studio-actions" }, copy, reset), copyBox, note));
  document.body.append(panel);

  // The studio's own scrolling, swiping and keys stay in the studio: the page would take them for a dive.
  for (const type of ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"]) panel.addEventListener(type, (e) => e.stopPropagation());

  const goTo = (depth: "sky" | "sea" | null) => {
    if (!depth || (root.dataset.depth === "sea") === (depth === "sea")) return;
    document.getElementById(depth === "sea" ? "dive-btn" : "surface-btn")?.click();
  };
  function drawTabs(): void {
    tabs.replaceChildren(...TABS.map((t) => {
      const b = el("button", { type: "button", className: "studio-tab", role: "tab", textContent: t.label });
      b.setAttribute("aria-selected", String(t.id === tab));
      b.addEventListener("click", () => { tab = t.id; drawTabs(); drawBody(); goTo(t.depth); });
      return b;
    }));
  }

  const change = (c: Control, value: unknown) => {
    const v = accept(c, value);
    if (v !== undefined) source.set(setPath(source.get(), c.path, v));
  };
  function row(c: Control): HTMLElement {
    const id = `studio-${c.path.replace(/\./g, "-")}`, value = getPath(source.get(), c.path);
    const label = el("label", { htmlFor: id, textContent: c.label });
    if (c.kind === "range") {
      const out = el("output", { textContent: fmt(c, value as number) });
      const input = el("input", { id, type: "range", min: String(c.min), max: String(c.max), step: String(c.step), value: String(value) });
      input.addEventListener("input", () => { out.textContent = fmt(c, Number(input.value)); change(c, Number(input.value)); });
      return el("div", { className: "studio-row" }, label, input, out);
    }
    if (c.kind === "toggle") {
      const input = el("input", { id, type: "checkbox", checked: value === true, className: "studio-switch" });
      input.addEventListener("change", () => { change(c, input.checked); drawBody(); });
      return el("div", { className: "studio-row" }, label, input);
    }
    const seg = el("div", { className: "studio-seg", role: "group", id });
    seg.setAttribute("aria-label", c.label);
    for (const option of c.options) {
      const b = el("button", { type: "button", textContent: option });
      b.setAttribute("aria-pressed", String(option === value));
      b.addEventListener("click", () => { change(c, option); drawBody(); });
      seg.append(b);
    }
    const wrap = el("div", {}, el("div", { className: "studio-row" }, el("span", { textContent: c.label }), seg));
    if (c.path.endsWith("camera.mode")) wrap.append(el("p", { className: "studio-help", textContent: CAMERA_HELP[String(value)] ?? "" }));
    return wrap;
  }
  function drawBody(): void {
    const groups = new Map<string, HTMLElement>();
    const keepScroll = body.scrollTop;
    body.replaceChildren();
    for (const c of CONTROLS.filter((c) => c.tab === tab)) {
      const name = c.group ?? "";
      let g = groups.get(name);
      if (!g) { g = el("section", { className: "studio-group" }, ...(name ? [el("h3", { textContent: name })] : [])); groups.set(name, g); body.append(g); }
      g.append(row(c));
    }
    body.scrollTop = keepScroll;
  }

  copy.addEventListener("click", async () => {
    const text = JSON.stringify(changedFrom(opts.defaults, source.get()), null, 1);
    copyBox.value = text === "{}" ? "{} (no changes from the site's defaults)" : text;
    copyBox.hidden = false;
    copyBox.select();
    try { await navigator.clipboard.writeText(text); copy.textContent = "Copied"; } catch { copy.textContent = "Select and copy"; }
    setTimeout(() => { copy.textContent = "Copy settings"; }, 1800);
  });
  reset.addEventListener("click", () => { source.clear(); copyBox.hidden = true; });
  minimize.addEventListener("click", () => { panel.toggleAttribute("data-min"); minimize.textContent = panel.hasAttribute("data-min") ? "+" : "–"; });
  close.addEventListener("click", () => {
    panel.remove(); clearInterval(timer); opts.closed();
    if (location.hash === "#studio") history.replaceState(null, "", location.pathname + location.search);
  });
  source.subscribe(() => { if (!body.contains(document.activeElement)) drawBody(); });

  const timer = setInterval(() => {
    const live = opts.status().filter((s) => s.running);
    stat.textContent = live.length ? live.map((s) => `${s.name} ${s.fps} fps · ${Math.round(s.splats / 1000)}k`).join("  ") : "paused";
  }, 500);
  drawTabs(); drawBody();
}
