import { cue } from "./cues";
import { FX_POWER, FX_SCAN, FX_TEAR } from "@/shaders/fx-signatures";
import { fx } from "./fxgl";
import { hhold } from "./hhold";
import { artifact, hashSeed, rng } from "./motion";
import { setJumping } from "./scroll";
import { useUI } from "./store";
import { POWER, powerOffAt, powerOnAt, SCAN, scanAt, TEAR, tearAt, tearBands, jitterAt, type PowerFrame } from "./timelines";
import { tokenSrgb } from "./token-color";
import type { Theme } from "./tokens";

/**
 * The transition grammar (DESIGN.md §3.6): continuity → DITHER RESOLVE, discontinuity → TRACKING
 * TEAR, existence → POWER CYCLE. There is no fourth signature. This module plays the two that
 * cover the screen; DITHER RESOLVE lives with what it resolves (the stage, <DitherImage>).
 *
 * The reduced-motion edition swaps each for its DESIGN crossfade: the tear is a 160 ms --bg
 * cover/uncover, a power cycle a 200 ms crossfade with no flash. Sound is unaffected.
 *
 * A lazy chunk: import it through lib/signatures.ts, never directly from first-load code. Loading
 * it compiles the three fx-gl programs (on idle, after load).
 */
fx.register({ tear: FX_TEAR, power: FX_POWER, scan: FX_SCAN });

const isReduced = () => document.documentElement.dataset.motion === "reduce";
const isPaper = () => document.documentElement.dataset.theme === "paper";
type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void> };
const startViewTransition = (update: () => void): ViewTransitionLike | null => {
  const d = document as Document & { startViewTransition?: (cb: () => void) => ViewTransitionLike };
  return typeof d.startViewTransition === "function" ? d.startViewTransition(update) : null;
};
/**
 * Whether a transition began. One started while another runs skips it: the skipped one's `ready`
 * rejects but its update still runs, so the page's state is right and the newer transition has the
 * screen. Nothing to animate then, and nothing thrown (an uncaught "Transition was skipped").
 */
const began = (vt: ViewTransitionLike): Promise<boolean> => vt.ready.then(
  () => true,
  () => false,
);

// ── the reduced-motion / no-WebGL cover ─────────────────────────────────────────────────

function coverEl(): HTMLElement {
  let el = document.getElementById("fx-cover");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx-cover";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
}

/** A solid --bg panel covers, the swap happens, it uncovers: `ms` in total, linear (no motion). */
async function coverSwap(ms: number, atCut: () => void | Promise<void>): Promise<void> {
  const el = coverEl();
  const half = ms / 2;
  await el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: half, fill: "forwards" }).finished;
  await atCut();
  await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: half, fill: "forwards" }).finished;
}

// ── ② TRACKING TEAR ─────────────────────────────────────────────────────────────────────

export interface TearOptions {
  /** the swap at the cut (scroll teleport, route change); a promise holds the cover until it settles */
  atCut: () => void | Promise<void>;
  /** seeds the bands (the destination, so the same jump tears the same way) */
  seed?: string;
  /**
   * Back/forward: the browser has already swapped the page, so the tear enters at full cover (its
   * cut) and only rolls off once the restore is done. The flood is low-contrast noise, not a flash.
   */
  enterAtCut?: boolean;
}

/**
 * The jitter moves #screen (all DOM, the docked stage with it). Pins are sticky, not fixed, so a
 * transform here can't re-anchor them; the chrome lives outside, in #hud.
 */
const jitterTarget = (): HTMLElement | null => document.getElementById("screen");

let tearing = false;

/** Discontinuity: you jumped. Only for nav/rail clicks, terminal goto/open, route changes and back/forward. */
export async function tear({ atCut, seed = "tear", enterAtCut = false }: TearOptions): Promise<void> {
  if (tearing) {
    await atCut(); // a jump during a jump: swap now, under the cover that's already up
    return;
  }
  tearing = true;
  setJumping(true);
  cue("TEAR");
  try {
    if (isReduced() || !fx.can("tear")) {
      await coverSwap(TEAR.reducedMs, atCut);
      return;
    }
    const random = rng(hashSeed(`${seed}`));
    const bands = new Float32Array(20);
    tearBands(random).forEach((b, i) => bands.set([b.y, b.h, b.offset, b.chroma], i * 4));
    const paper = isPaper();
    const colors = paper
      ? { uInk: tokenSrgb("--fg-1"), uGround: tokenSrgb("--bg"), uHot: tokenSrgb("--fg-2"), uCold: tokenSrgb("--fg-2") }
      : { uInk: tokenSrgb("--fg-3"), uGround: tokenSrgb("--bg-sunken"), uHot: tokenSrgb("--hot"), uCold: tokenSrgb("--accent") };
    const seedValue = random() * 100;
    const target = jitterTarget();
    let lastX = 0;
    const jitterRandom = (step: number) => rng(hashSeed(`${seed}:${step}`))();
    const moveTo = (x: number) => {
      if (x === lastX || !target) return;
      lastX = x;
      target.style.translate = x ? `${x}px 0` : "";
    };
    await fx.play({
      effect: "tear",
      ms: TEAR.ms,
      cutAt: TEAR.cutMs,
      holdAt: TEAR.floodFullMs,
      maxHoldMs: TEAR.maxHoldMs,
      ...(enterAtCut ? { startAt: TEAR.floodFullMs } : {}),
      onCut: async () => {
        moveTo(0);
        await atCut();
        hhold();
      },
      uniforms: (t) => {
        const f = tearAt(t);
        return { uBand: bands, uBands: f.bands, uHead: f.head, uFlood: f.flood, uRoll: f.roll, uSeed: seedValue, uMode: paper ? 1 : 0, ...colors };
      },
      onFrame: (t) => moveTo(t >= TEAR.ms ? 0 : Math.round(jitterAt(t, jitterRandom) * tearAt(t).jitter)),
    });
    moveTo(0);
  } finally {
    tearing = false;
    setJumping(false);
  }
}

// ── ① POWER CYCLE ───────────────────────────────────────────────────────────────────────

const FRAME_MS = 1000 / 60;

/** WAAPI keyframes sampled from a timeline every 60 Hz frame: exact at the samples. */
function sampled(ms: number, frame: (t: number) => Keyframe): Keyframe[] {
  const n = Math.max(2, Math.ceil(ms / FRAME_MS));
  return Array.from({ length: n + 1 }, (_, i) => ({ ...frame((i / n) * ms), offset: i / n }));
}

const raster = (f: PowerFrame): Keyframe => ({ transform: `scale(${f.scaleX}, ${f.scaleY})`, opacity: f.opacity, filter: `brightness(${f.brightness})` });
const hiddenFrame: Keyframe = { opacity: 0 };

function animatePseudo(pseudo: "old" | "new", keyframes: Keyframe[], ms: number, delay = 0): Animation {
  return document.documentElement.animate(keyframes, { duration: ms, delay, fill: "both", easing: "linear", pseudoElement: `::view-transition-${pseudo}(root)` });
}

/**
 * The stage can't draw while fx-gl does (one context per frame), so after a theme swap it would hold
 * its last old-theme frame and pop at the end. A cut at the swap makes fx-gl yield one frame: the
 * stage draws the new theme once and holds that — its first frame, as law 4 wants — while the beam
 * runs on.
 */
const NO_OP = () => undefined;
/** one artifact frame: by then the swap's re-render has re-tinted the scene */
const ARTIFACT_FRAME_MS = 1000 / artifact.fps;

/** fx-gl's beam for a power timeline; `mask` darkens outside the raster (no View Transition). */
function beam(ms: number, frameAt: (t: number) => PowerFrame, mask: boolean, onCut?: { at: number; fn: () => void }, onFrame?: (t: number) => void): Promise<void> {
  const color = tokenSrgb("--fg-1");
  return fx.play({
    effect: "power",
    ms,
    ...(onCut ? { cutAt: onCut.at, onCut: onCut.fn } : {}),
    ...(onFrame ? { onFrame } : {}),
    uniforms: (t) => {
      const f = frameAt(t);
      return { uScaleX: f.scaleX, uScaleY: f.scaleY, uBright: f.brightness, uBarrel: f.barrel, uRoll: f.roll, uOpacity: f.opacity, uMask: mask ? 1 : 0, uBeam: color };
    },
    afterglowMs: POWER.afterglowMs,
  });
}

async function crossfade(update: () => void): Promise<void> {
  const vt = startViewTransition(update);
  if (!vt) {
    update();
    return;
  }
  if (!(await began(vt))) return;
  animatePseudo("old", [{ opacity: 1 }, { opacity: 0 }], POWER.reducedMs);
  animatePseudo("new", [{ opacity: 0 }, { opacity: 1 }], POWER.reducedMs);
  await vt.finished;
}

const applyTheme = (next: Theme) => {
  document.documentElement.dataset.theme = next; // synchronously, inside the View Transition's update
  useUI.getState().setTheme(next);
};

/**
 * The theme switch: OFF-fast (240 ms) → swap → ON-fast (360 ms), inside a View Transition where
 * supported (the old snapshot collapses, the new one expands). Into Paper it's the SCAN: a light
 * bar sweeps down revealing the new theme behind it. Without View Transitions, #fx-gl covers the
 * instant token swap at the moment of collapse.
 */
export async function switchTheme(next: Theme): Promise<void> {
  if (document.documentElement.dataset.theme === next) return;
  cue("POWER", { variant: "theme" });
  if (isReduced() || !fx.can(next === "paper" ? "scan" : "power")) {
    await crossfade(() => applyTheme(next));
    return;
  }
  const toPaper = next === "paper";
  const total = POWER.offFastMs + POWER.onFastMs;
  const vt = startViewTransition(() => applyTheme(next));
  if (vt) {
    if (!(await began(vt))) return;
    if (toPaper) {
      animatePseudo("new", sampled(SCAN.ms, (t) => ({ clipPath: `inset(0 0 ${((1 - scanAt(t)) * 100).toFixed(2)}% 0)` })), SCAN.ms);
      void fx.play({ effect: "scan", ms: SCAN.ms, cutAt: ARTIFACT_FRAME_MS, onCut: NO_OP, uniforms: (t) => ({ uY: scanAt(t), uMask: 0, uBar: tokenSrgb("--bg-raised"), uCover: tokenSrgb("--bg") }) });
    } else {
      animatePseudo("old", [...sampled(POWER.offFastMs, (t) => raster(powerOffAt(t, true))).map((k) => ({ ...k, offset: (k.offset as number) * (POWER.offFastMs / total) })), { ...hiddenFrame, offset: 1 }], total);
      animatePseudo("new", [{ ...hiddenFrame, offset: 0 }, { ...hiddenFrame, offset: POWER.offFastMs / total }, ...sampled(POWER.onFastMs, (t) => raster(powerOnAt(t, true))).map((k) => ({ ...k, offset: (POWER.offFastMs + (k.offset as number) * POWER.onFastMs) / total }))], total);
      void beam(total, (t) => (t < POWER.offFastMs ? powerOffAt(t, true) : powerOnAt(t - POWER.offFastMs, true)), false, { at: POWER.offFastMs, fn: NO_OP });
    }
    await vt.finished;
    return;
  }
  // no View Transitions: fx-gl's raster mask hides the swap
  if (toPaper) {
    const cover = tokenSrgb("--bg");
    applyTheme(next);
    await fx.play({ effect: "scan", ms: SCAN.ms, cutAt: ARTIFACT_FRAME_MS, onCut: NO_OP, uniforms: (t) => ({ uY: scanAt(t), uMask: 1, uBar: tokenSrgb("--bg-raised"), uCover: cover }) });
    return;
  }
  await beam(total, (t) => (t < POWER.offFastMs ? powerOffAt(t, true) : powerOnAt(t - POWER.offFastMs, true)), true, { at: POWER.offFastMs, fn: () => applyTheme(next) });
}

/**
 * Never trap the visitor (Part 4): once the tube is off, the first key press, upward wheel, touch or
 * click turns it back on (ON-fast). The footer's halt (Part 13) uses exactly this.
 */
function resumeOnInput(): void {
  const resume = (e: Event) => {
    if (e instanceof WheelEvent && e.deltaY > 0) return; // only an upward scroll resumes
    for (const t of RESUME_EVENTS) window.removeEventListener(t, resume, true);
    if (document.documentElement.dataset.tube === "off") void powerOn({ fast: true });
  };
  for (const t of RESUME_EVENTS) window.addEventListener(t, resume, { capture: true, passive: true });
}
const RESUME_EVENTS = ["keydown", "wheel", "touchstart", "pointerdown"] as const;

/**
 * POWER OFF (450 ms): the tube collapses to a line, then a dot (the footer's last pixel). It plays
 * POWER's off, or HALT's sweep when the footer asks (§6.4).
 */
export async function powerOff(options: { cue?: "POWER" | "HALT" } = {}): Promise<void> {
  if (options.cue === "HALT") cue("HALT");
  else cue("POWER", { variant: "off" });
  const off = () => {
    document.documentElement.dataset.tube = "off";
    resumeOnInput();
  };
  if (isReduced() || !fx.can("power")) {
    await crossfade(off);
    return;
  }
  const vt = startViewTransition(off);
  if (vt) {
    if (!(await began(vt))) return;
    animatePseudo("old", sampled(POWER.offMs, (t) => raster(powerOffAt(t))), POWER.offMs);
    void beam(POWER.offMs, (t) => powerOffAt(t), false);
    await vt.finished;
    return;
  }
  await beam(POWER.offMs, (t) => powerOffAt(t), true, { at: POWER.offMs - FRAME_MS, fn: off });
}

/**
 * A panel's own POWER CYCLE (§3.6: the terminal opens and closes "scoped to the panel"): the
 * screen's dot → line → open (ON) and collapse to a line, then a dot (OFF), on the panel's box
 * alone, with no beam — the screen around it stays as it is. Paper's is its SCAN, down the panel
 * (ON) and back up (OFF); reduced motion, the crossfade. Input interrupts: the caller can finish()
 * or cancel() what's returned.
 */
export function powerPanel(el: HTMLElement, dir: "on" | "off"): Animation {
  const back: PlaybackDirection = dir === "on" ? "normal" : "reverse";
  if (isReduced()) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: POWER.reducedMs, fill: "both", direction: back });
  if (isPaper()) return el.animate(sampled(SCAN.ms, (t) => ({ clipPath: `inset(0 0 ${((1 - scanAt(t)) * 100).toFixed(2)}% 0)` })), { duration: SCAN.ms, fill: "both", direction: back });
  const ms = dir === "on" ? POWER.onMs : POWER.offMs;
  return el.animate(sampled(ms, (t) => raster(dir === "on" ? powerOnAt(t) : powerOffAt(t))), { duration: ms, fill: "both" });
}

export interface PowerOnOptions {
  /** ON-fast (360 ms): deep links, a skipped boot */
  fast?: boolean;
  /**
   * Called on the exact frame the beam opens — the end of the dot → line stretch — or as the
   * picture starts to appear where there's no beam (the SCAN, the reduced crossfade). The hero's
   * name rises from it (DESIGN.md §7.4).
   */
  onOpen?: () => void;
}

let poweringOn: Promise<void> | null = null;

/**
 * POWER ON (600 ms): dot → line → open; the stage holds its first frame underneath until 420 ms.
 * One at a time: asked again while one runs (input and HALT's scroll watch can ask in the same
 * frame), the caller joins it — no second animation over the first, no second cue.
 */
export function powerOn(options: PowerOnOptions = {}): Promise<void> {
  if (!poweringOn) poweringOn = runPowerOn(options).finally(() => (poweringOn = null));
  return poweringOn;
}

async function runPowerOn({ fast = false, onOpen }: PowerOnOptions = {}): Promise<void> {
  cue("POWER", { variant: "on" });
  const on = () => {
    delete document.documentElement.dataset.tube;
  };
  const ms = fast ? POWER.onFastMs : POWER.onMs;
  const stretchMs = POWER.stretchMs * (fast ? POWER.onFastMs / POWER.onMs : 1);
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    onOpen?.();
  };
  const watchBeam = (t: number) => {
    if (t >= stretchMs) open();
  };
  if (isReduced() || !fx.can(isPaper() ? "scan" : "power")) {
    open();
    await crossfade(on);
    return;
  }
  if (isPaper()) {
    // Paper's power-on is the SCAN
    const vt = startViewTransition(on);
    if (vt) {
      if (!(await began(vt))) {
        open();
        return;
      }
      animatePseudo("new", sampled(SCAN.ms, (t) => ({ clipPath: `inset(0 0 ${((1 - scanAt(t)) * 100).toFixed(2)}% 0)` })), SCAN.ms);
      open();
      void fx.play({ effect: "scan", ms: SCAN.ms, uniforms: (t) => ({ uY: scanAt(t), uMask: 0, uBar: tokenSrgb("--bg-raised"), uCover: tokenSrgb("--bg") }) });
      await vt.finished;
    } else {
      on();
      open();
    }
    return;
  }
  const hold = fast ? POWER.stageHoldMs * (POWER.onFastMs / POWER.onMs) : POWER.stageHoldMs;
  const vt = startViewTransition(on);
  if (vt) {
    if (!(await began(vt))) {
      open();
      return;
    }
    animatePseudo("new", sampled(ms, (t) => raster(powerOnAt(t, fast))), ms);
    void beam(hold, (t) => powerOnAt(t, fast), false, undefined, watchBeam);
    await vt.finished;
    open(); // the beam's frames may not have reached it (a hidden tab draws none)
    return;
  }
  on();
  await beam(hold, (t) => powerOnAt(t, fast), true, undefined, watchBeam);
  open();
}
