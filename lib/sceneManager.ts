import { createStore, type StoreApi } from "zustand/vanilla";
import { flushHud } from "./hud";
import { median, RollingWindow } from "./stats";
import { liveAllowed, SCENE_IDS, TIER_RULES, type SceneId, type Tier, type TierDecision } from "./tier";

/**
 * The governor — DESIGN.md §4.2. One stage context, five scenes, at most one LIVE.
 *
 *   COLD → PRIMED → WARM → LIVE → COOLING → COLD
 *   PRIMED  chunk + CPU assets ready (no GPU)
 *   WARM    mounted, shaders compiled (compileAsync), buffers uploaded — zero draw calls
 *   LIVE    drawing into its docked slot
 *   COOLING left its slot; 2 s grace absorbs back-and-forth, then disposed (COLD)
 *
 * Invariants: ≤ 1 LIVE, ≤ 2 resident in VRAM (a COOLING scene is evicted early when a WARM one
 * needs room), offscreen ⇒ 0 draw calls, one drawing context per frame (#fx-gl freezes the stage).
 *
 * Plain TypeScript, no three.js: it ships in first-load JS and runs under vitest with a fake clock
 * and a fake runtime. The three/R3F side (components/stage/StageRuntime) plugs in through
 * StageRuntime; DOM access lives in configure()/measure()/start() only.
 *
 * Split (v2.3, the §8.3 lever): this module is what the page needs before a scene can draw — the
 * store, the tier, the slots and the interlock, the boot's tasks, #fx-gl's frames, the stats. The
 * state machine above (residency, docking, the stage's draws) is lib/governor-engine.ts, which the
 * stage runtime brings and plugs in (attachEngine); until then every slot shows its poster.
 */
export const SCENE_STATES = ["COLD", "PRIMED", "WARM", "LIVE", "COOLING"] as const;
export type SceneState = (typeof SCENE_STATES)[number];

/** §4.2 / §8.3 policy constants. */
export const GOVERNOR = {
  maxLive: 1,
  maxResident: 2,
  coolingGraceMs: 2000,
  /** no input or camera motion for this long ⇒ the stage drops to idleFps */
  idleAfterMs: 2000,
  idleFps: 30,
  /** on displays above highRefreshHz the stage renders at the display rate only while its p95 ≤ this */
  highRefreshHz: 90,
  highRefreshP95Ms: 7.5,
  highRefreshFallbackFps: 60,
  /**
   * …or while frames still make vsync: the cap needs the ticks to be late too (p95 interval over
   * this many refresh intervals). Apple GPUs clock down at a light load, and their timer queries
   * then overstate the cost (measured on the hero at HIGH, M5 Pro: 0.90–1.49 ms saturated,
   * 4.0–5.5 ms p50 and 7.5–9.8 ms p95 as timed — the p95 alone would cap a display that never
   * misses a frame).
   */
  missedFrameIntervals: 1.5,
  /** once capped, the stage holds 60 for this long before trying the display rate again */
  highRefreshHoldMs: 3000,
  /** slots this close to the screen (in viewports) start warming: "≥ 1.5 viewports ahead" */
  warmAheadViewports: 1.5,
  /** the interlock: ≥ 100 svh of DOM-only content between any two stage slots */
  interlockSvh: 1,
} as const;

export type RenderMode = "off" | "boot" | "full" | "capped" | "idle" | "demand" | "frozen";

export interface Viewport {
  width: number;
  /** visible height (innerHeight) — what's on screen */
  height: number;
  /** #stage height (100lvh) — what docking aligns */
  canvasHeight: number;
  /** 100svh in px, for the interlock */
  svh: number;
}

export interface Slot {
  key: number;
  id: SceneId;
  el: HTMLElement | null;
  /** natural (unpinned) document coordinates, cached by measure() — never read in the loop */
  top: number;
  height: number;
  /** a pin (StickyStack: sticky in a taller track) holds the slot still for `length` px of scroll from `start` */
  pin: { start: number; length: number } | null;
  /** a takeover (PROJECTION): fixed to the viewport, whatever the scroll */
  fixed?: boolean;
}

export interface RenderJob {
  id: SceneId;
  /** seconds (R3F's advance() takes seconds) */
  time: number;
  /** the slot's region of the canvas, CSS px; GL viewport y = offsetBottom */
  viewport: { width: number; height: number; offsetBottom: number };
  /**
   * DITHER RESOLVE from this frame (scene tier, §3.6): set when the slot's poster was on screen
   * while the scene couldn't draw. Origin in the slot's viewport, 0–1 (where the user looked).
   */
  resolve: { x: number; y: number } | null;
}

export interface RenderResult {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
}

/** What the three/R3F runtime provides once loaded. */
export interface StageRuntime {
  /** Compiles shaders (compileAsync) and uploads every buffer and texture of a mounted scene, issuing no draw call. */
  warm(id: SceneId): Promise<{ ms: number; vramBytes: number }>;
  render(job: RenderJob): RenderResult;
  /** false ⇒ render on demand only */
  animating(id: SceneId): boolean;
  memory(): { geometries: number; textures: number; programs: number };
  framebufferBytes(): number;
}

/** #fx-gl, seen from the governor: it asks for frames; the stage freezes while it has them. */
export interface FrameOverlay {
  wantsFrame(now: number): boolean;
  draw(now: number): void;
}

/** Work the stage does for a few frames at boot (the tier probe). Returns true when done. */
export type BootTask = (now: number) => boolean;

export interface SceneModule {
  /** CPU-side preparation (fetch, decode, generate): runs at PRIMED, never touches the GPU */
  prime?: () => unknown;
  /** the R3F scene component, typed by the runtime */
  default: unknown;
}
export type SceneLoaders = Record<SceneId, () => Promise<SceneModule>>;

export interface SceneSnapshot {
  state: SceneState;
  /** resident: mounted in three (WARM, LIVE, COOLING, or PRIMED while warming) */
  mounted: boolean;
  /** WARM / LIVE / COOLING with a healthy context: the slot can show the live scene (else its poster) */
  drawable: boolean;
  /**
   * The slot shows its poster: not drawable — or drawable but the poster was on screen, so it stays
   * until the stage's first (dithered) frame has replaced it (no frame with neither).
   */
  poster: boolean;
  warmMs: number | null;
  vramBytes: number;
  error: string | null;
}

export interface ProbeRecord {
  tier: Tier;
  p90Ms: number;
  method: "gpu-timer" | "sync";
  frames: number;
}

export interface StageSnapshot {
  tier: Tier | null;
  /** the tier is decided (probe done or not needed); scenes only go LIVE after this */
  tierFinal: boolean;
  tierReasons: string[];
  phone: boolean;
  probes: ProbeRecord[];
  refreshHz: number | null;
  dpr: number;
  deviceDpr: number;
  runtime: "off" | "pending" | "loading" | "ready" | "failed";
  contextLost: boolean;
  mode: RenderMode;
  resident: SceneId[];
  scenes: Record<SceneId, SceneSnapshot>;
  interlock: SlotGap[];
  prefetched: SceneId[];
}

export interface StageStats {
  frame: number;
  /** tick intervals (ms) */
  intervals: RollingWindow;
  /** stage render CPU time (ms) */
  work: RollingWindow;
  /** stage GPU time (ms), from timer queries where the browser has them */
  gpu: RollingWindow;
  last: RenderResult & { frame: number };
  framesRendered: number;
  framesFrozen: number;
  framesFx: number;
  framesBoot: number;
  maxLive: number;
  maxResident: number;
  /** frames in which both the stage and #fx-gl drew (by construction 0; the GL census double-checks) */
  bothDrew: number;
  /** draw calls issued while the LIVE scene's slot was off screen */
  offscreenDraws: number;
  /** a LIVE slot is on screen this frame */
  visible: boolean;
  docked: SceneId | null;
  drewThisFrame: "stage" | "fx" | "boot" | null;
  /** how many times each scene was warmed (compile + upload) */
  warms: Record<SceneId, number>;
}

// ── pure geometry (exported for tests) ────────────────────────────────────────────────────

type SlotGeometry = Pick<Slot, "top" | "height"> & { pin?: Slot["pin"]; fixed?: boolean };

/** The slot's top edge in viewport px at a scroll position — held still while its pin runs. */
export function viewTop(slot: SlotGeometry, scroll: number): number {
  if (slot.fixed) return 0;
  const pin = slot.pin;
  if (!pin || scroll <= pin.start) return slot.top - scroll;
  if (scroll >= pin.start + pin.length) return slot.top + pin.length - scroll;
  return slot.top - pin.start;
}

/** Where the slot's scroll footprint ends (natural bottom plus the pin's length). */
export const docBottom = (slot: SlotGeometry): number => slot.top + slot.height + (slot.pin?.length ?? 0);

/** How much of a slot is on screen, px. */
export function visibleHeight(slot: SlotGeometry, scroll: number, viewportHeight: number): number {
  const top = viewTop(slot, scroll);
  return Math.max(0, Math.min(viewportHeight, top + slot.height) - Math.max(0, top));
}

export interface SlotGap {
  from: SceneId;
  to: SceneId;
  /** DOM-only distance from the end of `from` (pins included) to the start of `to`, in svh units (1 = 100 svh) */
  gapSvh: number;
}

/** Every consecutive pair of slots and the DOM-only distance between them (the gate reports these). */
export function slotGaps(slots: readonly Slot[], svhPx: number): (SlotGap & { pass: boolean })[] {
  if (svhPx <= 0) return [];
  // a slot with no height draws nothing (an edition hides it: ARCHIVE's under reduced motion), so
  // it bounds no stage
  const sorted = slots.filter((s) => s.height > 0 && !s.fixed).sort((a, b) => a.top - b.top);
  const out: (SlotGap & { pass: boolean })[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (!a || !b) continue;
    const gapSvh = (b.top - docBottom(a)) / svhPx;
    out.push({ from: a.id, to: b.id, gapSvh: Math.round(gapSvh * 100) / 100, pass: gapSvh >= GOVERNOR.interlockSvh - 1e-3 });
  }
  return out;
}

/** Consecutive slot pairs with less than the interlock's DOM-only distance between them. */
export const interlockGaps = (slots: readonly Slot[], svhPx: number): SlotGap[] => slotGaps(slots, svhPx).flatMap(({ pass, ...g }) => (pass ? [] : [g]));

// ── the governor ──────────────────────────────────────────────────────────────────────────

const freshSnapshot = (): StageSnapshot => ({
  tier: null,
  tierFinal: false,
  tierReasons: [],
  phone: false,
  probes: [],
  refreshHz: null,
  dpr: 1,
  deviceDpr: 1,
  runtime: "off",
  contextLost: false,
  mode: "off",
  resident: [],
  scenes: Object.fromEntries(SCENE_IDS.map((id) => [id, { state: "COLD", mounted: false, drawable: false, poster: true, warmMs: null, vramBytes: 0, error: null }])) as Record<SceneId, SceneSnapshot>,
  interlock: [],
  prefetched: [],
});

const freshStats = (): StageStats => ({
  frame: 0,
  intervals: new RollingWindow(240),
  work: new RollingWindow(240),
  gpu: new RollingWindow(240),
  last: { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 },
  framesRendered: 0,
  framesFrozen: 0,
  framesFx: 0,
  framesBoot: 0,
  maxLive: 0,
  maxResident: 0,
  bothDrew: 0,
  offscreenDraws: 0,
  visible: false,
  docked: null,
  drewThisFrame: null,
  warms: Object.fromEntries(SCENE_IDS.map((id) => [id, 0])) as Record<SceneId, number>,
});

/**
 * Docking (DESIGN.md §4.2, v1.5): the one canvas moves into the live slot's dock, where
 * `position: sticky` holds it — native scrolling, no per-frame JS, no lag on any input. Called
 * only when the docked slot changes (inside the interlock, where nobody sees it).
 */
export type DockSink = (slot: HTMLElement | null) => void;

export interface GovernorOptions {
  now?: () => number;
}

/** What the scene scheduler sees of the governor (lib/governor-engine.ts): read-mostly, no DOM. */
export interface GovernorHost {
  readonly now: () => number;
  readonly store: StoreApi<StageSnapshot>;
  readonly stats: StageStats;
  slots(): readonly Slot[];
  viewport(): Viewport;
  runtime(): StageRuntime | null;
  loaders(): SceneLoaders | null;
  /** scene chunks already fetched (prefetch() on idle) */
  readonly modules: Map<SceneId, SceneModule>;
  /** scenes kept resident with no slot (hold()) */
  readonly held: ReadonlyMap<SceneId, number>;
  dockSink(el: HTMLElement | null): void;
  pointer(): { x: number; y: number } | null;
  lastActivity(): number;
  direction(): 1 | -1;
  frameP95(): number;
  nextKey(): number;
}

/** The scene scheduler, as the governor drives it (lib/governor-engine.ts implements it). */
export interface SceneEngine {
  /** residency and docking; the stage's draw unless the frame is held — the mode it asked for, or null */
  frame(now: number, scroll: number, held: boolean): RenderMode | null;
  takeover(id: SceneId, el: HTMLElement | null): (() => void) | null;
  readonly takenOver: SceneId | null;
  /** the docked slot's key */
  readonly docked: number | null;
  forgetSlot(key: number): void;
  scene(id: SceneId): { module: SceneModule | null; data: unknown };
  sceneMounted(id: SceneId): void;
  invalidate(id?: SceneId): void;
  onTier(tier: Tier, final: boolean): void;
  markDirty(): void;
  contextLost(): void;
  contextRestored(): void;
  detach(): void;
}

export class Governor {
  readonly store: StoreApi<StageSnapshot> = createStore<StageSnapshot>(freshSnapshot);
  readonly stats: StageStats = freshStats();
  /** dev-only hooks the runtime installs (forced context loss for the harness and the gate) */
  dev: {
    loseContext?: () => void;
    restoreContext?: () => void;
    runtimeMemory?: () => { geometries: number; textures: number; programs: number };
    framebufferBytes?: () => number;
    /** a mounted scene's animation clock (s) — proves continuity across route changes */
    sceneTime?: (id: SceneId) => number | null;
    /** the post chain's ground: what its scene buffer was cleared to vs the ground it grades against (linear) */
    postGround?: () => { cleared: number[]; ground: number[] } | null;
    /** false: post scenes draw without the post chain (the GPU-cost breakdown in scripts/hero-gate.mjs) */
    post?: boolean;
    /** the post chain's render targets, bytes (debug) */
    postBytes?: () => number;
    /** the hero's particle field, while it's mounted (debug only) */
    hero?: unknown;
    /** the LOG deck (components/stage/log/deck.ts), in debug */
    log?: unknown;
    /** A3's sky (?debug=1): scripts/archive-gate.mjs reads its state */
    archive?: unknown;
    /** A4's carousel (?debug=1): scripts/work-gate.mjs reads and drives it */
    work?: unknown;
    /** A5's keycap pile (?debug=1): scripts/capabilities-gate.mjs reads and drives it */
    capabilities?: unknown;
    /**
     * Debug: renders the LIVE scene `frames` times back to back into an offscreen target and waits
     * for the GPU — ms per frame with the GPU saturated (and clocked up), next to the timer queries'
     * per-frame times at the page's own, lighter load.
     */
    bench?: (id: SceneId, frames: number) => Promise<number | null>;
  } = {};

  private readonly now: () => number;
  private slots: Slot[] = [];
  private nextKey = 1;
  private loaders: SceneLoaders | null = null;
  private runtime: StageRuntime | null = null;
  private engine: SceneEngine | null = null;
  private readonly modules = new Map<SceneId, SceneModule>();
  private overlay: FrameOverlay | null = null;
  private bootTasks: { task: BootTask; done: () => void }[] = [];
  private viewport: Viewport = { width: 0, height: 0, canvasHeight: 0, svh: 0 };
  private readScroll: () => number = () => 0;
  private dockSink: DockSink = () => undefined;
  private isHidden: () => boolean = () => false;
  private lastScroll = 0;
  private direction: 1 | -1 = 1;
  private lastActivity = 0;
  private lastTick = 0;
  private pointer: { x: number; y: number } | null = null;
  private refresh: number[] = [];
  private warningsShown = new Set<string>();
  /** PROJECTION: scenes kept resident with no slot (hold()) */
  private readonly held = new Map<SceneId, number>();
  private readonly host: GovernorHost;

  constructor(options: GovernorOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.host = {
      now: this.now,
      store: this.store,
      stats: this.stats,
      slots: () => this.slots,
      viewport: () => this.viewport,
      runtime: () => this.runtime,
      loaders: () => this.loaders,
      modules: this.modules,
      held: this.held,
      dockSink: (el) => this.dockSink(el),
      pointer: () => this.pointer,
      lastActivity: () => this.lastActivity,
      direction: () => this.direction,
      frameP95: () => this.frameP95(),
      nextKey: () => this.nextKey++,
    };
  }

  // ── wiring ──────────────────────────────────────────────────────────────────────────────

  configure(options: { loaders?: SceneLoaders; readScroll?: () => number; dockSink?: DockSink; isHidden?: () => boolean }): void {
    if (options.loaders) this.loaders = options.loaders;
    if (options.readScroll) this.readScroll = options.readScroll;
    if (options.dockSink) this.dockSink = options.dockSink;
    if (options.isHidden) this.isHidden = options.isHidden;
  }

  /** Plugs in the scene scheduler (the stage runtime brings it, lib/governor-engine.ts). Once. */
  attachEngine(make: (host: GovernorHost) => SceneEngine): void {
    if (this.engine) return;
    this.engine = make(this.host);
    const snap = this.snapshot;
    if (snap.tier) this.engine.onTier(snap.tier, snap.tierFinal);
  }

  get snapshot(): StageSnapshot {
    return this.store.getState();
  }

  private patch(p: Partial<StageSnapshot>): void {
    this.store.setState(p);
  }

  setRuntimeStatus(runtime: StageSnapshot["runtime"]): void {
    if (this.snapshot.runtime !== runtime) this.patch({ runtime });
  }

  attachRuntime(rt: StageRuntime): void {
    this.runtime = rt;
    this.dev.runtimeMemory = () => rt.memory();
    this.dev.framebufferBytes = () => rt.framebufferBytes();
    this.setRuntimeStatus("ready");
  }

  detachRuntime(): void {
    this.runtime = null;
    this.engine?.detach();
    this.bootTasks.splice(0).forEach((b) => b.done());
  }

  setOverlay(overlay: FrameOverlay | null): void {
    this.overlay = overlay;
  }

  /** The tier from the hard rules (final = false while the probe still has a say). */
  setTier(decision: TierDecision, final: boolean): void {
    this.patch({ tier: decision.tier, tierReasons: decision.reasons, phone: decision.phone, tierFinal: final, ...(decision.tier === "OFF" ? { runtime: "off" as const } : {}) });
    this.engine?.onTier(decision.tier, final);
  }

  recordProbe(p: ProbeRecord): void {
    this.patch({ probes: [...this.snapshot.probes, p] });
  }

  setDpr(dpr: number, deviceDpr: number): void {
    if (this.snapshot.dpr !== dpr || this.snapshot.deviceDpr !== deviceDpr) this.patch({ dpr, deviceDpr });
  }

  setViewport(v: Viewport): void {
    this.viewport = v;
    this.checkInterlock();
  }

  /** GPU time of one stage frame, when a timer query resolves (a few frames late). */
  recordGpuMs(ms: number): void {
    this.stats.gpu.push(ms);
  }

  /** The stage's frame-time p95: the worse of CPU and GPU. */
  frameP95(): number {
    const cpu = this.stats.work.count ? this.stats.work.percentile(95) : 0;
    const gpu = this.stats.gpu.count ? this.stats.gpu.percentile(95) : 0;
    return Math.max(cpu, gpu);
  }

  // ── slots ───────────────────────────────────────────────────────────────────────────────

  registerSlot(id: SceneId, el: HTMLElement | null, rect?: { top: number; height: number }): () => void {
    const slot: Slot = { key: this.nextKey++, id, el, top: rect?.top ?? 0, height: rect?.height ?? 0, pin: null };
    this.slots.push(slot);
    if (el) this.measure();
    else this.checkInterlock();
    return () => {
      this.slots = this.slots.filter((s) => s !== slot);
      this.engine?.forgetSlot(slot.key);
      this.checkInterlock();
    };
  }

  /**
   * PROJECTION (DESIGN.md §7.4 WORK, §3.6 continuity): a scene takes the whole viewport for a
   * moment. The canvas docks into `el` (a fixed layer with a .stage-dock), the scene is LIVE there
   * whatever the slots say, and draws as it asks, until the release. Null when the tier doesn't
   * let it draw or it isn't resident — the caller falls back to a plain navigation.
   */
  takeover(id: SceneId, el: HTMLElement | null): (() => void) | null {
    return this.engine?.takeover(id, el) ?? null;
  }

  /** The scene a takeover holds, if any (the stage's own state, for the dev overlay and the gate). */
  get takenOver(): SceneId | null {
    return this.engine?.takenOver ?? null;
  }

  /**
   * Keeps a scene resident (WARM) with no slot on the page — what a PROJECTION needs to reverse
   * on Back from a case study. Counted: each hold is released once. Within the residency budget.
   */
  hold(id: SceneId): () => void {
    this.held.set(id, (this.held.get(id) ?? 0) + 1);
    this.engine?.markDirty();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const n = (this.held.get(id) ?? 1) - 1;
      if (n > 0) this.held.set(id, n);
      else this.held.delete(id);
    };
  }

  /** Test hook: moves a slot without a DOM. */
  setSlotRect(id: SceneId, top: number, height: number, pin: Slot["pin"] = null): void {
    for (const s of this.slots) if (s.id === id) Object.assign(s, { top, height, pin });
    this.checkInterlock();
  }

  /** The pointer, in viewport px (the DITHER RESOLVE origin when it's over the slot). */
  notePointer(x: number, y: number): void {
    this.pointer = { x, y };
  }

  /**
   * A scene's slot's top edge in viewport px now, from the cached geometry (no layout read): what
   * a scene maps the pointer through when its slot isn't the whole viewport (A3's picking, as its
   * pin comes and goes). The docked slot when the scene has several; null when it has none.
   */
  slotTop(id: SceneId): number | null {
    if (this.engine?.takenOver === id) return 0;
    if (typeof window === "undefined") return null;
    const own = this.slots.filter((s) => s.id === id);
    const docked = this.engine?.docked ?? null;
    const slot = own.find((s) => s.key === docked) ?? own[0];
    return slot ? viewTop(slot, window.scrollY) : null;
  }

  /**
   * Caches every slot's document offset. Reads layout, so it runs from ResizeObserver, resize,
   * fonts and scroll-refresh callbacks (lib/scroll.ts) — never from update().
   */
  measure(): void {
    if (typeof window === "undefined") return;
    const scroll = window.scrollY;
    for (const s of this.slots) {
      if (!s.el || !s.el.isConnected) continue; // detached mid-navigation: keep the last good rect
      const r = s.el.getBoundingClientRect();
      // inside a pin (StickyStack: a sticky block in a taller track), the track says where the pin
      // starts and how long it holds — read from layout, so it's right before any script refreshes
      const track = s.el.closest<HTMLElement>(".pin-track");
      const stuck = track?.firstElementChild instanceof HTMLElement ? track.firstElementChild : null;
      const start = track ? track.getBoundingClientRect().top + scroll : Number.NaN;
      const length = track && stuck ? track.offsetHeight - stuck.offsetHeight : Number.NaN;
      s.pin = Number.isFinite(start) && Number.isFinite(length) && length > 0 ? { start, length } : null;
      const pin = s.pin;
      s.top = !pin || scroll <= pin.start ? r.top + scroll : scroll >= pin.start + pin.length ? r.top + scroll - pin.length : r.top + pin.start;
      s.height = r.height;
    }
    this.checkInterlock();
  }

  /** All slot-to-slot gaps at the current viewport, passing or not (scripts/scroll-gate.mjs). */
  gaps(): (SlotGap & { pass: boolean })[] {
    return slotGaps(this.slots, this.viewport.svh);
  }

  private checkInterlock(): void {
    const gaps = interlockGaps(this.slots, this.viewport.svh);
    const prev = this.snapshot.interlock;
    if (JSON.stringify(prev) !== JSON.stringify(gaps)) this.patch({ interlock: gaps });
    if (process.env.NODE_ENV !== "production") {
      for (const g of gaps) {
        const key = `${g.from}→${g.to}:${g.gapSvh}`;
        if (this.warningsShown.has(key)) continue;
        this.warningsShown.add(key);
        console.warn(`[stage] interlock: only ${g.gapSvh} svh of DOM-only content between "${g.from}" and "${g.to}" — needs ≥ ${GOVERNOR.interlockSvh * 100} svh (DESIGN.md §4.2)`);
      }
    }
  }

  // ── scenes (called by the runtime, through the engine) ──────────────────────────────────

  scene(id: SceneId): { module: SceneModule | null; data: unknown } {
    return this.engine?.scene(id) ?? { module: this.modules.get(id) ?? null, data: null };
  }

  /** ScenePortal committed: its three objects exist — compile and upload them. */
  sceneMounted(id: SceneId): void {
    this.engine?.sceneMounted(id);
  }

  /** A scene asks for one more frame (on-demand rendering). */
  invalidate(id?: SceneId): void {
    this.engine?.invalidate(id);
  }

  /** Input, scrolling or camera motion: keeps the stage at full rate for another 2 s. */
  noteActivity(now = this.now()): void {
    this.lastActivity = now;
  }

  /** Resolves after the task has run to completion, one frame at a time, on the one RAF. */
  runBootTask(task: BootTask): Promise<void> {
    return new Promise((done) => this.bootTasks.push({ task, done }));
  }

  // ── context loss (§4.2) ─────────────────────────────────────────────────────────────────

  contextLost(): void {
    if (this.engine) this.engine.contextLost();
    else this.patch({ contextLost: true });
  }

  /** The current slot re-warms on the next frame; other resident scenes are released. */
  contextRestored(): void {
    if (this.engine) this.engine.contextRestored();
    else this.patch({ contextLost: false });
  }

  // ── the frame ───────────────────────────────────────────────────────────────────────────

  /**
   * One step of the one-RAF chain, after lenis.raf and the scroll tick: the scheduler's residency
   * and docking, then exactly one of { #fx-gl, boot task, stage render } draws — or nothing does.
   */
  update(now: number = this.now()): void {
    const st = this.stats;
    st.frame++;
    st.drewThisFrame = null;
    if (this.lastTick > 0) {
      st.intervals.push(now - this.lastTick);
      this.sampleRefresh(now - this.lastTick);
    }
    this.lastTick = now;

    const scroll = this.readScroll();
    if (Math.abs(scroll - this.lastScroll) > 0.5) {
      this.direction = scroll > this.lastScroll ? 1 : -1;
      this.lastActivity = now;
    }
    this.lastScroll = scroll;

    const snap = this.snapshot;
    const tier = snap.tierFinal ? snap.tier : null;
    const hidden = this.isHidden();
    // who draws this frame: #fx-gl and a boot task hold it; otherwise the stage, if it asks
    const fx = this.overlay?.wantsFrame(now) ?? false;
    const asked = this.engine?.frame(now, scroll, hidden || fx || this.bootTasks.length > 0) ?? null;
    let mode: RenderMode = tier === null ? (this.bootTasks.length ? "boot" : "off") : tier === "OFF" ? "off" : "demand";
    if (hidden) mode = "off";
    else if (fx) mode = "frozen";
    else if (this.bootTasks.length) mode = "boot";
    else if (asked) mode = asked;

    if (mode === "frozen") {
      st.drewThisFrame = "fx";
      this.overlay?.draw(now);
      st.framesFx++;
      if (st.visible) st.framesFrozen++;
    } else if (mode === "boot") {
      st.drewThisFrame = "boot";
      const head = this.bootTasks[0];
      if (head && head.task(now)) {
        this.bootTasks.shift();
        head.done();
      }
      st.framesBoot++;
    }

    if (this.snapshot.mode !== mode) this.patch({ mode });
    flushHud(now);
  }

  private sampleRefresh(interval: number): void {
    if (this.snapshot.refreshHz !== null) return;
    this.refresh.push(interval);
    if (this.refresh.length >= TIER_RULES.refreshSamples) {
      const hz = Math.round(1000 / median(this.refresh));
      this.refresh = [];
      this.patch({ refreshHz: hz });
    }
  }

  // ── lifecycle (client) ──────────────────────────────────────────────────────────────────

  /** Chunks for the scenes this tier can show, fetched while the main thread is idle (HIGH/MID). */
  prefetch(): void {
    const tier = this.snapshot.tier;
    if (!this.loaders || (tier !== "HIGH" && tier !== "MID")) return;
    for (const id of SCENE_IDS) {
      if (this.modules.has(id) || !liveAllowed(tier, id)) continue;
      const loader = this.loaders[id];
      void loader().then((m) => {
        if (!this.modules.has(id)) this.modules.set(id, m);
        this.patch({ prefetched: [...new Set([...this.snapshot.prefetched, id])] });
      });
    }
  }

  /** Debug: resets the max-seen counters (the gate test calls it before each scenario). */
  resetStats(): void {
    const { intervals, work, gpu } = this.stats;
    Object.assign(this.stats, freshStats(), { intervals, work, gpu });
  }
}

/** The app's one governor. */
export const governor = new Governor();
