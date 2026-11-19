/**
 * RETROGRADE motion language — DESIGN.md §3, verbatim. Every animation imports from here.
 *
 *   GSAP   owns time and scroll (timelines, scrub, SplitText)     → ease ids via registerEases()
 *   Motion owns React presence, layout/FLIP and gestures          → motionSpring(springs.x)
 *   WebGL  integrates the same springs with lib/spring.ts (RK4)   → new Spring(springs.x)
 *   CSS    reads var(--ease-*) / var(--dur-*) from styles/tokens.css (tests keep both in sync)
 */

export type Bezier = readonly [number, number, number, number];

// ── §3.2 Easing ──────────────────────────────────────────────────────────────────────

export const ease = {
  /** entrances, reveals, panels arriving */
  settle: [0.22, 1, 0.36, 1],
  /** A → B between two resting states: camera flights, layout swaps, back-to-top */
  transit: [0.65, 0, 0.35, 1],
  /** exits */
  depart: [0.5, 0, 0.75, 0],
  /** mechanical snaps: toggles, bracket draw, rail detents, the stamp's approach */
  relay: [0.9, 0, 0.1, 1],
  /** light only — glow, flash falloff, afterglow; never positions */
  decay: [0.1, 0.9, 0.2, 1],
} as const satisfies Record<string, Bezier>;

export type EaseName = keyof typeof ease;
export const EASE_NAMES = Object.keys(ease) as EaseName[];

export const cssEase = (name: EaseName): string => `cubic-bezier(${ease[name].join(", ")})`;
export const cssEaseVar = (name: EaseName): string => `var(--ease-${name})`;

/** cubic-bezier evaluator: GSAP's registered eases (lib/gsap.ts), Lenis glides, Counter, Canvas2D. */
export function bezier([x1, y1, x2, y2]: Bezier): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number): number => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (x > v) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

// ── §3.3 Springs (Motion units) ───────────────────────────────────────────────────────

export interface SpringConfig {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
}

export const springs = {
  /** toggles, chips, press, cursor ring contraction */
  snap: { stiffness: 700, damping: 48, mass: 1 },
  /** panels, dossier, nav indicator */
  settle: { stiffness: 180, damping: 25, mass: 1 },
  /** hero name per-char rise, VERIFIED stamp, card deal, H-HOLD */
  overshoot: { stiffness: 300, damping: 22, mass: 1 },
  /** Tier-B tilt and flip — weight with a hint of wobble */
  tilt: { stiffness: 150, damping: 18, mass: 1 },
  /** magnetic buttons */
  magnetic: { stiffness: 260, damping: 20, mass: 0.6 },
  /** cameras: rail jumps, dossier dolly, gallery settle */
  heavy: { stiffness: 60, damping: 15.5, mass: 1 },
} as const satisfies Record<string, SpringConfig>;

export type SpringName = keyof typeof springs;

/**
 * Constellation re-plot. mass = 1 + normalized citations and damping = 14·√m, so the damping
 * ratio stays 0.64: heavier (more-cited) papers move slower and settle last, never bounce more.
 */
export function relayout(citationsNorm: number): SpringConfig {
  const mass = 1 + Math.min(1, Math.max(0, citationsNorm));
  return { stiffness: 120, damping: 14 * Math.sqrt(mass), mass };
}

export const dampingRatio = (s: SpringConfig): number => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));

/**
 * A spring as a `linear()` easing and its settle time, for compositor animations (WAAPI, CSS
 * transitions) that keep the spring's shape with no frame loop (Tier B, §4.4): the step response
 * from rest at 0 to 1, integrated at 0.5 ms until it stays within `eps` of 1, sampled at `points`;
 * and when it first gets there. The springs used this way (overshoot, tilt) settle inside
 * MAX_TIMED_MS (tests/credentials.test.ts).
 */
export function springLinear(s: SpringConfig, { eps = 0.001, points = 48 }: { eps?: number; points?: number } = {}): { easing: string; ms: number; reachMs: number } {
  const h = 0.0005;
  const xs: number[] = [0];
  let x = 0;
  let v = 0;
  let last = 0;
  for (let i = 1; i <= 8000; i++) {
    const a = (-s.stiffness * (x - 1) - s.damping * v) / s.mass;
    v += a * h;
    x += v * h;
    xs.push(x);
    if (Math.abs(x - 1) > eps || Math.abs(v) > eps * 10) last = i;
  }
  const end = last + 1;
  const pts = Array.from({ length: points + 1 }, (_, j) => (j === 0 ? 0 : j === points ? 1 : (xs[Math.round((j / points) * end)] ?? 1)));
  // when it first arrives (a stamp's thud, a card landing): the first sample at 1 − eps or past it
  const reach = xs.findIndex((v) => v >= 1 - eps);
  return { easing: `linear(${pts.map((p) => String(Math.round(p * 10000) / 10000)).join(", ")})`, ms: Math.round(end * h * 1000), reachMs: Math.round((reach < 0 ? end : reach) * h * 1000) };
}

/** Spring transition for Motion (motion/react). */
export const motionSpring = (s: SpringConfig) =>
  ({ type: "spring", stiffness: s.stiffness, damping: s.damping, mass: s.mass }) as const;

// ── §3.3 Followers (exponential damping, λ in 1/s; τ = 1/λ) ──────────────────────────

export const followers = {
  cursorRing: 24,
  cursorLabel: 12,
  indexPreview: 9,
  heroParallax: 4,
  heroRepel: 10,
  hudScroll: 14,
  scrollVelocity: 6,
} as const;

// ── §3.4 Duration tiers (ms) ──────────────────────────────────────────────────────────

export const duration = {
  micro: { in: 120, out: 80 },
  element: { in: 400, out: 260 },
  scene: { in: 900, out: 600 },
} as const;

export type DurationTier = keyof typeof duration;
/** Nothing time-based exceeds this (except the boot gate and rate-based text). */
export const MAX_TIMED_MS = 900;
export const sec = (ms: number): number => ms / 1000;

// ── Artifacts step (law 5) ────────────────────────────────────────────────────────────

export const artifact = {
  /** digits, scramble glyphs and other machine artifacts step at 30 fps */
  fps: 30,
  grainFps: 24,
  caretBlinkMs: 1060,
  typewriterCps: 45,
  terminalLinesPerSec: 120,
  /**
   * the terminal's `rain` (§7.4 SHELL): rate-based text like the output's stream, so outside the
   * 900 ms rule — it runs this long at most, and any input ends it
   */
  rainMs: 30_000,
  rainStepsPerSec: 18,
  scrambleMaxChars: 40,
  scrambleMaxMs: 600,
  /** the HUD section label's glitch on continuous scroll (§3.6 ②: no full-screen effect) — 6 frames */
  labelGlitchMs: 200,
  ditherElementSteps: 16,
  ditherSceneSteps: 32,
} as const;

/** A state the visitor's action set that says so, then lets go: COPY's "COPIED ✓" (CONNECT's address, a paper's BibTeX). */
export const feedback = {
  copiedMs: 1600,
  /** the number keys' on-screen display ("CH 04 · ARCHIVE", lib/channels.ts) holds this long */
  channelMs: 1500,
} as const;

/**
 * §7.4 IDENTITY — the portrait's exposure lamp and the CURRENTLY line. The lamp develops the photo
 * where it shines (over duration.micro.in) and the exposure fades back with τ, like phosphor.
 */
export const identity = {
  /** the lamp's radius, as a share of the portrait's width */
  lampRadius: 0.18,
  lampTauMs: 600,
  /** CURRENTLY types its next line this often; hover or focus holds it */
  currentlySwapMs: 6000,
} as const;

/**
 * §3.6 — the Konami code's degauss: the one ungrammatical motion, hidden, so allowed past the
 * 900 ms rule. A wobble that rings down (cycles over its length, decaying with τ), a hue sweep
 * across the screen, the hum under both.
 */
export const degauss = {
  ms: 1200,
  wobbleCycles: 7,
  tauMs: 380,
  /** the wobble's peak: a twist, a shear and a breath of the raster, at t = 0 */
  rotateDeg: 0.6,
  skewDeg: 1.2,
  scale: 0.006,
  /** the hue band crosses the screen in this long, turning a full circle */
  sweepMs: 900,
  saturate: 1.8,
  /** keyframes sampled over the wobble */
  samples: 48,
} as const;

/**
 * §7.4 NO SIGNAL — the on-screen box drifts like an idle set's, a slow rate-based wander (outside the
 * 900 ms rule, as the marquee is): a pass across in each, the two periods apart so its path wanders.
 */
export const noSignal = { driftXMs: 13_700, driftYMs: 8_900 } as const;

/** §3.6 — the three signature transitions' timings (ms). lib/timelines.ts turns them into frames. */
export const signature = {
  power: { onMs: 600, onStretchMs: 90, onOpenMs: 420, offMs: 450, offCollapseMs: 220, offPinchMs: 340, offFastMs: 240, onFastMs: 360, afterglowMs: 300, reducedMs: 200 },
  tear: { ms: 450, bandsUntilMs: 120, cutMs: 180, floodFullMs: 200, reducedMs: 160, maxHoldMs: 1500 },
  scan: { ms: 600 },
  resolve: {
    element: { ms: 400, steps: 16, bayer: 4 },
    scene: { ms: 900, steps: 32, bayer: 8 },
  },
} as const;

/**
 * §7.4 POST — the boot's clock, in ms from its first paint (the head script's origin). P1 is the
 * caret alone; log lines print whole, at least lineGapMs apart; POWER ON at 100% or powerAtMs,
 * whichever comes first; the hero is visible by capMs no matter what (a CSS failsafe holds it
 * even if no script ever runs). The failsafe fires capLeadMs early: a compositor change is
 * presented on the next vsync, so one 60 Hz frame of lead puts the hero's frame on screen by capMs.
 */
export const boot = { p1Ms: 250, lineGapMs: 40, powerAtMs: 1600, capMs: 2200, capLeadMs: Math.ceil(1000 / 60), /** §5.2: the boot-only ≤ 3% flicker's period */ flickerMs: 1700 } as const;

/** Quantizes elapsed time to whole artifact frames. */
export const quantize = (ms: number, fps: number = artifact.fps): number => {
  const frame = 1000 / fps;
  return Math.floor(ms / frame) * frame;
};

// ── §3.5 Stagger ──────────────────────────────────────────────────────────────────────

export const stagger = {
  charMs: 28,
  charSpreadMs: 400,
  lineMs: 60,
  lineMax: 6,
  itemMs: 40,
  jitter: 0.15,
  capMs: 600,
} as const;

/** FNV-1a 32-bit — deterministic seeds from element ids. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds delays from per-step intervals, humanized ±15% (seeded), then capped. */
function humanize(intervals: readonly number[], seed: string, capMs: number): number[] {
  const random = rng(hashSeed(seed));
  const delays: number[] = [];
  let acc = 0;
  intervals.forEach((gap, i) => {
    if (i > 0) acc += gap * (1 + stagger.jitter * (2 * random() - 1));
    delays.push(acc);
  });
  const max = delays.length ? Math.max(...delays) : 0;
  return max > capMs ? delays.map((d) => (d * capMs) / max) : delays;
}

/** Per-character delays (ms): each = min(28 ms, 400 ms / n); spread ≤ 400 ms. */
export function charDelays(n: number, seed = "chars"): number[] {
  if (n <= 0) return [];
  const each = Math.min(stagger.charMs, stagger.charSpreadMs / n);
  return humanize(Array.from({ length: n }, () => each), seed, stagger.charSpreadMs);
}

/** Per-line delays (ms): 60 ms each for the first 6 lines; line 7+ arrives with line 6. */
export function lineDelays(n: number, seed = "lines"): number[] {
  if (n <= 0) return [];
  return humanize(
    Array.from({ length: n }, (_, i) => (i > 0 && i < stagger.lineMax ? stagger.lineMs : 0)),
    seed,
    stagger.capMs,
  );
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Per-item delays (ms), ordered by distance from the origin — never by DOM index.
 * Returned in input order; spread capped at 600 ms (each shrinks below 40 ms if needed).
 */
export function itemDelays(points: readonly Point[], origin: Point, seed = "items"): number[] {
  const n = points.length;
  if (n === 0) return [];
  const order = points
    .map((p, i) => ({ i, d: Math.hypot(p.x - origin.x, p.y - origin.y) }))
    .sort((a, b) => a.d - b.d || a.i - b.i);
  const each = Math.min(stagger.itemMs, stagger.capMs / Math.max(1, n - 1));
  const byRank = humanize(Array.from({ length: n }, () => each), seed, stagger.capMs);
  const out = new Array<number>(n).fill(0);
  order.forEach((o, rank) => {
    out[o.i] = byRank[rank] ?? 0;
  });
  return out;
}

/** GSAP function-based delay from a millisecond array. */
export const gsapDelays =
  (delaysMs: readonly number[], baseSec = 0) =>
  (index: number): number =>
    baseSec + (delaysMs[index] ?? 0) / 1000;
