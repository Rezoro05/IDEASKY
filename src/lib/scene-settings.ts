/** The 3D backgrounds' settings: what the camera does, how the splats look, which deep-sea elements show.
 *  CONTROLS is the single list of what can be changed (the studio draws it; merging only lets these through, clamped). */

export const CAMERA_MODES = ["still", "drift", "parallax", "both"] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];
export const QUALITIES = ["auto", "low", "medium", "high"] as const;
export type Quality = (typeof QUALITIES)[number];
export const SEA_ELEMENTS = ["seabed", "rocks", "kelp", "jellies", "whale", "snow", "shafts"] as const;
export type SeaElement = (typeof SEA_ELEMENTS)[number];

export type Camera = {
  mode: CameraMode;
  /** How far the camera travels, in screen pixels. */
  range: number;
  speed: number;
  /** 0 = follows at once, near 1 = glides after the target. */
  smoothing: number;
  zoom: number;
  /** Looking up (+) or down (−), in degrees. */
  tilt: number;
  /** 0 = the camera slides (everything shifts); 1 = it turns to keep the middle of the scene in place. */
  turn: number;
};
export type Look = { depth: number; brightness: number; saturation: number; size: number; opacity: number; fog: number; blur: number };
export type Element = { on: boolean; amount: number; speed: number };
export type SceneSettings = { on: boolean; camera: Camera; look: Look };
export type Settings = {
  sky: SceneSettings & { water: Element };
  sea: SceneSettings & { elements: Record<SeaElement, Element> };
  quality: Quality;
};

const element = (amount = 1, speed = 1): Element => ({ on: true, amount, speed });

export const DEFAULTS: Settings = {
  sky: {
    on: true,
    camera: { mode: "both", range: 22, speed: 0.5, smoothing: 0.92, zoom: 1.04, tilt: 0, turn: 0.75 },
    look: { depth: 1, brightness: 1, saturation: 1, size: 1, opacity: 1, fog: 0.15, blur: 0 },
    water: element(1, 1),
  },
  sea: {
    on: true,
    camera: { mode: "both", range: 40, speed: 0.6, smoothing: 0.94, zoom: 1, tilt: 0, turn: 0.5 },
    look: { depth: 1, brightness: 1, saturation: 1, size: 1, opacity: 1, fog: 0.45, blur: 0 },
    elements: { seabed: element(), rocks: element(), kelp: element(1, 1), jellies: element(1, 1), whale: element(1, 1), snow: element(0.8, 1), shafts: element(1, 1) },
  },
  quality: "auto",
};

export type Tab = "sky" | "sea" | "deep" | "general";
export type Control =
  | { path: string; label: string; tab: Tab; kind: "toggle"; group?: string }
  | { path: string; label: string; tab: Tab; kind: "choice"; options: readonly string[]; group?: string }
  | { path: string; label: string; tab: Tab; kind: "range"; min: number; max: number; step: number; group?: string };

const ELEMENT_LABELS: Record<SeaElement, string> = { seabed: "Seabed", rocks: "Rock ridges", kelp: "Kelp", jellies: "Jellyfish", whale: "Whale", snow: "Marine snow", shafts: "Light shafts" };

function sceneControls(scene: "sky" | "sea"): Control[] {
  const p = (k: string) => `${scene}.${k}`, tab = scene;
  return [
    { path: p("on"), label: "3D background", tab, kind: "toggle" },
    { path: p("camera.mode"), label: "Camera", tab, kind: "choice", options: CAMERA_MODES, group: "Camera" },
    { path: p("camera.range"), label: "Range", tab, kind: "range", min: 0, max: 140, step: 1, group: "Camera" },
    { path: p("camera.speed"), label: "Drift speed", tab, kind: "range", min: 0.05, max: 3, step: 0.05, group: "Camera" },
    { path: p("camera.smoothing"), label: "Smoothing", tab, kind: "range", min: 0, max: 0.99, step: 0.01, group: "Camera" },
    { path: p("camera.turn"), label: "Turn vs slide", tab, kind: "range", min: 0, max: 1, step: 0.05, group: "Camera" },
    { path: p("camera.zoom"), label: "Zoom", tab, kind: "range", min: 0.8, max: 1.8, step: 0.01, group: "Camera" },
    { path: p("camera.tilt"), label: "Tilt", tab, kind: "range", min: -10, max: 10, step: 0.5, group: "Camera" },
    { path: p("look.depth"), label: "Depth", tab, kind: "range", min: 0, max: 3, step: 0.05, group: "Look" },
    { path: p("look.brightness"), label: "Brightness", tab, kind: "range", min: 0.3, max: 1.8, step: 0.01, group: "Look" },
    { path: p("look.saturation"), label: "Saturation", tab, kind: "range", min: 0, max: 2, step: 0.01, group: "Look" },
    { path: p("look.size"), label: "Splat size", tab, kind: "range", min: 0.4, max: 2.5, step: 0.01, group: "Look" },
    { path: p("look.opacity"), label: "Opacity", tab, kind: "range", min: 0, max: 1, step: 0.01, group: "Look" },
    { path: p("look.fog"), label: "Fog", tab, kind: "range", min: 0, max: 1, step: 0.01, group: "Look" },
    { path: p("look.blur"), label: "Blur", tab, kind: "range", min: 0, max: 8, step: 0.1, group: "Look" },
  ];
}
const elementControls = (path: string, label: string, tab: Tab): Control[] => [
  { path: `${path}.on`, label, tab, kind: "toggle", group: label },
  { path: `${path}.amount`, label: "Amount", tab, kind: "range", min: 0, max: 1, step: 0.01, group: label },
  { path: `${path}.speed`, label: "Speed", tab, kind: "range", min: 0, max: 3, step: 0.05, group: label },
];

export const CONTROLS: readonly Control[] = [
  ...sceneControls("sky"),
  ...elementControls("sky.water", "Water shimmer", "sky"),
  ...sceneControls("sea"),
  ...SEA_ELEMENTS.flatMap((e) => elementControls(`sea.elements.${e}`, ELEMENT_LABELS[e], "deep")),
  { path: "quality", label: "Quality", tab: "general", kind: "choice", options: QUALITIES },
];

type Tree = { [k: string]: unknown };
export function getPath(obj: unknown, path: string): unknown {
  let at: unknown = obj;
  for (const k of path.split(".")) { if (at === null || typeof at !== "object") return undefined; at = (at as Tree)[k]; }
  return at;
}
/** A copy of `obj` with `path` set to `value` (only the branch along the path is copied). */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const node = (obj ?? {}) as Tree;
  return { ...node, [head!]: rest.length ? setPath(node[head!], rest.join("."), value) : value } as T;
}

/** What a control accepts: the value made valid, or undefined if it can't be. */
export function accept(control: Control, value: unknown): unknown {
  if (control.kind === "toggle") return typeof value === "boolean" ? value : undefined;
  if (control.kind === "choice") return typeof value === "string" && control.options.includes(value) ? value : undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(control.max, Math.max(control.min, value));
}

/** `base` with every valid value from `input` laid over it. Unknown keys and bad values are ignored, numbers clamped. */
export function mergeSettings(base: Settings, input: unknown): Settings {
  let out = base;
  for (const c of CONTROLS) {
    const v = accept(c, getPath(input, c.path));
    if (v !== undefined) out = setPath(out, c.path, v);
  }
  return out;
}

/** Only what differs from the defaults: short enough to paste in a message. */
export function changedFrom(base: Settings, settings: Settings): Tree {
  let out: Tree = {};
  for (const c of CONTROLS) {
    const v = getPath(settings, c.path);
    if (v !== getPath(base, c.path)) out = setPath(out, c.path, v);
  }
  return out;
}

export const PRESETS: Record<string, unknown> = {
  "Calm": {},
  "Still": { sky: { camera: { mode: "still" } }, sea: { camera: { mode: "still" } } },
  "Drift": { sky: { camera: { mode: "drift", range: 40, speed: 0.6 } }, sea: { camera: { mode: "drift", range: 70, speed: 0.7 } } },
  "Parallax": { sky: { camera: { mode: "parallax", range: 50, smoothing: 0.9 } }, sea: { camera: { mode: "parallax", range: 80, smoothing: 0.9 } } },
  "Cinematic": {
    sky: { camera: { mode: "both", range: 60, speed: 0.35, zoom: 1.12, turn: 0.9 }, look: { depth: 1.6, fog: 0.3 } },
    sea: { camera: { mode: "both", range: 110, speed: 0.4, zoom: 1.1, turn: 0.8 }, look: { depth: 1.4, fog: 0.6 } },
  },
  "Picture only": { sky: { on: false }, sea: { on: false } },
};

/** A preset is a few changes on top of the defaults. */
export const presetSettings = (name: string): Settings => mergeSettings(DEFAULTS, PRESETS[name] ?? {});

export type Device = { width: number; cores: number; memory: number };
/** Splat detail (0..1) and the most device pixels per CSS pixel worth drawing, for a quality on this device. */
export function detailFor(quality: Quality, device: Device): { detail: number; pixelRatio: number } {
  const q = quality !== "auto" ? quality : device.width < 700 || device.cores <= 4 || device.memory <= 4 ? "low" : device.width >= 1800 && device.cores >= 8 ? "high" : "medium";
  return q === "low" ? { detail: 0.4, pixelRatio: 1 } : q === "medium" ? { detail: 0.7, pixelRatio: 1.5 } : { detail: 1, pixelRatio: 2 };
}
