import { BufferGeometry, CustomBlending, DstColorFactor, GLSL3, Int16BufferAttribute, Matrix3, OneFactor, Points, ShaderMaterial, Vector2, Vector3, Vector4, ZeroFactor, type PerspectiveCamera } from "three";
import { damp } from "@/lib/damp";
import { HERO, type HeroTargets } from "@/lib/hero";
import { followers } from "@/lib/motion";
import { pointer } from "@/lib/pointer";
import { pinProgress, scrollSignal } from "@/lib/scroll";
import { facing, sunDirection } from "@/lib/sun";
import { TIERS, type Tier } from "@/lib/tier";
import { tokenLinear } from "@/lib/token-color";
import { HERO_FRAG, HERO_VERT } from "@/shaders/hero";

/**
 * The hero's particle field (DESIGN.md §4.3 A1) — its GPU side and its per-frame state, outside
 * React: one Points object, one ShaderMaterial, four Int16 targets. The scene component mounts it
 * and calls frame() from its LIVE frame callback; it never renders on its own.
 */

type Mat9 = [number, number, number, number, number, number, number, number, number];

export interface FrameInputs {
  dt: number;
  time: number;
  camera: PerspectiveCamera;
  /** the slot's drawn height (CSS px) and the canvas's pixel ratio */
  slotHeight: number;
  dpr: number;
  /** how far the hero pin holds (px), for where the slot sits once it lets go */
  pinLength: number;
  /** the poster capture (scripts/posters.ts): the clock at zero, no cursor, no stir */
  still?: boolean;
}

export class HeroField {
  readonly points: Points;
  private readonly material: ShaderMaterial;
  private readonly lattice: Int16BufferAttribute;
  private yaw = 0;
  private pitch = 0;
  private fx = 0;
  private fy = 0;
  private field = 0;

  constructor(
    private readonly targets: HeroTargets,
    private readonly count: number,
    private readonly tier: Tier,
  ) {
    const geometry = new BufferGeometry();
    const view = (t: Int16Array) => new Int16BufferAttribute(t.subarray(0, count * 3), 3, true);
    const [initials, constellation, globe, grid] = targets.targets;
    geometry.setAttribute("position", view(initials));
    geometry.setAttribute("aConstellation", view(constellation));
    geometry.setAttribute("aGlobe", view(globe));
    this.lattice = view(grid);
    geometry.setAttribute("aLattice", this.lattice);
    const { city } = targets;
    const lat = (Math.asin(Math.max(-1, Math.min(1, city[1] / Math.hypot(...city)))) * 180) / Math.PI;
    const lon = (Math.atan2(city[0], city[2]) * 180) / Math.PI;
    this.material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: HERO_VERT,
      fragmentShader: HERO_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: CustomBlending,
      uniforms: {
        uMorph: { value: 0 },
        uTime: { value: 0 },
        uFit: { value: new Vector4() },
        // the owner's city turned to face the viewer; the terminator is wherever the sun is
        uGlobe: { value: new Matrix3().set(...(facing(lat, lon, HERO.globe.tiltDeg) as Mat9)) },
        uSun: { value: new Vector3(0, 0, 1) },
        uCity: { value: new Vector3(...city) },
        uField: { value: new Vector3() },
        uRepel: { value: new Vector2(HERO.repel.radiusVh * 2, HERO.repel.push) },
        uAspect: { value: 1 },
        uNdcPerWorld: { value: 0 }, // set each frame, from the camera's visible height
        uShape: { value: new Vector4(HERO.morph.spread, HERO.morph.scatter, HERO.morph.burst, HERO.morph.curlFrequency) },
        uFlow: { value: new Vector4(HERO.morph.curlDrift, HERO.morph.idle, 0, HERO.morph.turbulence) },
        uSize: { value: new Vector3(HERO.sprite.sizePx, HERO.sprite.spread, HERO.camera.distance) },
        uColorBase: { value: new Vector3() },
        uColorHot: { value: new Vector3() },
        uColorSignal: { value: new Vector3() },
        uLight: { value: new Vector3() },
        uInk: { value: 0 },
        uProfile: { value: new Vector3().fromArray(HERO.light.glow) },
      },
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  private u<T>(name: string): T {
    return this.material.uniforms[name]?.value as T;
  }

  private setU(name: string, value: number): void {
    const u = this.material.uniforms[name];
    if (u) u.value = value;
  }

  /** Colors and blending from the theme's tokens (§2.4: the stage never hardcodes a color). */
  applyTheme(): void {
    const paper = document.documentElement.dataset.theme === "paper";
    const color = (name: string, token: `--${string}`) => {
      const [r, g, b] = tokenLinear(token);
      // Paper's colors are what the ink absorbs
      if (paper) this.u<Vector3>(name).set(1 - r, 1 - g, 1 - b);
      else this.u<Vector3>(name).set(r, g, b);
    };
    color("uColorBase", paper ? "--fg-1" : "--accent");
    color("uColorHot", "--fg-1");
    color("uColorSignal", "--hot");
    const low = this.tier === "LOW";
    const scale = Math.sqrt(TIERS.HIGH.heroParticles / this.count);
    const L = HERO.light;
    this.u<Vector3>("uLight").set((paper ? L.ink : L.dark) * scale * (low ? L.lowGain : 1), HERO.sprite.hotShare, L.hotGain);
    this.u<Vector3>("uProfile").fromArray(low && !paper ? L.halo : L.glow);
    this.setU("uInk", paper ? 1 : 0);
    // dark themes add light; Paper multiplies ink into the paper (DESIGN.md §5.4)
    const m = this.material;
    m.blendSrc = paper ? DstColorFactor : OneFactor;
    m.blendDst = paper ? ZeroFactor : OneFactor;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
  }

  /** The lattice again, for a changed layout. */
  setLattice(next: Int16Array): void {
    (this.lattice.array as Int16Array).set(next.subarray(0, this.count * 3));
    this.lattice.needsUpdate = true;
  }

  /** One LIVE frame: the morph from scroll, the frame from the viewport, the cursor, the sun. */
  frame({ dt, time: clock, camera: cam, slotHeight, dpr, pinLength, still = false }: FrameInputs): number {
    const time = still ? 0 : clock;
    const aspect = cam.aspect || 1;
    const progress = pinProgress("system");
    this.setU("uMorph", progress * (HERO.targets - 1));
    this.setU("uTime", time);

    // the subject's box and lift, in world units at the subject's depth
    const D = HERO.camera.distance;
    const visibleH = 2 * D * Math.tan(((cam.fov / 2) * Math.PI) / 180);
    const boxW = HERO.frame.width * visibleH * aspect;
    const boxH = HERO.frame.height * visibleH;
    const lift = (aspect < 1 ? HERO.frame.phoneLift : HERO.frame.lift) * visibleH;
    const a = this.targets.initialsAspect;
    const sI = Math.min(boxW / 2 / (a >= 1 ? 1 : a), boxH / 2 / (a >= 1 ? 1 / a : 1));
    const sC = Math.min(boxW, boxH) / 2;
    this.u<Vector4>("uFit").set(sI, sC, sC * 0.95, lift);
    this.setU("uNdcPerWorld", 2 / visibleH);
    this.setU("uAspect", aspect);
    this.u<Vector3>("uSize").set(HERO.sprite.sizePx * dpr * (this.tier === "LOW" ? HERO.light.haloScale : 1), HERO.sprite.spread, D);

    // the cursor: camera parallax (λ 4) and the repel field (λ 10), in the slot's own NDC
    const slotTop = -Math.max(0, scrollSignal.y - pinLength);
    const live = pointer.active && !still;
    const nx = live ? pointer.nx * 2 - 1 : 0;
    const ny = live ? 1 - ((pointer.y - slotTop) / Math.max(1, slotHeight)) * 2 : 0;
    this.yaw = damp(this.yaw, nx * HERO.camera.yawDeg, followers.heroParallax, dt);
    this.pitch = damp(this.pitch, ny * HERO.camera.pitchDeg, followers.heroParallax, dt);
    const over = live && pointer.type !== "touch" && Math.abs(ny) <= 1 ? 1 : 0;
    this.fx = damp(this.fx, nx, followers.heroRepel, dt);
    this.fy = damp(this.fy, ny, followers.heroRepel, dt);
    this.field = damp(this.field, over, followers.heroRepel, dt);
    this.u<Vector3>("uField").set(this.fx, this.fy, this.field);
    const yaw = (this.yaw * Math.PI) / 180;
    const pitch = (this.pitch * Math.PI) / 180;
    // the camera orbits the frame's center; the subject sits `lift` above it
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * D, Math.sin(pitch) * D, Math.cos(yaw) * Math.cos(pitch) * D);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();

    // scroll velocity stirs the cloud
    this.u<Vector4>("uFlow").z = still ? 0 : Math.min(1, Math.abs(scrollSignal.velocity) / HERO.morph.turbulenceVelocity);
    // the live terminator: the sun where it is now (the HUD's local time reads the same clock)
    this.u<Vector3>("uSun").set(...sunDirection(new Date()));
    return progress;
  }
}
