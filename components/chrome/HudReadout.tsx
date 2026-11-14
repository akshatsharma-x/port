"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { damp } from "@/lib/damp";
import { governor } from "@/lib/sceneManager";
import { clockCells, HUD_HZ, localClock, onHud, setText } from "@/lib/hud";
import { artifact, followers } from "@/lib/motion";
import { runScramble } from "@/lib/scramble";
import { scrollSignal, scrollStore, type ScrollSnapshot } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";
import { sectionLabel, type ChromeSection } from "./types";

const NO_SECTION = "—";

/**
 * The HUD readout (DESIGN.md §7.3), top-left: `RETROGRADE/OS · 04 ARCHIVE · 37%`. Part 5 adds the
 * clock and the front panel. The percentage follows scroll at λ 14 and is written at 10 Hz; the
 * section label changes instantly on jumps (the tear covers them) and glitches — this label only,
 * no full-screen effect — when continuous scroll crosses a section boundary.
 *
 * Decorative and fast-changing, so aria-hidden: the section rail carries the same state
 * (aria-current) for assistive technology.
 */
export function HudReadout({ os, sections, timeZone, countryCode }: { os: string; sections: readonly ChromeSection[]; timeZone: string; countryCode: string }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const isReduced = () => document.documentElement.dataset.motion === "reduce";
    // no section here (a route without tracked sections, or before they register): a dash holds
    // the fixed-width field, so nothing moves when a section arrives
    const labelOf = (id: string | null) => {
      const s = sections.find((x) => x.id === id);
      return s ? sectionLabel(s) : NO_SECTION;
    };
    let shown = scrollSignal.progress;
    const offTick = onTick((dt) => {
      shown = isReduced() ? scrollSignal.progress : damp(shown, scrollSignal.progress, followers.hudScroll, dt);
    });
    const offHud = onHud(HUD_HZ.text, () => setText(pctRef.current, `${String(Math.round(shown * 100)).padStart(2, "0")}%`));
    // the owner's local time and zone (14:32:07 CET), from the content's IANA zone; written only
    // when the second changes. Client-only: the server can't know the visitor's "now".
    const clock = localClock(timeZone, countryCode);
    const offClock = onHud(HUD_HZ.text, () => setText(clockRef.current, clock.format(new Date())));
    // FPS only in debug (2 Hz), from the governor's frame intervals
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    const offFps = debug
      ? onHud(HUD_HZ.fps, () => {
          const iv = governor.stats.intervals;
          if (iv.count) setText(fpsRef.current, ` · ${Math.round(1000 / iv.percentile(50))} FPS`);
        })
      : () => undefined;

    let glitch: (() => void) | null = null;
    const write = (text: string) => setText(labelRef.current, text);
    const onChange = (s: ScrollSnapshot, prev: ScrollSnapshot) => {
      if (s.seq === prev.seq) return;
      glitch?.();
      glitch = null;
      const text = labelOf(s.section);
      if (s.cause !== "scroll" || isReduced() || text === NO_SECTION) write(text);
      else glitch = runScramble(text, write, { ms: artifact.labelGlitchMs, seed: `hud:${s.seq}` });
    };
    write(labelOf(scrollStore.getState().section));
    const unsubscribe = scrollStore.subscribe(onChange);
    return () => {
      unsubscribe();
      glitch?.();
      offHud();
      offClock();
      offFps();
      offTick();
    };
  }, [sections, timeZone, countryCode]);

  // fixed-width fields, like any terminal status line: a label change never moves the percentage,
  // and a font swap never moves anything (fields are sized in em on the mono grid, not in ch)
  const labelCh = Math.max(0, ...sections.map((s) => sectionLabel(s).length));
  return (
    <p className="hud-readout t-micro" aria-hidden="true" style={{ "--label-n": labelCh, "--os-n": [...os].length, "--clock-n": clockCells(timeZone, countryCode) } as CSSProperties}>
      <span className="hud-readout__os">{os}</span>
      <span className="hud-readout__sep"> · </span>
      <span ref={labelRef} className="hud-readout__section">
        {NO_SECTION}
      </span>
      <span className="hud-readout__sep"> · </span>
      <span ref={pctRef} className="hud-readout__pct">
        00%
      </span>
      <span className="hud-readout__time">
        <span className="hud-readout__sep"> · </span>
        <span ref={clockRef} className="hud-readout__clock" />
      </span>
      <span ref={fpsRef} className="hud-readout__fps" />
    </p>
  );
}
