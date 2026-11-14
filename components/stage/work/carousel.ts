import {
  ClampToEdgeWrapping,
  DataTexture,
  RedFormat,
  UnsignedByteType,
  Color,
  Euler,
  DataArrayTexture,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from "three";
import { cue } from "@/lib/cues";
import type { StageData } from "@/lib/hero";
import { bezier, ease, signature, springs } from "@/lib/motion";
import { Spring } from "@/lib/spring";
import { arcPitch, arcPose, coverNdc, flingAmount, gateDistance, landing, rubber, unrubber, useWork, WORK, workView } from "@/lib/work";
import { SLIDE_FRAG, SLIDE_VERT } from "@/shaders/work";
import { tokenColor } from "../scene-api";
import { PRINT, type PrintAtlas } from "./print";

type Slide = StageData["work"]["slides"][number];

export interface CarouselData {
  slides: Slide[];
  /** RGBA8, a layer per slide, rows top to bottom (components/stage/work/covers.ts) */
  pixels: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  print: PrintAtlas;
}

export interface CarouselFrame {
  dt: number;
  /** the scene clock (s) */
  time: number;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  /** device pixels per CSS px (the dither's cell) */
  dpr: number;
  /** debug: no clock, no input (the poster) */
  still: boolean;
}

/** A PROJECTION's flight: the slide, which way, and when it started. */
interface Flight {
  slide: number;
  from: number;
  to: number;
  t0: number;
  done: () => void;
}

const DEG = Math.PI / 180;
const easeFly = bezier(ease.transit);
const RESOLVE_S = signature.resolve.scene.ms / 1000;
const RESOLVE_STEPS = signature.resolve.scene.steps;
const scratch = new Object3D();
const corner = new Vector3();
const offset = new Vector3();
const turn = new Euler();
const stock = new Color();

/**
 * A4's slide carousel (DESIGN.md §4.3 A4), outside React: one InstancedMesh of mounts on a gently
 * concave arc, sampling a DataArrayTexture of covers. It owns the rail's physics — a drag that
 * rubber-bands past the ends, a release that coasts and lands on the nearest slide on the `heavy`
 * spring, wheel bursts, steps — the gate (the landing slide resolves to full color and plays the
 * GATE clunk), the fling (smear, FLING whir, aberration) and the PROJECTION's flight. The scene
 * drives frame(); the page's HTML layer drives the input through lib/work.ts's workInput.
 */
export class Carousel {
  readonly group = new Group();
  readonly count: number;
  readonly slides: readonly Slide[];
  /** the rail: the slide index at the gate, continuous */
  position = 0;
  velocity = 0;
  /** the slide that last landed in the gate */
  gate = 0;
  /** 0–1: how fast the rail runs (the post chain's aberration reads it) */
  fling = 0;
  private readonly mesh: InstancedMesh;
  private readonly material: ShaderMaterial;
  private readonly covers: DataArrayTexture;
  private readonly print: DataTexture;
  private readonly aSlide: InstancedBufferAttribute;
  private readonly aState: InstancedBufferAttribute;
  private readonly spring = new Spring(springs.heavy, 0);
  private drag: { x0: number; p0: number; samples: { t: number; x: number }[]; travel: number } | null = null;
  private wheelUntil = -1;
  private wheelLast = 0;
  private landed = true;
  private resolveAt = -1;
  private pointed: number | null = null;
  private pointedEase: Float32Array;
  private flight: Flight | null = null;
  private flyValue = 0;
  private flySlide = -1;
  private band: { top: number; height: number } | null = null;
  private whirAt = 0;
  private whirOn = false;
  private now = 0;
  private pitchPx = 1;

  constructor(data: CarouselData) {
    this.slides = data.slides;
    this.count = data.slides.length;
    this.pointedEase = new Float32Array(this.count);
    this.covers = new DataArrayTexture(data.pixels, data.width, data.height, this.count);
    this.covers.colorSpace = SRGBColorSpace;
    this.covers.generateMipmaps = true;
    this.covers.minFilter = LinearMipmapLinearFilter;
    this.covers.magFilter = LinearFilter;
    this.covers.wrapS = this.covers.wrapT = ClampToEdgeWrapping;
    this.covers.needsUpdate = true;
    this.print = new DataTexture(data.print.data, data.print.width, data.print.height, RedFormat, UnsignedByteType);
    this.print.minFilter = LinearFilter;
    this.print.magFilter = LinearFilter;
    this.print.generateMipmaps = false;
    this.print.needsUpdate = true;
    const m = WORK.mount;
    const band = (1 - m.window.height) / 4; // the print sits mid-margin
    this.material = new ShaderMaterial({
      vertexShader: SLIDE_VERT,
      fragmentShader: SLIDE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uCovers: { value: this.covers },
        uPrint: { value: this.print },
        uSlides: { value: this.count },
        uWindow: { value: new Vector2(m.window.width / 2, m.window.height / 2) },
        uCoverNdc: { value: new Vector2(1, 1) },
        // a print row spans the window's width at the atlas's own aspect
        uPrintBand: { value: new Vector4(m.window.height / 2 + band, (m.window.width * PRINT.row) / 2, m.window.width / 2, 0) },
        uRadius: { value: m.radius },
        uCell: { value: 2 },
        uSmear: { value: 0 },
        uTaps: { value: WORK.fling.taps },
        uLook: { value: new Vector3(WORK.gate.lamp, WORK.gate.barrel, WORK.rest.dim) },
        uPaper: { value: 0 },
        uLoupe: { value: new Vector2(0.36, 1.18) },
        uGround: { value: tokenColor("--bg-sunken") },
        uInk: { value: tokenColor("--fg-2") },
        uLit: { value: tokenColor("--accent") },
        uMount: { value: tokenColor("--bg-raised") },
        uPrintInk: { value: tokenColor("--fg-2") },
        uRim: { value: tokenColor("--bg") },
      },
    });
    const geometry = new PlaneGeometry(1, 1);
    this.aSlide = new InstancedBufferAttribute(new Float32Array(this.count * 4), 4);
    this.aState = new InstancedBufferAttribute(new Float32Array(this.count * 3), 3);
    geometry.setAttribute("aSlide", this.aSlide);
    geometry.setAttribute("aState", this.aState);
    this.mesh = new InstancedMesh(geometry, this.material, this.count);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    workView.rects = new Float32Array(this.count * 4);
  }

  /** Theme tokens into the uniforms; Paper is a lightbox (dark ink on lit white) with a loupe at the gate. */
  applyTheme(): void {
    const paper = document.documentElement.dataset.theme === "paper";
    const u = this.material.uniforms;
    (u.uPaper as { value: number }).value = paper ? 1 : 0;
    tokenColor(paper ? "--bg-raised" : "--bg-sunken", u.uGround?.value);
    tokenColor(paper ? "--fg-1" : "--fg-3", u.uInk?.value);
    tokenColor("--accent", u.uLit?.value);
    // the mount's stock: on the tubes a dark frame lit a little; on the lightbox a light card, opaque
    const mount = tokenColor("--bg-raised", u.uMount?.value);
    mount.lerp(tokenColor("--fg-3", stock), paper ? WORK.mount.paperStock : WORK.mount.stock);
    tokenColor(paper ? "--fg-1" : "--fg-2", u.uPrintInk?.value);
    tokenColor(paper ? "--fg-1" : "--bg", u.uRim?.value);
  }

  // ── input (the page's HTML layer, through lib/work.ts workInput) ────────────────────────────────

  /** A press on the rail: it stops under the pointer. */
  down(x: number, t: number): void {
    if (this.flight) return;
    const raw = unrubber(this.position, this.count);
    this.drag = { x0: x, p0: raw, samples: [{ t, x }], travel: 0 };
    this.wheelUntil = -1;
    this.spring.snap(this.position);
    this.velocity = 0;
    this.landed = false;
  }

  move(x: number, t: number): void {
    const d = this.drag;
    if (!d) return;
    d.travel = Math.max(d.travel, Math.abs(x - d.x0));
    this.position = rubber(d.p0 - (x - d.x0) / this.pitchPx, this.count);
    d.samples.push({ t, x });
    while (d.samples.length > 2 && t - (d.samples[0]?.t ?? t) > WORK.input.velocityWindowMs) d.samples.shift();
    const a = d.samples[0];
    const b = d.samples[d.samples.length - 1];
    this.velocity = a && b && b.t > a.t ? (-(b.x - a.x) / (b.t - a.t)) * (1000 / this.pitchPx) : 0;
  }

  /** The release: it coasts and lands. Returns true when it was a click (it barely moved). */
  up(t: number): boolean {
    const d = this.drag;
    if (!d) return false;
    this.move(d.samples[d.samples.length - 1]?.x ?? d.x0, t);
    this.drag = null;
    const click = d.travel < WORK.input.clickSlopPx;
    const v = click ? 0 : this.velocity;
    this.spring.value = this.position;
    this.spring.velocity = v;
    this.spring.setTarget(click ? Math.round(this.position) : landing(this.position, v, this.count));
    return click;
  }

  /** A wheel or trackpad: sideways only (a vertical wheel always scrolls the page). True if it moved the rail. */
  wheel(dx: number, dy: number, shift: boolean, t: number): boolean {
    if (this.flight || this.drag) return false;
    const sideways = shift && Math.abs(dy) > Math.abs(dx) ? dy : Math.abs(dx) > Math.abs(dy) ? dx : 0;
    if (!sideways) return false;
    const dtMs = Math.max(8, t - this.wheelLast);
    this.wheelLast = t;
    const before = this.position;
    this.position = rubber(unrubber(this.position, this.count) + sideways / this.pitchPx, this.count);
    this.velocity = ((this.position - before) / dtMs) * 1000;
    this.spring.snap(this.position);
    this.wheelUntil = t + WORK.input.wheelSettleMs;
    this.landed = false;
    return true;
  }

  /** ← / →: one slide along. */
  step(dir: -1 | 1): void {
    this.to(Math.round(this.spring.target) + dir);
  }

  /** Brings a slide to the gate. */
  to(index: number): void {
    if (this.flight) return;
    const i = Math.max(0, Math.min(this.count - 1, index));
    this.drag = null;
    this.wheelUntil = -1;
    if (i !== this.spring.target || !this.landed) {
      this.spring.value = this.position;
      this.spring.setTarget(i);
      if (i !== this.gate) this.landed = false;
    }
  }

  point(index: number | null): void {
    this.pointed = index;
  }

  get moving(): boolean {
    return !!this.drag || this.wheelUntil >= 0 || !this.spring.isSettled() || !!this.flight;
  }

  // ── PROJECTION ───────────────────────────────────────────────────────────────────────────────

  /**
   * The flight: out to cover the viewport (1) or home to the gate (0), WORK.projection.flyMs on
   * the `transit` ease. Resolves when it lands.
   */
  fly(slide: number, to: 0 | 1): Promise<void> {
    this.flight?.done();
    return new Promise((done) => {
      if (to === 1) this.to(slide);
      this.flySlide = slide;
      this.flight = { slide, from: this.flyValue, to, t0: this.now, done };
    });
  }

  /** At rest with a slide in the gate, nothing projected (after a PROJECTION has handed over). */
  settle(slide: number): void {
    this.flight?.done();
    this.flight = null;
    this.flySlide = -1;
    this.flyValue = 0;
    this.position = slide;
    this.spring.snap(slide);
    this.gate = slide;
    this.landed = true;
  }

  /** Holds a slide fully projected (the reverse begins here). */
  hold(slide: number): void {
    this.flight?.done();
    this.flight = null;
    this.flySlide = slide;
    this.flyValue = 1;
    this.position = slide;
    this.spring.snap(slide);
    this.gate = slide;
    this.landed = true;
    this.resolveAt = this.now - RESOLVE_S;
  }

  /**
   * While the stage holds the whole viewport, the band (the carousel's slot: its top and height in
   * viewport px) keeps its framing; null hands the camera back to the slot.
   */
  setBand(band: { top: number; height: number } | null): void {
    this.band = band;
  }

  /** The flying slide's window on screen (viewport px), for the takeover's clip; null when none flies. */
  flyRect(): { x: number; y: number; w: number; h: number } | null {
    if (this.flySlide < 0 || this.flyValue <= 0) return null;
    const k = this.flySlide * 4;
    const r = workView.rects;
    return { x: r[k] ?? 0, y: r[k + 1] ?? 0, w: r[k + 2] ?? 0, h: r[k + 3] ?? 0 };
  }

  // ── the frame ────────────────────────────────────────────────────────────────────────────────

  /** One frame; returns whether it's still moving (false: the governor renders on demand). */
  frame(f: CarouselFrame): boolean {
    const { dt, time, camera, width, height } = f;
    this.now = time;
    const nowMs = performance.now();
    const bandH = this.band?.height ?? height;
    const aspect = width / Math.max(1, bandH);
    const fov = camera.fov;
    const gateZ = gateDistance(aspect, fov);
    const pitch = arcPitch(aspect);
    // the camera frames the band; in a takeover the band sits at its own place in the viewport
    camera.aspect = aspect;
    if (this.band) camera.setViewOffset(width, this.band.height, 0, -this.band.top, width, height);
    else if (camera.view?.enabled) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    camera.updateMatrixWorld();
    // one pitch on screen at the gate, px: a drag of that moves the rail one slide
    const tan = Math.tan((fov / 2) * DEG);
    this.pitchPx = (pitch / (2 * gateZ * tan * aspect)) * width;

    // the rail
    if (f.still) {
      this.position = this.spring.target;
      this.velocity = 0;
    } else if (this.drag) {
      // move() sets the position
    } else if (this.wheelUntil >= 0) {
      this.velocity *= Math.exp(-dt / 0.08);
      if (nowMs >= this.wheelUntil) {
        this.wheelUntil = -1;
        this.spring.value = this.position;
        this.spring.velocity = 0;
        this.spring.setTarget(landing(this.position, 0, this.count));
      }
    } else {
      this.spring.step(dt);
      this.position = this.spring.value;
      this.velocity = this.spring.velocity;
    }
    // the gate: a slide lands when the rail comes to rest on it
    if (Math.abs(this.position - this.gate) > 0.12) this.landed = false;
    if (!this.landed && !this.drag && this.wheelUntil < 0 && this.spring.isSettled()) {
      this.spring.snap(this.spring.target);
      this.position = this.spring.value;
      this.velocity = 0;
      this.gate = Math.round(this.position);
      this.landed = true;
      this.resolveAt = time;
      if (!f.still) cue("GATE");
      useWork.getState().setGate(this.gate);
    }
    const resolve = this.landed ? (f.still ? 1 : Math.min(1, Math.floor(((time - this.resolveAt) / RESOLVE_S) * RESOLVE_STEPS) / RESOLVE_STEPS)) : 0;

    // the PROJECTION's flight
    const fl = this.flight;
    if (fl) {
      const k = Math.min(1, (time - fl.t0) / (WORK.projection.flyMs / 1000));
      this.flyValue = fl.from + (fl.to - fl.from) * easeFly(k);
      if (k >= 1) {
        this.flyValue = fl.to;
        this.flight = null;
        if (fl.to === 0) this.flySlide = -1;
        fl.done();
      }
    }
    const fly = this.flyValue;
    const cov = coverNdc(width / Math.max(1, height));
    (this.material.uniforms.uCoverNdc?.value as Vector2).set(cov.w / 2, cov.h / 2);

    // the fling: smear, whir and aberration
    this.fling = f.still ? 0 : flingAmount(this.velocity);
    const sign = this.velocity === 0 ? 0 : -Math.sign(this.velocity);
    (this.material.uniforms.uSmear as { value: number }).value = sign * this.fling * WORK.fling.smear;
    (this.material.uniforms.uCell as { value: number }).value = Math.max(1, Math.round(f.dpr * WORK.rest.cellPx));
    if (!f.still && (this.fling > 0.02 || this.whirOn) && nowMs - this.whirAt >= WORK.fling.whirMs) {
      this.whirAt = nowMs;
      this.whirOn = this.fling > 0.02;
      cue("FLING", { intensity: this.whirOn ? this.fling : 0 });
    }

    // the slides, far to near (the flying one last): no depth buffer, so the order is the overlap
    const order = Array.from({ length: this.count }, (_, i) => i).sort((a, b) => (a === this.flySlide ? 1 : b === this.flySlide ? -1 : Math.abs(b - this.position) - Math.abs(a - this.position)));
    const slide = this.aSlide.array as Float32Array;
    const state = this.aState.array as Float32Array;
    const ease = 1 - Math.exp(-dt * 12);
    for (let i = 0; i < this.count; i++) this.pointedEase[i] = (this.pointedEase[i] ?? 0) + ((this.pointed === i ? 1 : 0) - (this.pointedEase[i] ?? 0)) * (f.still ? 1 : ease);
    order.forEach((i, slot) => {
      const pose = arcPose(i, this.position, gateZ, pitch);
      scratch.position.set(pose.x, 0, pose.z);
      scratch.rotation.set(0, pose.yaw, 0);
      scratch.scale.setScalar(1);
      scratch.updateMatrix();
      this.mesh.setMatrixAt(slot, scratch.matrix);
      const away = Math.abs(i - this.position);
      const flying = i === this.flySlide ? fly : 0;
      slide.set([i, 1 - Math.min(1, away / 0.5), flying, i === this.flySlide ? 1 : 1 - fly], slot * 4);
      state.set([i === this.flySlide && fly > 0 ? 1 : i === this.gate ? resolve : 0, this.pointedEase[i] ?? 0, away], slot * 3);
      this.publish(i, pose, camera, width, height, flying, cov);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aSlide.needsUpdate = true;
    this.aState.needsUpdate = true;
    workView.width = width;
    workView.height = height;
    workView.version++;

    const easing = this.pointedEase.some((v, i) => Math.abs(v - (this.pointed === i ? 1 : 0)) > 1e-3);
    return !f.still && (this.moving || resolve < 1 || easing || this.fling > 0.02 || this.whirOn);
  }

  /** Slide i's window on screen (CSS px in the drawn region), for the HTML layer's links. */
  private publish(i: number, pose: { x: number; z: number; yaw: number }, camera: PerspectiveCamera, width: number, height: number, flying: number, cov: { w: number; h: number }): void {
    const r = workView.rects;
    const k = i * 4;
    if (Math.abs(pose.yaw) > 80 * DEG) {
      r.set([0, 0, 0, 0], k);
      return;
    }
    const hw = WORK.mount.window.width / 2;
    const hh = WORK.mount.window.height / 2;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [sx, sy] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as const) {
      corner.set(sx, sy, 0).applyEuler(turn.set(0, pose.yaw, 0)).add(offset.set(pose.x, 0, pose.z)).project(camera);
      let nx = corner.x;
      let ny = corner.y;
      if (flying > 0) {
        nx = nx + ((sx / hw) * (cov.w / 2) - nx) * flying;
        ny = ny + ((sy / hh) * (cov.h / 2) - ny) * flying;
      }
      const px = (nx * 0.5 + 0.5) * width;
      const py = (1 - (ny * 0.5 + 0.5)) * height;
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
    r.set([x0, y0, x1 - x0, y1 - y0], k);
  }

  /** Debug and the gate: what the rail is doing. */
  debugState() {
    const img = this.covers.image as { width: number; height: number; depth: number };
    return {
      count: this.count,
      position: this.position,
      velocity: this.velocity,
      gate: this.gate,
      landed: this.landed,
      target: this.spring.target,
      fling: this.fling,
      smear: (this.material.uniforms.uSmear as { value: number }).value,
      fly: this.flyValue,
      flySlide: this.flySlide,
      pitchPx: this.pitchPx,
      dragging: !!this.drag,
      band: this.band,
      paper: (this.material.uniforms.uPaper as { value: number }).value === 1,
      covers: { width: img.width, height: img.height, layers: img.depth },
      meshes: this.group.children.map((o) => ({ type: o.type, instanced: (o as InstancedMesh).isInstancedMesh === true, count: (o as InstancedMesh).count })),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.covers.dispose();
    this.print.dispose();
    this.mesh.dispose();
    if (this.whirOn) cue("FLING", { intensity: 0 });
  }
}
