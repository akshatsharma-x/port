import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BAYER4, DITHER, ditherGrid, halftoneFullRadius, snapOrigin, spritePixels, thresholdField } from "@/lib/dither";
import { artifact, hashSeed, rng } from "@/lib/motion";
import { SCRAMBLE_GLYPHS, scrambleFrame, scrambleMs, scrambleResolved } from "@/lib/scramble";

/** DESIGN.md §3.6 ③ (element tier) and §3.7 SCRAMBLE. */
describe("DITHER RESOLVE — element tier", () => {
  it("is 4×4 Bayer, 17 levels, steps(16) over 400 ms", () => {
    expect(DITHER).toMatchObject({ ms: 400, steps: 16, bayer: 4 });
    expect([...BAYER4].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it("thresholds = 0.7 · bayer4 + 0.3 · radial(origin), in [0, 1)", () => {
    const grid = { cols: 16, rows: 12 };
    const field = thresholdField(grid, { x: 0, y: 0 });
    expect(field[0]).toBeCloseTo(0.7 * 0 + 0.3 * (Math.hypot(0.5, 0.5) / Math.hypot(16, 12)));
    expect(Math.max(...field)).toBeLessThan(1);
    // the bayer term orders cells inside a 4×4 tile; the radial term makes it radiate from the origin
    const near = thresholdField(grid, { x: 0, y: 0 });
    const far = thresholdField(grid, { x: 1, y: 1 });
    expect(near[0]).toBeLessThan(far[0] ?? 0);
  });

  it("frame 0 hides everything, frame 16 shows everything, and coverage only grows", () => {
    const grid = { cols: 20, rows: 10 };
    const px = spritePixels(grid, thresholdField(grid, { x: 0.3, y: 0.7 }));
    expect(px.width).toBe((DITHER.steps + 1) * grid.cols);
    const coverage = Array.from({ length: DITHER.steps + 1 }, (_, k) => {
      let on = 0;
      for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) if ((px.data[(y * px.width + k * grid.cols + x) * 4 + 3] ?? 0) > 0) on++;
      return on / (grid.cols * grid.rows);
    });
    expect(coverage[0]).toBe(0);
    expect(coverage[DITHER.steps]).toBe(1);
    expect(coverage.every((c, k) => k === 0 || c >= (coverage[k - 1] ?? 0))).toBe(true);
    // a pixel, once on, stays on
    for (let y = 0; y < grid.rows; y++)
      for (let x = 0; x < grid.cols; x++) {
        let was = false;
        for (let k = 0; k <= DITHER.steps; k++) {
          const on = (px.data[(y * px.width + k * grid.cols + x) * 4 + 3] ?? 0) > 0;
          expect(was && !on).toBe(false);
          was = on;
        }
      }
  });

  it("keeps sprites small: big boxes get coarser cells; origins snap to share sprites", () => {
    expect(ditherGrid(400, 300)).toEqual({ cols: 100, rows: 75, cell: 4 });
    const big = ditherGrid(2400, 1600);
    expect(big.cols).toBeLessThanOrEqual(DITHER.maxCells);
    expect(big.rows).toBeLessThanOrEqual(DITHER.maxCells);
    expect(big.cols * big.cell).toBeGreaterThanOrEqual(2400);
    expect(snapOrigin({ x: 0.51, y: -3 })).toEqual({ x: 0.5, y: 0 });
  });

  it("Paper's HALFTONE covers the box at half the screen period", () => {
    expect(halftoneFullRadius(8)).toBeGreaterThanOrEqual(4);
  });
});

describe("SCRAMBLE — §3.7", () => {
  it("≤ 40 characters, ≤ 600 ms, 30 fps steps, resolving left → right", () => {
    expect(artifact.scrambleMaxChars).toBe(40);
    expect(scrambleMs("x".repeat(40))).toBe(600);
    expect(scrambleMs("ARCHIVE")).toBeCloseTo((7 * 1000) / 30);
    expect(scrambleResolved(10, 0, 300)).toBe(0);
    expect(scrambleResolved(10, 150, 300)).toBe(5);
    expect(scrambleResolved(10, 300, 300)).toBe(10);
    const frame = scrambleFrame("04 ARCHIVE", 150, 300, rng(hashSeed("t")));
    expect(frame.slice(0, 5)).toBe("04 AR");
    expect(frame[2]).toBe(" ");
    expect(frame.length).toBe("04 ARCHIVE".length);
    expect([...frame.slice(5)].every((ch) => SCRAMBLE_GLYPHS.includes(ch))).toBe(true);
  });

  it("uses only glyphs the baked JetBrains Mono carries", () => {
    const manifest = JSON.parse(readFileSync(join(resolve(__dirname, ".."), "app/fonts/manifest.json"), "utf8")) as { fonts: { id: string; codepoints: number[] }[] };
    const mono = new Set(manifest.fonts.find((f) => f.id === "jetbrains-mono")?.codepoints ?? []);
    expect([...SCRAMBLE_GLYPHS].filter((ch) => !mono.has(ch.codePointAt(0) ?? 0))).toEqual([]);
  });
});
