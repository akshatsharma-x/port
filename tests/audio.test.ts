import { describe, expect, it } from "vitest";
import { compressorMakeup, dbToGain, gainToDb, IMPLEMENTED, MIX, PEAK_DB, pitchJitter, STUBS } from "@/lib/audio";
import { CUES } from "@/lib/cues";

/** DESIGN.md §6.3–§6.4 — the engine's numbers. */
describe("sound engine", () => {
  it("runs the bible's master chain and caps", () => {
    expect(MIX).toMatchObject({ hpfHz: 70, lpfHz: 11_000, masterPeakDb: -6, voices: 8 });
    expect(MIX.compressor).toMatchObject({ thresholdDb: -24, ratio: 3 });
    expect(MIX.lpfHz).toBeLessThan(15_700); // nothing at the flyback whine
  });

  it("plays each cue at its sheet peak, all under the −6 dBFS ceiling", () => {
    expect(PEAK_DB).toEqual({ ENABLE: -18, BOOT_HUM: -32, BOOT_TICK: -30, BOOT_THUNK: -20, POWER: -22, TEAR: -24, SECTION: -30, COMMIT: -30, ARCHIVE: -30, REPLOT: -28, FLING: -28, GATE: -22, KEYCAP: -20, FLIP: -28, STAMP: -18, TRANSMIT: -24, HALT: -22, SHELL: -28, DEGAUSS: -24 });
    for (const db of Object.values(PEAK_DB)) expect(db).toBeLessThanOrEqual(MIX.masterPeakDb);
    expect(gainToDb(dbToGain(-24))).toBeCloseTo(-24);
  });

  it("pitches repeating cues ±4–8%", () => {
    let seed = 0;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 200; i++) {
      const d = Math.abs(pitchJitter(random) - 1);
      expect(d).toBeGreaterThanOrEqual(0.04 - 1e-9);
      expect(d).toBeLessThanOrEqual(0.08 + 1e-9);
    }
  });

  it("implements ENABLE, BOOT, POWER, TEAR, SECTION, COMMIT; every other cue is a named stub", () => {
    expect([...IMPLEMENTED].sort()).toEqual(["ARCHIVE", "BOOT", "COMMIT", "DEGAUSS", "ENABLE", "FLING", "FLIP", "GATE", "HALT", "KEYCAP", "POWER", "REPLOT", "SECTION", "SHELL", "STAMP", "TEAR", "TRANSMIT"]);
    // Part 13: the last stub (SHELL) and the Konami code's DEGAUSS are synthesized: no stubs left
    expect(STUBS).toEqual([]);
    expect([...IMPLEMENTED, ...STUBS].sort()).toEqual([...CUES].sort());
  });
});

describe("FLING: the carousel's whir (§6.4)", () => {
  it("gain ∝ speed up to the sheet's peak, its band rising with it; silent at rest", async () => {
    const { whirAt, FLING_WHIR, WHIR_MAKEUP } = await import("@/lib/audio");
    expect(whirAt(0).gain).toBe(0);
    const half = whirAt(0.5);
    const full = whirAt(1);
    expect(half.gain).toBeCloseTo(full.gain / 2, 9);
    // the voice's gain carries the band-pass's makeup; the boot gate holds its true peak to the sheet
    expect(full.gain).toBeCloseTo(dbToGain(PEAK_DB.FLING) * WHIR_MAKEUP, 9);
    expect(half.hz).toBeGreaterThan(FLING_WHIR.loHz);
    expect(full.hz).toBe(FLING_WHIR.hiHz);
    expect(whirAt(3)).toEqual(full); // clamped
  });
});

describe("band-passed noise bursts", () => {
  it("peak at exactly 1 before the cue's gain — so a burst peaks at the sheet's level by construction", async () => {
    const { burstSamples } = await import("@/lib/audio");
    for (const [hz, q, ms] of [[3200, 6, 4], [4200, 4, 5], [1900, 5, 6], [3800, 0.7, 120]] as const) {
      const s = burstSamples(48_000, hz, q, ms);
      expect(s.length).toBe(Math.round((ms / 1000) * 48_000));
      expect(Math.max(...[...s].map(Math.abs))).toBeCloseTo(1, 6);
      expect(burstSamples(48_000, hz, q, ms)).toEqual(s); // seeded: the same burst every time
      expect(Math.abs(s.at(-1) ?? 1)).toBeLessThan(1e-3); // decayed to silence by its end
    }
  });
});

describe("the master chain", () => {
  it("trims Web Audio's automatic compressor makeup: (1 / curve(0 dBFS))^0.6 = +9.6 dB at −24 dB, 3:1", () => {
    expect(gainToDb(compressorMakeup(MIX.compressor))).toBeCloseTo(9.6, 1);
    expect(compressorMakeup({ thresholdDb: 0, ratio: 3 })).toBeCloseTo(1); // no threshold, no makeup
  });
});
