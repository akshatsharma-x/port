"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { fx } from "@/lib/fxgl";
import { bootHead, prefetchStageRuntime } from "@/lib/boot";
import { heroTargets } from "@/lib/hero-targets";
import { whenIdle } from "@/lib/idle";
import { yieldToMain } from "@/lib/yield";
import { getLenis } from "@/lib/lenis";
import { governor, type Viewport } from "@/lib/sceneManager";
import { onScrollRefresh } from "@/lib/scroll";
import { useUI } from "@/lib/store";
import { onTick } from "@/lib/ticker";
import { debugTierCap, initialDpr, lowerTier, provisionalTier, readTierEnvironment, TIERS, type Tier, type TierDecision } from "@/lib/tier";
import { sceneLoaders } from "./registry";
import type { RuntimeHandle } from "./StageRuntime";

const INPUT_EVENTS = ["pointermove", "pointerdown", "wheel", "keydown", "touchstart"] as const;
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * The effective preference, read live. useReducedMotion() reports the server snapshot (false) on
 * the hydration pass; deciding a tier from it would create a WebGL context for one commit under
 * reduced motion — exactly what §3.9 forbids.
 */
function prefersReducedMotion(): boolean {
  const override = useUI.getState().motionOverride;
  return override === "system" ? window.matchMedia(REDUCE_QUERY).matches : override === "reduce";
}
const OFF: TierDecision = { tier: "OFF", phone: false, reasons: ["WebGL2 context failed"], probe: false };


/**
 * The stage and #fx-gl (DESIGN.md §4.1), mounted once in the root layout so both survive route
 * changes. Owns the stage's one tick on gsap.ticker (after lenis.raf → the scroll tick),
 * measurement and the tier decision.
 *
 * The one stage canvas is created here, outside React, and moved into the live slot's dock
 * (v1.5 docking: native `position: sticky`, so it scrolls with the page on every input with no
 * per-frame JS). Between slots and across routes it waits in #stage, a hidden parking bay. The
 * three/R3F runtime streams in after idle, and only when the tier allows WebGL: under reduced
 * motion or tier OFF no canvas exists at all, so no context is ever created.
 */
export function Stage() {
  const reduced = useReducedMotion();
  const gfx = useUI((s) => s.gfx);
  const [decision, setDecision] = useState<TierDecision | null>(null);
  const [Overlay, setOverlay] = useState<ComponentType | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const svhRef = useRef<HTMLDivElement>(null);
  const lvhRef = useRef<HTMLDivElement>(null);
  const runtime = useRef<RuntimeHandle | null>(null);
  const probed = useRef<Tier | null>(null);
  const failed = useRef(false);
  const latest = useRef<TierDecision | null>(null);
  const viewport = useRef<Viewport>({ width: 0, height: 0, canvasHeight: 0, svh: 0 });
  const enabled = decision !== null && decision.tier !== "OFF";

  // 1 · loop, docking, measurement, input — once
  useEffect(() => {
    const park = stageRef.current;
    const svh = svhRef.current;
    const lvh = lvhRef.current;
    if (!park || !svh || !lvh) return;
    // ?debug=1: the overlay is its own chunk, fetched only when asked for
    if (new URLSearchParams(window.location.search).get("debug") === "1") {
      void import("./DebugOverlay").then((m) => setOverlay(() => m.default));
    }

    governor.configure({
      loaders: sceneLoaders,
      readScroll: () => getLenis()?.scroll ?? window.scrollY,
      isHidden: () => document.visibilityState === "hidden",
      // a DOM move, only when the live slot changes — never per frame
      dockSink: (slot) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dock = slot?.querySelector<HTMLElement>(":scope > .stage-dock") ?? park;
        if (canvas.parentElement !== dock) dock.appendChild(canvas);
      },
    });

    // layout reads happen here — on resize/refresh — never inside the loop
    const measure = () => {
      const v: Viewport = { width: document.documentElement.clientWidth, height: window.innerHeight, canvasHeight: lvh.offsetHeight, svh: svh.offsetHeight };
      const resized = v.width !== viewport.current.width || v.canvasHeight !== viewport.current.canvasHeight;
      viewport.current = v;
      governor.setViewport(v);
      governor.measure();
      if (resized) runtime.current?.resize(v.width, v.canvasHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    ro.observe(lvh);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    const offRefresh = onScrollRefresh(measure);

    const onInput = (e: Event) => {
      governor.noteActivity();
      if (e instanceof PointerEvent) governor.notePointer(e.clientX, e.clientY);
    };
    for (const type of INPUT_EVENTS) window.addEventListener(type, onInput, { passive: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") governor.invalidate();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // the stage's place in the one RAF: gsap.ticker → lenis.raf → the scroll tick → here
    const offTick = onTick(() => governor.update());
    return () => {
      offTick();
      ro.disconnect();
      window.removeEventListener("resize", measure);
      offRefresh();
      for (const type of INPUT_EVENTS) window.removeEventListener(type, onInput);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // 2 · the tier: hard rules, phone policy, GFX override (§4.2); final now unless the probe runs
  useEffect(() => {
    let d = failed.current ? OFF : provisionalTier(readTierEnvironment(gfx, prefersReducedMotion()));
    const cap = debugTierCap(window.location.search);
    if (cap && d.tier !== "OFF") d = { ...d, tier: lowerTier(d.tier, cap), reasons: [...d.reasons, `debug tier ${cap}`], probe: false };
    latest.current = d;
    setDecision(d);
    // the hero's morph targets start now, off the main thread: during the boot they're one of the
    // things it waits for (DESIGN.md §4.3 A1); the scene's prime() picks them up when it's ready
    if (d.tier !== "OFF" && document.querySelector('[data-stage-slot="system"]')) void heroTargets(TIERS[d.tier].heroParticles);
    const rt = runtime.current;
    if (d.tier !== "OFF" && rt && probed.current) {
      // the runtime exists: no re-probe — the override applies on top of the probe's verdict
      const tier = lowerTier(d.tier, probed.current);
      governor.setTier({ ...d, tier }, true);
      const dpr = initialDpr(tier, window.devicePixelRatio);
      rt.setDpr(dpr);
      governor.setDpr(dpr, window.devicePixelRatio);
    } else governor.setTier(d, d.tier === "OFF" || !d.probe);
  }, [gfx, reduced]);

  // 3 · the stage runtime (lazy chunk), after idle — on a canvas React never owns, so it can move
  useEffect(() => {
    const park = stageRef.current;
    if (!enabled || !park) return;
    const canvas = document.createElement("canvas");
    canvas.className = "stage-canvas";
    canvas.setAttribute("aria-hidden", "true");
    park.appendChild(canvas);
    canvasRef.current = canvas;
    let cancelled = false;
    governor.setRuntimeStatus("pending");
    // During the boot on HIGH/MID the runtime is part of what the boot loads (§7.4): streamed at
    // once with its bytes counted, then imported from the cache. Otherwise — phones (after LCP and
    // idle, §8.3), deep links, later visits — it streams in after idle.
    const booting = bootHead().mode === "run" && latest.current?.probe === true;
    const schedule = (run: () => void) => {
      if (!booting) return whenIdle(run);
      void prefetchStageRuntime().then(() => !cancelled && run());
      return () => undefined;
    };
    const cancelIdle = schedule(() => {
      void (async () => {
        try {
          governor.setRuntimeStatus("loading");
          const { startRuntime } = await import("./StageRuntime");
          // the runtime's start-up is split into tasks (§8.3 TBT): evaluating the 0.7 MB chunk is one,
          // and each step that follows gets its own
          await yieldToMain();
          const d = latest.current;
          if (cancelled || !d || d.tier === "OFF") return;
          const v = viewport.current;
          const handle = await startRuntime(canvas, { width: v.width, height: v.canvasHeight, deviceDpr: window.devicePixelRatio, tier: d.tier, probe: d.probe });
          if (cancelled) {
            handle.destroy();
            return;
          }
          runtime.current = handle;
          probed.current = handle.tier;
          governor.dev.loseContext = handle.loseContext;
          governor.dev.restoreContext = handle.restoreContext;
          const now = latest.current ?? d;
          const tier = lowerTier(now.tier, handle.tier);
          governor.setTier({ ...now, tier, reasons: handle.tier !== d.tier ? [...now.reasons, `probe → ${handle.tier}`] : now.reasons }, true);
          const dpr = initialDpr(tier, window.devicePixelRatio);
          if (tier !== handle.tier) handle.setDpr(dpr);
          governor.setDpr(dpr, window.devicePixelRatio);
          whenIdle(() => governor.prefetch());
        } catch (error) {
          console.error("[stage] runtime failed — posters only", error);
          failed.current = true;
          governor.setRuntimeStatus("failed");
          governor.setTier(OFF, true);
          setDecision(OFF);
        }
      })();
    });
    return () => {
      cancelled = true;
      cancelIdle();
      runtime.current?.destroy();
      runtime.current = null;
      probed.current = null;
      canvas.remove();
      canvasRef.current = null;
      delete governor.dev.loseContext;
      delete governor.dev.restoreContext;
    };
  }, [enabled]);

  // 4 · #fx-gl: context #2, alive whenever the tier allows WebGL
  useEffect(() => {
    const canvas = fxRef.current;
    if (!enabled || !canvas) return;
    fx.attach(canvas);
    const onResize = () => fx.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      fx.detach();
    };
  }, [enabled]);

  return (
    <>
      <div ref={stageRef} id="stage" aria-hidden="true" />
      {/* PROJECTION (§7.4 WORK): the stage holds the viewport over the page, under the HUD */}
      {enabled && (
        <div id="stage-takeover" className="stage-takeover" aria-hidden="true" hidden>
          <div className="stage-dock" />
        </div>
      )}
      <div ref={svhRef} className="stage-probe stage-probe--svh" aria-hidden="true" />
      <div ref={lvhRef} className="stage-probe stage-probe--lvh" aria-hidden="true" />
      {enabled && <canvas ref={fxRef} id="fx-gl" aria-hidden="true" />}
      {Overlay && <Overlay />}
    </>
  );
}
