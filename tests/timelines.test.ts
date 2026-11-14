import { describe, expect, it } from "vitest";
import { hashSeed, MAX_TIMED_MS, rng, signature } from "@/lib/motion";
import { jitterAt, POWER, powerOffAt, powerOnAt, SCAN, scanAt, TEAR, tearAt, tearBands } from "@/lib/timelines";

/** DESIGN.md §3.6 — the numbers in the bible are the numbers in the code. */
const FRAME_60 = 1000 / 60;
const sample = (ms: number, step = 1) => Array.from({ length: Math.floor(ms / step) + 1 }, (_, i) => i * step);

describe("POWER CYCLE — §3.6 ①", () => {
  it("matches the bible's timings", () => {
    expect(signature.power).toMatchObject({ onMs: 600, onStretchMs: 90, onOpenMs: 420, offMs: 450, offCollapseMs: 220, offPinchMs: 340, offFastMs: 240, onFastMs: 360, afterglowMs: 300, reducedMs: 200 });
    expect(POWER.offFastMs + POWER.onFastMs).toBe(600); // the theme switch
    expect(POWER.stageHoldMs).toBe(420); // law 4: the stage holds its first frame until the beam is open
    expect(POWER.onBrightness).toBe(1.25);
    expect(POWER.offBrightness).toBe(1.6);
  });

  it("ON: a dot stretches to a line by 90 ms, opens by 420 ms, settles by 600 ms", () => {
    const start = powerOnAt(0);
    expect(start.scaleX).toBeCloseTo(POWER.lineScale);
    expect(start.scaleY).toBeCloseTo(POWER.lineScale);
    expect(powerOnAt(90).scaleX).toBeCloseTo(1);
    expect(powerOnAt(90).scaleY).toBeCloseTo(POWER.lineScale);
    expect(powerOnAt(420).scaleY).toBeCloseTo(1);
    expect(powerOnAt(420).barrel).toBeCloseTo(0);
    expect(powerOnAt(90).barrel).toBeCloseTo(POWER.barrel);
    expect(powerOnAt(600).brightness).toBeCloseTo(1);
    // one scanline roll passes while the line opens
    expect(powerOnAt(60).roll).toBe(-1);
    expect(powerOnAt(250).roll).toBeGreaterThan(0);
    expect(powerOnAt(500).roll).toBe(-1);
  });

  it("OFF: collapses to a line by 220 ms, pinches to a dot by 340 ms, fades by 450 ms", () => {
    expect(powerOffAt(220).scaleY).toBeCloseTo(POWER.lineScale);
    expect(powerOffAt(220).scaleX).toBeCloseTo(1);
    expect(powerOffAt(340).scaleX).toBeCloseTo(POWER.lineScale);
    expect(powerOffAt(340).opacity).toBeCloseTo(1);
    expect(powerOffAt(450).opacity).toBeCloseTo(0);
    expect(powerOffAt(220).brightness).toBeCloseTo(POWER.offBrightness);
  });

  it("the fast variants are the same curves, time-scaled (240 / 360 ms)", () => {
    expect(powerOffAt(POWER.offFastMs, true).opacity).toBeCloseTo(0);
    expect(powerOnAt(POWER.onFastMs, true).scaleY).toBeCloseTo(1);
    expect(powerOnAt(POWER.onFastMs, true).brightness).toBeCloseTo(1);
    expect(powerOffAt(120, true).scaleY).toBeCloseTo(powerOffAt(225).scaleY, 1);
  });

  it("photosensitivity: one flash per cycle, ≤ 2 frames (at or above 90% of the peak)", () => {
    for (const fast of [false, true]) {
      const off = sample(fast ? POWER.offFastMs : POWER.offMs, 0.5).map((t) => powerOffAt(t, fast).brightness);
      const peak = Math.max(...off);
      const flashMs = off.filter((b) => b >= 0.9 * peak).length * 0.5;
      expect(flashMs).toBeLessThanOrEqual(POWER.maxFlashFrames * FRAME_60);
      // one flash: the bright samples are contiguous
      const idx = off.flatMap((b, i) => (b >= 0.9 * peak ? [i] : []));
      expect((idx.at(-1) ?? 0) - (idx[0] ?? 0) + 1).toBe(idx.length);
      // ON never exceeds its 1.25× line brightness: no flash at all
      expect(Math.max(...sample(POWER.onMs).map((t) => powerOnAt(t, fast).brightness))).toBeLessThanOrEqual(POWER.onBrightness);
    }
  });

  it("the Paper SCAN sweeps top → bottom in 600 ms", () => {
    expect(SCAN.ms).toBe(600);
    expect(scanAt(0)).toBe(0);
    expect(scanAt(600)).toBe(1);
    const ys = sample(600, 10).map(scanAt);
    expect(ys.every((y, i) => i === 0 || y >= (ys[i - 1] ?? 0))).toBe(true);
  });
});

describe("TRACKING TEAR — §3.6 ②", () => {
  it("is 450 ms with the cut at 180 ms, bands to 120, the flood full by 200", () => {
    expect(TEAR).toMatchObject({ ms: 450, cutMs: 180, bandsUntilMs: 120, floodFromMs: 120, floodFullMs: 200, reducedMs: 160 });
    expect(TEAR.cutMs).toBeLessThan(TEAR.floodFullMs);
    expect(TEAR.ms).toBeLessThanOrEqual(MAX_TIMED_MS);
  });

  it("floods through 16 Bayer steps — never a smooth alpha ramp — and covers the cut", () => {
    const floods = new Set(sample(TEAR.ms).map((t) => tearAt(t).flood));
    for (const f of floods) expect(Number.isInteger(f * TEAR.floodSteps)).toBe(true);
    expect(floods.size).toBeLessThanOrEqual(TEAR.floodSteps + 1);
    expect(tearAt(119).flood).toBe(0);
    expect(tearAt(TEAR.cutMs).flood).toBeGreaterThanOrEqual(0.75);
    expect(tearAt(TEAR.floodFullMs).flood).toBe(1);
    // the flood rolls off upward as one bar
    expect(tearAt(TEAR.floodFullMs).roll).toBe(1);
    expect(tearAt(TEAR.ms).roll).toBe(0);
  });

  it("lays out 3–5 seeded bands, 1.5–9% tall, offset 12–48 px, chroma 4–12 px", () => {
    const counts = new Set<number>();
    for (let s = 0; s < 200; s++) {
      const bands = tearBands(rng(hashSeed(`seed-${s}`)));
      counts.add(bands.length);
      for (const b of bands) {
        expect(b.h).toBeGreaterThanOrEqual(0.015);
        expect(b.h).toBeLessThanOrEqual(0.09);
        expect(Math.abs(b.offset)).toBeGreaterThanOrEqual(12);
        expect(Math.abs(b.offset)).toBeLessThanOrEqual(48);
        expect(b.chroma).toBeGreaterThanOrEqual(4);
        expect(b.chroma).toBeLessThanOrEqual(12);
      }
    }
    expect([...counts].sort()).toEqual([3, 4, 5]);
    // the same destination tears the same way
    expect(tearBands(rng(hashSeed("#archive")))).toEqual(tearBands(rng(hashSeed("#archive"))));
  });

  it("jitters ±3–8 px in 30 Hz steps", () => {
    const random = (step: number) => rng(hashSeed(`j:${step}`))();
    for (let t = 0; t < TEAR.ms; t += 5) {
      const x = Math.abs(jitterAt(t, random));
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(8);
    }
    expect(jitterAt(0, random)).toBe(jitterAt(33, random)); // one step lasts 1/30 s
    expect(tearAt(TEAR.ms).jitter).toBe(0); // damped out by the end
  });
});
