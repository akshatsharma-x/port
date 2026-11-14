import { artifact, hashSeed, rng } from "./motion";

/**
 * #fx-css — the glass (DESIGN.md §5.1–§5.3): grain, scanlines and the refresh roll, all CSS and
 * compositor-only. These are its numbers and its pure helpers (tests/fx-css.test.ts).
 */
export const FX_CSS = {
  grain: {
    /** a tile of this many CSS px, one grain per CSS px */
    tile: 160,
    /** dark themes: white speckle, peak α 0.08, mean 0.028 */
    dark: { peak: 0.08, mean: 0.028 },
    /** Paper: black toner speckle, peak α 0.09, mean 0.025 */
    paper: { peak: 0.09, mean: 0.025 },
    fps: artifact.grainFps,
    /** jitter positions per cycle (24 fps → a 500 ms cycle) */
    steps: 12,
  },
  scan: { alpha: 0.07, pitchCssPx: 3 },
  roll: { lift: 0.025, bandPx: 140, periodMs: 9000 },
} as const;

/** §5.3 device-pixel snapping: pitch_dev = max(2, round(3 × DPR)), line = max(1, round(pitch_dev / 3)). In CSS px. */
export function scanPitch(dpr: number): { pitch: number; line: number } {
  const d = dpr > 0 ? dpr : 1;
  const pitchDev = Math.max(2, Math.round(FX_CSS.scan.pitchCssPx * d));
  const lineDev = Math.max(1, Math.round(pitchDev / 3));
  return { pitch: pitchDev / d, line: lineDev / d };
}

/** The grain's per-pixel alpha (0–1 of the peak): u^k, with k chosen so the mean is `mean / peak`. */
export const grainExponent = ({ peak, mean }: { peak: number; mean: number }): number => peak / mean - 1;

/** A tile of grain alpha (0–255), seeded: the same tile on every load. */
export function grainTile(size: number, spec: { peak: number; mean: number }, seed = "grain"): Uint8ClampedArray<ArrayBuffer> {
  const k = grainExponent(spec);
  const random = rng(hashSeed(seed));
  const a = new Uint8ClampedArray(new ArrayBuffer(size * size));
  for (let i = 0; i < a.length; i++) a[i] = Math.round(255 * random() ** k);
  return a;
}
