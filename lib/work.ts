import { create } from "zustand";

/**
 * A4 · PROJECTS "WORK" (DESIGN.md §4.3 A4, §4.4 B4, §7.4 WORK): the slide carousel's constants, the
 * pure geometry and physics the stage and the tests share, and the store and view bus between the
 * stage and the page. The scene itself is components/stage/scenes/work.tsx (a lazy chunk).
 *
 * World units are mounts: a 35 mm slide's 50 × 50 mm mount is 1 × 1, its 36 × 24 mm window
 * 0.72 × 0.48. The camera sits at the origin looking down −z.
 */
export const WORK = {
  /** A4's budget: at most eight slides (one InstancedMesh, one DataArrayTexture layer each) */
  maxSlides: 8,
  /** the covers' shape: a 35 mm frame, 3:2 */
  aspect: 1.5,
  mount: {
    /** the window, as shares of the mount */
    window: { width: 0.72, height: 0.48 },
    /** the mount's corner radius, share of its side */
    radius: 0.04,
    /** the mount's stock: the raised ground toward --fg-3 by this much (dark tubes), so it reads as a frame */
    stock: 0.07,
    /** …and on Paper's lightbox, a light card against the backlit white */
    paperStock: 0.16,
  },
  /** the rail: a gently concave arc, its centre behind the viewer; the gate is its middle */
  arc: {
    /** the gate mount fills the tighter of these shares of the slot (phones by width) */
    fill: { width: 0.38, height: 0.58, phoneWidth: 0.74 },
    /** a phone's frame is portrait below this aspect */
    portrait: 0.9,
    /** arc radius, mounts: each neighbour yaws by pitch / radius */
    radius: 4.4,
    /** centre-to-centre along the arc, mounts */
    pitch: 1.14,
    /** on a portrait frame the neighbours close in, so an edge of each still shows */
    phonePitch: 1.04,
  },
  /** input, in slides: a drag moves by the pointer's travel over one pitch on screen */
  input: {
    /** a release coasts with this time constant (s); it lands on the slide nearest where it would stop */
    coastS: 0.32,
    /** past either end the rail gives this much of the pull (a rubber band) */
    rubber: 0.32,
    /** a wheel burst settles this long after its last event (ms) */
    wheelSettleMs: 140,
    /** a press that moves less than this (px) is a click */
    clickSlopPx: 6,
    /** the pointer's velocity is averaged over this window (ms) */
    velocityWindowMs: 90,
  },
  /** fast flings (§4.3 A4): the smear, the FLING whir and the aberration all read flingAmount() */
  fling: {
    /** speed at full effect, slides/s */
    full: 6,
    /** the smear's trail at full speed, share of the window's width */
    smear: 0.1,
    /** taps along it */
    taps: 8,
    /** the whir is sent at most this often (ms) */
    whirMs: 50,
  },
  /** the gate: lamp falloff, a hint of lens barrel, dust */
  gate: {
    /** the lamp's hotspot falls to (1 − lamp) at the window's corners */
    lamp: 0.3,
    barrel: 0.04,
    /** specks per slide (and one hair), seeded by the slide */
    dust: 9,
  },
  /** at rest: a dither duotone, its cell this many CSS px; neighbours dim with distance from the gate */
  rest: { dim: 0.42, cellPx: 1.5 },
  /**
   * PROJECTION (§7.4): fly to fill the viewport, swap the route under it, let go once the DOM hero
   * decodes — the let-go an element-tier dissolve (lib/motion signature.resolve.element)
   */
  projection: {
    flyMs: 680,
    /** the hand-off waits at most this long for the route and the hero image (ms) */
    holdMaxMs: 1500,
  },
  /** B4 · the INDEX preview: follows the cursor (λ 9) with rotateZ = clamp(vx × 0.02, ±4°) */
  preview: { lambda: 9, gain: 0.02, maxDeg: 4, offsetPx: 28, width: 320 },
} as const;

/** 0–1: how fast the rail runs (smear, whir and aberration). */
export const flingAmount = (velocity: number): number => Math.min(1, Math.abs(velocity) / WORK.fling.full);

/** The slide a release lands on: the nearest to where it would coast to, on the rail. */
export function landing(position: number, velocity: number, count: number): number {
  const coast = position + velocity * WORK.input.coastS;
  return Math.max(0, Math.min(count - 1, Math.round(coast)));
}

/** A pull past either end of the rail gives way by WORK.input.rubber (a rubber band). */
export function rubber(position: number, count: number): number {
  const max = Math.max(0, count - 1);
  if (position < 0) return position * WORK.input.rubber;
  if (position > max) return max + (position - max) * WORK.input.rubber;
  return position;
}

/** …and back: the raw position a band-limited one came from. */
export function unrubber(position: number, count: number): number {
  const max = Math.max(0, count - 1);
  if (position < 0) return position / WORK.input.rubber;
  if (position > max) return max + (position - max) / WORK.input.rubber;
  return position;
}

/** The pitch along the arc for a frame of this aspect (portrait frames close the neighbours in). */
export const arcPitch = (aspect: number): number => (aspect < WORK.arc.portrait ? WORK.arc.phonePitch : WORK.arc.pitch);

/** Slide i's pose with the rail at `position`: centre (x, z) and yaw (rad), facing the arc's centre. */
export function arcPose(i: number, position: number, gate: number, pitch: number): { x: number; z: number; yaw: number } {
  const r = WORK.arc.radius;
  const phi = ((i - position) * pitch) / r;
  return { x: r * Math.sin(phi), z: -gate + r * (1 - Math.cos(phi)), yaw: -phi };
}

/** How far the gate stands from the camera so its mount fills its share of the slot. */
export function gateDistance(aspect: number, fovDeg: number): number {
  const tan = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const f = WORK.arc.fill;
  const byHeight = 1 / (2 * tan * f.height);
  const byWidth = 1 / (2 * tan * aspect * (aspect < WORK.arc.portrait ? f.phoneWidth : f.width));
  return Math.max(byHeight, byWidth);
}

/**
 * object-fit: cover, in NDC: the size of a 3:2 image that covers a viewport of this aspect — 2 on
 * the axis it fits, more on the one it overflows. The PROJECTION lands the window here, and the
 * case study's DOM hero is the same image under `object-fit: cover`, so the hand-off is exact.
 */
export function coverNdc(viewportAspect: number, imageAspect: number = WORK.aspect): { w: number; h: number } {
  return viewportAspect > imageAspect ? { w: 2, h: (2 * viewportAspect) / imageAspect } : { w: (2 * imageAspect) / viewportAspect, h: 2 };
}

/** "01/05": a slide's print, the index's number column. */
export const slideNumber = (i: number, count: number): string => `${String(i + 1).padStart(2, "0")}/${String(count).padStart(2, "0")}`;

// ── the store the stage and the page share ───────────────────────────────────────────────────────

export interface WorkState {
  /** the slide in the gate */
  gate: number;
  /** a slide the page points at: an INDEX row's (it lights on the rail) */
  pointed: number | null;
  /** the page asks the rail to bring a slide to the gate (the keys, a focused slide); seq makes a repeat a new ask */
  request: { index: number; seq: number } | null;
  setGate(index: number): void;
  point(index: number | null): void;
  bring(index: number): void;
}

/** Slide indices throughout: the stage data's order, which is the content's (featured projects). */
export const useWork = create<WorkState>()((set, get) => ({
  gate: 0,
  pointed: null,
  request: null,
  setGate: (gate) => set({ gate }),
  point: (pointed) => set({ pointed }),
  bring: (index) => set({ request: { index, seq: (get().request?.seq ?? 0) + 1 } }),
}));

/**
 * The rail's input, from the page's HTML layer (it owns the pointer, the wheel and the keys) to the
 * stage's carousel, which installs itself here while it's mounted. Times are performance.now() ms.
 */
export interface WorkInput {
  down(x: number, t: number): void;
  move(x: number, t: number): void;
  /** true when the press was a click */
  up(t: number): boolean;
  /** true when it moved the rail (a sideways wheel); a vertical one is the page's */
  wheel(dx: number, dy: number, shift: boolean, t: number): boolean;
  step(dir: -1 | 1): void;
  to(index: number): void;
}
export const workInput: { sink: WorkInput | null } = { sink: null };

/**
 * What the stage publishes for the page's HTML each frame it draws: every slide's window as a
 * screen rect (CSS px in the slot: x, y, width, height; 0 width when it faces away), and the slot's
 * size. The HTML layer reads it on the ticker and moves its links by transform only.
 */
export const workView = {
  version: 0,
  width: 0,
  height: 0,
  rects: new Float32Array(0) as Float32Array,
};
