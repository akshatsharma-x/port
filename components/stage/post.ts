import { BlendFunction, BloomEffect, Effect, EffectAttribute, EffectComposer, EffectPass, Pass, RenderPass } from "postprocessing";
import {
  Color,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  Texture,
  Uniform,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from "three";
import { STAGE_FX, type StageTheme } from "@/lib/fx-stage";
import { TIERS, type Tier } from "@/lib/tier";
import { tokenLinear } from "@/lib/token-color";
import { PERSIST_FRAG, PERSIST_VERT, RETRO_FRAG } from "@/shaders/retro";

/**
 * The stage's post chain (DESIGN.md §5.1, §5.2; §8.1: postprocessing used directly): the scene
 * into a HalfFloat target (RGBA8 on LOW: no bloom ⇒ no HDR), the phosphor persistence pass (HIGH,
 * dark themes), then ONE EffectPass — Bloom (mip levels by tier; none on LOW or Paper) and
 * RetroEffect. Fixed per tier and theme: Phosphor ↔ Amber is uniforms; Paper is its own chain.
 *
 * Sized to the slot's region of the canvas, never to the canvas (EffectComposer.setSize would
 * resize the renderer); the last pass draws into the slot's viewport.
 */

class PersistencePass extends Pass {
  private readonly targets: [WebGLRenderTarget, WebGLRenderTarget];
  private readonly material: ShaderMaterial;
  decay = 0;
  private flip = 0;

  /** `written` gets each frame's fresh memory before the EffectPass that reads it runs */
  constructor(private readonly written: (texture: Texture) => void) {
    super("PersistencePass");
    this.needsSwap = false;
    const make = () => new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    this.targets = [make(), make()];
    this.material = new ShaderMaterial({
      uniforms: { uScene: { value: null }, uPrev: { value: null }, uBg: { value: new Color() }, uDecay: { value: 0 } },
      vertexShader: PERSIST_VERT,
      fragmentShader: PERSIST_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.fullscreenMaterial = this.material;
  }

  get texture(): Texture {
    return (this.targets[this.flip] as WebGLRenderTarget).texture;
  }

  setBackground(c: Color): void {
    (this.material.uniforms.uBg?.value as Color).copy(c);
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, _out: WebGLRenderTarget, deltaTime = 1 / 60): void {
    const read = this.targets[this.flip] as WebGLRenderTarget;
    const write = this.targets[1 - this.flip] as WebGLRenderTarget;
    const u = this.material.uniforms;
    (u.uScene as { value: Texture }).value = inputBuffer.texture;
    (u.uPrev as { value: Texture }).value = read.texture;
    // per 1/60 s, dt-corrected: the same trail at 60, 120 or 30 fps
    (u.uDecay as { value: number }).value = this.decay ** (Math.min(deltaTime, 0.1) * 60);
    renderer.setRenderTarget(write);
    renderer.render(this.scene, this.camera);
    this.flip = 1 - this.flip;
    this.written(write.texture);
  }

  override setSize(width: number, height: number): void {
    for (const t of this.targets) t.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)));
  }

  override dispose(): void {
    for (const t of this.targets) t.dispose();
    this.material.dispose();
    super.dispose();
  }
}

class RetroEffect extends Effect {
  constructor(noise: Texture) {
    super("RetroEffect", RETRO_FRAG, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uBg", new Uniform(new Color())],
        ["uPersist", new Uniform(null)],
        ["uPersistOn", new Uniform(0)],
        ["uCA", new Uniform(new Vector2())],
        ["uVignette", new Uniform(new Vector3())],
        ["uPaper", new Uniform(0)],
        ["uNoise", new Uniform(noise)],
        ["uNoiseSize", new Uniform(STAGE_FX.dither.size)],
      ]),
    });
  }
  set(name: string, value: unknown): void {
    const u = this.uniforms.get(name);
    if (u) u.value = value;
  }
  get(name: string): unknown {
    return this.uniforms.get(name)?.value;
  }
}

/** The 64 × 64 blue-noise tile (scripts/bake/bluenoise.ts) — neutral until it arrives. */
export function blueNoise(onReady: () => void): { texture: Texture } {
  const holder = { texture: new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, RGBAFormat) as Texture };
  holder.texture.needsUpdate = true;
  void fetch(STAGE_FX.dither.url)
    .then((r) => r.blob())
    .then((b) => createImageBitmap(b, { colorSpaceConversion: "none", premultiplyAlpha: "none" }))
    .then((bitmap) => {
      const t = new Texture(bitmap);
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.minFilter = NearestFilter;
      t.magFilter = NearestFilter;
      t.generateMipmaps = false;
      t.flipY = false;
      t.colorSpace = NoColorSpace;
      t.needsUpdate = true;
      holder.texture = t;
      onReady();
    })
    .catch(() => undefined); // no tile: the dither is a flat half (no change)
  return holder;
}

export interface PostFrame {
  /** linear background, the canvas's opaque ground */
  bg: Color;
  /** device px added to the aberration by a fling */
  flingPx: number;
}

export class StagePost {
  readonly key: string;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly effectPass: EffectPass;
  private readonly retro: RetroEffect;
  private readonly bloom: BloomEffect | null;
  private readonly persist: PersistencePass | null;
  private width = 0;
  private height = 0;

  constructor(renderer: WebGLRenderer, readonly tier: Tier, readonly theme: StageTheme, noise: Texture) {
    this.key = StagePost.keyFor(tier, theme);
    const spec = TIERS[tier];
    const hdr = spec.sceneTarget === "HalfFloat";
    const paper = theme === "paper";
    this.composer = new EffectComposer(renderer, { frameBufferType: hdr ? HalfFloatType : UnsignedByteType, depthBuffer: false, stencilBuffer: false, multisampling: 0 });
    this.composer.autoRenderToScreen = false;
    this.renderPass = new RenderPass(undefined, undefined);
    this.renderPass.clearPass.overrideClearAlpha = 1;
    this.composer.addPass(this.renderPass);
    this.retro = new RetroEffect(noise);
    this.persist = spec.trails && !paper && STAGE_FX.persistence[theme] > 0 ? new PersistencePass((t) => this.retro.set("uPersist", t)) : null;
    if (this.persist) {
      this.persist.decay = STAGE_FX.persistence[theme];
      this.composer.addPass(this.persist);
    }
    this.bloom =
      spec.bloomMips > 0 && !paper
        ? new BloomEffect({ blendFunction: BlendFunction.ADD, mipmapBlur: true, luminanceThreshold: STAGE_FX.bloom.threshold, luminanceSmoothing: STAGE_FX.bloom.smoothing, intensity: STAGE_FX.bloom.intensity[theme], radius: STAGE_FX.bloom.radius, levels: spec.bloomMips })
        : null;
    this.effectPass = this.bloom ? new EffectPass(undefined, this.bloom, this.retro) : new EffectPass(undefined, this.retro);
    this.composer.addPass(this.effectPass);
    this.retro.set("uPaper", paper ? 1 : 0);
    this.retro.set("uPersistOn", this.persist ? 1 : 0);
    (this.retro.get("uVignette") as Vector3).set(STAGE_FX.vignette.offset, STAGE_FX.vignette.darkness, paper ? STAGE_FX.vignette.paper : 0);
  }

  static keyFor(tier: Tier, theme: StageTheme): string {
    return `${tier}|${theme === "paper" ? "paper" : "dark"}`;
  }

  /** Phosphor ↔ Amber: the same chain, other constants. */
  retheme(theme: StageTheme): void {
    if (this.bloom) this.bloom.intensity = STAGE_FX.bloom.intensity[theme];
    if (this.persist) this.persist.decay = STAGE_FX.persistence[theme];
  }

  setNoise(noise: Texture): void {
    this.retro.set("uNoise", noise);
  }

  /**
   * Draws a frame. To the screen (into the slot's viewport, which the caller has set), or — for a
   * DITHER RESOLVE — into a target, returned for the resolve's composite.
   */
  render(renderer: WebGLRenderer, scene: Scene, camera: Camera, dt: number, width: number, height: number, frame: PostFrame, toTexture: boolean, pixelRatio?: number): Texture | null {
    const dpr = pixelRatio ?? renderer.getPixelRatio();
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.composer.inputBuffer.setSize(w, h);
      for (const p of this.composer.passes) p.setSize(w, h);
      // bloom's luminance target at half size: its mip chain halves it first anyway (postprocessing
      // sizes it to the full frame — 23 MB at MID, measured)
      this.bloom?.luminancePass.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    }
    // the output buffer only holds a frame drawn to a texture (a DITHER RESOLVE): kept at 1 × 1 the
    // rest of the time — the last pass draws straight into the canvas (a full frame of VRAM saved)
    const out = toTexture ? [w, h] : [1, 1];
    if (this.composer.outputBuffer.width !== out[0] || this.composer.outputBuffer.height !== out[1]) this.composer.outputBuffer.setSize(out[0] as number, out[1] as number);
    this.renderPass.mainScene = scene;
    this.renderPass.mainCamera = camera;
    this.renderPass.clearPass.overrideClearColor = frame.bg;
    (this.retro.get("uBg") as Color).copy(frame.bg);
    this.persist?.setBackground(frame.bg);
    // Paper's aberration is the plates' misregistration, on fling only (§5.2): none at rest
    const rest = this.theme === "paper" ? 0 : TIERS[this.tier].restChromaticAberrationPx;
    (this.retro.get("uCA") as Vector2).set(rest * dpr, frame.flingPx * dpr);
    this.effectPass.renderToScreen = !toTexture;
    // ClearPass sets the clear color before it binds its target, and three converts a clear color
    // for the target bound at that moment: bound to the canvas, the linear ground would be cleared
    // as its sRGB value (measured: #050505 came out at 32/255). Bind the (linear) input first.
    renderer.setRenderTarget(this.composer.inputBuffer);
    this.composer.render(dt);
    // the composer swaps buffers in locals only: RenderPass wrote inputBuffer, the EffectPass outputBuffer
    return toTexture ? this.composer.outputBuffer.texture : null;
  }

  /**
   * Debug: GPU bytes held by the chain's own render targets — the composer's two buffers, the
   * persistence pair, bloom's luminance target and its mip chain (Gate C's VRAM, with the scene's
   * buffers and the canvas).
   */
  vramBytes(): number {
    const targets = new Set<WebGLRenderTarget>([this.composer.inputBuffer, this.composer.outputBuffer]);
    const add = (t: unknown) => {
      if (t instanceof WebGLRenderTarget) targets.add(t);
    };
    for (const t of (this.persist as unknown as { targets?: WebGLRenderTarget[] } | null)?.targets ?? []) add(t);
    const bloom = this.bloom as unknown as { luminancePass?: { renderTarget?: unknown }; mipmapBlurPass?: { renderTarget?: unknown; downsamplingMipmaps?: unknown[]; upsamplingMipmaps?: unknown[] } } | null;
    add(bloom?.luminancePass?.renderTarget);
    add(bloom?.mipmapBlurPass?.renderTarget);
    for (const t of [...(bloom?.mipmapBlurPass?.downsamplingMipmaps ?? []), ...(bloom?.mipmapBlurPass?.upsamplingMipmaps ?? [])]) add(t);
    let bytes = 0;
    for (const t of targets) bytes += t.width * t.height * (t.texture.type === HalfFloatType ? 8 : 4);
    return bytes;
  }

  /** Debug: the target a frame drawn `toTexture` ends in (the bench reads it back to sync). */
  get output(): WebGLRenderTarget {
    return this.composer.outputBuffer;
  }

  /** Debug: the scene buffer's first pixel (the cleared ground, where nothing draws) vs uBg. */
  ground(renderer: WebGLRenderer): { cleared: number[]; ground: number[] } {
    const buffer = new Uint16Array(4);
    const target = this.composer.inputBuffer;
    const half = target.texture.type === HalfFloatType;
    const out = half ? buffer : new Uint8Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, out);
    const decode = (v: number) => (half ? halfToFloat(v) : v / 255);
    const bg = this.retro.get("uBg") as Color;
    return { cleared: [...out].slice(0, 3).map(decode), ground: [bg.r, bg.g, bg.b] };
  }

  dispose(): void {
    this.composer.dispose();
  }
}

function halfToFloat(h: number): number {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? Number.NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + f / 1024);
}

/** The theme's ground for the canvas, in linear light. */
export const themeBackground = (out = new Color()): Color => {
  const [r, g, b] = tokenLinear("--bg");
  return out.setRGB(r, g, b);
};
