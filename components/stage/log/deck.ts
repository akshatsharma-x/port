import {
  CatmullRomCurve3,
  DoubleSide,
  GLSL3,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  OneFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  CustomBlending,
  type PerspectiveCamera,
  type Texture,
} from "three";
import { CARD, encode, holeCenter, holes } from "@/lib/hollerith";
import { LOG, MAX_SLOTS } from "@/lib/log";
import { springs } from "@/lib/motion";
import { pointer } from "@/lib/pointer";
import { pinProgress } from "@/lib/scroll";
import { Spring } from "@/lib/spring";
import { tokenLinear } from "@/lib/token-color";
import { CARD_FRAG, CARD_VERT, PANEL_FRAG, PANEL_VERT, SHAFT_FRAG, SHAFT_VERT } from "@/shaders/log";

/**
 * The LOG deck (DESIGN.md §4.3 A2) — its GPU side and per-frame state, outside React: one
 * InstancedMesh of cards, one InstancedMesh of light shafts, the light panel behind. The scene
 * mounts it and calls frame() from its LIVE callback; it never renders on its own.
 *
 * Scroll owns the deck: the LOG pin's progress picks the active card, and the camera follows on a
 * `heavy` spring, so a click on the year scale (a glide to that role's node) is a heavy flight.
 */
export interface DeckCard {
  slug: string;
  text: string;
}

export interface DeckFrame {
  dt: number;
  camera: PerspectiveCamera;
  /** the poster capture: the first card, no cursor */
  still?: boolean;
}

const UP = new Vector3(0, 1, 0);
const DEG = Math.PI / 180;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class LogDeck {
  readonly group = new Group();
  /** the roles' count; slots = roles + the leaders at both ends */
  readonly roles: number;
  private readonly slots: number;
  private readonly rail: CatmullRomCurve3;
  private readonly cards: InstancedMesh;
  private readonly cardMat: ShaderMaterial;
  private readonly aCard: InstancedBufferAttribute;
  private readonly aBehind: InstancedBufferAttribute;
  private readonly shaftMat: ShaderMaterial;
  private readonly panelMat: ShaderMaterial;
  private readonly matrices: Matrix4[];
  private readonly standing: Float32Array;
  private readonly camSpring = new Spring(springs.heavy, 0);
  private readonly bank = new Spring(springs.settle, 0);
  private readonly bends: Spring[];
  private hovered = -1;
  private readonly tmp = { m: new Matrix4(), r: new Matrix4(), inv: new Matrix4(), v: new Vector3(), w: new Vector3(), n: new Vector3(), t: new Vector3(), right: new Vector3(), a: new Vector3(), b: new Vector3(), c: new Vector3(), o: new Vector3(), dir: new Vector3() };

  constructor(atlas: Texture, deck: readonly DeckCard[]) {
    this.roles = deck.length;
    this.slots = Math.min(MAX_SLOTS, deck.length + 2 * LOG.leaders);
    const S = this.slots;
    const L = LOG.leaders;
    const cellOf = (j: number) => (j - L >= 0 && j - L < this.roles ? j - L : LOG.atlas.blankCell);

    // the rail: through the slots' hinge points, swaying across and a little up and down
    const pts: Vector3[] = [];
    for (let j = 0; j < S; j++) {
      const ph = (2 * Math.PI * j) / LOG.sway.period;
      pts.push(new Vector3(LOG.sway.x * Math.sin(ph), LOG.sway.y * Math.sin(ph / 1.7), -j * LOG.spacing));
    }
    this.rail = new CatmullRomCurve3(pts, false, "centripetal");

    // cards: one plane, hinged at its bottom edge (y = 0), bowed in the vertex shader
    const plane = new PlaneGeometry(CARD.width, CARD.height, 24, 6);
    plane.translate(0, CARD.height / 2, 0);
    const A = LOG.atlas;
    const cellW = A.width / A.cols;
    const cellH = A.height / A.rows;
    this.cardMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: CARD_VERT,
      fragmentShader: CARD_FRAG,
      side: DoubleSide,
      uniforms: {
        uAtlas: { value: atlas },
        uAtlasGrid: { value: new Vector2(A.cols, A.rows) },
        uCardInCell: { value: new Vector4(Math.round((cellW - A.card.width) / 2) / cellW, Math.round((cellH - A.card.height) / 2) / cellH, A.card.width / cellW, A.card.height / cellH) },
        uCardSize: { value: new Vector2(CARD.width, CARD.height) },
        uCornerCut: { value: new Vector2(CARD.cornerCut.top, CARD.cornerCut.side) },
        uStock: { value: new Vector3() },
        uInk: { value: new Vector3() },
        uInkBright: { value: new Vector3() },
        uLight: { value: new Vector3() },
        uHole: { value: LOG.light.hole },
        uGlow: { value: LOG.light.glow },
        uFallenFade: { value: LOG.fallenFade },
        uFog: { value: new Vector4() },
        uFogShape: { value: new Vector2(LOG.fog.density, LOG.fog.start) },
      },
    });
    this.cards = new InstancedMesh(plane, this.cardMat, S);
    this.aCard = new InstancedBufferAttribute(new Float32Array(S * 4), 4);
    this.aBehind = new InstancedBufferAttribute(new Float32Array(S * 2), 2);
    plane.setAttribute("aCard", this.aCard);
    plane.setAttribute("aBehind", this.aBehind);
    for (let j = 0; j < S; j++) this.aCard.setX(this.slot(j), cellOf(j));
    this.cards.frustumCulled = false;
    this.cards.renderOrder = 1;
    // the shafts' uniform array is declared MAX_SLOTS long, and three uploads all of it
    this.matrices = Array.from({ length: MAX_SLOTS }, () => new Matrix4());
    this.standing = new Float32Array(S);
    this.bends = Array.from({ length: S }, () => new Spring(springs.settle, 0));

    // shafts: one ribbon per hole of every role card, its light set per card
    const shaftRows: number[] = [];
    deck.forEach((c, d) => {
      for (const [col, row] of holes(encode(c.text))) {
        const [x, y] = holeCenter(col, row);
        shaftRows.push(d + L, x, y);
      }
    });
    const ribbon = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    ribbon.index = quad.index;
    ribbon.setAttribute("position", quad.getAttribute("position"));
    ribbon.setAttribute("aShaft", new InstancedBufferAttribute(new Float32Array(shaftRows), 3));
    ribbon.instanceCount = shaftRows.length / 3;
    this.shaftMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      uniforms: {
        uCards: { value: this.matrices },
        uCardLight: { value: new Float32Array(MAX_SLOTS) },
        uCardSize: { value: new Vector2(CARD.width, CARD.height) },
        uShaft: { value: new Vector2(LOG.light.shaft.length, CARD.hole.width * 1.6) },
        uLight: { value: new Vector3() },
        uShaftIntensity: { value: LOG.light.shaft.intensity },
        uFog: { value: new Vector4() },
        uFogShape: { value: new Vector2(LOG.fog.density, LOG.fog.start) },
      },
    });
    const shafts = new Mesh(ribbon, this.shaftMat);
    shafts.frustumCulled = false;
    shafts.renderOrder = 2;

    // the light behind the deck: past the last card, facing back up the rail
    this.panelMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: PANEL_VERT,
      fragmentShader: PANEL_FRAG,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      uniforms: { uLight: { value: new Vector3() }, uPanel: { value: LOG.light.panel } },
    });
    const panel = new Mesh(new PlaneGeometry(CARD.width * 2.4, CARD.height * 3), this.panelMat);
    const end = this.rail.getPoint(1);
    panel.position.set(end.x, end.y + CARD.height / 2, end.z - LOG.spacing * LOG.light.panelBack);
    panel.renderOrder = 0;

    this.group.add(panel, this.cards, shafts);
  }

  /** Colors from the theme's tokens (DESIGN.md §5.4: Paper's deck is a light table). */
  applyTheme(): void {
    const paper = document.documentElement.dataset.theme === "paper";
    const v = (name: string) => new Vector3(...tokenLinear(name));
    const bg = v("--bg");
    const u = this.cardMat.uniforms;
    if (paper) {
      (u.uStock?.value as Vector3).copy(v("--bg-sunken").lerp(v("--fg-2"), LOG.tone.paperStock));
      (u.uInk?.value as Vector3).copy(v("--fg-2"));
      (u.uInkBright?.value as Vector3).copy(v("--fg-1"));
      (u.uLight?.value as Vector3).copy(v("--bg-raised"));
      (u.uHole as { value: number }).value = 1;
    } else {
      const raised = v("--bg-raised");
      const print = v("--fg-2");
      const stock = raised.clone().lerp(print, LOG.tone.stockLift);
      (u.uStock?.value as Vector3).copy(stock);
      (u.uInk?.value as Vector3).copy(stock.clone().lerp(print, LOG.tone.inkStrength));
      (u.uInkBright?.value as Vector3).copy(v("--fg-1"));
      (u.uLight?.value as Vector3).copy(v("--accent"));
      (u.uHole as { value: number }).value = LOG.light.hole;
    }
    (u.uFog?.value as Vector4).set(bg.x, bg.y, bg.z, 0);
    const light = u.uLight?.value as Vector3;
    (this.shaftMat.uniforms.uLight?.value as Vector3).copy(light);
    (this.shaftMat.uniforms.uFog?.value as Vector4).set(bg.x, bg.y, bg.z, 0);
    (this.shaftMat.uniforms.uShaftIntensity as { value: number }).value = paper ? 0 : LOG.light.shaft.intensity;
    (this.panelMat.uniforms.uLight?.value as Vector3).copy(light);
    (this.panelMat.uniforms.uPanel as { value: number }).value = paper ? 0 : LOG.light.panel;
  }

  /**
   * Slot j's instance: far to near. The stage's post chain has no depth buffer (the hero is all
   * additive light), and an InstancedMesh draws in instance order — so the deck paints back to
   * front, and the nearer card covers the farther. The cards never cross each other.
   */
  private slot(j: number): number {
    return this.slots - 1 - j;
  }

  /** The rail's frame at slot parameter j (0 … slots − 1): the hinge point, the tangent into the deck. */
  private at(j: number, p: Vector3, t: Vector3): void {
    const u = Math.min(1, Math.max(0, j / (this.slots - 1)));
    this.rail.getPoint(u, p);
    this.rail.getTangent(u, t);
  }

  /** Advances the deck one LIVE frame. Returns whether anything is still moving. */
  frame({ dt, camera, still = false }: DeckFrame): boolean {
    const L = LOG.leaders;
    const S = this.slots;
    const k = this.tmp;
    this.camSpring.setTarget(still ? 0 : pinProgress("log") * Math.max(0, this.roles - 1));
    if (still) this.camSpring.snap(0);
    const a = this.camSpring.step(dt);
    const jc = a + L;
    const flip = LOG.flip.angleDeg * DEG;

    // the cards: standing ahead of the camera; each one it has passed hinged forward and down
    let moving = !this.camSpring.isSettled();
    for (let j = 0; j < S; j++) {
      const passed = smooth(0, LOG.flip.span, jc - j);
      const theta = flip * passed;
      this.standing[j] = 1 - smooth(0.15, 0.5, passed);
      this.at(j, k.v, k.t);
      // facing back up the rail (toward the camera), upright
      k.n.copy(k.t).negate();
      k.right.crossVectors(UP, k.n).normalize();
      const up = k.w.crossVectors(k.n, k.right).normalize();
      k.r.makeBasis(k.right, up, k.n);
      k.m.makeRotationX(theta);
      this.matrices[j]?.copy(k.r).multiply(k.m).setPosition(k.v);
      const i = this.slot(j);
      this.cards.setMatrixAt(i, this.matrices[j] as Matrix4);
      const bend = this.bends[j] as Spring;
      bend.setTarget(!still && j === this.hovered ? 1 : 0);
      const b = bend.step(dt);
      if (!bend.isSettled()) moving = true;
      this.aCard.setY(i, LOG.hover.bend * b);
      this.aCard.setZ(i, 1 + (LOG.hover.lightGain - 1) * b);
      this.aCard.setW(i, this.standing[j] ?? 0);
    }
    for (let j = 0; j < S; j++) {
      const behind = j + 1 < S ? j + 1 : -1;
      this.aBehind.setXY(this.slot(j), behind < 0 ? -1 : (this.aCard.getX(this.slot(behind)) ?? -1), behind < 0 ? 0 : (this.standing[behind] ?? 0));
      // a shaft only from a standing card the camera faces
      (this.shaftMat.uniforms.uCardLight?.value as Float32Array)[j] = (this.standing[j] ?? 0) * (this.aCard.getZ(this.slot(j)) ?? 1) * (j >= jc - 0.5 && j <= jc + 3 ? 1 : 0);
    }
    this.cards.instanceMatrix.needsUpdate = true;
    this.aCard.needsUpdate = true;
    this.aBehind.needsUpdate = true;

    // the camera: on the rail before the active card, looking past it to the right, banked on curves
    this.at(jc, k.v, k.t);
    const cam = camera;
    k.n.copy(k.t).negate();
    k.right.crossVectors(k.t, UP).normalize();
    const span = 2 * Math.tan(((cam.fov / 2) * Math.PI) / 180) * (cam.aspect || 1);
    const back = Math.max(LOG.camera.back, CARD.width / (LOG.camera.fill * span));
    const offset = LOG.camera.offset * span * back;
    cam.position.copy(k.v).addScaledVector(k.n, back).addScaledVector(UP, CARD.height / 2 + LOG.camera.lift).addScaledVector(k.right, offset);
    const target = k.w.copy(k.v).addScaledVector(UP, CARD.height / 2).addScaledVector(k.right, offset);
    // lateral curvature at the camera's slot, as a share of the sway's sharpest
    const d = 0.5;
    this.at(jc - d, k.a, k.c);
    this.at(jc + d, k.b, k.c);
    const lateral = (k.a.x + k.b.x - 2 * k.v.x) / (d * d);
    const sharpest = LOG.sway.x * ((2 * Math.PI) / LOG.sway.period) ** 2;
    const travel = Math.min(1, Math.abs(this.camSpring.velocity) / LOG.camera.bankSpeed);
    this.bank.setTarget(-LOG.camera.bankDeg * DEG * Math.max(-1, Math.min(1, lateral / sharpest)) * travel);
    const roll = this.bank.step(dt);
    if (!this.bank.isSettled(1e-4)) moving = true;
    cam.up.copy(UP).applyAxisAngle(k.n, roll);
    cam.lookAt(target);
    cam.updateMatrixWorld();

    // the cursor: which standing card it's over, by ray against the cards near the camera
    this.hovered = still || !pointer.active || pointer.type === "touch" ? -1 : this.pick(cam, jc);
    return moving;
  }

  /** ?debug=1 (scripts/log-gate.mjs): where the camera is, its bank, what the cursor's over. */
  debugState(): { active: number; target: number; rollDeg: number; hovered: number; bend: number; standing: number } {
    const L = LOG.leaders;
    return {
      active: this.camSpring.value,
      target: this.camSpring.target,
      rollDeg: (this.bank.value * 180) / Math.PI,
      hovered: this.hovered < 0 ? -1 : this.hovered - L,
      bend: this.hovered < 0 ? 0 : (this.bends[this.hovered]?.value ?? 0),
      standing: [...this.standing].filter((v) => v > 0.5).length,
    };
  }

  private pick(cam: PerspectiveCamera, jc: number): number {
    const k = this.tmp;
    const dir = k.dir.set(pointer.nx * 2 - 1, 1 - pointer.ny * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    const inv = k.inv;
    const o = k.o;
    const r = k.a;
    let best = -1;
    let bestT = Infinity;
    for (let j = Math.max(0, Math.floor(jc - 0.5)); j < Math.min(this.slots, Math.ceil(jc + 3)); j++) {
      if ((this.standing[j] ?? 0) < 0.5) continue;
      inv.copy(this.matrices[j] as Matrix4).invert();
      o.copy(cam.position).applyMatrix4(inv);
      r.copy(dir).transformDirection(inv);
      if (Math.abs(r.z) < 1e-6) continue;
      const t = -o.z / r.z;
      if (t <= 0 || t >= bestT) continue;
      const x = o.x + r.x * t;
      const y = o.y + r.y * t;
      if (Math.abs(x) <= CARD.width / 2 && y >= 0 && y <= CARD.height) {
        best = j;
        bestT = t;
      }
    }
    return best;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as Mesh;
      mesh.geometry?.dispose();
    });
    // the deck owns its atlas: free the texture, and the bitmap it was made from
    const atlas = this.cardMat.uniforms.uAtlas?.value as Texture | undefined;
    (atlas?.image as ImageBitmap | undefined)?.close?.();
    atlas?.dispose();
    this.cardMat.dispose();
    this.shaftMat.dispose();
    this.panelMat.dispose();
  }
}
