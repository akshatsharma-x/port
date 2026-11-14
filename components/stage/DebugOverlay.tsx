"use client";

import { useArchive } from "@/lib/archive";
import { projection } from "@/lib/projection";
import { useWork } from "@/lib/work";
import { useEffect, useRef } from "react";
import { stageDev } from "@/content/dev-stage";
import { fx } from "@/lib/fxgl";
import { contextCensus, glContext } from "@/lib/gl";
import { HUD_HZ, onHud, setText } from "@/lib/hud";
import { getLenis } from "@/lib/lenis";
import { bootStore } from "@/lib/boot";
import { cueLog } from "@/lib/cues";
import { readRafFunnel } from "@/lib/raf-funnel";
import { governor, GOVERNOR } from "@/lib/sceneManager";
import { pinProgress, scrollGeometry, scrollSignal, scrollStore } from "@/lib/scroll";
import { powerOff, powerOn, switchTheme } from "@/lib/signatures";
import { loadAudio } from "@/lib/sound";
import { SCENE_IDS } from "@/lib/tier";

/**
 * The dev overlay (?debug=1) — DESIGN.md §4.2's invariants, measured live. Text updates at 10 Hz
 * and FPS at 2 Hz through lib/hud (no React render per frame).
 *
 * It also installs the GL census: every WebGL2 draw and clear call, from any context, attributed to
 * the funnel's frame number. "Never two contexts drawing in one frame" and "offscreen ⇒ 0 draw
 * calls" are counted from actual GL calls, not from the governor's own bookkeeping.
 */
const DRAWS = ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "drawRangeElements"] as const;
const CLEARS = ["clear", "clearBufferfv", "clearBufferiv", "clearBufferuiv", "clearBufferfi", "blitFramebuffer"] as const;

export interface GlCensus {
  /** frames in which more than one context issued a draw or clear */
  multiContextFrames: number;
  framesWithStage: number;
  framesWithFx: number;
  /** stage draw calls while no LIVE slot was on screen (boot probe excluded) */
  offscreenStageDraws: number;
  /** stage draw calls in total */
  stageDraws: number;
  fxCalls: number;
  uninstall(): void;
}

function installGlCensus(): GlCensus {
  const proto = WebGL2RenderingContext.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  const originals = new Map<string, (...args: unknown[]) => unknown>();
  let frame = -1;
  const drew = new Set<unknown>();
  const census: GlCensus = { multiContextFrames: 0, framesWithStage: 0, framesWithFx: 0, offscreenStageDraws: 0, stageDraws: 0, fxCalls: 0, uninstall: () => undefined };
  const close = () => {
    if (drew.size > 1) census.multiContextFrames++;
    if (drew.has(glContext("stage"))) census.framesWithStage++;
    if (drew.has(glContext("fx-gl"))) census.framesWithFx++;
    drew.clear();
  };
  const record = (ctx: unknown, isDraw: boolean) => {
    const f = readRafFunnel()?.frames ?? 0;
    if (f !== frame) {
      close();
      frame = f;
    }
    drew.add(ctx);
    const stage = glContext("stage");
    if (ctx === stage && isDraw) {
      census.stageDraws++;
      if (!governor.stats.visible && governor.stats.drewThisFrame !== "boot") census.offscreenStageDraws++;
    }
    if (ctx === glContext("fx-gl")) census.fxCalls++;
  };
  for (const name of [...DRAWS, ...CLEARS]) {
    const orig = proto[name];
    if (typeof orig !== "function") continue;
    originals.set(name, orig);
    const isDraw = (DRAWS as readonly string[]).includes(name);
    proto[name] = function (this: unknown, ...args: unknown[]) {
      record(this, isDraw);
      return orig.apply(this, args);
    };
  }
  census.uninstall = () => {
    for (const [name, orig] of originals) proto[name] = orig;
  };
  return census;
}

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
const ms = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "—");
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export default function DebugOverlay() {
  const textRef = useRef<HTMLPreElement>(null);
  const fpsRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const census = installGlCensus();
    const L = stageDev.overlay;
    let maxContexts = 0;

    const offText = onHud(HUD_HZ.text, () => {
      const s = governor.snapshot;
      const st = governor.stats;
      const ctx = contextCensus();
      maxContexts = Math.max(maxContexts, ctx.seenAlive ?? ctx.aliveCount);
      const mem = governor.dev.runtimeMemory?.() ?? { geometries: 0, textures: 0, programs: 0 };
      const sceneVram = SCENE_IDS.reduce((sum, id) => sum + (s.scenes[id].mounted ? s.scenes[id].vramBytes : 0), 0);
      const fb = governor.dev.framebufferBytes?.() ?? 0;
      const funnel = readRafFunnel();
      const probe = s.probes.map((p) => `${p.tier} p90 ${ms(p.p90Ms)} ms (${p.method}, ${p.frames} f)`).join(" → ") || "—";
      const passed = st.maxLive <= GOVERNOR.maxLive && st.maxResident <= GOVERNOR.maxResident && maxContexts <= 2 && census.multiContextFrames === 0 && census.offscreenStageDraws === 0;
      const lines = [
        `${L.title}  ${passed ? L.pass : L.fail}`,
        `${L.tier.padEnd(10)}${s.tier ?? "—"}${s.tierFinal ? "" : " (provisional)"} · probe ${probe}${s.tierReasons.length ? ` · ${s.tierReasons.join(", ")}` : ""}`,
        `${L.display.padEnd(10)}refresh ${s.refreshHz ?? "…"} Hz · DPR ${s.dpr} (device ${s.deviceDpr})`,
        `${L.stage.padEnd(10)}mode ${s.mode} · runtime ${s.runtime}${s.contextLost ? " · CONTEXT LOST" : ""} · docked ${st.docked ?? "—"} · cpu p50 ${ms(st.work.percentile(50))} p95 ${ms(st.work.percentile(95))} · gpu p50 ${ms(st.gpu.percentile(50))} p95 ${ms(st.gpu.percentile(95))} ms`,
        `${L.render.padEnd(10)}calls ${st.last.calls} · tris ${k(st.last.triangles)} · points ${k(st.last.points)} · frames drawn ${st.framesRendered} · frozen ${st.framesFrozen} · fx ${fx.frames}`,
        `${L.memory.padEnd(10)}geometries ${mem.geometries} · textures ${mem.textures} · programs ${mem.programs} · ${s.contextLost ? "VRAM released (context lost)" : `VRAM ≈ ${mb(sceneVram + fb)} (scenes ${mb(sceneVram)} + framebuffer ${mb(fb)})`}`,
        `${L.contexts.padEnd(10)}alive ${ctx.aliveCount} (${ctx.alive.map((a) => `${a.name}${a.lost ? " lost" : ""}`).join(", ") || "none"}) · seen ${ctx.seen ?? "—"} · max ${maxContexts}`,
        `${L.scenes.padEnd(10)}${SCENE_IDS.map((id) => {
          const x = s.scenes[id];
          return `${id} ${x.state}${x.mounted ? "*" : ""}${x.warmMs !== null ? ` ${x.warmMs}ms` : ""}`;
        }).join(" · ")}`,
        `${L.checks.padEnd(10)}max live ${st.maxLive}/1 · max resident ${st.maxResident}/2 · max contexts ${maxContexts}/2 · two-context frames ${census.multiContextFrames} · offscreen draws ${census.offscreenStageDraws}`,
        `${L.raf.padEnd(10)}native ${funnel ? (funnel.native / Math.max(1, funnel.frames)).toFixed(2) : "—"}/frame · funnelled ${funnel?.last ?? "—"} callbacks this frame`,
        `${L.interlock.padEnd(10)}${s.interlock.length ? s.interlock.map((g) => `${g.from}→${g.to} ${g.gapSvh} svh`).join(", ") : L.ok}`,
      ];
      setText(textRef.current, lines.join("\n"));
    });

    const offFps = onHud(HUD_HZ.fps, () => {
      const iv = governor.stats.intervals;
      const recent = iv.values().slice(-60);
      const mean = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      setText(fpsRef.current, `${L.frame.padEnd(10)}FPS ${mean ? Math.round(1000 / mean) : "—"} · p50 ${ms(iv.percentile(50))} ms · p95 ${ms(iv.percentile(95))} ms`);
    });

    // the gate test (scripts/stage-gate.mjs) drives the stage through this
    const w = window as Window & { __retrograde?: unknown };
    w.__retrograde = {
      governor,
      fx,
      census,
      contexts: contextCensus,
      lenis: getLenis,
      funnel: readRafFunnel,
      // Part 4: the scroll layer and the transition grammar, for scripts/scroll-gate.mjs
      scroll: { store: scrollStore, signal: scrollSignal, pinProgress, geometry: scrollGeometry },
      cues: cueLog,
      transitions: { switchTheme, powerOff, powerOn },
      // Part 5: the boot's store and the (lazy) sound engine, for scripts/boot-gate.mjs
      boot: bootStore,
      audio: loadAudio,
      // Part 8: ARCHIVE's shared state (layout, keyword, open record), for scripts/archive-gate.mjs
      archive: useArchive,
      // Part 9: WORK's shared state and the PROJECTION's state and steps, for scripts/work-gate.mjs
      work: useWork,
      projection,
    };
    return () => {
      offText();
      offFps();
      census.uninstall();
      delete w.__retrograde;
    };
  }, []);

  return (
    <div className="stage-debug" aria-hidden="true">
      <p ref={fpsRef} className="stage-debug__fps" />
      <pre ref={textRef} className="stage-debug__text" />
    </div>
  );
}
