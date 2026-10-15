/** Where the background camera wants to be, and how it gets there. Pure: time and the pointer in, a pose out.
 *  Units are screen pixels at the scene's picture plane (z = 0); the camera sits `focal` in front of it, so a still camera shows the scene 1:1. */
import type { Camera } from "./scene-settings";
import { lookAt, multiply, perspective, scaleThenMove, type Mat4, type V3 } from "./mat4";

export type Pose = { x: number; y: number; z: number };
/** Pointer position across the screen, −1 (left / top) … 1 (right / bottom); null when there is none (a phone). */
export type Pointer = { x: number; y: number } | null;

export const STILL: Pose = { x: 0, y: 0, z: 0 };
export const FOV = (50 * Math.PI) / 180;

/** A slow, never-repeating-looking float: a few sines at unrelated rates. */
export function drift(t: number, range: number, speed: number): Pose {
  const s = t * speed;
  return {
    x: range * (0.7 * Math.sin(s * 0.21) + 0.3 * Math.sin(s * 0.53 + 1.3)),
    y: range * 0.45 * Math.sin(s * 0.17 + 0.6),
    z: range * 0.6 * Math.sin(s * 0.11 + 2.1),
  };
}

/** The camera leans toward the pointer: right shows more of the right, a pointer up looks a little down onto the scene. */
export function parallax(pointer: Pointer, range: number): Pose {
  if (!pointer) return STILL;
  return { x: pointer.x * range, y: -pointer.y * range * 0.6, z: 0 };
}

export function cameraTarget(camera: Camera, t: number, pointer: Pointer): Pose {
  const { mode, range, speed } = camera;
  if (mode === "still") return STILL;
  if (mode === "drift") return drift(t, range, speed);
  // Without a pointer (a phone), parallax has nothing to follow: it drifts instead, so the scene still feels alive.
  if (mode === "parallax") return pointer ? parallax(pointer, range) : drift(t, range * 0.5, speed);
  const d = drift(t, range * 0.5, speed), p = parallax(pointer, range);
  return { x: d.x + p.x, y: d.y + p.y, z: d.z };
}

/** One step of easing from `current` toward `target`. `smoothing` is how much of the gap is kept per 60th of a second. */
export function follow(current: Pose, target: Pose, dt: number, smoothing: number): Pose {
  const k = 1 - Math.pow(Math.min(0.999, Math.max(0, smoothing)), dt * 60);
  return { x: current.x + (target.x - current.x) * k, y: current.y + (target.y - current.y) * k, z: current.z + (target.z - current.z) * k };
}

export const settled = (a: Pose, b: Pose, within = 0.05) => Math.abs(a.x - b.x) < within && Math.abs(a.y - b.y) < within && Math.abs(a.z - b.z) < within;

/** The distance from the camera to the picture plane that shows it at 1:1 for a screen this tall. */
export const focalFor = (height: number) => height / 2 / Math.tan(FOV / 2);

export type View = { view: Mat4; proj: Mat4; focal: number };
/** View and projection for a pose. `turn` 1 keeps the middle of the picture plane in place; 0 slides straight. */
export function viewFor(pose: Pose, camera: Pick<Camera, "zoom" | "tilt" | "turn">, width: number, height: number): View {
  const f = focalFor(height);
  const eye: V3 = [pose.x, pose.y, f + pose.z];
  const lookY = pose.y * (1 - camera.turn) + Math.tan((camera.tilt * Math.PI) / 180) * f;
  const target: V3 = [pose.x * (1 - camera.turn), lookY, 0];
  const zoomedFov = 2 * Math.atan(Math.tan(FOV / 2) / camera.zoom);
  return { view: lookAt(eye, target), proj: perspective(zoomedFov, width / height, 1, f * 12), focal: f * camera.zoom };
}

/** The model matrix that places a scene: uniform scale, depth stretched by `depth`, then moved. */
export const placeScene = (scale: number, depth: number, move: V3): Mat4 => scaleThenMove([scale, scale, scale * depth], move);

export const modelView = (view: View, model: Mat4): Mat4 => multiply(view.view, model);
