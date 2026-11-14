"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { allBootTasksDone, bootClock, bootFraction, bootFrameClock, bootHead, bootStore, cleanRenderer, megabytes, meter, onBootTask, registerBootTask, type BootLine } from "@/lib/boot";
import { cue } from "@/lib/cues";
import { fx } from "@/lib/fxgl";
import { HUD_HZ, onHud, setText } from "@/lib/hud";
import { artifact, boot, signature } from "@/lib/motion";
import { governor } from "@/lib/sceneManager";
import { loadTransitions, powerOn, transitionsLoaded } from "@/lib/signatures";
import { audioMayStart, loadAudio } from "@/lib/sound";
import { useUI } from "@/lib/store";
import { onTick } from "@/lib/ticker";
import { TIERS } from "@/lib/tier";

/** the boot log's counts: 250,000 (grouped, like the rest of the site's numbers) */
const COUNT = new Intl.NumberFormat("en-US");

export interface BootFont {
  family: string;
  /** the CSS variable next/font binds the family to (--ff-display, --ff-body, --ff-mono) */
  cssVar: string;
  bytes: number;
}

export interface BootCopy {
  /** RETROGRADE/OS 1.0 · BUILD 2026-11-11 */
  head: string;
  /** NAME — ROLE: the one line that types */
  banner: string;
  labels: {
    cpu: string;
    cores: string;
    gpu: string;
    masked: string;
    notQueried: string;
    unknown: string;
    display: string;
    measured: string;
    hz: string;
    gfx: string;
    tier: string;
    probe: string;
    particles: string;
    font: string;
    data: string;
    papers: string;
    projects: string;
    credentials: string;
    a11y: string;
    reducedMotion: string;
    contrast: string;
    standard: string;
    more: string;
    on: string;
    off: string;
    sound: string;
    muted: string;
    soundKey: string;
    ok: string;
    loading: string;
    skip: string;
    skipLabel: string;
  };
  counts: { papers: number; projects: number; credentials: number };
  fonts: BootFont[];
}

/** POWER ON-fast's picture is fully open this long after it starts: later than this before the cap, the boot just cuts. */
const ON_FAST_OPEN_MS = signature.power.onOpenMs * (signature.power.onFastMs / signature.power.onMs);
const ON_FAST_STRETCH_MS = signature.power.onStretchMs * (signature.power.onFastMs / signature.power.onMs);
/** the banner's caret rides as its last character (mono, §2.10) */
const CARET = "█";

/** A resolved promise of a line; `when` waits for something real first. */
function lineTask(id: string, make: () => BootLine | null, when: Promise<unknown> = Promise.resolve(), bytes = 0) {
  return registerBootTask(id, when.then(make), bytes);
}

/** Resolves once `test` passes on a frame (checked on the one RAF), or with null after `ms`. */
function frameWait<T>(test: () => T | null, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const off = onTick(() => {
      const v = test();
      if (v !== null || performance.now() - t0 > ms) {
        off();
        resolve(v);
      }
    });
  });
}

interface BootView {
  root: HTMLDivElement;
  log: HTMLOListElement | null;
  banner: HTMLParagraphElement | null;
  progress: HTMLParagraphElement | null;
  setPhase: (phase: "p1" | "p2" | "p3") => void;
}

/** One log row, written straight into the DOM in the tick that prints it: on-screen spacing = print spacing. */
function appendRow(log: HTMLOListElement | null, line: BootLine): void {
  if (!log) return;
  const li = document.createElement("li");
  li.className = "boot__row";
  for (const [cls, text] of [["boot__tag", line.tag], ["boot__text", line.text], ["boot__leader", ""], ["boot__status", line.status]] as const) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    li.append(span);
  }
  log.append(li);
}

interface BootRunner {
  attach(view: BootView): void;
  detach(): void;
  skip(): void;
}

/** One boot per page load — React (StrictMode's double mount included) only attaches its view. */
let runner: BootRunner | null = null;

function startBoot({ banner, labels: L, counts, fonts }: BootCopy): BootRunner | null {
  const h = bootHead();
  const html = document.documentElement;
  if (h.mode !== "run") return null;
  const clock = bootClock;
  const marks: NonNullable<typeof h.marks> = (h.marks = {});
  const mark = (k: keyof typeof marks | "controlled" | "p2" | "p3" | "open" | "done") => {
    (marks as Record<string, number>)[k] = performance.now();
  };
  let view: BootView | null = null;
  const flags = { controlled: false, gone: false };
  const setFlag = (flag: "controlled" | "gone") => {
    flags[flag] = true;
    if (view) view.root.dataset[flag] = "";
  };
  const finish = (how: "done" | "skipped") => {
    mark("done");
    bootStore.setState({ phase: "done" });
    useUI.getState().setBoot(how);
  };
  const idle: BootRunner = {
    attach(v) {
      view = v;
      if (flags.gone) v.root.dataset.gone = "";
    },
    detach() {
      view = null;
    },
    skip() {},
  };
  // skipped before any script ran (the head script's listener), or too late to open a beam in
  // time: the CSS already did — or is about to do — the reveal
  if (h.skip || clock() > boot.capMs - ON_FAST_OPEN_MS) {
    h.off?.();
    flags.gone = true;
    finish(h.skip ? "skipped" : "done");
    return idle;
  }
  // the exit is ours now — the CSS cap stays armed behind us: should the main thread stall past
  // 2.2 s (a slow phone hydrating, the runtime compiling), the compositor still shows the hero
  flags.controlled = true;
  mark("controlled");
  h.off?.();
  useUI.getState().setBoot("running");
  void loadTransitions(); // POWER ON's grammar, now — not on idle
  // P1: the hum fades in — only if the sound preference is already ON (and the browser lets the
  // context run before a gesture; otherwise the first gesture starts it)
  if (useUI.getState().sound && audioMayStart()) void loadAudio().then((m) => m.getEngine() && cue("BOOT", { variant: "hum" }));

  // ── the tasks: each resolves to the line that proves it ──
  const reduced = html.dataset.motion === "reduce";
  lineTask("cpu", () => (navigator.hardwareConcurrency ? { key: "cpu", tag: L.cpu, text: `${navigator.hardwareConcurrency} ${L.cores}`, status: L.ok } : null));
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  lineTask("data", () => ({ key: "data", tag: L.data, text: `${counts.papers} ${L.papers} · ${counts.projects} ${L.projects} · ${counts.credentials} ${L.credentials}`, status: L.ok }), Promise.resolve(), nav?.decodedBodySize ?? 0);
  lineTask("a11y", () => ({ key: "a11y", tag: L.a11y, text: `${L.reducedMotion} ${reduced ? L.on : L.off} · ${L.contrast} ${matchMedia("(prefers-contrast: more)").matches ? L.more : L.standard}`, status: L.ok }));
  lineTask("sound", () => ({ key: "sound", tag: L.sound, text: useUI.getState().sound ? L.on : L.muted, status: L.soundKey }));

  // fonts: real bytes (the baked files' sizes) as each face finishes
  const styles = getComputedStyle(html);
  const faces = fonts.map((f) => {
    const family = styles.getPropertyValue(f.cssVar).split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
    return { ...f, face: [...document.fonts].find((ff) => ff.family.replace(/^['"]|['"]$/g, "") === family) ?? null };
  });
  let fontLoaded = 0;
  const fontsReady = Promise.all(faces.map((f) => (f.face ? f.face.loaded : Promise.resolve()).then(() => fontTask.progress((fontLoaded += f.bytes)), () => undefined)));
  const fontTask = lineTask(
    "fonts",
    () => ({ key: "fonts", tag: L.font, text: fonts.map((f) => f.family).join(" · "), status: `${faces.filter((f) => f.face?.status === "loaded").length}/${fonts.length}` }),
    fontsReady,
    fonts.reduce((sum, f) => sum + f.bytes, 0),
  );

  // the display, once the governor has measured the refresh rate (median of 60 frames)
  lineTask(
    "display",
    () => {
      const hz = governor.store.getState().refreshHz;
      return hz ? { key: "display", tag: L.display, text: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio.toFixed(2)}× · ${hz} ${L.hz} ${L.measured}`, status: L.ok } : null;
    },
    frameWait(() => governor.store.getState().refreshHz, boot.capMs),
  );

  // the GPU, from #fx-gl's context — never a context of our own (under reduced motion: none at all)
  lineTask(
    "gpu",
    () => {
      if (reduced) return { key: "gpu", tag: L.gpu, text: L.notQueried, status: L.ok };
      if (governor.store.getState().tier === "OFF") return { key: "gpu", tag: L.gpu, text: L.unknown, status: L.ok };
      return { key: "gpu", tag: L.gpu, text: `${cleanRenderer(fx.renderer()) ?? L.masked} · WEBGL2`, status: L.ok };
    },
    reduced ? Promise.resolve() : frameWait(() => (fx.ready || governor.store.getState().tier === "OFF" ? true : null), boot.capMs),
  );

  // the tier, once it's final (after the probe on HIGH/MID), and the particles the hero draws at it
  lineTask(
    "gfx",
    () => {
      const s = governor.store.getState();
      if (!s.tierFinal || !s.tier) return null;
      const n = TIERS[s.tier].heroParticles;
      return { key: "gfx", tag: L.gfx, text: `${L.tier} ${s.tier}${n > 0 ? ` · ${COUNT.format(n)} ${L.particles}` : ""}`, status: L.ok };
    },
    frameWait(() => (governor.store.getState().tierFinal ? true : null), boot.capMs),
  );

  // ── P2 printing, P3 power-up ──
  const pending: BootLine[] = [];
  const printed: BootLine[] = [];
  const offTasks = onBootTask((_, line) => {
    if (line) pending.push(line);
  });
  let lastPrint = Number.NEGATIVE_INFINITY;
  let p2At = 0;
  let state: "p1" | "p2" | "p3" = "p1";
  let skipped = false;
  const chars = [...banner];

  const writeProgress = () => {
    const s = bootStore.getState();
    const f = bootFraction(s);
    setText(view?.progress, `${L.loading} ${meter(f)} ${String(Math.floor(f * 100)).padStart(3, " ")}%  ${megabytes(s.bytes.loaded)} / ${megabytes(s.bytes.total)} MB`);
  };
  const offHud = onHud(HUD_HZ.text, writeProgress);
  const setState = (next: "p1" | "p2" | "p3") => {
    state = next;
    view?.setPhase(next);
    bootStore.setState({ phase: next });
  };

  const markOpen = () => {
    mark("open");
    bootStore.setState({ beamOpenAt: performance.now() });
  };
  const powerUp = (fast: boolean) => {
    if (state === "p3") return;
    mark("p3");
    bootStore.setState({ skipped });
    setState("p3");
    writeProgress();
    stop();
    cue("BOOT", { variant: "hum-off" });
    setFlag("gone"); // the log leaves in one frame: dark glass until the beam
    const remaining = boot.capMs - clock();
    if (remaining <= ON_FAST_STRETCH_MS) {
      // too late for a beam to open by the cap (the main thread stalled): the CSS cap has shown the
      // hero — or is about to — and shutters would cover it again. A cut; the name stays settled.
      marks.variant = "cut";
      finish(skipped ? "skipped" : "done");
      return;
    }
    if (!transitionsLoaded() || remaining < ON_FAST_OPEN_MS) {
      // the grammar hasn't landed (a slow network): the CSS ON-fast shutters, no script needed
      marks.variant = "css";
      html.dataset.bootFallback = "";
      window.setTimeout(markOpen, ON_FAST_STRETCH_MS);
      window.setTimeout(() => finish(skipped ? "skipped" : "done"), signature.power.onFastMs);
      return;
    }
    html.dataset.tube = "off";
    const quick = fast || remaining < signature.power.onMs;
    marks.variant = quick ? "fast" : "full";
    void powerOn({ fast: quick, onOpen: markOpen }).then(() => finish(skipped ? "skipped" : "done"));
  };

  // the tick runs on the frame clock: a line printed here is on screen with this frame, so
  // "≥ 40 ms apart" holds for what the visitor sees, not only for when the code ran
  const offTick = onTick(() => {
    const t = bootFrameClock();
    if (state === "p1" && t >= boot.p1Ms) {
      p2At = t;
      mark("p2");
      setState("p2");
    }
    if (state !== "p2") return;
    // the banner types (the only line that does); the caret is its last character, so typing
    // never moves an element (no layout shift)
    const typed = Math.min(chars.length, Math.floor(((t - p2At) / 1000) * artifact.typewriterCps));
    setText(view?.banner, `${chars.slice(0, typed).join("")}${CARET}`);
    if (pending.length > 0 && t - lastPrint >= boot.lineGapMs) {
      const line = pending.shift();
      lastPrint = t;
      if (line) {
        printed.push(line);
        appendRow(view?.log ?? null, line);
        cue("BOOT", { variant: "tick" });
      }
    }
    if ((allBootTasksDone() && pending.length === 0 && t - lastPrint >= boot.lineGapMs) || t >= boot.powerAtMs) powerUp(false);
  });

  const skip = () => {
    skipped = true;
    powerUp(true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") skip();
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("pointerdown", skip, true);
  function stop() {
    offTick();
    offHud();
    offTasks();
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("pointerdown", skip, true);
  }

  return {
    attach(v) {
      view = v;
      if (flags.controlled) v.root.dataset.controlled = "";
      if (flags.gone) v.root.dataset.gone = "";
      if (v.log && v.log.childElementCount === 0) for (const line of printed) appendRow(v.log, line);
      v.setPhase(state);
    },
    detach() {
      view = null;
    },
    skip,
  };
}

/**
 * The boot (DESIGN.md §7.4 POST): P1 a caret on black; P2 log lines printed whole as their real
 * tasks resolve, at least 40 ms apart, while the owner banner types at 45 cps; P3 POWER ON at
 * 100% or 1.6 s. Esc, a click or a tap skips (ON-fast). The overlay is server-rendered; the head
 * script shows it only on the first visit to / in a session, and a CSS failsafe takes it down at
 * 2.2 s even if this never runs. Deep links get the CSS POWER ON-fast shutters instead.
 */
export function BootSequence(copy: BootCopy) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLParagraphElement>(null);
  const progressRef = useRef<HTMLParagraphElement>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const copyRef = useRef(copy);
  const [phase, setPhase] = useState<"p1" | "p2" | "p3">("p1");
  const { head, labels: L } = copy;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    runner ??= startBoot(copyRef.current);
    runner?.attach({ root, log: logRef.current, banner: bannerRef.current, progress: progressRef.current, setPhase });
    return () => runner?.detach();
  }, []);

  return (
    <>
      <div ref={rootRef} className="boot t-micro" data-phase={phase} style={{ "--caret-ms": `${artifact.caretBlinkMs}ms`, "--boot-flicker": `${boot.flickerMs}ms` } as CSSProperties}>
        <div className="boot__screen" aria-hidden="true">
          <p className="boot__head">{head}</p>
          {/* rows are appended by the runner (appendRow), never by React */}
          <ol ref={logRef} className="boot__log" />
          <p ref={progressRef} className="boot__progress" />
          <p ref={bannerRef} className="boot__banner" />
        </div>
        {/* P1: the caret alone, blinking 530/530, where the first line will print */}
        <span className="boot__caret" aria-hidden="true" />
        <button type="button" className="boot__skip" aria-label={L.skipLabel} onClick={() => runner?.skip()}>
          {L.skip}
        </button>
      </div>
      <div className="boot-shutter" aria-hidden="true">
        <i className="boot-shutter__top" />
        <i className="boot-shutter__bottom" />
        <i className="boot-shutter__beam" />
      </div>
    </>
  );
}
