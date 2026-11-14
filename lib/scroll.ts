import { track as trackEvent } from "@/lib/analytics";
import Lenis from "lenis";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import { createStore } from "zustand/vanilla";
import { cue } from "./cues";
import { damp } from "./damp";
import { isTextEntry } from "./keys";
import { gsap, whenScrollTrigger } from "./gsap";
import { getLenis, setLenis } from "./lenis";
import { bezier, duration, ease, followers, sec } from "./motion";
import { onTick } from "./ticker";

/**
 * The scroll layer — DESIGN.md §3.8 — the one place that touches Lenis. It runs on the one RAF:
 * gsap.ticker → lenis.raf → the scroll tick here (sections, pins, detents, the velocity signal)
 * → the stage governor.
 *
 * It tracks sections and pins itself, from geometry measured on refresh (resize, fonts, images,
 * height changes) — never per frame. Pins are native (sticky blocks in tracks sized in CSS), so
 * every position is static between refreshes and a frame's work is a comparison against the
 * scroll position. ScrollTrigger isn't needed for any of it, so it stays out of first-load JS
 * (§8.3): a later part that wants a scrubbed timeline loads it (lib/gsap.ts) and it updates on
 * this tick.
 *
 * Native truth: Lenis drives the real window scroll, so `scrollY` is always real, the keyboard
 * scrolls natively and anchors are handled by lib/navigation.ts. Under reduced motion there is no
 * Lenis (native scroll), no scrub and no pin: pinned sections render as stacked static frames.
 */
export const LENIS_OPTIONS = { lerp: 0.1, wheelMultiplier: 1, syncTouch: false } as const;

/** Pins (svh of pinned scroll). Nothing else pins — 450 svh in total. */
export const PINS = { system: 100, log: 200, archive: 150 } as const;
export type PinnedSection = keyof typeof PINS;

/** Soft detents inside pins: < 0.2 px/ms, within 8% (of the pin's length) of a node, no input. */
export const DETENT = {
  maxVelocityPxPerS: 200,
  within: 0.08,
  /** how long after the last input before a detent may engage */
  quietMs: 150,
} as const;

/** The section line, as a fraction of the viewport: the section that holds the middle is current. */
const SECTION_LINE = 0.5;

/** Keys the browser scrolls with (natively — Lenis never sees them). */
const SCROLL_KEYS = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "]);

export interface ScrollSnapshot {
  reduced: boolean;
  /** the section under the section line */
  section: string | null;
  /** why it changed: first measure, continuous scroll (side effects run) or a jump (the tear owns them) */
  cause: "init" | "scroll" | "jump";
  /** increments on every change: the HUD's label glitch keys off it */
  seq: number;
  visited: string[];
  /** the tracked sections on this page, in document order (the rail shows these) */
  tracked: string[];
  /** a discontinuous jump is under way (between the tear's start and its end) */
  jumping: boolean;
}

export const scrollStore = createStore<ScrollSnapshot>(() => ({ reduced: false, section: null, cause: "init", seq: 0, visited: [], tracked: [], jumping: false }));

/** Per-frame values — read them in a tick; never subscribe a React render to them. */
export const scrollSignal = {
  y: 0,
  /** px/s, signed (+ = down), damped λ 6 (followers.scrollVelocity) */
  velocity: 0,
  /** px/s, undamped */
  raw: 0,
  direction: 1 as 1 | -1,
  /** 0–1 of the whole page */
  progress: 0,
  /** ms timestamp of the last wheel/touch/key/pointer input */
  lastInput: 0,
};

export interface SectionDef {
  id: string;
  el: HTMLElement;
  onEnter?: () => void;
  onLeave?: () => void;
}

export interface PinDef {
  /** a PINS key: the element holds still for PINS[id] svh of scroll while its content advances */
  id: PinnedSection;
  /** the in-flow track, 100 svh + the pin tall (its height is CSS: known before any script runs) */
  track: HTMLElement;
  /** the sticky element inside it (gets data-pin-start / data-pin-length) */
  el: HTMLElement;
  /** discrete nodes (≥ 2): the content steps between them, soft detents pull to them */
  steps?: number;
  onProgress?: (progress: number) => void;
  onStep?: (step: number) => void;
}

interface SectionReg {
  def: SectionDef;
  /** document px, measured on refresh */
  top: number;
  bottom: number;
  active: boolean;
}

interface PinReg {
  def: PinDef;
  /** document px where the block sticks, and for how many px of scroll */
  start: number;
  length: number;
  progress: number;
  step: number;
}

const sections = new Map<string, SectionReg>();
const pins = new Map<PinnedSection, PinReg>();
const refreshListeners = new Set<() => void>();
let running = false;
let detentUntil = 0;
let lastTracked = Number.NaN;
let st: typeof ScrollTriggerType | null = null;

const nearestNode = (progress: number, steps: number) => Math.round(progress * (steps - 1)) / (steps - 1);

/** Pure: should a detent engage, and to which progress? (exported for tests) */
export function detentTarget(progress: number, steps: number, velocityPxPerS: number, quietForMs: number): number | null {
  if (steps < 2 || Math.abs(velocityPxPerS) >= DETENT.maxVelocityPxPerS || quietForMs < DETENT.quietMs) return null;
  const node = nearestNode(progress, steps);
  const d = Math.abs(progress - node);
  return d > 0.002 && d < DETENT.within ? node : null;
}

/** Pure: which section holds the line (document px)? Sections are disjoint, in any order. */
export function sectionAt(regs: Iterable<{ id: string; top: number; bottom: number }>, line: number): string | null {
  for (const r of regs) if (line >= r.top && line < r.bottom) return r.id;
  return null;
}

function setSection(id: string | null, cause: ScrollSnapshot["cause"]): void {
  const s = scrollStore.getState();
  if (s.section === id) return;
  // the first section a page reports is where it starts, not a crossing: no cue, no hash
  const effective = s.section === null && cause === "scroll" ? "init" : cause;
  const visited = id && !s.visited.includes(id) ? [...s.visited, id] : s.visited;
  scrollStore.setState({ section: id, cause: effective, seq: s.seq + 1, visited });
  // a section seen for the first time this visit (analytics: once a section, never per scroll)
  if (id && visited !== s.visited) trackEvent("section_view", { section: id });
  if (effective === "scroll" && id) {
    cue("SECTION");
    shallowHash(id);
  }
}

/** Continuous scroll keeps the address bar linkable without adding history entries. */
function shallowHash(id: string): void {
  const first = [...sections.values()].sort((a, b) => a.top - b.top)[0]?.def.id;
  const url = id === first ? `${location.pathname}${location.search}` : `${location.pathname}${location.search}#${id}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) window.history.replaceState(null, "", url); // Next.js keeps its state
}

function publishTracked(): void {
  const ids = [...sections.values()].sort((a, b) => (a.def.el.compareDocumentPosition(b.def.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map((r) => r.def.id);
  const prev = scrollStore.getState().tracked;
  if (ids.length !== prev.length || ids.some((id, i) => id !== prev[i])) scrollStore.setState({ tracked: ids });
}

/** One frame's tracking: which section holds the line, how far through each pin. */
function track(y: number): void {
  lastTracked = y;
  const line = y + window.innerHeight * SECTION_LINE;
  let current: string | null = null;
  for (const r of sections.values()) {
    if (current === null && line >= r.top && line < r.bottom) current = r.def.id;
  }
  for (const r of sections.values()) {
    const on = r.def.id === current;
    if (on === r.active) continue;
    r.active = on;
    (on ? r.def.onEnter : r.def.onLeave)?.();
  }
  if (current) setSection(current, scrollStore.getState().jumping ? "jump" : "scroll");
  for (const p of pins.values()) {
    const progress = p.length > 0 ? Math.min(1, Math.max(0, (y - p.start) / p.length)) : 0;
    if (progress === p.progress) continue;
    p.progress = progress;
    p.def.onProgress?.(progress);
    const steps = p.def.steps ?? 0;
    if (steps > 1) {
      const step = Math.round(progress * (steps - 1));
      if (step !== p.step) {
        p.step = step;
        p.def.onStep?.(step);
      }
    }
  }
}

const currentY = () => getLenis()?.scroll ?? window.scrollY;

/** Re-measures every section and pin (layout reads — on refresh only), then re-tracks. */
export function refreshScroll(): void {
  if (typeof window === "undefined") return;
  const y = window.scrollY;
  for (const r of sections.values()) {
    if (!r.def.el.isConnected) continue;
    const rect = r.def.el.getBoundingClientRect();
    r.top = rect.top + y;
    r.bottom = rect.bottom + y;
  }
  for (const p of pins.values()) {
    if (!p.def.track.isConnected) continue;
    p.start = Math.round(p.def.track.getBoundingClientRect().top + y);
    p.length = Math.max(0, p.def.track.offsetHeight - p.def.el.offsetHeight);
    // published for the gate and the dev overlay (the governor reads the track itself)
    p.def.el.dataset.pinStart = String(p.start);
    p.def.el.dataset.pinLength = String(p.length);
  }
  st?.refresh();
  track(currentY());
  for (const cb of refreshListeners) cb();
}

/** Called after every refresh (the stage re-measures; a deep link lands its hash). */
export function onScrollRefresh(cb: () => void): () => void {
  refreshListeners.add(cb);
  return () => refreshListeners.delete(cb);
}

let refreshTimer = 0;
/** Coalesces refresh requests (registration bursts on route change, image loads, height changes). */
export function scheduleRefresh(delayMs = 120): void {
  if (typeof window === "undefined") return;
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshScroll, delayMs);
}

/** Tracks a section for the HUD, rail and hash; returns the cleanup. */
export function trackSection(def: SectionDef): () => void {
  const reg: SectionReg = { def, top: 0, bottom: 0, active: false };
  sections.set(def.id, reg);
  publishTracked();
  scheduleRefresh();
  return () => {
    if (sections.get(def.id) === reg) sections.delete(def.id);
    publishTracked();
    if (scrollStore.getState().section === def.id) scrollStore.setState({ section: null });
    scheduleRefresh();
  };
}

/**
 * A pin, natively: the element is `position: sticky` inside a track PINS[id] svh taller than it,
 * so the browser holds it — on the compositor, with no per-frame JS, no fixed/in-flow swap (which
 * Chrome reports as a layout shift at every pin start and end) and no spacer inserted after
 * hydration. This only tracks the progress through it: steps, detents, scrubbed cameras.
 * A no-op under reduced motion (the CSS drops the track and the frames stack).
 */
export function pinSection(def: PinDef): () => void {
  if (!PINS[def.id]) {
    console.warn(`[scroll] "${String(def.id)}" can't pin — only ${Object.keys(PINS).join(", ")} pin (DESIGN.md §3.8)`);
    return () => undefined;
  }
  // the edition the head script stamped before first paint — not scrollStore: a page's effects run
  // before the layout's, so pins register before startScroll() has read the preference
  if (document.documentElement.dataset.motion === "reduce") return () => undefined;
  const reg: PinReg = { def, start: 0, length: 0, progress: -1, step: 0 };
  pins.set(def.id, reg);
  scheduleRefresh();
  return () => {
    if (pins.get(def.id) === reg) pins.delete(def.id);
    delete def.el.dataset.pinStart;
    delete def.el.dataset.pinLength;
    scheduleRefresh();
  };
}

/**
 * Where a target sits in scroll px — inside a pin, its (stuck) rect is replaced by the pin's start.
 * An element lands below the chrome's top band (html scroll-padding-top), as a native anchor
 * jump does, so a section's strip never lands under the HUD.
 */
export function scrollTargetOf(target: string | number | HTMLElement): number | null {
  if (typeof target === "number") return target;
  const el = typeof target === "string" ? document.getElementById(target.replace(/^#/, "")) : target;
  if (!el) return null;
  const pad = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  for (const reg of pins.values()) {
    const pinned = reg.def.el;
    // a pinned block itself sticks at the top: it lands at its pin's start, unpadded
    if (pinned === el) return reg.start;
    if (pinned.contains(el)) return Math.max(0, reg.start + el.offsetTop - pad);
  }
  return Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad);
}

/** Instant, truthful scroll (the TRACKING TEAR's cut). Tracking catches up in the same call. */
export function teleport(target: string | number | HTMLElement): void {
  const y = scrollTargetOf(target);
  if (y === null) return;
  const lenis = getLenis();
  if (lenis) {
    // its limit is measured by a ResizeObserver: after a route swap it's still the last page's
    // (a Back from a 2,246 px case study clamped home's 10,155 to 1,346) — measure now
    lenis.resize();
    lenis.scrollTo(y, { immediate: true, force: true });
  } else window.scrollTo(0, y);
  track(currentY());
}

// a quiet glide in flight: its token, so only the glide that started it (or input) ends it
let quietGlide = 0;
let glideSeq = 0;

function endQuietGlide(token?: number): void {
  if (!quietGlide || (token !== undefined && token !== quietGlide)) return;
  quietGlide = 0;
  setJumping(false);
  const id = scrollStore.getState().section;
  if (id) shallowHash(id); // the landing is linkable, as a crossing would have made it
}

/**
 * A smooth scroll (back to top, the hero's advance): Lenis on `transit`, or native under reduced
 * motion. `quiet`: the sections it passes aren't crossings — no SECTION cue for each, no hash, no
 * detent (back to top passes the whole page in 900 ms) — it lands like a jump. It ends where it
 * lands, or when input takes the scroll back (Lenis drops a scrollTo's onComplete then).
 */
export function glideTo(target: string | number | HTMLElement, ms: number = duration.scene.in, { quiet = false }: { quiet?: boolean } = {}): void {
  const y = scrollTargetOf(target);
  if (y === null) return;
  const lenis = getLenis();
  if (!lenis) {
    window.scrollTo({ top: y, behavior: "auto" });
    return;
  }
  endQuietGlide(); // a glide replaces the one in flight
  const token = ++glideSeq;
  if (quiet) {
    quietGlide = token;
    setJumping(true);
  }
  lenis.scrollTo(y, { duration: sec(ms), easing: bezier(ease.transit), force: true, onComplete: () => endQuietGlide(token) });
}

export function setJumping(on: boolean): void {
  scrollStore.setState({ jumping: on });
  if (!on) {
    // the jump landed: whatever section holds the line now is current, without scroll side effects
    for (const reg of sections.values()) if (reg.active) setSection(reg.def.id, "jump");
  }
}

/**
 * Starts the layer; returns the stop function. Idempotent per mount (React StrictMode-safe).
 */
export function startScroll({ reduced }: { reduced: boolean }): () => void {
  if (running) return () => undefined;
  running = true;
  scrollStore.setState({ reduced });

  let lenis: Lenis | null = null;
  let offLenisRaf: (() => void) | null = null;
  if (!reduced) {
    lenis = new Lenis({ ...LENIS_OPTIONS, autoRaf: false, anchors: false, autoResize: true });
    const raf = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(raf, false, true); // first in the frame: everything after reads this frame's scroll
    gsap.ticker.lagSmoothing(0);
    offLenisRaf = () => gsap.ticker.remove(raf);
    setLenis(lenis);
  }
  // a ScrollTrigger loaded by a later part updates on this tick, after Lenis
  const offSt = whenScrollTrigger((loaded) => {
    st = loaded;
  });

  // Input always wins (law 7): a scrolling key, a press or a touch cancels any eased scroll in
  // flight — a detent or a glide — so the native scroll it starts isn't overridden by Lenis.
  const onInput = (e: Event) => {
    scrollSignal.lastInput = performance.now();
    detentUntil = 0;
    const key = e instanceof KeyboardEvent ? e.key : null;
    // a wheel or a scrolling key takes a quiet glide's scroll back too: from here it's continuous
    if (quietGlide && (key === null || (SCROLL_KEYS.has(key) && !isTextEntry(e.target)))) endQuietGlide();
    if (!lenis || lenis.isScrolling !== "smooth") return;
    const takesOver = key === null ? e.type === "pointerdown" || e.type === "touchstart" : SCROLL_KEYS.has(key) && !isTextEntry(e.target);
    if (takesOver) {
      lenis.stop(); // stop() + start() is Lenis's public reset: animation cancelled, synced to scrollY
      lenis.start();
    }
  };
  const inputs = ["wheel", "touchstart", "touchmove", "keydown", "pointerdown"] as const;
  for (const t of inputs) window.addEventListener(t, onInput, { passive: true });

  // refresh once fonts are in (metrics change), after each image loads, on resize, and when content grows
  void document.fonts?.ready.then(() => scheduleRefresh(0));
  const onLoad = (e: Event) => {
    if (e.target instanceof HTMLImageElement || e.target instanceof HTMLVideoElement) scheduleRefresh();
  };
  document.addEventListener("load", onLoad, true);
  window.addEventListener("load", () => scheduleRefresh(0), { once: true });
  const onResize = () => scheduleRefresh();
  window.addEventListener("resize", onResize);
  let lastHeight = document.documentElement.scrollHeight;
  const ro = new ResizeObserver(() => {
    const h = document.documentElement.scrollHeight;
    if (Math.abs(h - lastHeight) > 1) {
      lastHeight = h;
      scheduleRefresh();
    }
  });
  ro.observe(document.body);

  let lastY = window.scrollY;
  const offTick = onTick((dt) => {
    const y = currentY();
    const raw = dt > 0 ? (y - lastY) / dt : 0;
    lastY = y;
    scrollSignal.y = y;
    scrollSignal.raw = raw;
    scrollSignal.velocity = damp(scrollSignal.velocity, raw, followers.scrollVelocity, dt);
    if (Math.abs(raw) > 1) scrollSignal.direction = raw > 0 ? 1 : -1;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollSignal.progress = Math.min(1, Math.max(0, y / max));
    if (y !== lastTracked) track(y);
    st?.update();
    if (lenis && !scrollStore.getState().jumping) detent(y);
  });

  return () => {
    offTick();
    offLenisRaf?.();
    offSt();
    ro.disconnect();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("load", onLoad, true);
    for (const t of inputs) window.removeEventListener(t, onInput);
    lenis?.destroy();
    setLenis(null);
    running = false;
  };
}

/** Soft detents: only when idle and close; any input cancels (Lenis lets input override scrollTo). */
function detent(y: number): void {
  const now = performance.now();
  if (now < detentUntil) return;
  const lenis = getLenis();
  if (!lenis || lenis.isScrolling) return;
  for (const reg of pins.values()) {
    const steps = reg.def.steps ?? 0;
    const end = reg.start + reg.length;
    if (steps < 2 || reg.length <= 0 || y < reg.start || y > end) continue;
    const node = detentTarget((y - reg.start) / reg.length, steps, scrollSignal.velocity, now - scrollSignal.lastInput);
    if (node === null) continue;
    detentUntil = now + duration.element.in + 50;
    lenis.scrollTo(reg.start + node * reg.length, { duration: sec(duration.element.in), easing: bezier(ease.relay), force: false, lock: false });
    return;
  }
}

/** The scroll position of a pin's step node (keyboard focus inside a StickyStack frame goes there). */
export function stepScroll(id: PinnedSection, step: number): number | null {
  const reg = pins.get(id);
  const steps = reg?.def.steps ?? 0;
  if (!reg || steps < 2) return null;
  return reg.start + (Math.min(steps - 1, Math.max(0, step)) / (steps - 1)) * reg.length;
}

/** Eases to a step node like a detent (the relay snap), or jumps natively without Lenis. */
export function scrollToStep(id: PinnedSection, step: number): void {
  const y = stepScroll(id, step);
  if (y === null) return;
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(y, { duration: sec(duration.element.in), easing: bezier(ease.relay), force: true });
  else window.scrollTo(0, y);
}

/** Current pin progress for a section (stages read it to scrub cameras). */
export const pinProgress = (id: PinnedSection): number => Math.max(0, pins.get(id)?.progress ?? 0);

/** Geometry as measured (the dev overlay and scripts/scroll-gate.mjs). */
export const scrollGeometry = () => ({
  sections: [...sections.values()].map((r) => ({ id: r.def.id, top: Math.round(r.top), bottom: Math.round(r.bottom), active: r.active })),
  pins: [...pins.values()].map((p) => ({ id: p.def.id, start: p.start, length: p.length, progress: p.progress, step: p.step })),
});
