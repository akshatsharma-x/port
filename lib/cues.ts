import { useUI } from "./store";

/**
 * The sound cue bus (DESIGN.md §6.4). Callers name what happened; the bus applies each cue's rate
 * limit and the sound preference, then hands it to the engine. Part 5's lib/audio.ts registers the
 * engine (synthesis, samples, master chain); until then cues are counted, not heard.
 */
export const CUES = ["ENABLE", "BOOT", "POWER", "TEAR", "SECTION", "COMMIT", "FLING", "GATE", "ARCHIVE", "REPLOT", "KEYCAP", "FLIP", "STAMP", "SHELL", "TRANSMIT", "HALT", "DEGAUSS"] as const;
export type Cue = (typeof CUES)[number];

/** Minimum spacing between plays (ms), from the cue sheet's Limit column. */
export const CUE_LIMIT_MS: Partial<Record<Cue, number>> = {
  TEAR: 450,
  SECTION: 1200,
  COMMIT: 40,
  ARCHIVE: 150,
};

export interface CueDetail {
  /** e.g. POWER "on" | "off" */
  variant?: string;
  /** 0–1, e.g. FLING speed or KEYCAP impact */
  intensity?: number;
  /** a note (Hz): ARCHIVE plays the focused record's year (lib/archive.ts yearNote) */
  hz?: number;
  /** a length (ms): ARCHIVE's blip runs as long as its citations say (lib/archive.ts citationMs) */
  ms?: number;
}

export type CueEngine = (cue: Cue, detail: CueDetail) => void;

let engine: CueEngine | null = null;
const last = new Map<Cue, number>();
/** what reached the engine, and what the limits held back (the gate and the dev overlay read these) */
export const cueLog = { played: new Map<Cue, number>(), limited: new Map<Cue, number>() };

export function registerCueEngine(next: CueEngine | null): void {
  engine = next;
}

/** Fires a cue. Returns true if it passed the rate limit (whether or not sound is on). */
export function cue(name: Cue, detail: CueDetail = {}, now: number = typeof performance === "undefined" ? 0 : performance.now()): boolean {
  const limit = CUE_LIMIT_MS[name] ?? 0;
  const prev = last.get(name);
  if (prev !== undefined && now - prev < limit) {
    cueLog.limited.set(name, (cueLog.limited.get(name) ?? 0) + 1);
    return false;
  }
  last.set(name, now);
  cueLog.played.set(name, (cueLog.played.get(name) ?? 0) + 1);
  if (engine && useUI.getState().sound) engine(name, detail);
  return true;
}

/** Test hook. */
export function resetCues(): void {
  last.clear();
  cueLog.played.clear();
  cueLog.limited.clear();
}
