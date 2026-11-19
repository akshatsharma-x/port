import { FX_VERT, FX_WIPE } from "@/shaders/fx";
import { createGlContext, releaseGlContext } from "./gl";
import { cssEase, duration } from "./motion";
import { governor, type FrameOverlay } from "./sceneManager";
import { tokenSrgb } from "./token-color";

/**
 * #fx-gl — the transition layer (DESIGN.md §4.1): WebGL2 context #2, raw (no three.js), fixed
 * above the DOM, idle unless a transition runs. It draws only in frames the governor gives it, and
 * while it has them the stage doesn't draw (the freeze handshake): exactly one context per frame.
 *
 * A play is a timeline: uniforms as a function of time, an optional cut (the TRACKING TEAR's swap)
 * and an optional hold (the cover stays up while a route swap finishes). After a cut, the layer
 * yields one frame so the stage can draw its new scene under the still-displayed cover.
 *
 * First-load JS carries the layer and the test wipe only. The signature programs arrive with
 * lib/transitions.ts (a lazy chunk, fetched on idle) and register() compiles them then — still
 * off the interaction path, and again after a context restore.
 */
export type FxEffect = "wipe" | "tear" | "power" | "scan";
export type UniformValue = number | readonly number[] | Float32Array;
export type Uniforms = Record<string, UniformValue>;

export interface FxPlay {
  effect: FxEffect;
  ms: number;
  uniforms: (t: number) => Uniforms;
  /** the cut: called once at this time; a promise holds the timeline at `holdAt` until it settles */
  cutAt?: number;
  onCut?: () => void | Promise<void>;
  holdAt?: number;
  maxHoldMs?: number;
  /** every drawn frame (DOM jitter, H-HOLD…) */
  onFrame?: (t: number) => void;
  /** start part-way in (ms): back/forward enters the tear already at full cover */
  startAt?: number;
  /**
   * End without a final clear: the last frame fades as the canvas's own opacity (compositor-only,
   * no GL call), so the stage can draw again while the afterglow decays.
   */
  afterglowMs?: number;
}

interface Run extends FxPlay {
  start: number | null;
  held: number;
  cut: "pending" | "running" | "done";
  yieldNext: boolean;
  done: () => void;
}

const SOURCES: Partial<Record<FxEffect, string>> = { wipe: FX_WIPE };
const FX_DPR_CAP = 2;

class FxLayer implements FrameOverlay {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private programs = new Map<FxEffect, { program: WebGLProgram; locs: Map<string, WebGLUniformLocation | null> }>();
  private run: Run | null = null;
  private clearPending = false;
  private resizeDeferred = false;
  /** frames this layer drew (overlay, gate) */
  frames = 0;
  /** the last play's timeline time when it ended (tests, gate) */
  lastPlay: { effect: FxEffect; frames: number; heldMs: number } | null = null;
  private playFrames = 0;

  get ready(): boolean {
    return !!this.gl && this.programs.size > 0 && !this.gl.isContextLost();
  }

  /**
   * The GPU as WebGL names it (the boot's GPU line), or null without a context. RENDERER is read
   * first; the debug extension only when RENDERER is a generic bucket (asking for it warns in some
   * browsers). lib/boot.ts cleanRenderer() decides whether what came back was masked.
   */
  renderer(): string | null {
    const gl = this.gl;
    if (!gl || gl.isContextLost()) return null;
    const plain = String(gl.getParameter(gl.RENDERER) ?? "");
    if (plain && !/^(webkit webgl|mozilla)$/i.test(plain)) return plain;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? plain) : plain;
  }

  /** This effect's program is compiled and the context is healthy: callers fall back otherwise. */
  can(effect: FxEffect): boolean {
    return this.ready && this.programs.has(effect);
  }

  /** Adds programs (compiled now if the context is up, else at attach / restore). */
  register(sources: Partial<Record<FxEffect, string>>): void {
    Object.assign(SOURCES, sources);
    if (this.gl && !this.gl.isContextLost()) this.build(Object.keys(sources) as FxEffect[]);
  }

  get busy(): boolean {
    return this.run !== null;
  }

  attach(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    this.gl = createGlContext("fx-gl", canvas, { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true });
    if (!this.gl) return false;
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    this.build();
    this.resize();
    governor.setOverlay(this);
    return true;
  }

  detach(): void {
    this.canvas?.removeEventListener("webglcontextlost", this.onLost);
    this.canvas?.removeEventListener("webglcontextrestored", this.onRestored);
    this.run?.done();
    this.run = null;
    governor.setOverlay(null);
    releaseGlContext("fx-gl");
    this.gl = null;
    this.programs.clear();
    this.vao = null;
    this.canvas = null;
  }

  /** Plays a timeline. Resolves after its last frame (immediately without a context — callers fall back). */
  play(p: FxPlay): Promise<void> {
    if (!this.can(p.effect)) return Promise.resolve();
    this.run?.done();
    this.playFrames = 0;
    return new Promise((done) => {
      this.run = { ...p, start: null, held: 0, cut: p.cutAt === undefined ? "done" : "pending", yieldNext: false, done };
    });
  }

  /** The Part 3 test wipe. */
  wipe(ms: number = duration.scene.in): Promise<void> {
    const c = tokenSrgb("--accent");
    return this.play({ effect: "wipe", ms, uniforms: (t) => ({ t: t / ms, c }) });
  }

  resize(): void {
    if (!this.canvas) return;
    if (this.run || this.clearPending) {
      this.resizeDeferred = true; // resizing clears the drawing buffer: never mid-transition
      return;
    }
    const dpr = Math.min(FX_DPR_CAP, window.devicePixelRatio || 1);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) Object.assign(this.canvas, { width: w, height: h });
  }

  // ── FrameOverlay ────────────────────────────────────────────────────────────────────────

  wantsFrame(): boolean {
    if (this.run?.yieldNext) {
      this.run.yieldNext = false; // the swap frame: the stage draws, this canvas keeps its last image
      return false;
    }
    return this.run !== null || this.clearPending;
  }

  draw(now: number): void {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas) return;
    canvas.dataset.active = "";
    const r = this.run;
    if (r) {
      r.start ??= now - (r.startAt ?? 0);
      let t = now - r.start - r.held;
      if (r.cut === "pending" && r.cutAt !== undefined && t >= r.cutAt) {
        r.cut = "running";
        const settle = () => {
          r.cut = "done";
          r.yieldNext = true;
        };
        try {
          const result = r.onCut?.();
          if (result && typeof (result as Promise<void>).then === "function") (result as Promise<void>).then(settle, settle);
          else settle();
        } catch (error) {
          console.error("[fx-gl] cut failed", error);
          settle();
        }
      }
      if (r.cut === "running" && r.holdAt !== undefined && t > r.holdAt && r.held < (r.maxHoldMs ?? Number.POSITIVE_INFINITY)) {
        r.held += t - r.holdAt;
        t = r.holdAt;
      }
      if (t < r.ms) {
        this.drawProgram(r.effect, t, r.uniforms(t));
        r.onFrame?.(t);
        this.frames++;
        this.playFrames++;
        return;
      }
      r.onFrame?.(r.ms);
      this.lastPlay = { effect: r.effect, frames: this.playFrames, heldMs: Math.round(r.held) };
      r.done();
      this.run = null;
      if (r.afterglowMs) {
        // no GL call this frame: the stage takes it; the last image fades on the compositor
        const fade = canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: r.afterglowMs, easing: cssEase("decay") });
        fade.onfinish = () => {
          if (!this.run) delete canvas.dataset.active; // the next play clears before it draws
        };
        return;
      }
      this.clearPending = true;
    }
    // a play's last frame: clear to transparent, hand the next frame back to the stage
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.frames++;
    this.clearPending = false;
    delete canvas.dataset.active;
    if (this.resizeDeferred) {
      this.resizeDeferred = false;
      this.resize();
    }
  }

  // ── internals ───────────────────────────────────────────────────────────────────────────

  private drawProgram(effect: FxEffect, t: number, values: Uniforms): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const p = this.programs.get(effect);
    if (!gl || !canvas || !p) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p.program);
    const loc = (name: string) => {
      if (!p.locs.has(name)) p.locs.set(name, gl.getUniformLocation(p.program, name));
      return p.locs.get(name) ?? null;
    };
    gl.uniform2f(loc("uRes"), canvas.width, canvas.height);
    gl.uniform1f(loc("uT"), t);
    for (const [name, v] of Object.entries(values)) {
      const l = loc(name);
      if (l === null) continue;
      if (typeof v === "number") gl.uniform1f(l, v);
      else if (v instanceof Float32Array) gl.uniform4fv(l, v);
      else if (v.length === 2) gl.uniform2f(l, v[0] ?? 0, v[1] ?? 0);
      else if (v.length === 3) gl.uniform3f(l, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
      else if (v.length === 4) gl.uniform4f(l, v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private vao: WebGLVertexArrayObject | null = null;

  /** Compiles `only` (default: every registered program); the shared triangle is made once per context. */
  private build(only?: readonly FxEffect[]): void {
    const gl = this.gl;
    if (!gl) return;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = shader(gl.VERTEX_SHADER, FX_VERT);
    if (!vs) return;
    for (const [effect, src] of Object.entries(SOURCES) as [FxEffect, string][]) {
      if (only && !only.includes(effect)) continue;
      const fs = shader(gl.FRAGMENT_SHADER, src);
      const program = gl.createProgram();
      if (!fs || !program) continue;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, "p");
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(`[fx-gl] ${effect} failed to link`, gl.getProgramInfoLog(program), gl.getShaderInfoLog(fs));
        continue;
      }
      gl.deleteShader(fs);
      this.programs.set(effect, { program, locs: new Map() });
    }
    gl.deleteShader(vs);
    if (this.vao) return;
    // one full-screen triangle, shared by every program
    const vao = gl.createVertexArray();
    this.vao = vao;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  private onLost = (e: Event) => {
    e.preventDefault(); // allow restoration
    this.run?.done();
    this.run = null;
    this.clearPending = false;
    this.programs.clear();
    this.vao = null; // gone with the context
  };

  private onRestored = () => {
    this.build();
  };
}

/** The app's one transition layer. */
export const fx = new FxLayer();
