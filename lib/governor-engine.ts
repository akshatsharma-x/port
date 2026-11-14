import { GOVERNOR, viewTop, visibleHeight, type GovernorHost, type RenderJob, type RenderMode, type SceneEngine, type SceneModule, type SceneSnapshot, type SceneState, type Slot } from "./sceneManager";
import { liveAllowed, SCENE_IDS, type SceneId, type Tier } from "./tier";

/**
 * The governor's scene scheduler — DESIGN.md §4.2's state machine, split out of first-load JS (§8.3:
 * the lever, v2.3). The governor (lib/sceneManager.ts) keeps what the page needs before any scene
 * can draw: the store, the tier, the slots and the interlock, the boot's tasks, #fx-gl's frames and
 * the stats. This module arrives with the stage runtime (components/stage/StageRuntime.tsx imports
 * it), and from then on runs residency, docking and the stage's draws:
 *
 *   COLD → PRIMED → WARM → LIVE → COOLING → COLD
 *
 * Nothing here can draw before the runtime exists, and on HIGH and MID the tier — what lets a
 * scene go LIVE — is final only after the runtime's probe; so the page loses nothing by waiting.
 */

/** The slot the stage docks to: the most-visible one whose scene may go LIVE. */
export function pickCurrent(slots: readonly Slot[], scroll: number, viewportHeight: number, allowed: (id: SceneId) => boolean): Slot | null {
  let best: Slot | null = null;
  let bestArea = 0;
  for (const s of slots) {
    if (!allowed(s.id)) continue;
    const v = visibleHeight(s, scroll, viewportHeight);
    if (v > bestArea) {
      best = s;
      bestArea = v;
    }
  }
  return best;
}

/**
 * Slots to warm: ahead in the scroll direction within warm-ahead distance (plus any partly visible
 * one), nearest first. Slots behind are left to COOLING — "the next scene starts warming when the
 * current stage's document begins"; the one you left cools, then goes.
 */
export function warmCandidates(
  slots: readonly Slot[],
  scroll: number,
  viewportHeight: number,
  direction: 1 | -1,
  allowed: (id: SceneId) => boolean,
  exclude: SceneId | null,
): SceneId[] {
  const reach = GOVERNOR.warmAheadViewports * viewportHeight;
  const found: { id: SceneId; gap: number; ahead: boolean }[] = [];
  for (const s of slots) {
    if (!allowed(s.id) || s.id === exclude) continue;
    const top = viewTop(s, scroll);
    const bottom = top + s.height;
    const gap = bottom <= 0 ? -bottom : top >= viewportHeight ? top - viewportHeight : 0;
    if (gap > reach) continue;
    const ahead = direction > 0 ? top > 0 : bottom < viewportHeight;
    const onScreen = Math.min(viewportHeight, bottom) - Math.max(0, top) > 0;
    if (!ahead && !onScreen) continue;
    found.push({ id: s.id, gap, ahead });
  }
  found.sort((a, b) => a.gap - b.gap);
  return [...new Set(found.map((f) => f.id))];
}

interface Entry {
  id: SceneId;
  state: SceneState;
  module: SceneModule | null;
  data: unknown;
  loading: boolean;
  mounted: boolean;
  warming: boolean;
  /** after a context loss: mounted, but its GPU side is gone */
  needsRewarm: boolean;
  /** bumps on evict / context loss, so late async results are dropped */
  epoch: number;
  coolingSince: number;
  warmMs: number | null;
  vramBytes: number;
  drawnSinceLive: boolean;
  invalidated: boolean;
  /** the slot was on screen showing its poster since the scene last drew: resolve on next draw */
  posterSeen: boolean;
  error: string | null;
}

const rankForEviction = (e: Entry): number => (e.state === "COOLING" ? 0 : e.state === "WARM" ? 1 : 2);

/** The scheduler, plugged into the app's governor by the stage runtime (governor.attachEngine). */
export function createEngine(host: GovernorHost): SceneEngine {
  return new Scheduler(host);
}

class Scheduler implements SceneEngine {
  private readonly entries: Record<SceneId, Entry>;
  private readonly all: Entry[];
  private dirty = true;
  private lost = false;
  private docked_: number | null = null;
  private lastRenderAt = Number.NEGATIVE_INFINITY;
  /** frameP95() sorts two windows: refreshed at 2 Hz, not per frame */
  private p95Cached = 0;
  private intervalP95Cached = 0;
  private p95At = Number.NEGATIVE_INFINITY;
  private cappedUntil = Number.NEGATIVE_INFINITY;
  /** PROJECTION: a scene holding the whole viewport (takeover()) */
  private takeoverSlot: Slot | null = null;

  constructor(private readonly host: GovernorHost) {
    this.entries = Object.fromEntries(
      SCENE_IDS.map((id) => [
        id,
        { id, state: "COLD", module: null, data: null, loading: false, mounted: false, warming: false, needsRewarm: false, epoch: 0, coolingSince: 0, warmMs: null, vramBytes: 0, drawnSinceLive: false, invalidated: false, posterSeen: false, error: null },
      ]),
    ) as Record<SceneId, Entry>;
    this.all = SCENE_IDS.map((id) => this.entries[id]);
  }

  get docked(): number | null {
    return this.docked_;
  }

  get takenOver(): SceneId | null {
    return this.takeoverSlot?.id ?? null;
  }

  markDirty(): void {
    this.dirty = true;
  }

  // ── the frame ───────────────────────────────────────────────────────────────────────────

  /**
   * Residency and docking, every frame; the stage's own render decision and draw unless the frame
   * is held (hidden, #fx-gl, a boot task). Returns the mode the stage asked for, or null.
   */
  frame(now: number, scroll: number, held: boolean): RenderMode | null {
    const h = this.host;
    const st = h.stats;
    const snap = h.store.getState();
    const tier = snap.tierFinal ? snap.tier : null;
    const allowed = (id: SceneId) => liveAllowed(tier, id);
    const vp = h.viewport();
    const vh = vp.height;
    // a takeover (PROJECTION) is the current slot, whatever the page's slots say
    const take = this.takeoverSlot && tier && allowed(this.takeoverSlot.id) ? this.takeoverSlot : null;
    if (take) take.height = vp.canvasHeight;
    const slots = h.slots();
    const current = take ?? (tier ? pickCurrent(slots, scroll, vh, allowed) : null);
    const desiredLive = current?.id ?? null;
    const budget = GOVERNOR.maxResident - (desiredLive ? 1 : 0);
    // held scenes first (a PROJECTION's way back), then the warm-ahead
    const kept: SceneId[] = [];
    if (tier) for (const id of h.held.keys()) if (allowed(id) && id !== desiredLive) kept.push(id);
    const ahead = tier ? warmCandidates(slots, scroll, vh, h.direction(), allowed, desiredLive) : [];
    const desiredWarm = (kept.length ? [...new Set([...kept, ...ahead])] : ahead).slice(0, budget);

    this.reconcile(now, desiredLive, desiredWarm);

    // invariants (no allocation: this runs every frame)
    let liveCount = 0;
    let resident = 0;
    let liveEntry: Entry | null = null;
    for (const e of this.all) {
      if (e.state === "LIVE") {
        liveCount++;
        liveEntry ??= e;
      }
      if (e.mounted) resident++;
    }
    st.maxLive = Math.max(st.maxLive, liveCount);
    st.maxResident = Math.max(st.maxResident, resident);
    const onScreen = !!(liveEntry && current && current.id === liveEntry.id);
    st.visible = onScreen;
    // gap protection: the slot on screen is showing its poster (its scene can't draw yet)
    if (current) {
      const e = this.entries[current.id];
      if (!e.posterSeen && !(e.state === "LIVE" && e.drawnSinceLive) && !this.isDrawable(e)) {
        e.posterSeen = true;
        this.dirty = true;
      }
    }

    let mode: RenderMode | null = null;
    let renderStage = false;
    const runtime = h.runtime();
    if (!held && onScreen && liveEntry && runtime && !this.lost) {
      const r = this.renderDecision(now, liveEntry);
      mode = r.mode;
      renderStage = r.render;
    }

    // docking: the canvas moves to a slot only when it will draw there (its last frame belongs there)
    if (onScreen && liveEntry && current && (liveEntry.drawnSinceLive || renderStage)) this.dock(current);
    st.docked = this.docked_ === null ? null : (slots.find((s) => s.key === this.docked_)?.id ?? null);

    // drewThisFrame is set before handing the frame out: the debug GL census attributes calls by it
    if (renderStage && liveEntry && current && runtime) {
      st.drewThisFrame = "stage";
      const t0 = h.now();
      const viewport = this.slotViewport(current);
      const resolve = liveEntry.posterSeen ? this.resolveOrigin(current, viewport, scroll) : null;
      liveEntry.posterSeen = false;
      const res = runtime.render({ id: liveEntry.id, time: now / 1000, viewport, resolve });
      st.work.push(h.now() - t0);
      st.last = { ...res, frame: st.frame };
      st.framesRendered++;
      if (!onScreen) st.offscreenDraws += res.calls;
      this.lastRenderAt = now;
      liveEntry.invalidated = false;
      if (!liveEntry.drawnSinceLive) {
        liveEntry.drawnSinceLive = true;
        this.dirty = true; // the poster can go now
      }
    }

    if (this.dirty) this.publish();
    return mode;
  }

  private renderDecision(now: number, e: Entry): { render: boolean; mode: RenderMode } {
    const h = this.host;
    if (now - this.p95At > 500) {
      this.p95Cached = h.frameP95();
      this.intervalP95Cached = h.stats.intervals.count ? h.stats.intervals.percentile(95) : 0;
      this.p95At = now;
    }
    const animating = (h.runtime()?.animating(e.id) ?? false) || e.invalidated || !e.drawnSinceLive;
    if (!animating) return { render: false, mode: "demand" };
    let fps = 0;
    let mode: RenderMode = "full";
    if (now - h.lastActivity() > GOVERNOR.idleAfterMs) {
      fps = GOVERNOR.idleFps;
      mode = "idle";
    } else if (this.highRefreshCapped(now)) {
      fps = GOVERNOR.highRefreshFallbackFps;
      mode = "capped";
    }
    // a frame due within half a frame counts as due (the tick lands on vsync, not on the ms)
    const render = fps === 0 || !e.drawnSinceLive || e.invalidated || now - this.lastRenderAt >= 1000 / fps - 4;
    return { render, mode };
  }

  /** §8.3: the stage drops to 60 on a high-refresh display only when it can't hold the display rate. */
  private highRefreshCapped(now: number): boolean {
    const hz = this.host.store.getState().refreshHz ?? 0;
    if (hz <= GOVERNOR.highRefreshHz) return false;
    if (now < this.cappedUntil) return true;
    const slow = this.host.stats.work.count >= 30 && this.p95Cached > GOVERNOR.highRefreshP95Ms;
    const late = this.intervalP95Cached > (1000 / hz) * GOVERNOR.missedFrameIntervals;
    if (slow && late) this.cappedUntil = now + GOVERNOR.highRefreshHoldMs;
    return slow && late;
  }

  private slotViewport(slot: Slot): RenderJob["viewport"] {
    const { width, canvasHeight } = this.host.viewport();
    if (slot.height >= canvasHeight) return { width, height: canvasHeight, offsetBottom: 0 };
    return { width, height: slot.height, offsetBottom: canvasHeight - slot.height };
  }

  private dock(slot: Slot): void {
    if (this.docked_ === slot.key) return;
    this.docked_ = slot.key;
    this.host.dockSink(slot.el);
  }

  /** A slot went away: if the canvas was docked there, it undocks. */
  forgetSlot(key: number): void {
    if (this.docked_ !== key) return;
    this.docked_ = null;
    this.host.dockSink(null);
  }

  /** The pointer if it's over the slot's drawn region, else its center (0–1 in the slot viewport). */
  private resolveOrigin(slot: Slot, vp: RenderJob["viewport"], scroll: number): { x: number; y: number } {
    const top = Math.max(0, viewTop(slot, scroll));
    const p = this.host.pointer();
    if (p && p.y >= top && p.y <= top + vp.height && vp.width > 0 && vp.height > 0) return { x: p.x / vp.width, y: (p.y - top) / vp.height };
    return { x: 0.5, y: 0.5 };
  }

  private isDrawable(e: Entry): boolean {
    return !this.lost && e.mounted && !e.warming && !e.needsRewarm && (e.state === "WARM" || e.state === "LIVE" || e.state === "COOLING");
  }

  // ── PROJECTION ──────────────────────────────────────────────────────────────────────────

  takeover(id: SceneId, el: HTMLElement | null): (() => void) | null {
    const snap = this.host.store.getState();
    const e = this.entries[id];
    if (!snap.tierFinal || !liveAllowed(snap.tier, id) || this.lost || !this.isDrawable(e)) return null;
    const slot: Slot = { key: this.host.nextKey(), id, el, top: 0, height: this.host.viewport().canvasHeight, pin: null, fixed: true };
    this.takeoverSlot = slot;
    e.invalidated = true;
    this.dirty = true;
    return () => {
      if (this.takeoverSlot !== slot) return;
      this.takeoverSlot = null;
      this.forgetSlot(slot.key);
      this.dirty = true;
    };
  }

  // ── scenes (called by the runtime) ──────────────────────────────────────────────────────

  scene(id: SceneId): { module: SceneModule | null; data: unknown } {
    const e = this.entries[id];
    return { module: e.module, data: e.data };
  }

  sceneMounted(id: SceneId): void {
    const e = this.entries[id];
    if (!e.mounted || !this.host.runtime()) return;
    this.startWarm(e);
  }

  private startWarm(e: Entry): void {
    const runtime = this.host.runtime();
    if (!runtime) return;
    const epoch = e.epoch;
    e.warming = true;
    e.needsRewarm = false;
    this.host.stats.warms[e.id]++;
    runtime.warm(e.id).then(
      (r) => {
        if (e.epoch !== epoch || !e.mounted) return;
        e.warming = false;
        e.warmMs = Math.round(r.ms * 10) / 10;
        e.vramBytes = r.vramBytes;
        this.setState(e, "WARM");
        this.publish();
      },
      (error: unknown) => {
        if (e.epoch !== epoch) return;
        e.error = error instanceof Error ? error.message : String(error);
        console.error(`[stage] warming "${e.id}" failed`, error);
        this.evict(e);
        this.publish();
      },
    );
  }

  invalidate(id?: SceneId): void {
    for (const e of this.all) if (!id || e.id === id) e.invalidated = true;
  }

  /** The tier decided: scenes it can't show go. */
  onTier(tier: Tier, final: boolean): void {
    if (final) for (const e of this.all) if (!liveAllowed(tier, e.id) && e.mounted) this.evict(e);
    this.dirty = true;
  }

  /** The runtime went: everything resident goes with it. */
  detach(): void {
    for (const e of this.all) if (e.mounted) this.evict(e);
    this.publish();
  }

  // ── context loss (§4.2) ─────────────────────────────────────────────────────────────────

  contextLost(): void {
    this.lost = true;
    for (const e of this.all) {
      if (!e.mounted) continue;
      e.epoch++;
      e.warming = false;
      e.needsRewarm = true;
      if (e.state !== "PRIMED") this.setState(e, "PRIMED");
    }
    this.host.store.setState({ contextLost: true });
    this.publish();
  }

  /** The current slot re-warms on the next frame; other resident scenes are released. */
  contextRestored(): void {
    this.lost = false;
    this.host.store.setState({ contextLost: false });
    this.dirty = true;
  }

  // ── residency ───────────────────────────────────────────────────────────────────────────

  private setState(e: Entry, state: SceneState, now = this.host.now()): void {
    if (e.state === state) return;
    if (state === "COOLING") e.coolingSince = now;
    if (state === "LIVE") e.drawnSinceLive = false;
    e.state = state;
    this.dirty = true;
  }

  private reconcile(now: number, desiredLive: SceneId | null, desiredWarm: SceneId[]): void {
    const want = new Set<SceneId>(desiredWarm);
    if (desiredLive) want.add(desiredLive);
    const runtime = this.host.runtime();

    for (const e of this.all) {
      if (e.mounted && e.needsRewarm && !this.lost) {
        // after a context restore: only the current slot is worth re-warming
        if (e.id === desiredLive && runtime && !this.anyWarming()) this.startWarm(e);
        else if (e.id !== desiredLive) this.evict(e);
        continue;
      }
      switch (e.state) {
        case "LIVE":
          if (e.id !== desiredLive) this.setState(e, "COOLING", now);
          break;
        case "WARM":
          if (e.id === desiredLive) this.setState(e, "LIVE", now);
          else if (!want.has(e.id)) this.setState(e, "COOLING", now);
          break;
        case "COOLING":
          if (e.id === desiredLive) this.setState(e, "LIVE", now);
          else if (want.has(e.id)) this.setState(e, "WARM", now);
          else if (now - e.coolingSince >= GOVERNOR.coolingGraceMs) this.evict(e);
          break;
        case "PRIMED":
          if (e.mounted && e.warming && !want.has(e.id)) this.evict(e); // abandoned warm-ahead frees the slot
          else if (!e.mounted && !want.has(e.id)) {
            e.data = null;
            this.setState(e, "COLD", now);
          }
          break;
        case "COLD":
          break;
      }
    }

    if (this.lost) return;
    for (const id of desiredLive ? [desiredLive, ...desiredWarm] : desiredWarm) {
      const e = this.entries[id];
      if (e.state === "COLD" && !e.loading && !e.error) this.load(e);
      if (e.state === "PRIMED" && !e.mounted && runtime && !this.anyWarming() && this.makeRoom(e, desiredLive, want)) this.mount(e);
    }
  }

  private anyWarming(): boolean {
    return this.all.some((e) => e.warming);
  }

  /** Frees a VRAM slot for `e`: COOLING first (oldest), then WARM or warming scenes nobody wants. */
  private makeRoom(e: Entry, desiredLive: SceneId | null, want: Set<SceneId>): boolean {
    const resident = this.all.filter((x) => x.mounted);
    if (resident.length < GOVERNOR.maxResident) return true;
    const evictable = resident
      .filter((x) => x.state !== "LIVE" && x.id !== desiredLive && x !== e)
      .filter((x) => x.state === "COOLING" || !want.has(x.id) || e.id === desiredLive)
      .sort((a, b) => rankForEviction(a) - rankForEviction(b) || a.coolingSince - b.coolingSince);
    const victim = evictable[0];
    if (!victim) return false;
    this.evict(victim);
    return true;
  }

  private load(e: Entry): void {
    const loader = this.host.loaders()?.[e.id];
    if (!loader) return;
    e.loading = true;
    const epoch = e.epoch;
    void (async () => {
      try {
        // a chunk the governor prefetched on idle is already here
        const mod = e.module ?? this.host.modules.get(e.id) ?? (await loader());
        e.module = mod;
        this.host.modules.set(e.id, mod);
        const data = await mod.prime?.();
        if (e.epoch !== epoch || e.state !== "COLD") return;
        e.data = data ?? null;
        this.setState(e, "PRIMED");
      } catch (error) {
        e.error = error instanceof Error ? error.message : String(error);
        console.error(`[stage] loading "${e.id}" failed`, error);
        this.dirty = true;
      } finally {
        e.loading = false;
      }
    })();
  }

  private mount(e: Entry): void {
    e.mounted = true;
    e.warming = true; // until the portal commits and warm() resolves
    this.dirty = true;
  }

  /** Unmounts and disposes (the runtime's portal cleanup frees every GPU resource) → COLD. */
  private evict(e: Entry): void {
    e.epoch++;
    e.mounted = false;
    e.warming = false;
    e.needsRewarm = false;
    e.data = null;
    e.drawnSinceLive = false;
    e.posterSeen = false;
    this.setState(e, "COLD");
  }

  /** Mirrors entries into the store — only on change, never per frame. */
  private publish(): void {
    this.dirty = false;
    const store = this.host.store;
    const prev = store.getState().scenes;
    let changed = false;
    const scenes = { ...prev };
    for (const e of this.all) {
      const next: SceneSnapshot = {
        state: e.state,
        mounted: e.mounted,
        drawable: this.isDrawable(e),
        poster: !(this.isDrawable(e) && (!e.posterSeen || (e.state === "LIVE" && e.drawnSinceLive))),
        warmMs: e.warmMs,
        vramBytes: e.vramBytes,
        error: e.error,
      };
      const p = prev[e.id];
      if (!p || p.state !== next.state || p.mounted !== next.mounted || p.drawable !== next.drawable || p.poster !== next.poster || p.warmMs !== next.warmMs || p.error !== next.error) {
        scenes[e.id] = next;
        changed = true;
      }
    }
    const resident = this.all.filter((e) => e.mounted).map((e) => e.id);
    const residentChanged = resident.join() !== store.getState().resident.join();
    if (changed || residentChanged) store.setState({ scenes, ...(residentChanged ? { resident } : {}) });
  }
}
