/** The 3D backgrounds and their studio: their own module, loaded only after the page is up (islands/app), so the first view
 *  doesn't wait for the splat renderer. They start once the picture is decoded and the page has had a moment; #studio opens their control center. */
import { SCENE_ON } from "../content/site";
import { settingsSource, startScenes, type Scenes } from "./scene";
import { DEFAULTS, mergeSettings, presetSettings } from "../lib/scene-settings";
import { startStudio } from "./studio";
import { byId } from "./dom";

export function startBackgrounds(opts: { /** The scenes exist (a change of board rebuilds them through this). */ started: (scenes: () => Scenes | null) => void }): void {
  const root = document.documentElement;
  const source = settingsSource(SCENE_ON ? DEFAULTS : presetSettings("Picture only"), mergeSettings);
  const picture = document.querySelector<HTMLImageElement>(".skyline");
  let scenes: Scenes | null = null;
  const mine = () => root.dataset.mode === "mine";
  const start = () => {
    if (scenes || !picture) return;
    scenes = startScenes({
      field: byId("field"), picture, clouds: document.querySelector(".clouds"), sea: byId("sea"), seaBefore: document.querySelector(".sea-light"), source,
      skyActive: () => root.dataset.depth !== "sea" && !root.classList.contains("sky-covered"),
      seaActive: () => root.dataset.depth === "sea" && !root.classList.contains("sky-covered"),
      seaKind: () => (mine() ? "wreck" : "deep"),
    });
  };
  opts.started(() => scenes);
  const whenIdle = (fn: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 300));
  if (picture) picture.decode().catch(() => undefined).then(() => whenIdle(start));
  let studioOpen = false;
  const openStudio = () => {
    if (studioOpen || location.hash !== "#studio") return;
    studioOpen = true;
    start();
    startStudio({ source, defaults: SCENE_ON ? DEFAULTS : presetSettings("Picture only"), status: () => scenes?.status() ?? [], closed: () => { studioOpen = false; } });
  };
  openStudio();
  addEventListener("hashchange", openStudio);
}
