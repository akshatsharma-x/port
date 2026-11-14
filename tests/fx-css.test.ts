import { describe, expect, it } from "vitest";
import { FX_CSS, grainExponent, grainTile, scanPitch } from "@/lib/fx-css";

/** DESIGN.md §5.2–§5.3 — the glass's numbers. */
describe("#fx-css", () => {
  it("snaps the scanline pitch to device pixels: pitch_dev = max(2, round(3·DPR)), line = max(1, round(pitch_dev/3))", () => {
    expect(scanPitch(1)).toEqual({ pitch: 3, line: 1 });
    expect(scanPitch(2)).toEqual({ pitch: 3, line: 1 });
    expect(scanPitch(1.5)).toEqual({ pitch: 5 / 1.5, line: 2 / 1.5 }); // 4.5 → 5 device px, never a fraction
    expect(scanPitch(2.625)).toEqual({ pitch: 8 / 2.625, line: 3 / 2.625 });
    expect(scanPitch(0.5)).toEqual({ pitch: 4, line: 2 }); // max(2, …) in device px
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.625, 3]) {
      const { pitch, line } = scanPitch(dpr);
      expect(Number.isInteger(Math.round(pitch * dpr * 1e6) / 1e6)).toBe(true);
      expect(Number.isInteger(Math.round(line * dpr * 1e6) / 1e6)).toBe(true);
    }
  });

  it("grain: peak α 0.08 / mean 0.028 on the dark tubes, 0.09 / 0.025 toner on Paper — measured on the tile", () => {
    expect(FX_CSS.grain.dark).toEqual({ peak: 0.08, mean: 0.028 });
    expect(FX_CSS.grain.paper).toEqual({ peak: 0.09, mean: 0.025 });
    for (const spec of [FX_CSS.grain.dark, FX_CSS.grain.paper]) {
      const tile = grainTile(FX_CSS.grain.tile, spec);
      let sum = 0;
      let max = 0;
      for (const a of tile) {
        sum += a;
        max = Math.max(max, a);
      }
      const mean = (sum / tile.length / 255) * spec.peak;
      expect(mean).toBeCloseTo(spec.mean, 3);
      expect((max / 255) * spec.peak).toBeLessThanOrEqual(spec.peak);
      expect(grainExponent(spec)).toBeGreaterThan(0);
    }
    expect(FX_CSS.grain.fps).toBe(24);
  });

  it("scanlines α 0.07; the roll is +2.5%, 140 px, every 9 s", () => {
    expect(FX_CSS.scan.alpha).toBe(0.07);
    expect(FX_CSS.roll).toEqual({ lift: 0.025, bandPx: 140, periodMs: 9000 });
  });
});
