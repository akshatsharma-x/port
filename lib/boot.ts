import { createStore } from "zustand/vanilla";

/**
 * The boot (DESIGN.md §7.4 POST) — a real preloader. Work registers itself as tasks (fonts, the
 * stage runtime, the data; Part 6 adds the hero's worker and textures); each task may carry real
 * bytes, and resolves to the log line that proves it. The percentage is bytes loaded over bytes
 * declared; P3 (POWER ON) comes when every task has resolved, or at the boot's clock limit.
 *
 * The decision to boot is made before first paint by the head script (lib/theme-script.ts):
 * html[data-boot] = "run" (the first visit to / in a session) or "fast" (POWER ON-fast over
 * painted content). Its origin — window.__boot.t0 — is the boot's time zero.
 */
export type BootMode = "run" | "fast";
export type BootPhase = "p1" | "p2" | "p3" | "done";

export interface BootLine {
  key: string;
  /** the column on the left: CPU, GPU, DISP… */
  tag: string;
  text: string;
  /** the column on the right: OK, 3/3, [S]… */
  status: string;
}

export interface BootSnapshot {
  phase: BootPhase;
  lines: BootLine[];
  bytes: { loaded: number; total: number };
  tasks: { done: number; total: number };
  /** performance.now() of the frame the POWER ON beam opened: the hero's name rises from it */
  beamOpenAt: number | null;
  skipped: boolean;
}

export const bootStore = createStore<BootSnapshot>(() => ({ phase: "p1", lines: [], bytes: { loaded: 0, total: 0 }, tasks: { done: 0, total: 0 }, beamOpenAt: null, skipped: false }));

interface BootHead {
  mode: BootMode;
  t0: number;
  /** performance.now() of a skip pressed before the controller took over, else 0 */
  skip: number;
  /** removes the head script's early skip listeners */
  off?: () => void;
  /** performance.now() of each phase as it happened — the gate (scripts/boot-gate.mjs) reads these */
  marks?: Partial<Record<"controlled" | "p2" | "p3" | "open" | "done", number>> & { variant?: "full" | "fast" | "css" | "cut" };
  /** the boot's time zero: its first paint (see bootOrigin) */
  origin?: number;
}

/** What the head script decided (and when the boot's clock started). */
export function bootHead(): BootHead {
  const w = typeof window === "undefined" ? null : (window as Window & { __boot?: BootHead });
  return w?.__boot ?? { mode: "fast", t0: 0, skip: 0 };
}

/**
 * The boot's time zero: its first paint — when the visitor first sees it, and when the CSS cap's
 * clock starts (an animation's delay counts from its first style). The head script runs earlier
 * (before the render-blocking CSS has arrived), so its t0 is only the fallback.
 */
export function bootOrigin(): number {
  const h = bootHead();
  if (h.origin !== undefined) return h.origin;
  const paint = performance.getEntriesByType("paint").find((e) => e.name === "first-paint");
  if (paint) h.origin = Math.max(h.t0, paint.startTime);
  return h.origin ?? h.t0;
}

/** ms since the boot's first paint. */
export const bootClock = (): number => performance.now() - bootOrigin();

/**
 * ms since the boot's first paint, on the current frame's clock (document.timeline — the
 * timestamp a rAF callback is handed). What a tick changes is presented with its frame, so
 * spacing measured on this clock is the spacing on screen: GSAP's ticker time is Date.now()
 * when the tick happens to run, which drifts within the frame.
 */
export function bootFrameClock(): number {
  const t = document.timeline?.currentTime;
  return (typeof t === "number" ? t : performance.now()) - bootOrigin();
}

// ── the task registry ──────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  total: number;
  loaded: number;
  done: boolean;
  result: Promise<BootLine | null>;
}

const tasks = new Map<string, Task>();
const listeners = new Set<(id: string, line: BootLine | null) => void>();
/** every settled task's line, in order — replayed to late listeners, so no line is ever lost */
const settled: { id: string; line: BootLine | null }[] = [];

function publish(): void {
  let loaded = 0;
  let total = 0;
  let done = 0;
  for (const t of tasks.values()) {
    total += t.total;
    loaded += Math.min(t.total, t.loaded);
    if (t.done) done++;
  }
  bootStore.setState({ bytes: { loaded, total }, tasks: { done, total: tasks.size } });
}

export interface BootTaskHandle {
  /** real bytes received so far (≤ the declared total) */
  progress(loaded: number): void;
  /** the declared size, once known (a manifest that arrives after the task registered) */
  setTotal(bytes: number): void;
}

/**
 * Registers a task the boot waits for. `bytes` is its declared size (0 when it has none to count);
 * `run` resolves to the line it prints (or null for none). A task that throws prints nothing and
 * still counts as settled — the boot never hangs on a failure.
 */
export function registerBootTask(id: string, run: Promise<BootLine | null>, bytes = 0): BootTaskHandle {
  const task: Task = { id, total: bytes, loaded: 0, done: false, result: run };
  tasks.set(id, task);
  publish();
  const settle = (line: BootLine | null) => {
    task.done = true;
    task.loaded = task.total;
    publish();
    settled.push({ id, line });
    for (const l of listeners) l(id, line);
  };
  run.then(settle, () => settle(null));
  return {
    progress(loaded: number) {
      if (task.done) return;
      task.loaded = Math.max(task.loaded, Math.min(task.total, loaded));
      publish();
    },
    setTotal(bytes: number) {
      if (task.done) return;
      task.total = bytes;
      publish();
    },
  };
}

/** Each settled task, in the order they settle — the ones already settled first. */
export function onBootTask(cb: (id: string, line: BootLine | null) => void): () => void {
  for (const s of settled) cb(s.id, s.line);
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const allBootTasksDone = (): boolean => [...tasks.values()].every((t) => t.done);

// ── formatting (pure; tests/boot.test.ts) ────────────────────────────────────────────────

/** The load as a fraction: bytes when any task declared bytes, else tasks done. */
export function bootFraction(s: Pick<BootSnapshot, "bytes" | "tasks">): number {
  if (s.bytes.total > 0) return Math.min(1, s.bytes.loaded / s.bytes.total);
  return s.tasks.total > 0 ? s.tasks.done / s.tasks.total : 0;
}

/** Decimal megabytes, two places: 1 MB = 1,000,000 bytes (what scripts/weight.mjs counts). */
export const megabytes = (bytes: number): string => (bytes / 1_000_000).toFixed(2);

/** A ▕██████░░░░▏ meter of `cells` cells. */
export function meter(fraction: number, cells = 20): string {
  const on = Math.round(Math.min(1, Math.max(0, fraction)) * cells);
  return `▕${"█".repeat(on)}${"░".repeat(cells - on)}▏`;
}

/**
 * A WebGL renderer string, as the boot prints it — or null when the browser masked it. ANGLE
 * wraps the real name ("ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, …)"); Safari and
 * Firefox may hand back a bucket ("Apple GPU", "Mozilla") that names nothing.
 */
export function cleanRenderer(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const angle = /^ANGLE \((.*)\)$/i.exec(s);
  if (angle?.[1]) {
    const parts = angle[1].split(",").map((p) => p.trim());
    s = parts[1] ?? parts[0] ?? s;
    s = s.replace(/^ANGLE [\w ]*Renderer:\s*/i, "");
    s = s.replace(/\s+(Direct3D\S*|vs_\S+|ps_\S+|\(0x[0-9a-f]+\)|OpenGL.*|D3D\S*)/gi, "").trim();
  }
  if (!s || /^(webkit webgl|mozilla|apple gpu|generic renderer)$/i.test(s)) return null;
  return s;
}

// ── the stage runtime, streamed ───────────────────────────────────────────────────────────

/** public/boot-manifest.json — written after every production build (scripts/boot-manifest.mjs). */
export interface BootManifest {
  version: 2;
  /** the stage runtime's chunks (StageRuntime + three/R3F), decoded bytes */
  runtime: { url: string; bytes: number }[];
  /** every file under /data/ (the scenes' data), decoded bytes — served compressed, with no length */
  data: { url: string; bytes: number }[];
}

export const BOOT_MANIFEST_URL = "/boot-manifest.json";

let manifestLoad: Promise<BootManifest | null> | null = null;

/** The manifest, fetched once; null in next dev (no postbuild), offline, or from another build. */
export function bootManifest(): Promise<BootManifest | null> {
  manifestLoad ??= (async () => {
    if (process.env.NODE_ENV !== "production") return null;
    try {
      const res = await fetch(BOOT_MANIFEST_URL, { cache: "no-cache" });
      const m = res.ok ? ((await res.json()) as { version?: number }) : null;
      return m?.version === 2 ? (m as BootManifest) : null;
    } catch {
      return null; // offline or blocked: nothing is counted from it
    }
  })();
  return manifestLoad;
}

let runtimePrefetch: Promise<void> | null = null;

/**
 * Streams the stage runtime's chunks once, counting real bytes as they arrive (the boot's
 * "runtime" task), so the dynamic import that follows is served from the HTTP cache. Without a
 * manifest (next dev, or a build that skipped postbuild) it resolves at once and the import
 * fetches as usual — the boot then counts only the bytes it can see.
 */
export function prefetchStageRuntime(): Promise<void> {
  runtimePrefetch ??= (async () => {
    // registered before anything is awaited: the boot can't reach 100% without it
    let settle: () => void = () => undefined;
    const task = registerBootTask("runtime", new Promise<BootLine | null>((resolve) => (settle = () => resolve(null))));
    const chunks = (await bootManifest())?.runtime ?? [];
    task.setTotal(chunks.reduce((n, c) => n + c.bytes, 0));
    let loaded = 0;
    await Promise.all(
      chunks.map(async (c) => {
        const res = await fetch(c.url);
        const reader = res.body?.getReader();
        if (!reader) {
          loaded += (await res.arrayBuffer()).byteLength;
          task.progress(loaded);
          return;
        }
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded += value.byteLength;
          task.progress(loaded);
        }
      }),
    ).catch(() => undefined);
    settle();
  })();
  return runtimePrefetch;
}
