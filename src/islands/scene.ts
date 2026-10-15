/** The 3D backgrounds: the skyline in the sky and the deep sea below, each drawn as splats on a canvas behind everything else.
 *  They start after the page is up (the skyline picture shows first and stays if anything fails), run only while their world is in view
 *  and nothing covers it, and follow the studio's settings live (islands/studio). */
import { createSplatRenderer, type DrawUniforms, type SplatRenderer } from "../boundaries/splatGl";
import { GROUP, GROUP_COUNT, type SplatSet } from "../lib/splats";
import { skylineSplats } from "../lib/skyline-splats";
import { deepSea } from "../lib/deep-sea";
import { mulberry32 } from "../lib/random";
import { cameraTarget, focalFor, follow, modelView, placeScene, settled, STILL, viewFor, type Pointer, type Pose } from "../lib/scene-camera";
import { depthRow, depthSorter, needsResort, type DepthRow, type Sorter } from "../lib/splat-sort";
import { DEFAULTS, detailFor, SEA_ELEMENTS, type Element as Part, type SceneSettings, type Settings } from "../lib/scene-settings";
import type { Mat4 } from "../lib/mat4";

export type SettingsSource = { get(): Settings; subscribe(fn: (s: Settings) => void): void };

/** Where the scene sits, and where its fog starts (a share of the camera's distance to the picture plane). */
type Placement = { model: Mat4; fogFrom: number; push: DrawUniforms["push"] };
type SceneSpec = {
  name: "sky" | "sea";
  host: HTMLElement;
  /** Where the canvas goes in the host (it is inserted before this). */
  before: Element | null;
  scene: (s: Settings) => SceneSettings;
  build: (detail: number) => SplatSet | null;
  place: (width: number, height: number, s: Settings) => Placement;
  groups: (s: Settings) => { on: Float32Array; amount: Float32Array; speed: Float32Array };
  active: () => boolean;
  /** The camera moved: anything outside the canvas that should move with it (the sky's clouds). */
  moved?: (pose: Pose) => void;
  ready?: () => void;
  /** Build the splats a little after start, before the scene is first seen (the sea: ready before the first dive). */
  prepareAfterMs?: number;
};

export type SceneStatus = { name: string; fps: number; splats: number; running: boolean };

let pointer: Pointer = null;
if (typeof addEventListener === "function") {
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return; // a finger has no hover: phones drift instead
    pointer = { x: (e.clientX / innerWidth) * 2 - 1, y: (e.clientY / innerHeight) * 2 - 1 };
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointer = null; });
}

function device() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { width: innerWidth, cores: nav.hardwareConcurrency || 4, memory: nav.deviceMemory ?? 8 };
}

function startScene(spec: SceneSpec, source: SettingsSource): { status(): SceneStatus } {
  const canvas = document.createElement("canvas");
  canvas.className = `scene-canvas scene-${spec.name}`;
  canvas.setAttribute("aria-hidden", "true");
  spec.host.insertBefore(canvas, spec.before);
  let renderer: SplatRenderer | null = null, set: SplatSet | null = null, sorter: Sorter | null = null;
  let lastRow: DepthRow | null = null, builtDetail = -1, shown = false;
  let pose: Pose = STILL, clock = 0, last = 0, frame = 0, fps = 0, fpsFrames = 0, fpsSince = 0, lastDrawn = 0;
  let size = { w: spec.host.clientWidth, h: spec.host.clientHeight };
  new ResizeObserver(() => { size = { w: spec.host.clientWidth, h: spec.host.clientHeight }; lastRow = null; }).observe(spec.host);

  function ensureBuilt(s: Settings): boolean {
    const { detail } = detailFor(s.quality, device());
    if (detail === builtDetail && set) return true;
    renderer ??= createSplatRenderer(canvas);
    if (!renderer) return false;
    const next = spec.build(detail);
    if (!next) return false;
    set = next; builtDetail = detail; sorter = depthSorter(set.count); lastRow = null;
    renderer.upload(set);
    return true;
  }

  function tick(now: number): void {
    frame = 0;
    const s = source.get(), scene = spec.scene(s);
    if (!scene.on || !spec.active() || document.hidden) { last = 0; schedule(); return; }
    if (!ensureBuilt(s) || !renderer || renderer.lost || !set || !sorter) { canvas.remove(); return; } // the picture stays
    const { pixelRatio, detail } = detailFor(s.quality, device());
    const capMs = detail < 0.5 ? 1000 / 31 : 0; // slow devices: 30 frames a second is plenty for a background
    if (capMs && now - lastDrawn < capMs) { schedule(); return; }
    lastDrawn = now;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now; clock += dt;

    const ratio = Math.min(devicePixelRatio || 1, pixelRatio);
    renderer.resize(Math.max(1, Math.round(size.w * ratio)), Math.max(1, Math.round(size.h * ratio)));
    pose = follow(pose, cameraTarget(scene.camera, clock, pointer), dt, scene.camera.smoothing);
    spec.moved?.(pose);
    const view = viewFor(pose, scene.camera, size.w, size.h), place = spec.place(size.w, size.h, s), mv = modelView(view, place.model);
    const row = depthRow(mv);
    if (needsResort(lastRow, row)) { renderer.setOrder(sorter.sort(set.centers, row)); lastRow = row; }
    const { on, amount, speed } = spec.groups(s);
    canvas.style.setProperty("--scene-blur", `${scene.look.blur}px`);
    renderer.draw({
      modelView: mv, proj: view.proj, focal: view.focal * ratio, time: clock, on, amount, speed,
      size: scene.look.size, opacity: scene.look.opacity, brightness: scene.look.brightness, saturation: scene.look.saturation,
      fog: (scene.look.fog * 2.5) / focalFor(size.h), fogFrom: place.fogFrom * focalFor(size.h), push: place.push,
    });
    if (!shown) { shown = true; canvas.classList.add("shown"); spec.ready?.(); }
    fpsFrames++;
    if (now - fpsSince > 500) { fps = Math.round((fpsFrames * 1000) / (now - fpsSince)); fpsFrames = 0; fpsSince = now; }
    schedule();
  }
  function schedule(): void { if (!frame) frame = requestAnimationFrame(tick); }

  if (spec.prepareAfterMs !== undefined) setTimeout(() => { const s = source.get(); if (spec.scene(s).on) ensureBuilt(s); }, spec.prepareAfterMs);
  source.subscribe((s) => {
    const on = spec.scene(s).on;
    canvas.hidden = !on;
    spec.host.classList.toggle(`scene-${spec.name}-on`, on && shown);
    if (!on) spec.moved?.(STILL);
    lastRow = null;
    schedule();
  });
  schedule();
  return { status: () => ({ name: spec.name, fps, splats: set?.count ?? 0, running: !!frame && spec.active() && spec.scene(source.get()).on }) };
}

const elementGroups = (e: Part, k: number, out: { on: Float32Array; amount: Float32Array; speed: Float32Array }) => {
  out.on[k] = e.on ? 1 : 0; out.amount[k] = e.amount; out.speed[k] = e.speed;
};
const blankGroups = () => ({ on: new Float32Array(GROUP_COUNT), amount: new Float32Array(GROUP_COUNT), speed: new Float32Array(GROUP_COUNT) });

/** The skyline picture's pixels, sampled to `cols` across. Null when the picture isn't loaded or can't be read. */
function picturePixels(img: HTMLImageElement, cols: number): { data: Uint8ClampedArray; cols: number; rows: number } | null {
  if (!img.complete || !img.naturalWidth) return null;
  const rows = Math.round((cols * img.naturalHeight) / img.naturalWidth);
  try {
    const c = document.createElement("canvas");
    c.width = cols; c.height = rows;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, cols, rows);
    return { data: ctx.getImageData(0, 0, cols, rows).data, cols, rows };
  } catch { return null; }
}

export type Scenes = { status(): SceneStatus[] };

export function startScenes(opts: {
  field: HTMLElement; picture: HTMLImageElement; clouds: HTMLElement | null; sea: HTMLElement; seaBefore: Element | null;
  source: SettingsSource; skyActive: () => boolean; seaActive: () => boolean;
}): Scenes {
  const { field, picture, source } = opts;
  const sky = startScene({
    name: "sky", host: field, before: picture.parentElement?.nextElementSibling ?? null,
    scene: (s) => s.sky,
    build: (detail) => {
      const px = picturePixels(picture, Math.round(330 + 330 * (detail - 0.4) / 0.6));
      return px && skylineSplats(px, { imageWidth: picture.naturalWidth, imageHeight: picture.naturalHeight, horizon: 0.8, depth: 1, rand: mulberry32(7) });
    },
    place: (w, h, s) => {
      // The picture's own place on the page: bottom edge, full width, cover-fit into a box up to 62% of the height (as .skyline in site.css).
      const box = Math.min(0.62 * h, Math.max(0.4 * w, 340));
      const scale = Math.max(w / picture.naturalWidth, box / picture.naturalHeight);
      // Depth is given in the shader (push), along each splat's ray from the eye, so the model only scales and places the picture.
      return { model: placeScene(scale, 1, [0, -h / 2, 0]), fogFrom: 1, push: { eyeY: h / 2 / scale, eyeDistance: focalFor(h) / scale, depth: s.sky.look.depth } }; // only what lies behind the picture plane fades
    },
    // The picture is always on; its group's amount and speed are the water shimmer's (see the shader).
    groups: (s) => { const g = blankGroups(); elementGroups(s.sky.water, GROUP.skyline, g); g.on[GROUP.skyline] = 1; if (!s.sky.water.on) g.amount[GROUP.skyline] = 0; return g; },
    active: opts.skyActive,
    moved: (pose) => { if (opts.clouds) opts.clouds.style.transform = pose === STILL || settled(pose, STILL) ? "" : `translate3d(${(pose.x * 0.25).toFixed(1)}px, ${(-pose.y * 0.25).toFixed(1)}px, 0)`; },
    ready: () => field.classList.add("scene-sky-on"),
  }, source);

  const sea = startScene({
    name: "sea", host: opts.sea, before: opts.seaBefore,
    scene: (s) => s.sea,
    build: (detail) => deepSea(mulberry32(1913), detail),
    place: (_w, h, s) => ({ model: placeScene(h / 1000, s.sea.look.depth, [0, 0, 0]), fogFrom: 0.6, push: null }),
    groups: (s) => {
      const g = blankGroups();
      SEA_ELEMENTS.forEach((e) => elementGroups(s.sea.elements[e], GROUP[e], g));
      return g;
    },
    active: opts.seaActive,
    prepareAfterMs: 2500,
    ready: () => opts.sea.classList.add("scene-sea-on"),
  }, source);
  return { status: () => [sky.status(), sea.status()] };
}

const STORE_ITEM = "skyofideas.scene"; // its own key: the bird Motion Studio (not in this repo yet) keeps "skyofideas.studio"

/** Settings for this browser: the site's defaults, with the studio's saved changes on top. Saving is best-effort. */
export function settingsSource(defaults: Settings, merge: (base: Settings, input: unknown) => Settings): SettingsSource & { set(s: Settings): void; saved(): boolean; clear(): void } {
  let storage: Storage | null = null;
  try { storage = localStorage; } catch { storage = null; }
  let saved: unknown = null;
  try { saved = JSON.parse(storage?.getItem(STORE_ITEM) ?? "null"); } catch { saved = null; }
  let current = saved ? merge(defaults, saved) : defaults;
  const listeners: ((s: Settings) => void)[] = [];
  return {
    get: () => current,
    subscribe(fn) { listeners.push(fn); fn(current); },
    set(s) {
      current = s;
      try { storage?.setItem(STORE_ITEM, JSON.stringify(s)); } catch { /* private mode: lasts this visit */ }
      for (const fn of listeners) fn(current);
    },
    saved: () => { try { return !!storage?.getItem(STORE_ITEM); } catch { return false; } },
    clear() {
      try { storage?.removeItem(STORE_ITEM); } catch { /* none */ }
      current = defaults;
      for (const fn of listeners) fn(current);
    },
  };
}

export { DEFAULTS };
