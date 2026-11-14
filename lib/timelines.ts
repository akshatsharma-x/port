import { bezier, ease, signature } from "./motion";

/**
 * The signature transitions as pure functions of time (ms) — DESIGN.md §3.6, verbatim. lib/
 * transitions.ts plays them; tests/timelines.test.ts checks them against the document's numbers.
 */
const settle = bezier(ease.settle);
const transit = bezier(ease.transit);
const depart = bezier(ease.depart);
const decay = bezier(ease.decay);
const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ── ① POWER CYCLE ─────────────────────────────────────────────────────────────────────────

/** the OFF flash falls off within two 60 Hz frames (photosensitivity: ≤ 2 frames) */
const FLASH_MS = 34;

const P = signature.power;
export const POWER = {
  onMs: P.onMs,
  offMs: P.offMs,
  /** theme switch: OFF-fast → swap → ON-fast */
  offFastMs: P.offFastMs,
  onFastMs: P.onFastMs,
  /** the stage holds its first frame underneath until here (ON) */
  stageHoldMs: P.onOpenMs,
  /** the dot → line stretch: the beam "opens" at its end */
  stretchMs: P.onStretchMs,
  /** the line's height, as a share of the screen, when collapsed (scaleY 0.004) */
  lineScale: 0.004,
  onBrightness: 1.25,
  offBrightness: 1.6,
  barrel: 0.15,
  afterglowMs: P.afterglowMs,
  /** reduced motion: a crossfade, no flash */
  reducedMs: P.reducedMs,
  /** photosensitivity: one flash per cycle, ≤ 2 frames, confined to the beam */
  maxFlashFrames: 2,
} as const;

export interface PowerFrame {
  /** content scale (the tube's raster) */
  scaleX: number;
  scaleY: number;
  /** beam brightness (1 = nominal) */
  brightness: number;
  /** barrel distortion strength (0–0.15) */
  barrel: number;
  /** the one scanline roll: 0–1 down the screen, or -1 when none */
  roll: number;
  /** content opacity (the dot fading) */
  opacity: number;
}

/** ON (600 ms, or the 360 ms fast variant): dot → line → open → settle. */
export function powerOnAt(t: number, fast = false): PowerFrame {
  const k = fast ? POWER.onFastMs / POWER.onMs : 1;
  const a = P.onStretchMs * k;
  const b = P.onOpenMs * k;
  const c = P.onMs * k;
  const stretch = settle(seg(t, 0, a));
  const open = settle(seg(t, a, b));
  return {
    scaleX: lerp(POWER.lineScale, 1, stretch),
    scaleY: lerp(POWER.lineScale, 1, open),
    brightness: t < b ? POWER.onBrightness : lerp(POWER.onBrightness, 1, decay(seg(t, b, c))),
    barrel: lerp(POWER.barrel, 0, seg(t, a, b)),
    roll: t >= a && t < b ? seg(t, a, b) : -1,
    opacity: 1,
  };
}

/** OFF (450 ms, or the 240 ms fast variant): collapse to a line → pinch to a dot → the dot fades. */
export function powerOffAt(t: number, fast = false): PowerFrame {
  const k = fast ? POWER.offFastMs / POWER.offMs : 1;
  const a = P.offCollapseMs * k;
  const b = P.offPinchMs * k;
  const c = P.offMs * k;
  const collapse = depart(seg(t, 0, a));
  const pinch = depart(seg(t, a, b));
  // the flash: brightness peaks at the line (t = a) and is already falling by the next frame
  const brightness = t < a ? lerp(1, POWER.offBrightness, collapse) : lerp(POWER.offBrightness, 1.2, seg(t, a, a + FLASH_MS * k));
  return {
    scaleX: lerp(1, POWER.lineScale, pinch),
    scaleY: lerp(1, POWER.lineScale, collapse),
    brightness,
    barrel: lerp(0, POWER.barrel, collapse),
    roll: -1,
    opacity: 1 - decay(seg(t, b, c)),
  };
}

// ── ② TRACKING TEAR ───────────────────────────────────────────────────────────────────────

const T = signature.tear;
export const TEAR = {
  ms: T.ms,
  cutMs: T.cutMs,
  bandsUntilMs: T.bandsUntilMs,
  floodFromMs: T.bandsUntilMs,
  floodFullMs: T.floodFullMs,
  /** 3–5 bands, 1.5–9% of the viewport tall, offset 12–48 px, chroma fringes 4–12 px */
  bands: { min: 3, max: 5, heightMin: 0.015, heightMax: 0.09, offsetMin: 12, offsetMax: 48, chromaMin: 4, chromaMax: 12 },
  /** VHS head-switching noise: the bottom 4% */
  headNoise: 0.04,
  /** #screen jitter: ±3–8 px, in 30 Hz steps */
  jitter: { min: 3, max: 8, hz: 30 },
  /** the flood is a 4×4 Bayer threshold: 16 steps, never an alpha fade */
  floodSteps: 16,
  /** reduced motion: a solid --bg cover/uncover */
  reducedMs: T.reducedMs,
  /** the longest the cover may hold for a slow route swap */
  maxHoldMs: T.maxHoldMs,
} as const;

export interface TearFrame {
  /** band strength (1 → decays after the flood) */
  bands: number;
  /** head-switching noise strength */
  head: number;
  /** flood coverage, Bayer-stepped 0–1 */
  flood: number;
  /** the flood's lower edge as it rolls off upward (1 = full screen, 0 = gone) */
  roll: number;
  /** jitter amplitude (0–1 of the seeded offset) */
  jitter: number;
}

export function tearAt(t: number): TearFrame {
  const flood = Math.floor(seg(t, TEAR.floodFromMs, TEAR.floodFullMs) * TEAR.floodSteps) / TEAR.floodSteps;
  const rollK = transit(seg(t, TEAR.floodFullMs, TEAR.ms));
  const after = seg(t, TEAR.floodFullMs, TEAR.ms);
  return {
    bands: t < TEAR.floodFullMs ? 1 : (1 - after) ** 2,
    head: t < TEAR.floodFullMs ? 1 : 1 - after,
    flood,
    roll: 1 - rollK,
    jitter: t < TEAR.bandsUntilMs ? 1 : t < TEAR.floodFullMs ? 0.6 : (1 - after) ** 3,
  };
}

/** Seeded band layout (DESIGN: 3–5 bands, 1.5–9% tall, offset 12–48 px, chroma 4–12 px). */
export function tearBands(random: () => number): { y: number; h: number; offset: number; chroma: number }[] {
  const b = TEAR.bands;
  const n = b.min + Math.floor(random() * (b.max - b.min + 1));
  return Array.from({ length: n }, () => ({
    y: random() * 0.9,
    h: lerp(b.heightMin, b.heightMax, random()),
    offset: lerp(b.offsetMin, b.offsetMax, random()) * (random() < 0.5 ? -1 : 1),
    chroma: lerp(b.chromaMin, b.chromaMax, random()),
  }));
}

/** The jitter step for a time: ±3–8 px, held for one 30 Hz step. */
export function jitterAt(t: number, random: (step: number) => number): number {
  const step = Math.floor((t / 1000) * TEAR.jitter.hz);
  const r = random(step);
  const mag = lerp(TEAR.jitter.min, TEAR.jitter.max, Math.abs(r * 2 - 1));
  return (r < 0.5 ? -1 : 1) * mag;
}

// ── PAPER SCAN (the Paper theme's POWER CYCLE) ────────────────────────────────────────────

export const SCAN = { ms: signature.scan.ms } as const; // on `transit`

/** The bar's position, top → bottom (0–1). */
export const scanAt = (t: number): number => transit(seg(t, 0, SCAN.ms));
