import {
  ClampToEdgeWrapping,
  Color,
  DataArrayTexture,
  DataTexture,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  RedFormat,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type PerspectiveCamera,
} from "three";
import { clackIntensity, dampingFor, hash, KEYS, keysView, useKeys, type KeySpec } from "@/lib/capabilities";
import { cloudFit, homes, type View } from "@/lib/capabilities-layout";
import { cue } from "@/lib/cues";
import { CAP_FRAG, CAP_VERT, SHADOW_FRAG, SHADOW_VERT } from "@/shaders/keycaps";
import { tokenColor } from "../scene-api";
import { keycapGeometry } from "./geometry";

export interface PileData {
  keys: KeySpec[];
  categories: number;
  /** the legend atlas's coverage, R8, rows top to bottom */
  legends: Uint8Array<ArrayBuffer>;
  /** the three themes' matcaps, RGBA8, a layer each (phosphor, amber, paper) */
  matcaps: Uint8Array<ArrayBuffer>;
}

export interface PileFrame {
  dt: number;
  time: number;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  /** the pointer in the slot (CSS px), or null when it's elsewhere */
  pointer: { x: number; y: number } | null;
  still: boolean;
}

const DEG = Math.PI / 180;
const S = KEYS.sim;
const kAnchor = S.anchor;
const cAnchor = dampingFor(S.anchor, S.anchorZeta);
const kGrab = S.grab;
const cGrab = dampingFor(S.grab, S.grabZeta);
const kOrient = S.orient;
const cOrient = dampingFor(S.orient, S.orientZeta);
const mat = new Matrix4();
const q = new Quaternion();
const qe = new Quaternion();
const qi = new Quaternion();
const v3 = new Vector3();
const scale = new Vector3(1, 1, 1);
const blob = new Vector3();
const ndc = new Vector3();

/**
 * A5's keycap pile (DESIGN.md §4.3 A5), outside React: one InstancedMesh of sculpted caps and one
 * instanced batch of blob shadows. HIGH runs the micro-sim — sphere proxies, the band's walls,
 * springs to each category's home, a grab spring for drag-and-throw and a legend-up spring, on a
 * fixed 1/120 s step that sleeps once everything settles. MID floats the keys on a sine at their
 * homes, with hover and press and no physics. The scene drives frame(); the page's HTML layer
 * drives the input through lib/capabilities.ts keysInput.
 */
export class Pile {
  readonly group = new Group();
  readonly count: number;
  readonly mode: "sim" | "float";
  private readonly keys: KeySpec[];
  private readonly categories: number;
  private readonly caps: InstancedMesh;
  private readonly shadows: InstancedMesh;
  private readonly capMat: ShaderMaterial;
  private readonly shadowMat: ShaderMaterial;
  private readonly legends: DataTexture;
  private readonly matcaps: DataArrayTexture;
  private readonly aKey: InstancedBufferAttribute;
  private readonly aShade: InstancedBufferAttribute;
  // the sim's state, world units (the cloud's centre at its depth)
  private readonly p: Float32Array;
  private readonly v: Float32Array;
  private readonly rot: Float32Array;
  private readonly w: Float32Array;
  private readonly tilt: Float32Array;
  private home: Float32Array;
  private readonly dim: Float32Array;
  private readonly lit: Float32Array;
  private readonly lift: Float32Array;
  private readonly press: Float32Array;
  private readonly screen: Float32Array;
  private depth = 12;
  private view: View = {};
  private bounds = { x: 6, y: 3, zNear: -8, zFar: -16 };
  private width = 0;
  private height = 0;
  private cluster: number | null = null;
  private hovered = -1;
  private grabbed = -1;
  private grabPoint = new Vector3();
  private down: { x: number; y: number; t: number; key: number; moved: boolean } | null = null;
  private accumulator = 0;
  private quiet = 0;
  private asleep = false;
  private now = 0;

  constructor(data: PileData, mode: "sim" | "float") {
    this.keys = data.keys.slice(0, KEYS.maxKeys);
    this.count = this.keys.length;
    this.categories = data.categories;
    this.mode = mode;
    const n = this.count;
    this.p = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 4);
    this.w = new Float32Array(n * 3);
    this.tilt = new Float32Array(n * 4);
    this.home = new Float32Array(n * 3);
    this.dim = new Float32Array(n);
    this.lit = new Float32Array(n);
    this.lift = new Float32Array(n);
    this.press = new Float32Array(n);
    this.screen = new Float32Array(n * 3);
    // each key's resting tilt: seeded, small, so the pile is loose and its legends still read
    this.keys.forEach((k, i) => {
      const a = (hash(k.slug) - 0.5) * 2 * KEYS.cloud.tilt;
      const b = (hash(`${k.slug}:y`) - 0.5) * 2 * KEYS.cloud.tilt;
      const c = (hash(`${k.slug}:z`) - 0.5) * 2 * KEYS.cloud.tilt * 0.6;
      q.setFromEuler(new Euler(a, b, c));
      this.tilt.set([q.x, q.y, q.z, q.w], i * 4);
      this.rot.set([q.x, q.y, q.z, q.w], i * 4);
    });

    const size = KEYS.atlas.size;
    this.legends = new DataTexture(data.legends, size, size, RedFormat, UnsignedByteType);
    this.legends.generateMipmaps = true;
    this.legends.minFilter = LinearMipmapLinearFilter;
    this.legends.magFilter = LinearFilter;
    this.legends.needsUpdate = true;
    const ms = KEYS.matcap.size;
    this.matcaps = new DataArrayTexture(data.matcaps, ms, ms, 3);
    this.matcaps.colorSpace = SRGBColorSpace;
    this.matcaps.generateMipmaps = true;
    this.matcaps.minFilter = LinearMipmapLinearFilter;
    this.matcaps.magFilter = LinearFilter;
    this.matcaps.wrapS = this.matcaps.wrapT = ClampToEdgeWrapping;
    this.matcaps.needsUpdate = true;

    this.capMat = new ShaderMaterial({
      vertexShader: CAP_VERT,
      fragmentShader: CAP_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uMatcap: { value: this.matcaps },
        uTheme: { value: 0 },
        uLegends: { value: this.legends },
        uCols: { value: KEYS.atlas.cols },
        uCap: { value: new Color() },
        uCapPrimary: { value: new Color() },
        uLegend: { value: new Color() },
        uLegendPrimary: { value: new Color() },
        uLit: { value: new Color() },
        uEmissive: { value: KEYS.legend.emissive },
        uPaper: { value: 0 },
        uDim: { value: KEYS.hover.dim },
      },
    });
    const capGeo = keycapGeometry();
    this.aKey = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    capGeo.setAttribute("aKey", this.aKey);
    this.caps = new InstancedMesh(capGeo, this.capMat, n);
    this.caps.frustumCulled = false;

    this.shadowMat = new ShaderMaterial({ vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthTest: false, depthWrite: false, uniforms: { uShadow: { value: new Color() }, uOpacity: { value: KEYS.shadow.opacity } } });
    const shadowGeo = new PlaneGeometry(1, 1);
    this.aShade = new InstancedBufferAttribute(new Float32Array(n * 2), 2);
    shadowGeo.setAttribute("aShade", this.aShade);
    this.shadows = new InstancedMesh(shadowGeo, this.shadowMat, n);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = -1;
    this.group.add(this.shadows, this.caps);
  }

  /** The theme: the matcap's layer, the plastics, the legends' light or ink, the shadow. */
  applyTheme(): void {
    const theme = document.documentElement.dataset.theme;
    const paper = theme === "paper";
    const u = this.capMat.uniforms;
    (u.uTheme as { value: number }).value = paper ? 2 : theme === "amber" ? 1 : 0;
    (u.uPaper as { value: number }).value = paper ? 1 : 0;
    const cap = tokenColor("--bg-raised", u.uCap?.value);
    if (paper) cap.multiply(new Color().setRGB(...KEYS.legend.beige));
    else cap.lerp(tokenColor("--fg-3"), KEYS.legend.charcoal);
    tokenColor("--accent", u.uCapPrimary?.value);
    tokenColor("--fg-1", u.uLegend?.value);
    tokenColor(paper ? "--bg-raised" : "--bg-sunken", u.uLegendPrimary?.value);
    tokenColor("--accent", u.uLit?.value);
    tokenColor(paper ? "--fg-1" : "--bg-sunken", this.shadowMat.uniforms.uShadow?.value);
    (this.shadowMat.uniforms.uOpacity as { value: number }).value = paper ? KEYS.shadow.paper : KEYS.shadow.opacity;
  }

  // ── the layout ────────────────────────────────────────────────────────────────────────────────

  /** Fits the cloud to the slot: its arrangement, how deep it floats, and the walls a throw bounces off. */
  private fit(camera: PerspectiveCamera, width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const fit = cloudFit(this.keys, this.categories, width / Math.max(1, height), camera.fov);
    this.view = fit;
    this.depth = fit.depth;
    this.bounds = fit.bounds;
    this.setHomes(homes(this.keys, this.categories, this.cluster, fit));
  }

  private setHomes(h: { x: number; y: number; z: number }[]): void {
    const first = !this.home.some((x) => x !== 0);
    h.forEach((o, i) => {
      this.home.set([o.x, o.y, o.z - this.depth], i * 3);
      if (first) this.p.set([o.x, o.y, o.z - this.depth], i * 3);
    });
    this.wake();
  }

  /** Gathers the pile by a category (or all): the homes move and the keys fly to them. */
  setCluster(category: number | null): void {
    if (category === this.cluster) return;
    this.cluster = category;
    // before the first fit there are no homes yet: fit() places the pile gathered
    if (this.width) homes(this.keys, this.categories, category, this.view).forEach((o, i) => this.home.set([o.x, o.y, o.z - this.depth], i * 3));
    this.wake();
  }

  wake(): void {
    this.asleep = false;
    this.quiet = 0;
  }

  // ── input (the page's HTML layer) ─────────────────────────────────────────────────────────────

  /** The key whose sphere is under a slot point (CSS px), nearest the camera, or −1. */
  pick(x: number, y: number): number {
    let best = -1;
    let bestZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      const sx = this.screen[i * 3] ?? 0;
      const sy = this.screen[i * 3 + 1] ?? 0;
      const r = Math.max(KEYS.pick.minPx, this.screen[i * 3 + 2] ?? 0);
      if ((sx - x) ** 2 + (sy - y) ** 2 > r * r) continue;
      const z = this.p[i * 3 + 2] ?? 0;
      if (z > bestZ) {
        bestZ = z;
        best = i;
      }
    }
    return best;
  }

  pointerDown(x: number, y: number, t: number): number {
    const key = this.pick(x, y);
    this.down = { x, y, t, key, moved: false };
    return key;
  }

  pointerMove(x: number, y: number, camera: PerspectiveCamera): void {
    const d = this.down;
    if (!d) return;
    if (!d.moved && Math.hypot(x - d.x, y - d.y) > 6) {
      d.moved = true;
      // only the micro-sim throws: MID floats
      if (this.mode === "sim" && d.key >= 0) this.grabbed = d.key;
    }
    if (this.grabbed >= 0) {
      // the grab point: the pointer's ray met at the key's depth
      const z = this.p[this.grabbed * 3 + 2] ?? -this.depth;
      ndc.set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2, 0.5).unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      const s = (z - camera.position.z) / dir.z;
      this.grabPoint.copy(camera.position).addScaledVector(dir, s);
      this.wake();
    }
  }

  /** The release: a throw, or a click (a press). True when it was a click on a key. */
  pointerUp(): number {
    const d = this.down;
    this.down = null;
    const was = this.grabbed;
    this.grabbed = -1;
    if (was >= 0) {
      // the throw keeps its speed, within reason
      const i = was * 3;
      const sp = Math.hypot(this.v[i] ?? 0, this.v[i + 1] ?? 0, this.v[i + 2] ?? 0);
      if (sp > S.maxThrow) for (let a = 0; a < 3; a++) this.v[i + a] = ((this.v[i + a] ?? 0) * S.maxThrow) / sp;
      this.wake();
      return -1;
    }
    return d && !d.moved ? d.key : -1;
  }

  /** A key goes down: a dip and back, a clack, and its row lights in the panel. */
  pressKey(i: number, strength = 1): void {
    if (i < 0 || i >= this.count) return;
    this.press[i] = 1;
    if (this.mode === "sim") this.v[i * 3 + 2] = (this.v[i * 3 + 2] ?? 0) - KEYS.press.kick * strength;
    cue("KEYCAP", { intensity: Math.min(1, 0.6 + 0.4 * strength) });
    useKeys.getState().light(i);
    this.wake();
  }

  // ── the frame ────────────────────────────────────────────────────────────────────────────────

  frame(f: PileFrame): boolean {
    const { dt, time, camera } = f;
    this.now = time;
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    camera.updateMatrixWorld();
    this.fit(camera, f.width, f.height);

    // hover: the key under the pointer (not while one is held)
    const over = f.pointer && this.grabbed < 0 ? this.pick(f.pointer.x, f.pointer.y) : -1;
    if (over !== this.hovered) {
      this.hovered = over;
      useKeys.getState().hover(over >= 0 ? over : null);
      this.wake();
    }
    const lit = useKeys.getState().lit;
    const litOn = lit && performance.now() - litSince(lit.seq) < KEYS.litMs ? lit.index : -1;

    // the springs and the press ease
    const e = 1 - Math.exp(-dt * KEYS.ease);
    let easing = false;
    for (let i = 0; i < this.count; i++) {
      const to = (k: Float32Array, to: number) => {
        // compared as stored: 0.6 in a Float32Array is not the double 0.6, and would ease forever
        const target = Math.fround(to);
        const cur = k[i] ?? 0;
        const next = f.still ? target : cur + (target - cur) * e;
        k[i] = Math.abs(next - target) < 1e-3 ? target : next;
        if (k[i] !== target) easing = true;
      };
      // the rest dim while one is hovered; gathered, the other categories recede a little
      const away = this.cluster !== null && (this.keys[i] as KeySpec).category !== this.cluster;
      to(this.dim, this.hovered >= 0 ? (this.hovered !== i ? 1 : 0) : away ? KEYS.gather.recede : 0);
      to(this.lift, this.hovered === i ? 1 : 0);
      to(this.lit, litOn === i ? 1 : 0);
      if ((this.press[i] ?? 0) > 0) {
        this.press[i] = Math.max(0, (this.press[i] ?? 0) - dt / (KEYS.press.ms / 1000));
        easing = true;
      }
    }

    if (this.mode === "sim" && !f.still) this.simulate(dt);
    const moving = this.mode === "float" || (!this.asleep && !f.still);

    // instances: back to front (no depth buffer), with their shadows on the wall behind
    const order = Array.from({ length: this.count }, (_, i) => i).sort((a, b) => this.zOf(a) - this.zOf(b));
    const aKey = this.aKey.array as Float32Array;
    const aShade = this.aShade.array as Float32Array;
    const wallZ = -this.depth - KEYS.shadow.wall;
    order.forEach((i, slot) => {
      const [x, y, z] = this.poseOf(i, f);
      q.fromArray(this.rot, i * 4);
      if (this.mode === "float") {
        // MID: a slow sway about the resting tilt
        const k = this.keys[i] as KeySpec;
        qe.setFromAxisAngle(v3.set(0, 0, 1), Math.sin((time * 2 * Math.PI) / KEYS.float.periodS + hash(k.slug) * 6.28) * KEYS.float.spin);
        q.fromArray(this.tilt, i * 4).multiply(qe);
      }
      // a hovered or lit key turns its legend square to the camera
      const flat = Math.max(this.lift[i] ?? 0, this.lit[i] ?? 0);
      if (flat > 0) q.slerp(qe.identity(), flat);
      mat.compose(v3.set(x, y, z), q, scale);
      this.caps.setMatrixAt(slot, mat);
      const k = this.keys[i] as KeySpec;
      aKey.set([k.cell, k.primary ? 1 : 0, this.dim[i] ?? 0, this.lit[i] ?? 0], slot * 4);
      // the shadow: the lamp is up and to the left, so it falls down and right, softer the farther
      const gap = Math.max(0, z - wallZ);
      const s = 1.05 + gap * KEYS.shadow.spread;
      mat.compose(v3.set(x + gap * KEYS.shadow.offset, y - gap * KEYS.shadow.offset, wallZ), qe.identity(), blob.set(s, s, 1));
      this.shadows.setMatrixAt(slot, mat);
      // softer the farther; none from a key at or behind the wall (gathered, the rest recede past it)
      aShade.set([Math.min(1, gap / KEYS.cloud.depth), Math.min(1, gap / KEYS.shadow.fade) / (1 + gap * 0.5)], slot * 2);
      this.publish(i, x, y, z, camera);
    });
    this.caps.instanceMatrix.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.aKey.needsUpdate = true;
    this.aShade.needsUpdate = true;
    // the tooltip's anchor
    keysView.width = this.width;
    keysView.height = this.height;
    keysView.hovered = this.hovered;
    if (this.hovered >= 0) {
      keysView.x = this.screen[this.hovered * 3] ?? 0;
      keysView.y = this.screen[this.hovered * 3 + 1] ?? 0;
      keysView.r = this.screen[this.hovered * 3 + 2] ?? 0;
    }
    keysView.version++;
    return !f.still && (moving || easing || this.grabbed >= 0);
  }

  /** A key's place this frame: the sim's, or MID's float about its home; plus its lift and press. */
  private poseOf(i: number, f: PileFrame): [number, number, number] {
    let x: number;
    let y: number;
    let z: number;
    if (this.mode === "sim") {
      x = this.p[i * 3] ?? 0;
      y = this.p[i * 3 + 1] ?? 0;
      z = this.p[i * 3 + 2] ?? 0;
    } else {
      // MID: each key eases to its home (the re-cluster's flight) and bobs there
      const e = f.still ? 1 : 1 - Math.exp(-f.dt * KEYS.float.follow);
      for (let a = 0; a < 3; a++) this.p[i * 3 + a] = (this.p[i * 3 + a] ?? 0) + ((this.home[i * 3 + a] ?? 0) - (this.p[i * 3 + a] ?? 0)) * e;
      const k = this.keys[i] as KeySpec;
      x = this.p[i * 3] ?? 0;
      y = (this.p[i * 3 + 1] ?? 0) + (f.still ? 0 : Math.sin((f.time * 2 * Math.PI) / KEYS.float.periodS + hash(k.slug) * 6.28) * KEYS.float.amplitude);
      z = this.p[i * 3 + 2] ?? 0;
    }
    z += (this.lift[i] ?? 0) * KEYS.hover.lift - Math.sin((1 - (this.press[i] ?? 0)) * Math.PI) * (this.press[i] ?? 0 ? KEYS.press.depth : 0);
    return [x, y, z];
  }

  private zOf(i: number): number {
    return (this.p[i * 3 + 2] ?? 0) + (this.lift[i] ?? 0) * KEYS.hover.lift;
  }

  /** Projects key i's centre and its sphere's radius to slot px. */
  private publish(i: number, x: number, y: number, z: number, camera: PerspectiveCamera): void {
    ndc.set(x, y, z).project(camera);
    const sx = (ndc.x * 0.5 + 0.5) * this.width;
    const sy = (1 - (ndc.y * 0.5 + 0.5)) * this.height;
    const tan = Math.tan((camera.fov / 2) * DEG);
    const r = (S.radius / (Math.max(0.1, -z) * tan)) * (this.height / 2);
    this.screen.set([sx, sy, r], i * 3);
  }

  // ── the micro-sim (HIGH) ─────────────────────────────────────────────────────────────────────

  private simulate(dt: number): void {
    if (this.asleep && this.grabbed < 0 && !this.down) return;
    this.accumulator = Math.min(this.accumulator + dt, S.step * S.maxSteps);
    let clack = 0;
    while (this.accumulator >= S.step) {
      this.accumulator -= S.step;
      clack = Math.max(clack, this.step(S.step));
    }
    const gain = clackIntensity(clack);
    if (gain > 0) cue("KEYCAP", { intensity: gain });
  }

  /** One fixed step; returns the hardest contact's speed. */
  private step(h: number): number {
    const n = this.count;
    const P = this.p;
    const V = this.v;
    let hardest = 0;
    let maxSpeed = 0;
    let maxOff = 0;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const held = i === this.grabbed;
      for (let a = 0; a < 3; a++) {
        const target = held ? this.grabPoint.getComponent(a) : (this.home[o + a] ?? 0);
        const k = held ? kGrab : kAnchor;
        const c = held ? cGrab : cAnchor;
        const acc = k * (target - (P[o + a] ?? 0)) - c * (V[o + a] ?? 0);
        V[o + a] = (V[o + a] ?? 0) + acc * h;
      }
      for (let a = 0; a < 3; a++) P[o + a] = (P[o + a] ?? 0) + (V[o + a] ?? 0) * h;
    }
    // sphere proxies: push apart, trade momentum along the contact normal
    const r2 = 2 * S.radius;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = (P[i * 3] ?? 0) - (P[j * 3] ?? 0);
        const dy = (P[i * 3 + 1] ?? 0) - (P[j * 3 + 1] ?? 0);
        const dz = (P[i * 3 + 2] ?? 0) - (P[j * 3 + 2] ?? 0);
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= r2 * r2 || d2 < 1e-12) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const nz = dz / d;
        const push = (r2 - d) / 2;
        for (const [k, s] of [
          [i, 1],
          [j, -1],
        ] as const) {
          P[k * 3] = (P[k * 3] ?? 0) + nx * push * s;
          P[k * 3 + 1] = (P[k * 3 + 1] ?? 0) + ny * push * s;
          P[k * 3 + 2] = (P[k * 3 + 2] ?? 0) + nz * push * s;
        }
        const vn = ((V[i * 3] ?? 0) - (V[j * 3] ?? 0)) * nx + ((V[i * 3 + 1] ?? 0) - (V[j * 3 + 1] ?? 0)) * ny + ((V[i * 3 + 2] ?? 0) - (V[j * 3 + 2] ?? 0)) * nz;
        if (vn >= 0) continue;
        const imp = (-(1 + S.bounce) * vn) / 2;
        V[i * 3] = (V[i * 3] ?? 0) + imp * nx;
        V[i * 3 + 1] = (V[i * 3 + 1] ?? 0) + imp * ny;
        V[i * 3 + 2] = (V[i * 3 + 2] ?? 0) + imp * nz;
        V[j * 3] = (V[j * 3] ?? 0) - imp * nx;
        V[j * 3 + 1] = (V[j * 3 + 1] ?? 0) - imp * ny;
        V[j * 3 + 2] = (V[j * 3 + 2] ?? 0) - imp * nz;
        // a glancing hit sets both spinning a little
        for (const k of [i, j]) {
          this.w[k * 3] = (this.w[k * 3] ?? 0) + ny * vn * 0.6;
          this.w[k * 3 + 1] = (this.w[k * 3 + 1] ?? 0) - nx * vn * 0.6;
        }
        hardest = Math.max(hardest, -vn);
      }
    }
    // the walls: the band's edges, widening with depth as the view does, and the front and back
    const B = this.bounds;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const wide = Math.max(0, -(P[o + 2] ?? 0)) / this.depth;
      const lim: [number, number, number][] = [
        [0, -B.x * wide, B.x * wide],
        [1, -B.y * wide, B.y * wide],
        [2, B.zFar, B.zNear],
      ];
      for (const [a, lo, hi] of lim) {
        const x = P[o + a] ?? 0;
        if (x < lo || x > hi) {
          P[o + a] = Math.min(hi, Math.max(lo, x));
          const vv = V[o + a] ?? 0;
          if ((x < lo && vv < 0) || (x > hi && vv > 0)) {
            hardest = Math.max(hardest, Math.abs(vv));
            V[o + a] = -vv * S.wallBounce;
          }
        }
      }
      maxSpeed = Math.max(maxSpeed, Math.hypot(V[o] ?? 0, V[o + 1] ?? 0, V[o + 2] ?? 0));
      maxOff = Math.max(maxOff, Math.hypot((P[o] ?? 0) - (this.home[o] ?? 0), (P[o + 1] ?? 0) - (this.home[o + 1] ?? 0), (P[o + 2] ?? 0) - (this.home[o + 2] ?? 0)));
    }
    // the legend-up spring: each key back to its resting tilt (face to the camera)
    let maxSpin = 0;
    for (let i = 0; i < n; i++) {
      q.fromArray(this.rot, i * 4);
      qe.fromArray(this.tilt, i * 4).multiply(qi.copy(q).invert());
      if (qe.w < 0) qe.set(-qe.x, -qe.y, -qe.z, -qe.w);
      const angle = 2 * Math.acos(Math.min(1, qe.w));
      const s = Math.sqrt(Math.max(0, 1 - qe.w * qe.w));
      const ax = s > 1e-6 ? qe.x / s : 0;
      const ay = s > 1e-6 ? qe.y / s : 0;
      const az = s > 1e-6 ? qe.z / s : 0;
      const o = i * 3;
      const wx = (this.w[o] ?? 0) + (kOrient * angle * ax - cOrient * (this.w[o] ?? 0)) * h;
      const wy = (this.w[o + 1] ?? 0) + (kOrient * angle * ay - cOrient * (this.w[o + 1] ?? 0)) * h;
      const wz = (this.w[o + 2] ?? 0) + (kOrient * angle * az - cOrient * (this.w[o + 2] ?? 0)) * h;
      this.w.set([wx, wy, wz], o);
      // q ← q + ½ (ω ⊗ q) h, normalised
      qe.set(wx, wy, wz, 0).multiply(q);
      q.set(q.x + 0.5 * qe.x * h, q.y + 0.5 * qe.y * h, q.z + 0.5 * qe.z * h, q.w + 0.5 * qe.w * h).normalize();
      this.rot.set([q.x, q.y, q.z, q.w], i * 4);
      maxSpin = Math.max(maxSpin, Math.hypot(wx, wy, wz));
    }
    // sleep once it's all still for a moment
    if (maxSpeed < S.sleepSpeed && maxSpin < S.sleepSpeed * 4 && maxOff < 0.01 && this.grabbed < 0) {
      this.quiet += h;
      if (this.quiet >= S.sleepAfter) this.asleep = true;
    } else this.quiet = 0;
    return hardest;
  }

  /**
   * The gate (A5: physics ≤ 0.3 ms a frame): the micro-sim's cost, ms per frame of `stepsPerFrame`
   * fixed steps (two at 60 Hz, four at the 30 fps cap), awake — a key thrown through the pile —
   * timed on its own and then put back as it was.
   */
  benchPhysics(frames = 600, stepsPerFrame = 2): number {
    if (this.mode !== "sim" || !this.count) return 0;
    const saved = [this.p, this.v, this.rot, this.w].map((a) => a.slice());
    const { accumulator, quiet, asleep } = this;
    const throwIt = () => {
      this.v[0] = S.maxThrow * 0.8;
      this.v[1] = S.maxThrow * 0.2;
    };
    throwIt();
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      if (f % 120 === 0) throwIt();
      for (let k = 0; k < stepsPerFrame; k++) clackIntensity(this.step(S.step));
    }
    const ms = (performance.now() - t0) / frames;
    [this.p, this.v, this.rot, this.w].forEach((a, i) => a.set(saved[i] as Float32Array));
    Object.assign(this, { accumulator, quiet, asleep });
    return ms;
  }

  /** Debug and the gate. */
  debugState() {
    const g = this.caps.geometry;
    return {
      mode: this.mode,
      count: this.count,
      asleep: this.asleep,
      hovered: this.hovered,
      grabbed: this.grabbed,
      cluster: this.cluster,
      columns: this.view.columns,
      depth: this.depth,
      bounds: { ...this.bounds },
      triangles: (g.index?.count ?? 0) / 3,
      meshes: this.group.children.map((o) => ({ type: o.type, instanced: (o as InstancedMesh).isInstancedMesh === true, count: (o as InstancedMesh).count })),
      positions: Array.from(this.p),
      homes: Array.from(this.home),
      screen: Array.from(this.screen),
      theme: (this.capMat.uniforms.uTheme as { value: number }).value,
      paper: (this.capMat.uniforms.uPaper as { value: number }).value,
      lit: Array.from(this.lit),
      dim: Array.from(this.dim),
    };
  }

  dispose(): void {
    this.caps.geometry.dispose();
    this.shadows.geometry.dispose();
    this.capMat.dispose();
    this.shadowMat.dispose();
    this.legends.dispose();
    this.matcaps.dispose();
    this.caps.dispose();
    this.shadows.dispose();
  }
}

/** When a lit key was lit (its store seq), so the row's light runs out after KEYS.litMs. */
const litTimes = new Map<number, number>();
function litSince(seq: number): number {
  let t = litTimes.get(seq);
  if (t === undefined) {
    t = performance.now();
    litTimes.clear();
    litTimes.set(seq, t);
  }
  return t;
}
