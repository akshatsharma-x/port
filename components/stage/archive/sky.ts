import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DynamicDrawUsage,
  GLSL3,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineSegments,
  Matrix4,
  MaxEquation,
  MinEquation,
  OneFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from "three";
import type { LayoutName } from "@/content/schema";
import { ARCHIVE, citationMs, glyphRadius, loopPose, skyView, yearNote } from "@/lib/archive";
import { CIRCLE_RADIUS, MAX_SHAPE_VERTICES, POINT_RADIUS, SHAPE_ORDER, SHAPE_VERTICES } from "@/lib/archive-shapes";
import { cue } from "@/lib/cues";
import type { StageData } from "@/lib/hero";
import { relayout, springs } from "@/lib/motion";
import { MAX_DT, Spring, SUBSTEP } from "@/lib/spring";
import { tokenLinear } from "@/lib/token-color";
import { EDGE_FRAG, EDGE_VERT, NODE_FRAG, NODE_VERT } from "@/shaders/archive";

type Graph = StageData["graph"];
const LAYOUTS: readonly LayoutName[] = ["topic", "year", "venue"];
const DEG = Math.PI / 180;
const CITES = 1 << 3; // StageData edge kinds: 1 author · 2 related · 4 topic · 8 cites

export interface SkyFrame {
  dt: number;
  /** the scene's clock (s): pulse, drift and the plotter */
  time: number;
  camera: PerspectiveCamera;
  /** the slot, CSS px */
  width: number;
  height: number;
  /** pinProgress("archive") */
  progress: number;
  /** the pointer in slot px, when one hovers it (touch never hovers) */
  pointer: { x: number; y: number } | null;
  /** the slot's top edge in viewport px (screen() answers in viewport px) */
  top?: number;
  /** the poster's still: the plot drawn, nothing breathing, nothing hovered */
  still: boolean;
}

/**
 * A3's sky (DESIGN.md §4.3 A3): two draws — the glyphs, one InstancedMesh with one material, and
 * the edges, one merged LineSegments — under a camera that scroll flies on the retrograde loop.
 *
 * Positions come from content/graph.json's three baked layouts; nothing simulates at runtime. A
 * re-plot springs each node to its new coordinates on `relayout`: mass = 1 + normalized
 * citations, damping = 14·√m, so the most-cited settle last without bouncing more (RK4 at the
 * project's 1/240 s sub-step, batched over Float32Arrays). The class owns no render loop:
 * frame() advances it and says whether anything is still moving.
 */
export class Sky {
  readonly group = new Group();
  readonly count: number;
  /** my records are the first `records` nodes (content/graph.ts) */
  readonly records: number;
  private readonly graph: Graph;

  // the re-plot: per node and axis — position, velocity, goal; per node — mass and damping
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly goal: Float32Array;
  private readonly mass: Float32Array;
  private readonly damping: Float32Array;
  private readonly stiffness: number;
  private moving = true;

  private readonly nodeMat: ShaderMaterial;
  private readonly glyphs: InstancedMesh;
  private readonly aCenter: InstancedBufferAttribute;
  private readonly aState: InstancedBufferAttribute;
  private readonly aMisc: InstancedBufferAttribute;
  private readonly stateGoal: Float32Array;
  private readonly recedeGoal: Float32Array;
  private readonly radius: Float32Array;

  private readonly edgeMat: ShaderMaterial;
  private readonly lines: LineSegments;
  private readonly ePos: BufferAttribute;
  private readonly eAttr: BufferAttribute;
  private readonly litGoal: Float32Array;
  private readonly eRecedeGoal: Float32Array;
  private readonly incident: number[][];
  private readonly neighbors: number[][];

  layout: LayoutName = "topic";
  /** the node under the cursor, the dial's pick, what the page points at, the open record */
  hovered = -1;
  dial = -1;
  pointed = -1;
  hot = -1;
  private keyword: Uint8Array | null = null;
  private plotAt = -1;
  private plotDue = true;
  private easing = true;

  // the camera: scroll's pose and the dossier's dolly, carried on the heavy spring
  private readonly rig = {
    azimuth: new Spring(springs.heavy),
    elevation: new Spring(springs.heavy),
    distance: new Spring(springs.heavy),
    x: new Spring(springs.heavy),
    y: new Spring(springs.heavy),
    z: new Spring(springs.heavy),
  };
  private rigSnapped = false;
  /** the camera orbits the sky's weighted center; the loop happens on the densest cluster's side */
  private readonly center = new Vector3();
  private readonly cluster = new Vector3();
  private clusterAzimuth = 0;
  private reach = 10;
  private readonly maxYear: number;
  private readonly minYear: number;
  private readonly maxCitations: number;

  private slotTop = 0;
  private readonly vp = new Matrix4();
  private readonly v = new Vector3();
  private readonly labels: Record<LayoutName, Float32Array>;

  constructor(graph: Graph) {
    this.graph = graph;
    const n = (this.count = graph.nodes.length);
    this.records = graph.nodes.filter((nd) => nd.kind === 0).length;

    const recordMax = Math.max(0, ...graph.nodes.filter((nd) => nd.kind === 0).map((nd) => nd.citations));
    const citedMax = Math.max(0, ...graph.nodes.filter((nd) => nd.kind === 1).map((nd) => nd.citations));
    const allMax = Math.max(recordMax, citedMax);
    this.maxCitations = allMax;
    const years = graph.nodes.map((nd) => nd.pubYear);
    this.minYear = Math.min(...years);
    this.maxYear = Math.max(...years);

    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.goal = new Float32Array(n * 3);
    this.mass = new Float32Array(n);
    this.damping = new Float32Array(n);
    this.radius = new Float32Array(n);
    this.stiffness = relayout(0).stiffness;
    graph.nodes.forEach((nd, i) => {
      const max = nd.kind === 0 ? recordMax : citedMax;
      const s = relayout(max > 0 ? nd.citations / max : 0);
      this.mass[i] = s.mass;
      this.damping[i] = s.damping;
      this.radius[i] = glyphRadius(nd.kind, nd.citations, max);
      this.pos.set(nd.topic, i * 3);
      this.goal.set(nd.topic, i * 3);
    });

    // ── the glyphs ──
    const quad = new PlaneGeometry(2, 2);
    const glyphData = new Float32Array(n * 4);
    const misc = new Float32Array(n * 2);
    graph.nodes.forEach((nd, i) => {
      glyphData.set([nd.shape, nd.kind, nd.dashed ? 1 : 0, this.radius[i] ?? 0], i * 4);
      misc[i * 2] = fract(Math.sin((i + 1) * 12.9898) * 43758.5453); // pulse phase, fixed per node
    });
    this.aCenter = new InstancedBufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage);
    this.aState = new InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage);
    this.aMisc = new InstancedBufferAttribute(misc, 2).setUsage(DynamicDrawUsage);
    this.stateGoal = new Float32Array(n * 4);
    this.recedeGoal = new Float32Array(n);
    quad.setAttribute("aCenter", this.aCenter);
    quad.setAttribute("aGlyph", new InstancedBufferAttribute(glyphData, 4));
    quad.setAttribute("aState", this.aState);
    quad.setAttribute("aMisc", this.aMisc);

    const shapes = new Array<Vector2>(SHAPE_ORDER.length * MAX_SHAPE_VERTICES).fill(new Vector2()).map(() => new Vector2());
    const counts = SHAPE_ORDER.map((t, s) => {
      if (t === "conference") return 0;
      const pts = SHAPE_VERTICES[t];
      pts.forEach(([x, y], k) => shapes[s * MAX_SHAPE_VERTICES + k]?.set(x, y));
      return pts.length;
    });
    // MAX on the dark tubes (the brightest light wins), MIN on Paper (the darkest ink): applyTheme()
    const blend = { blending: CustomBlending, blendEquation: MaxEquation, blendSrc: OneFactor, blendDst: OneFactor, transparent: true, depthTest: false, depthWrite: false } as const;
    this.nodeMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      ...blend,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: new Vector2(ARCHIVE.node.pulse.periodS, ARCHIVE.node.pulse.depth) },
        uScale: { value: new Vector2(ARCHIVE.node.hoverScale, ARCHIVE.node.focusScale) },
        uMargin: { value: ARCHIVE.node.margin },
        uFogShape: { value: new Vector2() },
        uShapes: { value: shapes },
        uShapeN: { value: counts },
        uRound: { value: new Vector2(CIRCLE_RADIUS, POINT_RADIUS) },
        uGround: { value: new Vector3() },
        uInk: { value: new Vector3(1, 1, 1) },
        uFaint: { value: new Vector3(0.5, 0.5, 0.5) },
        uAccent: { value: new Vector3(0, 1, 0) },
        uHot: { value: new Vector3(1, 0, 0.5) },
        uCitedLight: { value: ARCHIVE.node.citedLight },
        uGlow: { value: ARCHIVE.node.glow },
        uDash: { value: new Vector3(ARCHIVE.node.dash.count, ARCHIVE.node.dash.duty, ARCHIVE.node.dash.stroke) },
        uRecedeBy: { value: ARCHIVE.recede },
      },
    });
    this.glyphs = new InstancedMesh(quad, this.nodeMat, n);
    this.glyphs.frustumCulled = false; // the instances move; their matrices stay identity
    this.glyphs.renderOrder = 1;

    // ── the edges ──
    const edges = graph.edges;
    const m = edges.length;
    this.ePos = new BufferAttribute(new Float32Array(m * 6), 3).setUsage(DynamicDrawUsage);
    this.eAttr = new BufferAttribute(new Float32Array(m * 8), 4).setUsage(DynamicDrawUsage);
    const ends = new Float32Array(m * 2);
    this.incident = Array.from({ length: n }, () => []);
    this.neighbors = Array.from({ length: n }, () => []);
    edges.forEach(([s, t, , kinds], e) => {
      ends[e * 2 + 1] = 1;
      const kind = kinds & CITES ? 1 : 0;
      this.eAttr.setY(e * 2, kind);
      this.eAttr.setY(e * 2 + 1, kind);
      this.incident[s]?.push(e);
      this.incident[t]?.push(e);
      this.neighbors[s]?.push(t);
      this.neighbors[t]?.push(s);
    });
    this.litGoal = new Float32Array(m);
    this.eRecedeGoal = new Float32Array(m);
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute("position", this.ePos);
    lineGeo.setAttribute("aEnd", new BufferAttribute(ends, 1));
    lineGeo.setAttribute("aEdge", this.eAttr);
    this.edgeMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: EDGE_VERT,
      fragmentShader: EDGE_FRAG,
      ...blend,
      uniforms: {
        uTime: { value: 0 },
        uDraw: { value: new Vector2(-1e6, ARCHIVE.edges.drawMs / 1000) },
        uFogShape: { value: new Vector2() },
        uGround: { value: new Vector3() },
        uInk: { value: new Vector3(1, 1, 1) },
        uFaint: { value: new Vector3(0.5, 0.5, 0.5) },
        uLight: { value: new Vector3(ARCHIVE.edges.light.record, ARCHIVE.edges.light.cited, ARCHIVE.edges.light.lit) },
        uRecedeBy: { value: ARCHIVE.recede },
      },
    });
    this.lines = new LineSegments(lineGeo, this.edgeMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 0;

    this.labels = Object.fromEntries(LAYOUTS.map((l) => [l, new Float32Array(graph.labels[l].length * 3)])) as Record<LayoutName, Float32Array>;
    this.group.add(this.lines, this.glyphs);
    this.retarget();
    this.writeEdges();
  }

  // ── what the page asks for ──────────────────────────────────────────────────────────────

  /** A layout chip: every node springs to its coordinates there, and the plotter redraws. */
  setLayout(layout: LayoutName): boolean {
    if (layout === this.layout) return false;
    this.layout = layout;
    this.retarget();
    this.plotDue = true;
    this.moving = true;
    return true;
  }

  /** A keyword chip's filter: records without it, and the works only they cite, recede. */
  setKeyword(matches: readonly number[] | null): void {
    if (!matches) {
      this.keyword = null;
    } else {
      const k = new Uint8Array(this.count);
      for (const i of matches) k[i] = 1;
      // a cited work stays lit if any paper citing it does
      for (let i = this.records; i < this.count; i++) if ((this.neighbors[i] ?? []).some((j) => j < this.records && k[j])) k[i] = 1;
      this.keyword = k;
    }
    this.easing = true;
  }

  setPointed(index: number | null): void {
    this.pointed = index ?? -1;
    this.easing = true;
  }

  /** The open record (the dossier): HOT, and the camera dollies to it. */
  setHot(index: number | null): void {
    this.hot = index ?? -1;
    this.easing = true;
  }

  /** Colors from the theme's tokens (§2.4: color is state only); Paper is ink on a chart. */
  applyTheme(): void {
    const paper = document.documentElement.dataset.theme === "paper";
    const set = (u: ShaderMaterial["uniforms"], key: string, token: string) => (u[key]?.value as Vector3).set(...tokenLinear(token));
    for (const mat of [this.nodeMat, this.edgeMat]) {
      set(mat.uniforms, "uGround", "--bg");
      set(mat.uniforms, "uFaint", "--fg-3");
      mat.blendEquation = paper ? MinEquation : MaxEquation;
    }
    set(this.nodeMat.uniforms, "uInk", "--fg-1");
    set(this.edgeMat.uniforms, "uInk", "--fg-2");
    set(this.nodeMat.uniforms, "uAccent", "--accent");
    set(this.nodeMat.uniforms, "uHot", "--hot");
    (this.nodeMat.uniforms.uGlow as { value: number }).value = paper ? 0 : ARCHIVE.node.glow;
    this.easing = true;
  }

  // ── the frame ───────────────────────────────────────────────────────────────────────────

  /** Advances the sky one frame; true while anything still moves (the governor's on-demand mode). */
  frame(f: SkyFrame): boolean {
    this.slotTop = f.top ?? 0;
    const dt = Math.min(Math.max(f.dt, 0), MAX_DT);
    const moved = this.moving ? this.stepNodes(dt) : false;
    this.moving = moved;
    if (moved) this.writeEdges();

    const camMoving = this.flyCamera(f, dt);
    f.camera.updateMatrixWorld();
    this.vp.multiplyMatrices(f.camera.projectionMatrix, f.camera.matrixWorldInverse);
    this.project(f);

    const prevHover = this.hovered;
    this.hovered = f.still || !f.pointer ? -1 : this.pick(f.pointer.x, f.pointer.y);
    const dialMoved = !f.still && this.turnDial(f);
    if (this.hovered !== prevHover || dialMoved) this.easing = true;

    if (this.plotDue && f.width > 0) this.startPlot(f);
    const u = f.still ? 1e6 : f.time;
    (this.nodeMat.uniforms.uTime as { value: number }).value = f.still ? 0 : f.time;
    (this.edgeMat.uniforms.uTime as { value: number }).value = u;
    this.writeFog(f.camera);

    const eased = this.easing ? this.ease(f.still ? 1 : 1 - Math.exp(-ARCHIVE.ease * dt)) : false;
    this.easing = eased;
    const plotting = !f.still && f.time - this.plotAt < (ARCHIVE.edges.drawMs + ARCHIVE.edges.staggerMs) / 1000 + 0.05;

    skyView.layout = this.layout;
    skyView.hovered = this.hovered;
    skyView.version++;
    // my records breathe: the stage stays live while the sky is on screen, at the governor's pace
    return !f.still && (moved || camMoving || eased || plotting || this.records > 0);
  }

  /** The node in focus: what the page points at, else the cursor's, else the dial's. */
  get focused(): number {
    return this.pointed >= 0 ? this.pointed : this.hovered >= 0 ? this.hovered : this.dial;
  }

  // ── the re-plot ─────────────────────────────────────────────────────────────────────────

  private retarget(): void {
    const key = this.layout;
    this.graph.nodes.forEach((nd, i) => this.goal.set(nd[key], i * 3));
    // where the loop centers: the densest cluster in this layout (records count fully, cited works less)
    const n = this.count;
    let best = 0;
    let bestScore = -1;
    let far = 1e-3;
    for (let i = 0; i < n; i++) far = Math.max(far, Math.hypot(this.goal[i * 3] ?? 0, this.goal[i * 3 + 1] ?? 0, this.goal[i * 3 + 2] ?? 0));
    const sigma2 = (far * 0.3) ** 2;
    for (let i = 0; i < this.records; i++) {
      let score = 0;
      for (let j = 0; j < n; j++) {
        const d2 = dist2(this.goal, i, j);
        score += (j < this.records ? 1 : ARCHIVE.node.citedLight) * Math.exp(-d2 / (2 * sigma2));
      }
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    let w = 0;
    this.cluster.set(0, 0, 0);
    if (this.records > 0) {
      for (let j = 0; j < n; j++) {
        const k = (j < this.records ? 1 : ARCHIVE.node.citedLight) * Math.exp(-dist2(this.goal, best, j) / (2 * sigma2));
        this.cluster.x += (this.goal[j * 3] ?? 0) * k;
        this.cluster.y += (this.goal[j * 3 + 1] ?? 0) * k;
        this.cluster.z += (this.goal[j * 3 + 2] ?? 0) * k;
        w += k;
      }
      this.cluster.multiplyScalar(1 / Math.max(w, 1e-6));
    }
    // the sky's weighted center (records fully, cited works less): what the camera orbits and frames
    let cw = 0;
    this.center.set(0, 0, 0);
    for (let j = 0; j < n; j++) {
      const k = j < this.records ? 1 : ARCHIVE.node.citedLight;
      this.center.x += (this.goal[j * 3] ?? 0) * k;
      this.center.y += (this.goal[j * 3 + 1] ?? 0) * k;
      this.center.z += (this.goal[j * 3 + 2] ?? 0) * k;
      cw += k;
    }
    this.center.multiplyScalar(1 / Math.max(cw, 1e-6));
    // the loop's bearing: from the center toward the densest cluster (straight on when they coincide)
    const dx = this.cluster.x - this.center.x;
    const dz = this.cluster.z - this.center.z;
    this.clusterAzimuth = Math.hypot(dx, dz) > far * 0.05 ? Math.atan2(dx, dz) : 0;
    let reach = 1e-3;
    for (let j = 0; j < n; j++) {
      reach = Math.max(reach, Math.hypot((this.goal[j * 3] ?? 0) - this.center.x, (this.goal[j * 3 + 1] ?? 0) - this.center.y, (this.goal[j * 3 + 2] ?? 0) - this.center.z) + (this.radius[j] ?? 0));
    }
    this.reach = reach;
  }

  /** Batched RK4 of every node's spring; true while any is still moving. */
  private stepNodes(dt: number): boolean {
    const { pos, vel, goal, mass, damping } = this;
    const k = this.stiffness;
    const n = this.count;
    let remaining = dt;
    while (remaining > 1e-9) {
      const h = remaining < SUBSTEP ? remaining : SUBSTEP;
      for (let i = 0; i < n; i++) {
        const m = mass[i] ?? 1;
        const c = damping[i] ?? 14;
        for (let a = 0; a < 3; a++) {
          const q = i * 3 + a;
          const g = goal[q] ?? 0;
          const x0 = pos[q] ?? 0;
          const v0 = vel[q] ?? 0;
          const k1v = (-k * (x0 - g) - c * v0) / m;
          const x1 = x0 + 0.5 * h * v0;
          const v1 = v0 + 0.5 * h * k1v;
          const k2v = (-k * (x1 - g) - c * v1) / m;
          const x2 = x0 + 0.5 * h * v1;
          const v2 = v0 + 0.5 * h * k2v;
          const k3v = (-k * (x2 - g) - c * v2) / m;
          const x3 = x0 + h * v2;
          const v3 = v0 + h * k3v;
          const k4v = (-k * (x3 - g) - c * v3) / m;
          pos[q] = x0 + (h / 6) * (v0 + 2 * v1 + 2 * v2 + v3);
          vel[q] = v0 + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
        }
      }
      remaining -= h;
    }
    let still = true;
    for (let q = 0; q < n * 3; q++) {
      if (Math.abs((pos[q] ?? 0) - (goal[q] ?? 0)) > 1e-3 || Math.abs(vel[q] ?? 0) > 1e-2) {
        still = false;
        break;
      }
    }
    this.aCenter.needsUpdate = true;
    if (still) {
      pos.set(goal);
      vel.fill(0);
    }
    return !still;
  }

  private writeEdges(): void {
    const p = this.ePos.array as Float32Array;
    this.graph.edges.forEach(([s, t], e) => {
      p.set(this.pos.subarray(s * 3, s * 3 + 3), e * 6);
      p.set(this.pos.subarray(t * 3, t * 3 + 3), e * 6 + 3);
    });
    this.ePos.needsUpdate = true;
  }

  // ── the camera ──────────────────────────────────────────────────────────────────────────

  private flyCamera(f: SkyFrame, dt: number): boolean {
    const cam = f.camera;
    const c = ARCHIVE.camera;
    const pose = loopPose(f.still ? 0 : f.progress);
    const aspect = f.width / Math.max(1, f.height);
    const fit = Math.tan((cam.fov * DEG) / 2) * Math.min(1, aspect);
    const arcs = this.reach / (c.fill * fit);
    const drift = f.still ? 0 : c.drift.yawDeg * DEG * Math.sin((2 * Math.PI * f.time) / c.drift.periodS);
    let az = this.clusterAzimuth + pose.azimuth + drift;
    let el = pose.elevation;
    let dist = arcs * pose.distance;
    let tx = this.center.x;
    let ty = this.center.y;
    let tz = this.center.z;
    if (this.hot >= 0 && this.hot < this.count && !f.still) {
      // the dossier: dolly in along the current bearing until the record fills its share of the frame
      tx = this.pos[this.hot * 3] ?? tx;
      ty = this.pos[this.hot * 3 + 1] ?? ty;
      tz = this.pos[this.hot * 3 + 2] ?? tz;
      dist = ((this.radius[this.hot] ?? 0.5) * c.dollyRadii) / fit;
      az = this.rig.azimuth.target;
      el = this.rig.elevation.target;
      // on a landscape screen the dossier covers the right: aim to the record's right, so it sits left
      if (aspect > 1) {
        const shift = c.dollyShift * 2 * dist * Math.tan((cam.fov * DEG) / 2) * aspect;
        tx += Math.cos(az) * shift;
        tz -= Math.sin(az) * shift;
      }
    }
    const r = this.rig;
    if (!this.rigSnapped || f.still) {
      r.azimuth.snap(az);
      r.elevation.snap(el);
      r.distance.snap(dist);
      r.x.snap(tx);
      r.y.snap(ty);
      r.z.snap(tz);
      this.rigSnapped = true;
    } else {
      r.azimuth.setTarget(az).step(dt);
      r.elevation.setTarget(el).step(dt);
      r.distance.setTarget(dist).step(dt);
      r.x.setTarget(tx).step(dt);
      r.y.setTarget(ty).step(dt);
      r.z.setTarget(tz).step(dt);
    }
    const ce = Math.cos(r.elevation.value);
    cam.position.set(
      r.x.value + Math.sin(r.azimuth.value) * ce * r.distance.value,
      r.y.value + Math.sin(r.elevation.value) * r.distance.value,
      r.z.value + Math.cos(r.azimuth.value) * ce * r.distance.value,
    );
    cam.lookAt(r.x.value, r.y.value, r.z.value);
    // the clip planes follow the sky: everything within reach of the target, whatever the distance
    const near = Math.max(0.05, r.distance.value - this.reach * 1.6);
    const farPlane = r.distance.value + this.reach * 1.6;
    if (Math.abs(cam.near - near) > 1e-3 || Math.abs(cam.far - farPlane) > 1e-3) {
      cam.near = near;
      cam.far = farPlane;
      cam.updateProjectionMatrix();
    }
    return !Object.values(r).every((s) => s.isSettled(1e-4));
  }

  /** Fog by view depth: it starts a little in front of the target and swallows the far side. */
  private writeFog(cam: PerspectiveCamera): void {
    const target = this.v.set(this.rig.x.value, this.rig.y.value, this.rig.z.value);
    const depth = cam.position.distanceTo(target);
    const start = depth - this.reach * 0.25;
    const density = Math.sqrt(-Math.log(1 - 0.7)) / (this.reach * 1.25);
    (this.nodeMat.uniforms.uFogShape?.value as Vector2).set(density, start);
    (this.edgeMat.uniforms.uFogShape?.value as Vector2).set(density, start);
  }

  // ── screen space: the page's HTML, the cursor, the dial ─────────────────────────────────

  private project(f: SkyFrame): void {
    const n = this.count;
    if (skyView.nodes.length !== n * 4) skyView.nodes = new Float32Array(n * 4);
    const out = skyView.nodes;
    const e = this.vp.elements;
    const halfH = f.height / 2;
    const focal = halfH / Math.tan((f.camera.fov * DEG) / 2);
    for (let i = 0; i < n; i++) {
      const x = this.pos[i * 3] ?? 0;
      const y = this.pos[i * 3 + 1] ?? 0;
      const z = this.pos[i * 3 + 2] ?? 0;
      const cx = (e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0);
      const cy = (e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z + (e[13] ?? 0);
      const cw = (e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 0);
      if (cw <= 1e-6) {
        out.set([-1e5, -1e5, Infinity, 0], i * 4);
        continue;
      }
      out[i * 4] = (cx / cw + 1) * 0.5 * f.width;
      out[i * 4 + 1] = (1 - cy / cw) * 0.5 * f.height;
      out[i * 4 + 2] = cw;
      out[i * 4 + 3] = ((this.radius[i] ?? 0) * focal) / cw;
    }
    skyView.width = f.width;
    skyView.height = f.height;
    const labels = this.graph.labels[this.layout];
    const lp = this.labels[this.layout];
    labels.forEach((l, k) => {
      const [x, y, z] = l.at;
      const cx = (e[0] ?? 0) * x + (e[4] ?? 0) * y + (e[8] ?? 0) * z + (e[12] ?? 0);
      const cy = (e[1] ?? 0) * x + (e[5] ?? 0) * y + (e[9] ?? 0) * z + (e[13] ?? 0);
      const cw = (e[3] ?? 0) * x + (e[7] ?? 0) * y + (e[11] ?? 0) * z + (e[15] ?? 0);
      lp[k * 3] = cw > 1e-6 ? (cx / cw + 1) * 0.5 * f.width : -1e5;
      lp[k * 3 + 1] = cw > 1e-6 ? (1 - cy / cw) * 0.5 * f.height : -1e5;
      lp[k * 3 + 2] = cw > 1e-6 ? cw : Infinity;
    });
    skyView.labels = lp;
  }

  /** The glyph under (x, y), nearest first; every glyph's target is at least 24 px across. */
  private pick(x: number, y: number): number {
    const s = skyView.nodes;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.count; i++) {
      if (!Number.isFinite(s[i * 4 + 2] ?? Infinity)) continue;
      const reach = Math.max(ARCHIVE.pick.minPx, (s[i * 4 + 3] ?? 0) * ARCHIVE.node.hoverScale + ARCHIVE.pick.slopPx);
      const d = Math.hypot((s[i * 4] ?? 0) - x, (s[i * 4 + 1] ?? 0) - y);
      // nearer glyphs win ties: divide by the depth, so the front of a stack is what you touch
      if (d <= reach && d / reach < bestD) {
        bestD = d / reach;
        best = i;
      }
    }
    return best;
  }

  /** The dial: the node nearest the view's center takes focus as the camera passes (§4.3). */
  private turnDial(f: SkyFrame): boolean {
    const s = skyView.nodes;
    const cx = f.width / 2;
    const cy = f.height / 2;
    const at = (i: number) => (i < 0 ? Infinity : Math.hypot((s[i * 4] ?? 0) - cx, (s[i * 4 + 1] ?? 0) - cy));
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.count; i++) {
      if (!Number.isFinite(s[i * 4 + 2] ?? Infinity)) continue;
      const d = at(i);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const within = ARCHIVE.dial.within * Math.min(f.width, f.height);
    if (bestD > within) best = -1;
    const current = at(this.dial);
    if (best === this.dial || (this.dial >= 0 && current <= within && bestD > current - ARCHIVE.dial.hysteresisPx)) return false;
    this.dial = best;
    if (best >= 0 && this.pointed < 0 && this.hovered < 0) {
      const nd = this.graph.nodes[best];
      // §6.4: the nearest node's year on A-minor pentatonic, its citations as the blip's length
      if (nd) cue("ARCHIVE", { hz: yearNote(nd.pubYear, this.minYear, this.maxYear), ms: citationMs(nd.citations, this.maxCitations) });
    }
    return true;
  }

  // ── the plotter and the eased states ────────────────────────────────────────────────────

  /** The pen plotter: every edge draws in, nearest the camera first, inside 900 ms in all. */
  private startPlot(f: SkyFrame): void {
    this.plotDue = false;
    this.plotAt = f.time;
    const cam = f.camera.position;
    const d = this.graph.edges.map(([s, t]) => {
      const mx = ((this.goal[s * 3] ?? 0) + (this.goal[t * 3] ?? 0)) / 2;
      const my = ((this.goal[s * 3 + 1] ?? 0) + (this.goal[t * 3 + 1] ?? 0)) / 2;
      const mz = ((this.goal[s * 3 + 2] ?? 0) + (this.goal[t * 3 + 2] ?? 0)) / 2;
      return Math.hypot(mx - cam.x, my - cam.y, mz - cam.z);
    });
    const lo = Math.min(...d);
    const hi = Math.max(...d);
    d.forEach((di, e) => {
      const delay = hi > lo ? ((di - lo) / (hi - lo)) * (ARCHIVE.edges.staggerMs / 1000) : 0;
      this.eAttr.setX(e * 2, delay);
      this.eAttr.setX(e * 2 + 1, delay);
    });
    this.eAttr.needsUpdate = true;
    (this.edgeMat.uniforms.uDraw?.value as Vector2).x = f.time;
  }

  /** Eases every glyph's and edge's state toward its goal; true while any is still changing. */
  private ease(k: number): boolean {
    const n = this.count;
    const focus = this.focused;
    const context = this.pointed >= 0 ? this.pointed : this.hovered;
    const lit = new Set(context >= 0 ? (this.neighbors[context] ?? []) : []);
    for (let i = 0; i < n; i++) {
      this.stateGoal[i * 4] = i === context ? 1 : 0;
      this.stateGoal[i * 4 + 1] = lit.has(i) ? 1 : 0;
      this.stateGoal[i * 4 + 2] = i === focus ? 1 : 0;
      this.stateGoal[i * 4 + 3] = i === this.hot ? 1 : 0;
      const byContext = context >= 0 && i !== context && !lit.has(i) ? 1 : 0;
      const byKeyword = this.keyword && !this.keyword[i] ? 1 : 0;
      this.recedeGoal[i] = Math.max(byContext, byKeyword);
    }
    const litEdges = new Set(context >= 0 ? (this.incident[context] ?? []) : []);
    this.graph.edges.forEach(([s, t], e) => {
      this.litGoal[e] = litEdges.has(e) ? 1 : 0;
      this.eRecedeGoal[e] = Math.max(this.recedeGoal[s] ?? 0, this.recedeGoal[t] ?? 0) * (litEdges.has(e) ? 0 : 1);
    });

    let changing = false;
    const st = this.aState.array as Float32Array;
    for (let q = 0; q < n * 4; q++) {
      const g = this.stateGoal[q] ?? 0;
      const v = st[q] ?? 0;
      const next = Math.abs(g - v) < 1e-3 ? g : v + (g - v) * k;
      if (next !== g) changing = true;
      st[q] = next;
    }
    const misc = this.aMisc.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const g = this.recedeGoal[i] ?? 0;
      const v = misc[i * 2 + 1] ?? 0;
      const next = Math.abs(g - v) < 1e-3 ? g : v + (g - v) * k;
      if (next !== g) changing = true;
      misc[i * 2 + 1] = next;
    }
    const ea = this.eAttr.array as Float32Array;
    for (let e = 0; e < this.graph.edges.length; e++) {
      for (const [slot, goal] of [
        [2, this.litGoal[e] ?? 0],
        [3, this.eRecedeGoal[e] ?? 0],
      ] as const) {
        for (const end of [0, 1]) {
          const q = (e * 2 + end) * 4 + slot;
          const v = ea[q] ?? 0;
          const next = Math.abs(goal - v) < 1e-3 ? goal : v + (goal - v) * k;
          if (next !== goal) changing = true;
          ea[q] = next;
        }
      }
    }
    this.aState.needsUpdate = true;
    this.aMisc.needsUpdate = true;
    this.eAttr.needsUpdate = true;
    return changing;
  }

  // ── the gate's view (?debug=1) ──────────────────────────────────────────────────────────

  /** Where star i was drawn last frame, in viewport px, with its glyph's radius (null when off screen). */
  screen(i: number): { x: number; y: number; r: number } | null {
    const s = skyView.nodes;
    if (!Number.isFinite(s[i * 4 + 2] ?? Infinity)) return null;
    return { x: s[i * 4] ?? 0, y: (s[i * 4 + 1] ?? 0) + this.slotTop, r: s[i * 4 + 3] ?? 0 };
  }

  debugState() {
    return {
      layout: this.layout,
      count: this.count,
      records: this.records,
      edges: this.graph.edges.length,
      hovered: this.hovered,
      dial: this.dial,
      focused: this.focused,
      pointed: this.pointed,
      hot: this.hot,
      /** a keyword's filter: the lit stars, or null when the whole sky is lit */
      lit: this.keyword ? Array.from(this.keyword.keys()).filter((i) => this.keyword?.[i]) : null,
      moving: this.moving,
      plotAt: this.plotAt,
      camera: { azimuthDeg: (this.rig.azimuth.value - this.clusterAzimuth) / DEG, elevationDeg: this.rig.elevation.value / DEG, distance: this.rig.distance.value },
      reach: this.reach,
      /** each node's distance to its goal in the current layout (the re-plot's settling) */
      offGoal: Array.from({ length: this.count }, (_, i) => Math.sqrt(dist2between(this.pos, this.goal, i))),
      mass: Array.from(this.mass),
    };
  }

  dispose(): void {
    this.glyphs.geometry.dispose();
    this.glyphs.dispose();
    this.nodeMat.dispose();
    this.lines.geometry.dispose();
    this.edgeMat.dispose();
  }
}

function fract(x: number): number {
  return x - Math.floor(x);
}

function dist2(a: Float32Array, i: number, j: number): number {
  const dx = (a[i * 3] ?? 0) - (a[j * 3] ?? 0);
  const dy = (a[i * 3 + 1] ?? 0) - (a[j * 3 + 1] ?? 0);
  const dz = (a[i * 3 + 2] ?? 0) - (a[j * 3 + 2] ?? 0);
  return dx * dx + dy * dy + dz * dz;
}

function dist2between(a: Float32Array, b: Float32Array, i: number): number {
  const dx = (a[i * 3] ?? 0) - (b[i * 3] ?? 0);
  const dy = (a[i * 3 + 1] ?? 0) - (b[i * 3 + 1] ?? 0);
  const dz = (a[i * 3 + 2] ?? 0) - (b[i * 3 + 2] ?? 0);
  return dx * dx + dy * dy + dz * dz;
}
