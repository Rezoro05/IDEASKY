/** Draws gaussian splats with WebGL2: each splat becomes a screen-facing ellipse, its shape projected from 3D, blended far to near.
 *  The splats live in GPU textures (uploaded once); each frame sends only the camera, the time and the look.
 *  Animation (water shimmer, kelp sway, jellyfish bob, the passing whale, falling snow, flickering light) runs in the vertex shader, by group.
 *  Never throws: no WebGL2 (or a failed shader) gives null, and the page keeps its picture. */
import { GROUP_COUNT, type SplatSet } from "../lib/splats";

export type DrawUniforms = {
  modelView: Float32Array; proj: Float32Array;
  /** Focal length in device pixels (how many pixels one unit at distance one covers). */
  focal: number;
  time: number;
  on: Float32Array; amount: Float32Array; speed: Float32Array; // per group
  size: number; opacity: number; brightness: number; saturation: number;
  /** How fast the far distance fades, per scene unit beyond `fogFrom` (a camera distance). 0 = clear. */
  fog: number; fogFrom: number;
  /** For a picture given depth (the skyline): the eye's height and distance in the scene's own units, and how much depth to give.
   *  Null for a scene built in 3D (the sea). */
  push: { eyeY: number; eyeDistance: number; depth: number } | null;
};

export type SplatRenderer = {
  upload(set: SplatSet): void;
  setOrder(order: Uint32Array): void;
  /** Match the drawing buffer to the canvas's size on screen (CSS pixels × ratio). */
  resize(width: number, height: number): void;
  draw(u: DrawUniforms): void;
  readonly lost: boolean;
};

const ROW = 2048; // texels per texture row

const VERT = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D u_data; uniform sampler2D u_color;
uniform mat4 u_modelView, u_proj;
uniform vec2 u_viewport; uniform float u_focal, u_time;
uniform float u_on[${GROUP_COUNT}], u_amount[${GROUP_COUNT}], u_speed[${GROUP_COUNT}];
uniform float u_size, u_opacity, u_bright, u_sat, u_fog, u_fogFrom;
uniform vec4 u_push; // (eye height, eye distance, depth, on): see DrawUniforms.push
in vec2 a_corner; in uint a_index;
out vec4 v_color; out vec2 v_pos;
vec4 texel(sampler2D s, uint k) { return texelFetch(s, ivec2(int(k % ${ROW}u), int(k / ${ROW}u)), 0); }
void cull() { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }
void main() {
  uint i = a_index;
  vec4 t0 = texel(u_data, i * 3u), t1 = texel(u_data, i * 3u + 1u), t2 = texel(u_data, i * 3u + 2u);
  vec4 col = texel(u_color, i);
  int g = int(t0.w + 0.5);
  float phase = t2.z, amp = t2.w, sp = u_speed[g], t = u_time;
  if (u_on[g] < 0.5 || (g != 0 && phase >= u_amount[g] * 6.2831853) || col.a < 0.004) { cull(); return; }
  vec3 p = t0.xyz; float alpha = col.a;
  if (g == 0) { p.x += amp * u_amount[0] * sin(t * sp * 1.3 + phase + p.y * 0.05); }
  else if (g == 3) { p.x += amp * sin(t * sp * 0.9 + phase); p.z += amp * 0.4 * cos(t * sp * 0.7 + phase); }
  else if (g == 4) { p.y += amp * sin(t * sp * 0.55 + phase); p.x += amp * 0.35 * sin(t * sp * 0.21 + phase); alpha *= 0.8 + 0.2 * sin(t * sp * 1.7 + phase); }
  else if (g == 5) { float span = 9000.0; p.x += mod(t * sp * 55.0 + phase * span, span) - span * 0.5; p.y += 18.0 * sin(t * 0.35); }
  else if (g == 6) { p.y = mod(p.y - t * sp * (7.0 + amp * 14.0) + 560.0, 1120.0) - 560.0; p.x += 5.0 * sin(t * 0.5 + phase); }
  else if (g == 7) { alpha *= 0.55 + 0.45 * sin(t * sp * 0.25 + phase); p.x += amp * sin(t * sp * 0.12 + phase); }

  float grow = 1.0;
  if (u_push.w > 0.5) { // a picture given depth: slide each splat along its ray from the eye, so a still camera still sees the picture
    p.z *= u_push.z;
    grow = (u_push.y - p.z) / u_push.y;
    p.x *= grow; p.y = u_push.x + (p.y - u_push.x) * grow;
  }
  vec4 cam = u_modelView * vec4(p, 1.0);
  if (cam.z > -1.0) { cull(); return; }
  vec4 clip = u_proj * cam;
  vec2 ndc = clip.xy / clip.w;
  if (abs(ndc.x) > 1.4 || abs(ndc.y) > 1.4) { cull(); return; }

  mat3 S = mat3(t1.x, t1.y, t1.z, t1.y, t1.w, t2.x, t1.z, t2.x, t2.y) * (u_size * u_size * grow * grow);
  mat3 M = mat3(u_modelView);
  float z = cam.z, f = u_focal;
  mat3 J = transpose(mat3(vec3(-f / z, 0.0, f * cam.x / (z * z)), vec3(0.0, -f / z, f * cam.y / (z * z)), vec3(0.0)));
  mat3 T = J * M;
  mat3 c = T * S * transpose(T);
  float a = c[0][0] + 0.3, b = c[0][1], d = c[1][1] + 0.3;
  float mid = 0.5 * (a + d), r = length(vec2(0.5 * (a - d), b));
  float l1 = mid + r, l2 = mid - r;
  if (l2 <= 0.0) { cull(); return; }
  vec2 axis = abs(b) < 1e-6 ? (a >= d ? vec2(1.0, 0.0) : vec2(0.0, 1.0)) : normalize(vec2(b, l1 - a));
  vec2 major = min(3.0 * sqrt(l1), 2048.0) * axis, minor = min(3.0 * sqrt(l2), 2048.0) * vec2(axis.y, -axis.x);
  gl_Position = vec4(ndc + (a_corner.x * major + a_corner.y * minor) * 2.0 / u_viewport, 0.0, 1.0);
  v_pos = a_corner * 3.0;

  vec3 rgb = col.rgb;
  float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(lum), rgb, u_sat) * u_bright;
  float fade = exp(-max(-z - u_fogFrom, 0.0) * u_fog); // the far distance thins into the page's own sky or sea
  alpha *= fade * u_opacity;
  v_color = vec4(rgb * alpha, alpha);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec4 v_color; in vec2 v_pos;
out vec4 outColor;
void main() {
  float d = dot(v_pos, v_pos);
  if (d > 9.0) discard;
  outColor = v_color * exp(-0.5 * d);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("splat shader:", gl.getShaderInfoLog(s)); return null; }
  return s;
}

export function createSplatRenderer(canvas: HTMLCanvasElement): SplatRenderer | null {
  let gl: WebGL2RenderingContext | null = null;
  try { gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }); }
  catch { gl = null; }
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT), fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs); gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "a_corner"); gl.bindAttribLocation(program, 1, "a_index");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.warn("splat program:", gl.getProgramInfoLog(program)); return null; }

  const loc = (name: string) => gl!.getUniformLocation(program, name);
  const U = {
    data: loc("u_data"), color: loc("u_color"), modelView: loc("u_modelView"), proj: loc("u_proj"), viewport: loc("u_viewport"),
    focal: loc("u_focal"), time: loc("u_time"), on: loc("u_on"), amount: loc("u_amount"), speed: loc("u_speed"),
    size: loc("u_size"), opacity: loc("u_opacity"), bright: loc("u_bright"), sat: loc("u_sat"), fog: loc("u_fog"), fogFrom: loc("u_fogFrom"), push: loc("u_push"),
  };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const indices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, indices);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 0, 0);
  gl.vertexAttribDivisor(1, 1);

  const dataTex = gl.createTexture(), colorTex = gl.createTexture();
  for (const tex of [dataTex, colorTex]) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  let count = 0, lost = false;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });

  return {
    get lost() { return lost || gl!.isContextLost(); },
    upload(set) {
      const g = gl!;
      count = set.count;
      const rows = Math.max(1, Math.ceil((count * 3) / ROW)), colorRows = Math.max(1, Math.ceil(count / ROW));
      const data = new Float32Array(rows * ROW * 4), colors = new Uint8Array(colorRows * ROW * 4);
      for (let i = 0; i < count; i++) {
        const o = i * 12;
        data[o] = set.centers[i * 3]!; data[o + 1] = set.centers[i * 3 + 1]!; data[o + 2] = set.centers[i * 3 + 2]!; data[o + 3] = set.groups[i]!;
        data[o + 4] = set.covs[i * 6]!; data[o + 5] = set.covs[i * 6 + 1]!; data[o + 6] = set.covs[i * 6 + 2]!; data[o + 7] = set.covs[i * 6 + 3]!;
        data[o + 8] = set.covs[i * 6 + 4]!; data[o + 9] = set.covs[i * 6 + 5]!; data[o + 10] = set.phases[i]!; data[o + 11] = set.amps[i]!;
        for (let k = 0; k < 4; k++) colors[i * 4 + k] = Math.round(Math.min(1, Math.max(0, set.colors[i * 4 + k]!)) * 255);
      }
      g.bindTexture(g.TEXTURE_2D, dataTex);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA32F, ROW, rows, 0, g.RGBA, g.FLOAT, data);
      g.bindTexture(g.TEXTURE_2D, colorTex);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, ROW, colorRows, 0, g.RGBA, g.UNSIGNED_BYTE, colors);
    },
    setOrder(order) {
      gl!.bindBuffer(gl!.ARRAY_BUFFER, indices);
      gl!.bufferData(gl!.ARRAY_BUFFER, order, gl!.DYNAMIC_DRAW);
    },
    resize(width, height) {
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    },
    draw(u) {
      const g = gl!;
      g.viewport(0, 0, canvas.width, canvas.height);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      if (!count) return;
      g.useProgram(program);
      g.bindVertexArray(vao);
      g.disable(g.DEPTH_TEST);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, dataTex); g.uniform1i(U.data, 0);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, colorTex); g.uniform1i(U.color, 1);
      g.uniformMatrix4fv(U.modelView, false, u.modelView);
      g.uniformMatrix4fv(U.proj, false, u.proj);
      g.uniform2f(U.viewport, canvas.width, canvas.height);
      g.uniform1f(U.focal, u.focal); g.uniform1f(U.time, u.time);
      g.uniform1fv(U.on, u.on); g.uniform1fv(U.amount, u.amount); g.uniform1fv(U.speed, u.speed);
      g.uniform1f(U.size, u.size); g.uniform1f(U.opacity, u.opacity); g.uniform1f(U.bright, u.brightness); g.uniform1f(U.sat, u.saturation);
      g.uniform1f(U.fog, u.fog); g.uniform1f(U.fogFrom, u.fogFrom);
      if (u.push) g.uniform4f(U.push, u.push.eyeY, u.push.eyeDistance, u.push.depth, 1); else g.uniform4f(U.push, 0, 1, 1, 0);
      g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, count);
    },
  };
}
