"use client";

import { useEffect, useRef } from "react";
import { HUD_HZ, onHud } from "@/lib/hud";
import { switchTheme } from "@/lib/signatures";
import { setSoundOn, soundLevel } from "@/lib/sound";
import { useUI } from "@/lib/store";
import { THEME_LABEL, THEMES, type Theme } from "@/lib/tokens";

export interface PanelLabels {
  label: string;
  tube: string;
  sound: string;
  /** what SND means, for a screen reader, after the visible label */
  soundName: string;
  on: string;
  off: string;
  meter: string;
  grid: string;
  gfx: string;
  gfxName: string;
  gfxAuto: string;
  gfxLow: string;
  /** each tube's name, after its phosphor code */
  themes: Record<Theme, string>;
}

/** The VU meter's four LEDs light at these output peaks (dBFS). */
export const VU_DB = [-48, -36, -24, -12] as const;

/**
 * The front panel (DESIGN.md §7.3), bottom-left — hardware switches with LEDs:
 * TUBE P1 · P3 · PPR (the theme, by POWER CYCLE; SCAN into Paper), SND OFF/ON with a 4-LED VU
 * meter driven by the engine's AnalyserNode, GRID (also `G`), GFX AUTO/LOW. Native controls
 * underneath — radios and toggle buttons — so keyboard and assistive tech get them for free.
 */
export function FrontPanel({ labels: L }: { labels: PanelLabels }) {
  const theme = useUI((s) => s.theme);
  const sound = useUI((s) => s.sound);
  const grid = useUI((s) => s.grid);
  const gfx = useUI((s) => s.gfx);
  const toggleGrid = useUI((s) => s.toggleGrid);
  const setGfx = useUI((s) => s.setGfx);
  const vuRef = useRef<HTMLSpanElement>(null);

  // the meter reads the real output level at 10 Hz while sound is on
  useEffect(() => {
    const vu = vuRef.current;
    if (!vu || !sound) return;
    let pending = false;
    const off = onHud(HUD_HZ.text, () => {
      if (pending) return;
      pending = true;
      void soundLevel().then((db) => {
        pending = false;
        vu.dataset.lit = String(db === null ? 0 : VU_DB.filter((t) => db >= t).length);
      });
    });
    return () => {
      off();
      vu.dataset.lit = "0";
    };
  }, [sound]);

  return (
    <div className="front-panel t-micro" role="group" aria-label={L.label}>
      <fieldset className="fp-group fp-tube">
        <legend className="fp-legend">{L.tube}</legend>
        {THEMES.map((t: Theme) => (
          <label key={t} className="fp-pos">
            <input type="radio" name="fp-tube" value={t} checked={theme === t} onChange={() => void switchTheme(t)} />
            <span className="fp-led" aria-hidden="true" />
            <span>{THEME_LABEL[t]}</span>
            <span className="sr-only">{` ${L.themes[t]}`}</span>
          </label>
        ))}
      </fieldset>
      <button type="button" className="fp-switch" aria-pressed={sound} data-cue="none" onClick={() => void setSoundOn(!sound)}>
        <span className="fp-led" aria-hidden="true" />
        <span>{L.sound}</span>
        <span className="sr-only">{` ${L.soundName}`}</span>
        <span className="fp-state">{sound ? L.on : L.off}</span>
        <span ref={vuRef} className="fp-vu" aria-hidden="true" title={L.meter} data-lit="0">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>
      <button type="button" className="fp-switch" aria-pressed={grid} onClick={() => toggleGrid()}>
        <span className="fp-led" aria-hidden="true" />
        <span>{L.grid}</span>
      </button>
      <button type="button" className="fp-switch" aria-pressed={gfx === "low"} onClick={() => setGfx(gfx === "low" ? "auto" : "low")}>
        <span className="fp-led" aria-hidden="true" />
        <span>{L.gfx}</span>
        <span className="sr-only">{` ${L.gfxName}`}</span>
        <span className="fp-state">{gfx === "low" ? L.gfxLow : L.gfxAuto}</span>
      </button>
    </div>
  );
}
