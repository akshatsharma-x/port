"use client";

import { PerformanceMonitor } from "@react-three/drei/core/PerformanceMonitor";
import { advance, createPortal, createRoot, useFrame, useThree } from "@react-three/fiber";
import { Fragment, useLayoutEffect, useState, type ComponentType } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  HalfFloatType,
  Mesh as ThreeMesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RedFormat,
  RGFormat,
  Scene,
  setConsoleFunction,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
  type Texture,
} from "three";
import { useStore } from "zustand";
import { STAGE_FX, stageTheme, type StageTheme } from "@/lib/fx-stage";
import { DITHER } from "@/lib/dither";
import { createGlContext, releaseGlContext } from "@/lib/gl";
import { yieldToMain } from "@/lib/yield";
import { artifact, duration, hashSeed, rng, sec } from "@/lib/motion";
import { governor, GOVERNOR, type ProbeRecord, type RenderJob, type RenderResult, type StageRuntime } from "@/lib/sceneManager";
import { createEngine } from "@/lib/governor-engine";
import { scrollSignal } from "@/lib/scroll";
import { percentile } from "@/lib/stats";
import { DPR_RULES, initialDpr, stepDpr, TIER_RULES, TIERS, tierAfterProbe, type SceneId, type Tier } from "@/lib/tier";
import { HERO } from "@/lib/hero";
import { NOISE_GLSL } from "@/shaders/hero";
import { blueNoise, StagePost, themeBackground } from "./post";
import { createSceneHandle, SceneContext, stepScene, tokenColor, type SceneHandle, type SceneProps } from "./scene-api";

/**
 * The stage runtime — the lazy chunk with three.js and R3F (DESIGN.md §4.1, §8.3 ≤ 250 KB gz).
 *
 * One R3F root on the one persistent #stage canvas. It uses R3F's createRoot rather than <Canvas>:
 * <Canvas> registers the entire THREE namespace (extend(THREE)), which defeats tree-shaking and the
 * §8.3 budget; createRoot is the same root and the same advance() loop, and each scene extends only
 * the classes it uses. frameloop "never": the governor calls advance() only when a frame is due.
 */

const ZERO: RenderResult = { calls: 0, triangles: 0, points: 0, lines: 0 };

/**
 * R3F 9 creates a THREE.Clock in every root's store, and three r183+ deprecates Clock with a
 * console warning we can't act on. That one upstream line is dropped; everything else three says
 * reaches the console unchanged.
 */
const UPSTREAM_NOISE = /^THREE\.Clock: This module has been deprecated/;
setConsoleFunction((type, message, ...params) => {
  if (type === "warn" && UPSTREAM_NOISE.test(message)) return;
  const trace = params[0] as { isStackTrace?: boolean; getError?: (m: string) => unknown } | undefined;
  if (trace?.isStackTrace && trace.getError) console[type](trace.getError(message));
  else console[type](message, ...params);
});

interface RuntimeCore {
  renderer: WebGLRenderer;
  handles: Map<SceneId, SceneHandle>;
  job: { handle: SceneHandle; job: RenderJob } | null;
  timer: GpuTimer;
  /** DITHER RESOLVE in flight */
  resolves: ResolveBook;
  /** the post chain, built for the current tier and theme on first use */
  post: PostBook;
}

/**
 * The shared post chain (DESIGN.md §4.1: render targets and blue noise upload once). Built on the
 * first frame a post scene draws, for the tier and theme of that frame; Phosphor ↔ Amber changes
 * constants only, a move to or from Paper (or a tier change) builds the other chain.
 */
class PostBook {
  private chain: StagePost | null = null;
  private noise: { texture: Texture } | null = null;
  private theme: StageTheme | null = null;
  private readonly bg = new Color();
  get(renderer: WebGLRenderer): { post: StagePost; bg: Color; theme: StageTheme } | null {
    const tier = governor.snapshot.tier;
    if (!tier || tier === "OFF" || governor.dev.post === false) return null;
    const theme = stageTheme(document.documentElement.dataset.theme);
    this.noise ??= blueNoise(() => {
      if (this.noise) this.chain?.setNoise(this.noise.texture);
      governor.invalidate();
    });
    if (!this.chain || this.chain.key !== StagePost.keyFor(tier, theme)) {
      this.chain?.dispose();
      this.chain = new StagePost(renderer, tier, theme, this.noise.texture);
      this.theme = null;
    }
    if (this.theme !== theme) {
      this.theme = theme;
      this.chain.retheme(theme);
      themeBackground(this.bg);
    }
    return { post: this.chain, bg: this.bg, theme };
  }
  /** Debug: see StagePost.vramBytes. */
  vramBytes(): number {
    return this.chain?.vramBytes() ?? 0;
  }
  /** Debug: see StagePost.ground. */
  ground(renderer: WebGLRenderer): { cleared: number[]; ground: number[] } | null {
    return this.chain?.ground(renderer) ?? null;
  }
  /** context loss / teardown: every target and program is gone with the context */
  release(): void {
    this.chain?.dispose();
    this.chain = null;
    this.theme = null;
  }
}

/**
 * DITHER RESOLVEs in flight, per scene: start (R3F clock, s) and origin (0–1, GL y-up), plus the
 * offscreen pass they share — made on demand, disposed when the last one lands. (Methods, so the
 * render loop mutates through calls rather than through its props.)
 */
class ResolveBook {
  private entries = new Map<SceneId, { start: number; origin: [number, number] }>();
  private pass: Resolver | null = null;
  begin(id: SceneId, start: number, origin: [number, number]): void {
    this.entries.set(id, { start, origin });
  }
  get(id: SceneId) {
    return this.entries.get(id);
  }
  has(id: SceneId): boolean {
    return this.entries.has(id);
  }
  end(id: SceneId): void {
    this.entries.delete(id);
    if (this.entries.size === 0) this.release();
  }
  resolver(): Resolver {
    this.pass ??= new Resolver();
    return this.pass;
  }
  release(): void {
    this.pass?.dispose();
    this.pass = null;
  }
  /** context loss: the scenes re-resolve from their posters once restored */
  clear(): void {
    this.entries.clear();
    this.release();
  }
}

export interface RuntimeHandle {
  /** the tier the probe settled on */
  tier: Tier;
  resize(width: number, height: number): void;
  setDpr(dpr: number): void;
  destroy(): void;
  /** debug: WEBGL_lose_context */
  loseContext(): void;
  restoreContext(): void;
}

export interface RuntimeOptions {
  width: number;
  height: number;
  deviceDpr: number;
  tier: Tier;
  /** run the boot probe (HIGH/MID only) */
  probe: boolean;
}

export async function startRuntime(canvas: HTMLCanvasElement, opts: RuntimeOptions): Promise<RuntimeHandle> {
  // the literal lives only in this chunk: scripts/boot-manifest.mjs finds the runtime's chunks by it
  canvas.dataset.runtime = "retrograde:stage-runtime";
  const attributes: WebGLContextAttributes = { alpha: true, antialias: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" };
  const context = createGlContext("stage", canvas, attributes);
  if (!context) throw new Error("WebGL2 context creation failed");
  const renderer = new WebGLRenderer({ canvas, context, ...attributes });
  renderer.info.autoReset = false;
  renderer.setClearAlpha(0);
  const lose = context.getExtension("WEBGL_lose_context");
  await yieldToMain();

  const core: RuntimeCore = { renderer, handles: new Map(), job: null, timer: new GpuTimer(context), resolves: new ResolveBook(), post: new PostBook() };
  const root = createRoot(canvas);
  await root.configure({ gl: renderer, frameloop: "never", flat: true, dpr: initialDpr(opts.tier, opts.deviceDpr), size: { width: opts.width, height: opts.height, top: 0, left: 0 } });
  await yieldToMain();
  const store = root.render(<RuntimeTree core={core} />);
  await yieldToMain();

  // three's own listener has already called preventDefault(). While the context is lost every GL call
  // is a silent no-op, so this is the moment to drop three's records of the old GPU objects: after a
  // restore, disposing them would delete objects the new context doesn't own.
  const onLost = () => {
    // dispose while the context is lost (deletes are silent then): disposing these after the
    // restore would hand the new context the old one's objects (INVALID_OPERATION warnings).
    // Everything, uniform textures included: no GPU object survives the context, and three
    // re-uploads each from its JS-side data on next use (Part 7: an atlas left out here was
    // deleted after the restore by the old context's listener)
    for (const h of core.handles.values()) disposeTree(h.scene, { uniforms: true });
    core.resolves.clear();
    core.post.release();
    core.timer.reset();
    governor.contextLost();
  };
  const onRestored = () => {
    core.timer.reset();
    governor.contextRestored();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  // The boot probe: the hero's load at the provisional tier, demoting until it holds (§4.2).
  let tier = opts.tier;
  if (opts.probe) {
    while (tier === "HIGH" || tier === "MID") {
      const result = await probe(renderer, tier, opts);
      governor.recordProbe(result);
      const next = tierAfterProbe(tier, result.p90Ms);
      if (next === tier) break;
      tier = next;
    }
  }
  if (tier !== opts.tier) store.getState().setDpr(initialDpr(tier, opts.deviceDpr));

  const adapter: StageRuntime = {
    async warm(id) {
      const h = core.handles.get(id);
      if (!h) throw new Error(`scene "${id}" isn't mounted`);
      const t0 = performance.now();
      await renderer.compileAsync(h.scene, h.camera);
      uploadWithoutDrawing(renderer, h.scene, h.camera);
      return { ms: performance.now() - t0, vramBytes: sceneBytes(h.scene) };
    },
    render(job) {
      const handle = core.handles.get(job.id);
      if (!handle) return ZERO;
      if (job.resolve) core.resolves.begin(job.id, job.time, [job.resolve.x, 1 - job.resolve.y]);
      core.timer.poll((ms) => governor.recordGpuMs(ms));
      renderer.info.reset();
      core.job = { handle, job };
      advance(job.time);
      core.job = null;
      const r = renderer.info.render;
      return { calls: r.calls, triangles: r.triangles, points: r.points, lines: r.lines };
    },
    // a resolve in flight needs every frame, even for a scene at rest
    animating: (id) => (core.handles.get(id)?.isAnimating() ?? false) || core.resolves.has(id),
    memory: () => ({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length ?? 0 }),
    framebufferBytes: () => {
      const s = renderer.getDrawingBufferSize(new Vector2());
      return s.x * s.y * (4 * 2 + 4); // RGBA8 front + back, 32-bit depth
    },
  };
  // the governor's scene scheduler comes with the runtime, never in first-load JS (§8.3, v2.3)
  governor.attachEngine(createEngine);
  governor.attachRuntime(adapter);
  governor.dev.sceneTime = (id) => core.handles.get(id)?.time ?? null;
  governor.dev.postGround = () => core.post.ground(renderer);
  governor.dev.postBytes = () => core.post.vramBytes();
  governor.dev.bench = async (id, frames) => {
    const handle = core.handles.get(id);
    if (!handle) return null;
    const { width, height } = handle.size;
    const dpr = renderer.getPixelRatio();
    // the frames draw into `target` (or the post chain's own output), and the read-back comes from
    // there: ANGLE only waits for the work that writes the framebuffer it reads
    const target = new WebGLRenderTarget(Math.round(width * dpr), Math.round(height * dpr), { type: HalfFloatType });
    const chain = handle.post ? core.post.get(renderer) : null;
    const frame = chain ? { bg: chain.bg, flingPx: 0 } : null;
    const run = (n: number) => {
      for (let i = 0; i < n; i++) {
        if (chain && frame) chain.post.render(renderer, handle.scene, handle.camera, 1 / 60, width, height, frame, true);
        else {
          renderer.setRenderTarget(target);
          renderer.clear();
          renderer.render(handle.scene, handle.camera);
        }
      }
      const read = chain ? chain.post.output : target;
      renderer.readRenderTargetPixels(read, 0, 0, 1, 1, read.texture.type === HalfFloatType ? new Uint16Array(4) : new Uint8Array(4)); // waits for the GPU
    };
    run(10); // warm the clocks and the caches
    const t0 = performance.now();
    run(frames);
    const ms = (performance.now() - t0) / frames;
    target.dispose();
    renderer.setRenderTarget(null);
    governor.invalidate(id);
    return Math.round(ms * 1000) / 1000;
  };

  return {
    tier,
    resize(width, height) {
      store.getState().setSize(width, height, 0, 0);
      governor.invalidate();
    },
    setDpr(dpr) {
      store.getState().setDpr(dpr);
      governor.invalidate();
    },
    destroy() {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      governor.detachRuntime();
      delete governor.dev.sceneTime;
      delete governor.dev.postGround;
      delete governor.dev.postBytes;
      delete governor.dev.bench;
      core.resolves.release();
      core.post.release();
      root.unmount();
      renderer.dispose();
      releaseGlContext("stage");
    },
    loseContext: () => lose?.loseContext(),
    restoreContext: () => lose?.restoreContext(),
  };
}

// ── the R3F tree ──────────────────────────────────────────────────────────────────────────

function RuntimeTree({ core }: { core: RuntimeCore }) {
  return (
    <>
      <StageRenderer core={core} />
      <SceneHost core={core} />
      <DprMonitors />
    </>
  );
}

/** Priority 1, so R3F skips its own render: this draws the LIVE scene into its slot's region. */
function StageRenderer({ core }: { core: RuntimeCore }) {
  useFrame((state, delta) => {
    const current = core.job;
    if (!current) return;
    const { handle, job } = current;
    const { width, height, offsetBottom } = job.viewport;
    handle.setSize(width, height);
    stepScene(handle, delta);
    const gl = state.gl;
    const resolving = core.resolves.get(handle.id);
    const level = resolving ? resolveLevel(state.clock.elapsedTime - resolving.start) : 1;
    if (resolving && level >= 1) core.resolves.end(handle.id);
    core.timer.begin();
    const chain = handle.post ? core.post.get(gl) : null;
    const frame = chain ? { bg: chain.bg, flingPx: flingPx(chain.theme, handle.fling) } : null;
    if (resolving && level < 1) {
      const pass = core.resolves.resolver();
      const source = chain && frame ? chain.post.render(gl, handle.scene, handle.camera, delta, width, height, frame, true) : pass.renderScene(gl, handle, width, height);
      // the post chain leaves its own output bound: back to the canvas before sampling that output
      gl.setRenderTarget(null);
      setSlotViewport(gl, width, height, offsetBottom);
      if (source) pass.composite(gl, source, level, resolving.origin, width / Math.max(1, height));
    } else {
      setSlotViewport(gl, width, height, offsetBottom);
      if (chain && frame) chain.post.render(gl, handle.scene, handle.camera, delta, width, height, frame, false);
      else gl.render(handle.scene, handle.camera);
    }
    core.timer.end();
    gl.setScissorTest(false);
  }, 1);
  return null;
}

/** One portal per resident scene; the governor's `resident` list is the only thing that mounts them. */
function SceneHost({ core }: { core: RuntimeCore }) {
  const resident = useStore(governor.store, (s) => s.resident);
  return (
    <>
      {resident.map((id) => (
        <ScenePortal key={id} id={id} core={core} />
      ))}
    </>
  );
}

function ScenePortal({ id, core }: { id: SceneId; core: RuntimeCore }) {
  const [handle] = useState(() => createSceneHandle(id));
  const [{ Component, data }] = useState(() => {
    const s = governor.scene(id);
    return { Component: (s.module?.default ?? null) as ComponentType<SceneProps> | null, data: s.data };
  });
  useLayoutEffect(() => {
    core.handles.set(id, handle);
    governor.sceneMounted(id); // children have committed: their objects exist → compile + upload
    return () => {
      core.handles.delete(id);
      disposeTree(handle.scene); // COLD = disposed: renderer.info.memory back to baseline
    };
  }, [id, handle, core]);
  if (!Component) return null;
  return createPortal(
    <SceneContext.Provider value={handle}>
      <Component data={data} />
    </SceneContext.Provider>,
    handle.scene,
    { camera: handle.camera },
  );
}

/**
 * drei PerformanceMonitor steps the DPR by 0.25 (floor 1.0): down after 30 bad frames, up after
 * 120 good ones (§4.2). Two monitors, because the two windows differ; mounted only while the stage
 * renders every frame, so the 30 fps idle mode and on-demand rendering never read as "bad frames".
 */
function DprMonitors() {
  const mode = useStore(governor.store, (s) => s.mode);
  const refreshHz = useStore(governor.store, (s) => s.refreshHz);
  const tier = useStore(governor.store, (s) => (s.tierFinal ? s.tier : null));
  const setDpr = useThree((s) => s.setDpr);
  const [epoch, setEpoch] = useState(0);
  if ((mode !== "full" && mode !== "capped") || !tier || tier === "OFF") return null;
  const target = mode === "capped" ? GOVERNOR.highRefreshFallbackFps : (refreshHz ?? 60);
  const sampleMs = (1000 / target) * SAMPLE_FRAMES;
  const bounds = (): [number, number] => [target * 0.85, target * 0.95];
  const step = (direction: -1 | 1) => {
    const { dpr, deviceDpr } = governor.snapshot;
    const next = stepDpr(dpr, direction, tier, deviceDpr);
    if (next === dpr) return;
    setDpr(next);
    governor.setDpr(next, deviceDpr);
    governor.invalidate();
    setEpoch((e) => e + 1); // fresh windows after a resize
  };
  return (
    <Fragment key={epoch}>
      <PerformanceMonitor ms={sampleMs} iterations={DPR_RULES.badFrames / SAMPLE_FRAMES} threshold={0.7} bounds={bounds} onDecline={() => step(-1)} />
      <PerformanceMonitor ms={sampleMs} iterations={DPR_RULES.goodFrames / SAMPLE_FRAMES} threshold={0.95} bounds={bounds} onIncline={() => step(1)} />
    </Fragment>
  );
}
const SAMPLE_FRAMES = 10;

/**
 * A fling adds aberration (HIGH, MID; §5.2): up to 4 px with the scroll's speed, or a scene's own
 * fling (A4's rail, `handle.fling`). In Paper it's the
 * plates' misregistration instead, up to ±1 px.
 */
function flingPx(theme: StageTheme, scene = 0): number {
  const tier = governor.snapshot.tier;
  if (tier !== "HIGH" && tier !== "MID") return 0;
  // the page's scroll, or the scene's own fling (A4's rail), whichever is faster
  const amount = Math.max(scene, Math.min(1, Math.abs(scrollSignal.velocity) / STAGE_FX.aberration.flingVelocity));
  return amount * (theme === "paper" ? 1 : STAGE_FX.aberration.flingPx);
}

function setSlotViewport(gl: WebGLRenderer, width: number, height: number, offsetBottom: number): void {
  gl.setViewport(0, offsetBottom, width, height);
  gl.setScissor(0, offsetBottom, width, height);
  gl.setScissorTest(offsetBottom > 0);
}

// ── DITHER RESOLVE, scene tier (DESIGN.md §3.6): 8×8 Bayer, steps(32), 900 ms ─────────────

const RESOLVE_S = sec(duration.scene.in);
/** steps(32): the share of the threshold field revealed so far (1 = done) */
export const resolveLevel = (elapsedS: number): number => (elapsedS >= RESOLVE_S ? 1 : Math.floor((Math.max(0, elapsedS) / RESOLVE_S) * artifact.ditherSceneSteps) / artifact.ditherSceneSteps);
/** CSS px per Bayer cell — about one pixel of the 640-wide poster at a desktop width */
const RESOLVE_CELL_PX = 2;

const RESOLVE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * Unresolved pixels show the live scene as 1-bit ink (the poster's look); resolved ones show it in
 * full. A pixel resolves once 0.7·bayer8(cell) + 0.3·radial(origin) < level, so fidelity radiates
 * from where the user looked. Paper resolves by screen, not by dither (§3.6 HALFTONE): AM dots on
 * a 45° screen grow with the same radial weighting. The source is a scene with a transparent ground
 * (ink = its luminance) or the post chain's opaque frame (ink = light above the ground; on Paper,
 * what the ink absorbed).
 */
const RESOLVE_FRAG = /* glsl */ `
uniform sampler2D uScene;
uniform float uLevel;
uniform vec2 uOrigin;
uniform vec3 uInk;
uniform vec3 uBg;
uniform float uCell;
uniform float uAspect;
uniform float uPaper;
uniform float uPeriod;
varying vec2 vUv;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec4 scene = texture2D(uScene, vUv);
  float b = bayer8(floor(gl_FragCoord.xy / uCell));
  vec2 far = max(uOrigin, 1.0 - uOrigin) * vec2(uAspect, 1.0);
  float r = clamp(length((vUv - uOrigin) * vec2(uAspect, 1.0)) / length(far), 0.0, 1.0);
  bool resolved;
  if (uPaper > 0.5) {
    vec2 p = gl_FragCoord.xy / uPeriod;
    vec2 cell = fract(vec2(p.x + p.y, p.x - p.y) * 0.70710678) - 0.5;
    float grow = clamp((uLevel - 0.3 * r) / 0.7, 0.0, 1.0);
    resolved = length(cell) < grow * 0.7072;
  } else {
    resolved = 0.7 * b + 0.3 * r < uLevel;
  }
  if (resolved) {
    gl_FragColor = scene;
  } else {
    const vec3 Y = vec3(0.2126, 0.7152, 0.0722);
    bool opaque = scene.a > 0.999;
    float ink = !opaque ? dot(scene.rgb, Y) / max(scene.a, 1e-4)
      : uPaper > 0.5 ? 1.0 - dot(scene.rgb, Y) / max(dot(uBg, Y), 1e-4)
      : dot(max(scene.rgb - uBg, 0.0), Y);
    float on = (opaque ? 1.0 : scene.a) * step(b, ink);
    gl_FragColor = opaque && uPaper > 0.5 ? vec4(mix(uBg, uInk, on), 1.0) : vec4(uInk * on, on);
  }
  #include <colorspace_fragment>
}`;

/** The resolve pass: the scene into a target sized to its slot, then one composite quad. Lives only while a resolve runs. */
class Resolver {
  private target: WebGLRenderTarget | null = null;
  private readonly uniforms = {
    uScene: { value: null as Texture | null },
    uLevel: { value: 0 },
    uOrigin: { value: new Vector2(0.5, 0.5) },
    uInk: { value: tokenColor("--fg-3") },
    uBg: { value: tokenColor("--bg") },
    uCell: { value: RESOLVE_CELL_PX },
    uAspect: { value: 1 },
    uPaper: { value: 0 },
    uPeriod: { value: DITHER.halftonePeriodPx as number },
  };
  private readonly material = new ShaderMaterial({ vertexShader: RESOLVE_VERT, fragmentShader: RESOLVE_FRAG, uniforms: this.uniforms, depthTest: false, depthWrite: false });
  private readonly quad = new ThreeMesh(new PlaneGeometry(2, 2), this.material);
  private readonly quadScene = new Scene().add(this.quad);
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  renderScene(gl: WebGLRenderer, handle: SceneHandle, width: number, height: number): Texture {
    const dpr = gl.getPixelRatio();
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (!this.target) this.target = new WebGLRenderTarget(w, h);
    else if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
    gl.setRenderTarget(this.target);
    gl.setScissorTest(false);
    gl.clear();
    gl.render(handle.scene, handle.camera);
    gl.setRenderTarget(null);
    return this.target.texture;
  }

  /** The resolve's one quad, from `source` (the scene's own target, or the post chain's output). */
  composite(gl: WebGLRenderer, source: Texture, level: number, origin: [number, number], aspect: number): void {
    this.uniforms.uScene.value = source;
    this.uniforms.uCell.value = RESOLVE_CELL_PX * gl.getPixelRatio();
    this.uniforms.uLevel.value = level;
    this.uniforms.uOrigin.value.set(origin[0], origin[1]);
    this.uniforms.uAspect.value = aspect;
    tokenColor("--fg-3", this.uniforms.uInk.value);
    tokenColor("--bg", this.uniforms.uBg.value);
    this.uniforms.uPaper.value = document.documentElement.dataset.theme === "paper" ? 1 : 0;
    this.uniforms.uPeriod.value = DITHER.halftonePeriodPx * gl.getPixelRatio();
    gl.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
    this.quad.geometry.dispose();
    this.material.dispose();
  }
}

// ── WARM without drawing ──────────────────────────────────────────────────────────────────

/**
 * Uploads every buffer of a compiled scene with zero draw calls. three uploads attributes in
 * projectObject() (objects.update) before it decides what to draw; pushing each drawRange.start
 * past the end makes the draw count negative, so renderBufferDirect returns before any gl.draw*.
 * Culling off so nothing is skipped, autoClear off so the framebuffer isn't touched.
 */
function uploadWithoutDrawing(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): void {
  const saved: [Mesh, number, boolean][] = [];
  scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.geometry || !(m.isMesh || (o as Points).isPoints || (o as Object3D & { isLine?: boolean }).isLine)) return;
    saved.push([m, m.geometry.drawRange.start, m.frustumCulled]);
    m.geometry.drawRange.start = Number.MAX_SAFE_INTEGER;
    m.frustumCulled = false;
  });
  const autoClear = renderer.autoClear;
  const background = scene.background;
  const callsBefore = renderer.info.render.calls;
  renderer.autoClear = false;
  scene.background = null;
  renderer.render(scene, camera);
  renderer.autoClear = autoClear;
  scene.background = background;
  for (let i = saved.length - 1; i >= 0; i--) {
    const [m, start, culled] = saved[i] as [Mesh, number, boolean];
    m.geometry.drawRange.start = start;
    m.frustumCulled = culled;
  }
  if (renderer.info.render.calls !== callsBefore) console.warn("[stage] upload pass issued draw calls");
}

// ── disposal and VRAM accounting ──────────────────────────────────────────────────────────

const materialsOf = (o: Object3D): Material[] => {
  const m = (o as Mesh).material;
  return Array.isArray(m) ? m : m ? [m] : [];
};
const isTexture = (v: unknown): v is Texture => !!v && typeof v === "object" && (v as Texture).isTexture === true;
/** a material's own maps (map, alphaMap, …): the material's to free */
const mapsOf = (mat: Material): Texture[] => Object.values(mat).filter(isTexture);
/** every texture a material samples — its maps and a ShaderMaterial's uniforms (where LOG's atlas
 *  lives) — for the VRAM count; uniform textures are freed by the scene that made them, since a
 *  uniform may hold a shared one */
const texturesOf = (mat: Material): Texture[] => [
  ...mapsOf(mat),
  ...Object.values((mat as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms ?? {}).flatMap((u) => (Array.isArray(u.value) ? u.value : [u.value])).filter(isTexture),
];

/**
 * Frees a scene's GPU objects. On unmount, its materials' own maps only: a uniform's texture is the
 * scene module's to free (LOG's deck frees its atlas), and it may be shared. On context loss,
 * `uniforms` too: nothing GPU-side survives the context, and the deletes are silent while it's lost.
 */
function disposeTree(root: Object3D, { uniforms = false }: { uniforms?: boolean } = {}): void {
  root.traverse((o) => {
    (o as Mesh).geometry?.dispose();
    for (const mat of materialsOf(o)) {
      for (const t of uniforms ? texturesOf(mat) : mapsOf(mat)) t.dispose();
      mat.dispose();
    }
    if ((o as InstancedMesh).isInstancedMesh) (o as InstancedMesh).dispose();
  });
}

const byteLength = (a: unknown): number => {
  const x = a as { array?: ArrayLike<number> & { byteLength?: number }; data?: { array?: { byteLength?: number } } } | null;
  return x?.array?.byteLength ?? x?.data?.array?.byteLength ?? 0;
};

/** Bytes this scene holds on the GPU: vertex/index/instance buffers + textures (with mips). */
function sceneBytes(root: Object3D): number {
  const geometries = new Set<BufferGeometry>();
  const textures = new Set<Texture>();
  let bytes = 0;
  root.traverse((o) => {
    const g = (o as Mesh).geometry;
    if (g && !geometries.has(g)) {
      geometries.add(g);
      for (const a of Object.values(g.attributes)) bytes += byteLength(a);
      if (g.index) bytes += byteLength(g.index);
    }
    const im = o as InstancedMesh;
    if (im.isInstancedMesh) bytes += byteLength(im.instanceMatrix) + byteLength(im.instanceColor);
    for (const mat of materialsOf(o)) {
      for (const t of texturesOf(mat)) {
        if (textures.has(t)) continue;
        textures.add(t);
        // a texture array (A4's covers) holds `depth` layers; one-channel data (A4's print) a byte a pixel
        const img = t.image as { width?: number; height?: number; depth?: number } | null;
        const bpp = t.format === RedFormat ? 1 : t.format === RGFormat ? 2 : 4;
        bytes += (img?.width ?? 0) * (img?.height ?? 0) * (img?.depth ?? 1) * bpp * (t.generateMipmaps ? 4 / 3 : 1);
      }
    }
  });
  return bytes;
}

// ── GPU timing (EXT_disjoint_timer_query_webgl2, where the browser has it) ────────────────

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

class GpuTimer {
  private ext: TimerExt | null;
  private active: WebGLQuery | null = null;
  private pending: WebGLQuery[] = [];
  private spare: WebGLQuery[] = [];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  }

  /** Queries and extension objects don't survive a context loss: start over. */
  reset(): void {
    this.active = null;
    this.pending = [];
    this.spare = [];
    this.ext = this.gl.isContextLost() ? null : (this.gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null);
  }

  get supported(): boolean {
    return this.ext !== null;
  }

  begin(): void {
    if (!this.ext || this.active || this.pending.length > 8 || this.gl.isContextLost()) return;
    const q = this.spare.pop() ?? this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(): void {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Delivers finished results in order; a disjoint (GPU reset, throttling) drops them. */
  poll(onResult: (ms: number) => void): void {
    if (!this.ext || this.gl.isContextLost()) return;
    const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const q = this.pending[0] as WebGLQuery;
      if (!this.gl.getQueryParameter(q, this.gl.QUERY_RESULT_AVAILABLE)) break;
      const ns = this.gl.getQueryParameter(q, this.gl.QUERY_RESULT) as number;
      this.pending.shift();
      this.spare.push(q);
      if (!disjoint) onResult(ns / 1e6);
    }
  }
}

// ── the boot probe (§4.2) ─────────────────────────────────────────────────────────────────

/** The hero's per-frame load: its sprite, and its curl noise evaluated every frame (mid-flight, the worst case). */
const PROBE_VERT = /* glsl */ `
uniform float uSize;
uniform float uTime;
${NOISE_GLSL}
void main() {
  vec3 p = position;
  float a = uTime * 0.2;
  p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  p += curlNoise(p * 0.62 + vec3(0.0, uTime * 0.07, 0.0)) * 0.02;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize;
}`;
const PROBE_FRAG = /* glsl */ `
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  gl_FragColor = vec4(vec3(exp(-r * 16.0) * 0.6), 0.0);
}`;
/** extra frames to wait for timer-query results after the last probe frame */
const PROBE_RESULT_GRACE = 60;

/**
 * Renders the hero's representative load — the tier's particle count as additive sprites at the
 * hero's size, with its curl noise every frame, through the tier's own post chain (bloom mips,
 * persistence, RetroEffect), at the tier's DPR — for 5 + 45 frames on the one RAF, offscreen.
 * Frame time = GPU time from timer queries, else the CPU-observed time of a synchronous finish.
 */
async function probe(renderer: WebGLRenderer, tier: Tier, opts: RuntimeOptions): Promise<ProbeRecord> {
  const spec = TIERS[tier];
  const dpr = initialDpr(tier, opts.deviceDpr);
  const w = Math.max(1, Math.round(opts.width * dpr));
  const h = Math.max(1, Math.round(opts.height * dpr));
  const post = new StagePost(renderer, tier, stageTheme(document.documentElement.dataset.theme), new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1));
  const frameIn = { bg: themeBackground(), flingPx: 0 };
  const n = spec.heroParticles;
  const positions = new Float32Array(n * 3);
  const random = rng(hashSeed(`probe:${tier}`));
  for (let i = 0; i < n; i++) {
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const r = 1.6 * Math.cbrt(random());
    const s = Math.sqrt(1 - u * u);
    positions.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const uTime = { value: 0 };
  const material = new ShaderMaterial({
    uniforms: { uSize: { value: HERO.sprite.sizePx * dpr }, uTime },
    vertexShader: PROBE_VERT,
    fragmentShader: PROBE_FRAG,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  const scene = new Scene();
  scene.add(points);
  const camera = new PerspectiveCamera(50, w / h, 0.1, 50);
  camera.position.z = 4;
  await renderer.compileAsync(scene, camera);

  const timer = new GpuTimer(renderer.getContext() as WebGL2RenderingContext);
  const samples: number[] = [];
  const total = TIER_RULES.probeWarmupFrames + TIER_RULES.probeFrames;
  let frame = 0;
  let ticks = 0;
  await governor.runBootTask(() => {
    ticks++;
    if (frame < total) {
      const measured = frame >= TIER_RULES.probeWarmupFrames;
      uTime.value = frame / 60;
      const t0 = performance.now();
      if (measured) timer.begin();
      post.render(renderer, scene, camera, 1 / 60, opts.width, opts.height, frameIn, true, dpr);
      renderer.setRenderTarget(null);
      if (measured) timer.end();
      if (!timer.supported) {
        renderer.readRenderTargetPixels(post.output, 0, 0, 1, 1, post.output.texture.type === HalfFloatType ? new Uint16Array(4) : new Uint8Array(4)); // waits for the GPU
        if (measured) samples.push(performance.now() - t0);
      }
      frame++;
    }
    if (timer.supported) timer.poll((ms) => samples.push(ms));
    return frame >= total && (!timer.supported || samples.length >= TIER_RULES.probeFrames || ticks > total + PROBE_RESULT_GRACE);
  });

  geometry.dispose();
  material.dispose();
  post.dispose();
  const p90 = samples.length ? percentile(samples, 90) : Number.NaN;
  return { tier, p90Ms: Math.round(p90 * 100) / 100, method: timer.supported ? "gpu-timer" : "sync", frames: samples.length };
}
