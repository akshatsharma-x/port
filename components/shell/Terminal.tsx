"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { SearchIndex } from "@/content/search-index";
import { cue } from "@/lib/cues";
import { artifact } from "@/lib/motion";
import { jumpToHash, navigate } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import { complete, execute } from "@/lib/shell/commands";
import { SHELL } from "@/lib/shell/config";
import { rainCells, rainPool, startRain, stepRain, stillRain } from "@/lib/shell/rain";
import { fill, seg } from "@/lib/shell/text";
import type { Context, Effect, Line } from "@/lib/shell/types";
import { powerPanel, switchTheme } from "@/lib/signatures";
import { setSoundOn } from "@/lib/sound";
import { useUI } from "@/lib/store";
import { onTick } from "@/lib/ticker";
import type { ShellBoot } from "./ShellLauncher";
import css from "./terminal.module.css";

/**
 * ∞ SHELL — the terminal (DESIGN.md §7.4; PROMPTS.md Part 13), loaded on its first open. A native
 * modal <dialog>: focus stays in it, the page behind is inert, and its name is announced. It opens
 * and closes with its own POWER CYCLE, reads /search-index.json once, and streams what commands
 * print at 120 lines/s (any key skips to the end). The commands are lib/shell/commands.ts; this is
 * the glass, the keys and the effects.
 */
interface Row {
  id: number;
  segs: Line;
}

let rows = 0;
const toRows = (lines: readonly Line[]): Row[] => lines.map((segs) => ({ id: ++rows, segs }));
const keep = (all: Row[]): Row[] => (all.length > SHELL.scrollback ? all.slice(all.length - SHELL.scrollback) : all);
const isReduced = () => document.documentElement.dataset.motion === "reduce";
const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn", "AltGraph"]);
/** a hundred cells measure one (to a hundredth of a pixel) */
const PROBE = "0".repeat(100);

function loadHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(SHELL.historyKey);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(-SHELL.history) : [];
  } catch {
    return [];
  }
}

export default function Terminal({ boot }: { boot: ShellBoot }) {
  const open = useUI((s) => s.terminalOpen);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const probe = useRef<HTMLSpanElement>(null);

  const [ix, setIx] = useState<SearchIndex | null>(null);
  const [shown, setShown] = useState<Row[]>([]);
  const queue = useRef<Row[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState({ at: 0, left: 0 });
  const [focused, setFocused] = useState(false);
  const [raining, setRaining] = useState(false);
  const history = useRef<string[]>([]);
  const browse = useRef<{ at: number; draft: string } | null>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const stick = useRef(true);
  const cell = useRef({ width: 8, columns: 80 });
  const booted = useRef(false);

  const prompt = `${boot.user}@${boot.host}:~$ `;

  // ── output ──────────────────────────────────────────────────────────────────────────────
  const flush = useCallback(() => {
    if (!queue.current.length) return;
    const moved = queue.current.splice(0);
    setShown((prev) => keep([...prev, ...moved]));
    setStreaming(false);
  }, []);

  /** Lines out: streamed at 120 lines/s, or at once (an echo, reduced motion). */
  const print = useCallback(
    (lines: readonly Line[], now = false) => {
      if (!lines.length) return;
      const add = toRows(lines);
      if (now || isReduced()) {
        flush();
        setShown((prev) => keep([...prev, ...add]));
        return;
      }
      queue.current.push(...add);
      setStreaming(true);
    },
    [flush],
  );

  // the stream: whole lines at the artifact rate, frame-rate independent (law 7)
  useEffect(() => {
    if (!streaming) return;
    let budget = 0;
    return onTick((dt) => {
      budget += dt * artifact.terminalLinesPerSec;
      const n = Math.floor(budget);
      if (n <= 0) return;
      budget -= n;
      const moved = queue.current.splice(0, n);
      if (moved.length) setShown((prev) => keep([...prev, ...moved]));
      if (!queue.current.length) setStreaming(false);
    });
  }, [streaming]);

  // stay at the bottom while it's there; leave the reader where they scrolled to otherwise
  useLayoutEffect(() => {
    const s = screen.current;
    if (s && stick.current) s.scrollTop = s.scrollHeight;
  }, [shown]);

  // ── the index (once) and the banner ───────────────────────────────────────────────────────
  const loadIndex = useCallback(async (): Promise<SearchIndex | null> => {
    try {
      const res = await fetch("/search-index.json");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as SearchIndex;
      if (json.version !== SHELL.indexVersion) throw new Error("index version");
      setIx(json);
      return json;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    history.current = loadHistory();
    print([[seg(boot.loading, "dim")]], true);
    void loadIndex().then((j) => {
      if (!j) {
        print([[seg(boot.offline, "hot")]], true);
        return;
      }
      const S = j.labels.shell;
      const vars = { os: j.labels.os, version: j.build.version ?? S.none, sha: j.build.sha ?? S.none, tty: S.tty, name: j.profile.name, role: j.profile.role };
      print(S.banner.map((b, i) => [seg(fill(b, vars), i ? "dim" : "bold")]));
    });
  }, [boot, loadIndex, print]);

  // ── measuring a cell, and the panel's width in cells ──────────────────────────────────────
  const measure = useCallback(() => {
    const s = screen.current;
    const p = probe.current;
    if (!s || !p) return;
    // layout sizes, never the box on screen: the panel is scaled while it powers on
    const width = p.offsetWidth / PROBE.length || cell.current.width;
    const pad = Number.parseFloat(getComputedStyle(s).paddingLeft) + Number.parseFloat(getComputedStyle(s).paddingRight);
    cell.current = { width, columns: Math.max(20, Math.floor((s.clientWidth - pad) / width)) };
  }, []);
  useEffect(() => {
    const s = screen.current;
    if (!s) return;
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    return () => ro.disconnect();
  }, [measure]);

  const context = useCallback(
    (index: SearchIndex): Context => {
      const ui = useUI.getState();
      return {
        ix: index,
        columns: cell.current.columns,
        theme: ui.theme,
        sound: ui.sound,
        grid: ui.grid,
        gfx: ui.gfx,
        debug: ui.debug,
        uptimeMs: performance.now(),
        startedAt: new Date(performance.timeOrigin),
        now: new Date(),
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        history: history.current,
        path: window.location.pathname,
      };
    },
    [],
  );

  // ── open and close: the panel's own POWER CYCLE ───────────────────────────────────────────
  const stopRain = useCallback(() => setRaining(false), []);

  const close = useCallback(
    async (then?: () => void) => {
      const d = dialog.current;
      if (closing.current || !d?.open) return;
      closing.current = true;
      setRaining(false);
      flush();
      cue("SHELL", { variant: "close" });
      try {
        const a = await powerPanel(d, "off");
        await a.finished.catch(() => undefined);
        d.close();
        a.cancel();
      } catch {
        d.close();
      }
      useUI.getState().setTerminalOpen(false);
      closing.current = false;
      const after = then ?? afterClose.current;
      afterClose.current = null;
      after?.();
    },
    [flush],
  );

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      measure();
      cue("SHELL", { variant: "open" });
      input.current?.focus();
      let anim: Animation | null = null;
      void powerPanel(d, "on")
        .then((a) => {
          anim = a;
          return a.finished;
        })
        .then(() => {
          anim?.cancel();
          measure();
        })
        .catch(() => undefined);
    } else if (!open && d.open) void close();
  }, [open, measure, close]);

  // a phone's keyboard covers the bottom of the screen, where the line is: the panel rides above it
  // (visualViewport; touch only, so a desk's pinch-zoom isn't taken for a keyboard)
  useEffect(() => {
    const vv = window.visualViewport;
    const d = dialog.current;
    if (!open || !vv || !d || !window.matchMedia("(pointer: coarse)").matches) return;
    const fit = () => d.style.setProperty("--keyboard", `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
      d.style.removeProperty("--keyboard");
    };
  }, [open]);

  // the page behind doesn't scroll under the panel: wheels outside the screen stop here
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onWheel = (e: WheelEvent) => {
      if (!screen.current?.contains(e.target as Node)) e.preventDefault();
    };
    d.addEventListener("wheel", onWheel, { passive: false });
    return () => d.removeEventListener("wheel", onWheel);
  }, []);

  // ── effects ──────────────────────────────────────────────────────────────────────────────
  const go = useCallback((href: string): Promise<void> => {
    const url = new URL(href, window.location.href);
    return url.pathname === window.location.pathname && url.hash ? jumpToHash(url.hash) : navigate(url.href);
  }, []);
  /** CONNECT's first field: focusing it brings the form's behaviour (its first focus) */
  const focusForm = useCallback(() => {
    document.querySelector<HTMLElement>("form[data-connect-form] :is(input, select, textarea):not([tabindex='-1'])")?.focus();
  }, []);

  const apply = useCallback(
    async (e: Effect, index: SearchIndex) => {
      const S = index.labels.shell;
      switch (e.kind) {
        case "clear":
          queue.current = [];
          setStreaming(false);
          setShown([]);
          return;
        case "copy":
          try {
            await navigator.clipboard.writeText(e.text);
            print([[seg(S.copied, "dim")]]);
          } catch {
            print([[seg(S.noClipboard, "dim")]]);
          }
          return;
        case "url":
          window.open(e.href, "_blank", "noopener,noreferrer");
          return;
        case "navigate":
          await close(() => void go(e.href));
          return;
        case "contact":
          if (e.behind) {
            // the page goes to CONNECT under the panel; Esc lands in the form
            afterClose.current = focusForm;
            await go(routes.section("connect"));
          } else await close(() => void go(routes.section("connect")).then(focusForm));
          return;
        case "theme":
          await switchTheme(e.theme);
          return;
        case "sound":
          await setSoundOn(e.on);
          return;
        case "grid":
          useUI.getState().toggleGrid();
          return;
        case "gfx":
          useUI.getState().setGfx(e.gfx);
          return;
        case "debug":
          useUI.getState().setDebug(!useUI.getState().debug);
          return;
        case "rain": {
          const pool = rainPool(index);
          if (!pool.length) return;
          if (isReduced()) {
            // the reduced-motion edition: one still frame of it
            const s = screen.current;
            const lines = s ? Math.max(4, Math.floor(s.clientHeight / (Number.parseFloat(getComputedStyle(s).lineHeight) || 1)) - 2) : 12;
            print(stillRain(pool, cell.current.columns, lines).map((l) => [{ t: l, k: "accent", nowrap: true }]));
            return;
          }
          setRaining(true);
          return;
        }
      }
    },
    [close, focusForm, go, print],
  );

  // ── rain: thirty seconds at most, any key or press ends it ────────────────────────────────
  useEffect(() => {
    if (!raining || !ix) return;
    const cv = canvas.current;
    const s = screen.current;
    const g = cv?.getContext("2d");
    if (!cv || !s || !g) return;
    const box = { width: s.clientWidth, height: s.clientHeight };
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(box.width * dpr);
    cv.height = Math.round(box.height * dpr);
    const cs = getComputedStyle(cv);
    const lineHeight = Number.parseFloat(cs.lineHeight) || cell.current.width * 2;
    const head = getComputedStyle(dialog.current ?? cv).getPropertyValue("--fg-1").trim() || cs.color;
    const pool = rainPool(ix);
    const rain = startRain(pool, Math.floor(box.width / cell.current.width), Math.floor(box.height / lineHeight));
    const draw = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, box.width, box.height);
      g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      g.textBaseline = "top";
      for (const [x, y, ch, light] of rainCells(rain, SHELL.rainTrail)) {
        g.globalAlpha = light;
        g.fillStyle = light === 1 ? head : cs.color;
        g.fillText(ch, x * cell.current.width, y * lineHeight);
      }
    };
    let steps = 0;
    let elapsed = 0;
    draw();
    const off = onTick((dt) => {
      elapsed += dt * 1000;
      steps += dt * artifact.rainStepsPerSec;
      let moved = false;
      while (steps >= 1) {
        stepRain(rain, pool, SHELL.rainTrail);
        steps -= 1;
        moved = true;
      }
      if (moved) draw();
      if (elapsed >= artifact.rainMs) setRaining(false);
    });
    const end = () => setRaining(false);
    const d = dialog.current;
    d?.addEventListener("pointerdown", end);
    return () => {
      off();
      d?.removeEventListener("pointerdown", end);
      print([[seg(ix.labels.shell.rain.stop, "dim")]]);
    };
  }, [raining, ix, print]);

  // ── the line ─────────────────────────────────────────────────────────────────────────────
  const syncCaret = useCallback(() => {
    const el = input.current;
    if (!el) return;
    const at = el.selectionStart ?? el.value.length;
    setCaret({ at, left: at * cell.current.width - el.scrollLeft });
  }, []);
  // a line set from code (history, completion, a fresh prompt) puts the caret at its end, once React has written it
  const toEnd = useRef(false);
  useLayoutEffect(() => {
    const el = input.current;
    if (el && toEnd.current) {
      toEnd.current = false;
      el.setSelectionRange(el.value.length, el.value.length);
      el.scrollLeft = el.scrollWidth;
    }
    syncCaret();
  }, [value, syncCaret]);

  const setLine = (next: string) => {
    toEnd.current = true;
    setValue(next);
  };

  const remember = (text: string) => {
    const h = history.current;
    if (h[h.length - 1] !== text) h.push(text);
    if (h.length > SHELL.history) h.splice(0, h.length - SHELL.history);
    try {
      sessionStorage.setItem(SHELL.historyKey, JSON.stringify(h));
    } catch {
      /* no storage: the history lasts as long as the panel */
    }
  };

  const run = (text: string, index: SearchIndex) => {
    const result = execute(text, context(index));
    cue("SHELL", { variant: result.error ? "error" : "enter" });
    print(result.lines);
    for (const e of result.effects ?? []) void apply(e, index);
  };

  const submit = () => {
    flush();
    const text = value;
    print([[seg(prompt, "accent"), seg(text)]], true);
    setLine("");
    browse.current = null;
    if (!text.trim()) return;
    remember(text.trim());
    if (ix) return run(text, ix);
    // the index didn't load: every command tries again first
    void loadIndex().then((j) => (j ? run(text, j) : print([[seg(boot.offline, "hot")]])));
  };

  const interrupt = () => {
    queue.current = [];
    setStreaming(false);
    setRaining(false);
    print([[seg(prompt, "accent"), seg(value), seg(ix?.labels.shell.interrupted ?? "", "dim")]], true);
    setLine("");
    browse.current = null;
  };

  const walk = (dir: -1 | 1) => {
    const h = history.current;
    if (!h.length) return;
    if (!browse.current) {
      if (dir === 1) return;
      browse.current = { at: h.length, draft: value };
    }
    const at = Math.min(h.length, Math.max(0, browse.current.at + dir));
    browse.current.at = at;
    const next = at === h.length ? browse.current.draft : (h[at] ?? "");
    if (at === h.length) browse.current = null;
    setLine(next);
  };

  const tab = () => {
    if (!ix) return;
    const r = complete(value, context(ix));
    if (r.options.length) {
      print([[seg(prompt, "accent"), seg(value)]], true);
      const width = Math.max(...r.options.map((o) => o.length)) + 2;
      const per = Math.max(1, Math.floor(cell.current.columns / width));
      const lines: Line[] = [];
      for (let i = 0; i < r.options.length; i += per) lines.push([seg(r.options.slice(i, i + per).map((o) => o.padEnd(width)).join("").trimEnd(), "dim")]);
      print(lines, true);
    }
    if (r.input !== value) setLine(r.input);
  };

  const hasSelection = () => {
    const el = input.current;
    return (!!el && el.selectionStart !== el.selectionEnd) || !!window.getSelection()?.toString();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (raining) {
      e.preventDefault();
      stopRain();
      return;
    }
    const k = e.key;
    const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
    // any key skips the stream to its end (and still does what it does) — a modifier alone isn't a
    // key yet (Ctrl, on its way to Ctrl+C, would flush what Ctrl+C means to drop)
    if (queue.current.length && !MODIFIERS.has(k) && !(ctrl && k.toLowerCase() === "c")) flush();
    if (ctrl && k.toLowerCase() === "c") {
      if (hasSelection()) return; // the browser's copy
      e.preventDefault();
      interrupt();
      return;
    }
    if (ctrl && k.toLowerCase() === "l") {
      e.preventDefault();
      queue.current = [];
      setStreaming(false);
      setShown([]);
      return;
    }
    switch (k) {
      case "Enter":
        e.preventDefault();
        submit();
        return;
      case "Tab":
        if (e.shiftKey) return; // Shift+Tab leaves the line (the close button, the links)
        e.preventDefault();
        tab();
        return;
      case "ArrowUp":
        e.preventDefault();
        walk(-1);
        return;
      case "ArrowDown":
        e.preventDefault();
        walk(1);
        return;
      case "PageUp":
      case "PageDown": {
        e.preventDefault();
        const s = screen.current;
        if (s) s.scrollTop += (k === "PageUp" ? -1 : 1) * s.clientHeight * 0.9;
        return;
      }
    }
  };

  const onCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    if (raining) return stopRain(); // Esc ends the rain first
    void close();
  };

  return createPortal(
    <dialog
      ref={dialog}
      className={css.panel}
      aria-label={boot.label}
      data-lenis-prevent=""
      data-shell=""
      onCancel={onCancel}
      style={{ "--shell-scan-alpha": SHELL.scanAlpha } as CSSProperties}
    >
      <div className={css.bar}>
        <span aria-hidden="true">{`${ix?.labels.os ?? boot.os} · ${boot.tty}`}</span>
        <button type="button" className={css.close} aria-label={boot.close} onClick={() => void close()}>
          ×
        </button>
      </div>
      <div
        ref={screen}
        className={css.screen}
        onScroll={(e) => {
          const s = e.currentTarget;
          stick.current = s.scrollHeight - s.scrollTop - s.clientHeight < cell.current.width;
        }}
        onMouseUp={() => {
          if (!window.getSelection()?.toString()) input.current?.focus();
        }}
      >
        <div role="log" aria-label={boot.output}>
          {shown.map((r) => (
            <div key={r.id} className={css.line}>
              {r.segs.map((s, i) => {
                const cls = [s.k ? css[s.k] : "", s.nowrap ? css.nowrap : ""].filter(Boolean).join(" ") || undefined;
                if (!s.href) return <span key={i} className={cls}>{s.t}</span>;
                const external = /^https?:/.test(s.href);
                return (
                  <a key={i} className={`${css.link} ${cls ?? ""}`} href={s.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    {s.t}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
        <div className={css.prompt}>
          <span className={css.ps1} aria-hidden="true">
            {prompt}
          </span>
          <span className={css.field}>
            <label htmlFor={id} className="sr-only">
              {boot.input}
            </label>
            <input
              ref={input}
              id={id}
              className={css.input}
              value={value}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              onChange={(e) => {
                browse.current = null;
                setValue(e.target.value);
              }}
              onKeyDown={onKeyDown}
              onKeyUp={syncCaret}
              onSelect={syncCaret}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            <span className={css.caret} style={{ left: caret.left }} data-idle={focused ? undefined : ""} aria-hidden="true">
              {value[caret.at] ?? " "}
            </span>
          </span>
        </div>
        <span ref={probe} className={css.probe} aria-hidden="true">
          {PROBE}
        </span>
      </div>
      {raining && <canvas ref={canvas} className={css.rain} aria-hidden="true" />}
    </dialog>,
    document.body,
  );
}
