import { signature } from "./motion";

/**
 * DITHER RESOLVE, element tier (DESIGN.md §3.6 ③), for DOM images: a `mask-image` stepping through
 * a Bayer sprite. Frame k of 17 reveals every cell whose threshold is below k/16, and the threshold
 * field is 0.7 · bayer4(x, y) + 0.3 · radial(origin), so the image resolves out from where you
 * looked. The sprite depends on the box's cell grid and the origin, so it's generated at runtime
 * (once per grid and origin, cached) on a coarse grid that keeps it about a millisecond of work.
 */
export const DITHER = {
  ...signature.resolve.element,
  /** one mask cell, CSS px: the dither's grain */
  cellPx: 4,
  /** larger boxes get coarser cells, so a sprite stays ≤ 17 × 160 × 160 */
  maxCells: 160,
  bayerWeight: 0.7,
  radialWeight: 0.3,
  /** the origin snaps to a 1/8 grid of the box, so arrivals share sprites */
  originGrid: 8,
  /** Paper's HALFTONE: the 45° dot screen's period, CSS px */
  halftonePeriodPx: 8,
} as const;

/** The 4 × 4 Bayer index matrix (values 0–15). */
export const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The 8 × 8 Bayer index matrix (values 0–63): the About portrait's ordered dither (§2.11). */
export const BAYER8: readonly number[] = (() => {
  const out: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      // the recursive construction: interleave the bits of (x ^ y, y), finest scale most significant
      const a = x ^ y;
      let v = 0;
      for (let bit = 0; bit < 3; bit++) v = (v << 2) | (((a >> bit) & 1) << 1) | ((y >> bit) & 1);
      out.push(v);
    }
  }
  return out;
})();

export interface DitherGrid {
  cols: number;
  rows: number;
  /** CSS px per cell */
  cell: number;
}

export interface Origin {
  /** 0–1 across the box */
  x: number;
  y: number;
}

/** The cell grid for a box (CSS px). */
export function ditherGrid(width: number, height: number): DitherGrid {
  const cell = Math.max(DITHER.cellPx, Math.ceil(width / DITHER.maxCells), Math.ceil(height / DITHER.maxCells));
  return { cols: Math.max(1, Math.ceil(width / cell)), rows: Math.max(1, Math.ceil(height / cell)), cell };
}

export const snapOrigin = (o: Origin): Origin => {
  const g = DITHER.originGrid;
  const snap = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * g) / g;
  return { x: snap(o.x), y: snap(o.y) };
};

/** The threshold of every cell, in [0, 1): 0.7 · bayer4 + 0.3 · distance-to-origin (normalized). */
export function thresholdField({ cols, rows }: Pick<DitherGrid, "cols" | "rows">, origin: Origin): Float32Array {
  const ox = origin.x * cols;
  const oy = origin.y * rows;
  const far = Math.max(Math.hypot(ox, oy), Math.hypot(cols - ox, oy), Math.hypot(ox, rows - oy), Math.hypot(cols - ox, rows - oy)) || 1;
  const field = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const bayer = (BAYER4[(y % 4) * 4 + (x % 4)] ?? 0) / 16;
      const radial = Math.min(1, Math.hypot(x + 0.5 - ox, y + 0.5 - oy) / far);
      field[y * cols + x] = DITHER.bayerWeight * bayer + DITHER.radialWeight * radial;
    }
  }
  return field;
}

/**
 * The sprite's pixels: `steps + 1` frames side by side, frame k opaque where threshold < k/steps.
 * Frame 0 hides everything, the last frame shows everything. (Pure: tests/dither.test.ts.)
 */
export function spritePixels(grid: Pick<DitherGrid, "cols" | "rows">, field: Float32Array, steps: number = DITHER.steps): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const { cols, rows } = grid;
  const width = (steps + 1) * cols;
  const data = new Uint8ClampedArray(new ArrayBuffer(width * rows * 4));
  for (let k = 0; k <= steps; k++) {
    const level = k / steps;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if ((field[y * cols + x] ?? 1) < level) data[(y * width + k * cols + x) * 4 + 3] = 255;
      }
    }
  }
  return { width, height: rows, data };
}

const cache = new Map<string, Promise<string>>();
const CACHE_MAX = 12;

/** An object URL for the sprite of this grid and origin (PNG, alpha = revealed). */
export function ditherSprite(grid: DitherGrid, origin: Origin): Promise<string> {
  const o = snapOrigin(origin);
  const key = `${grid.cols}x${grid.rows}@${o.x},${o.y}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // most recent last
    cache.set(key, hit);
    return hit;
  }
  const made = (async () => {
    const px = spritePixels(grid, thresholdField(grid, o));
    const canvas = document.createElement("canvas");
    canvas.width = px.width;
    canvas.height = px.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("sprite encode failed");
    return URL.createObjectURL(blob);
  })();
  cache.set(key, made);
  made.catch(() => cache.delete(key));
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    void cache.get(oldest)?.then((url) => URL.revokeObjectURL(url), () => undefined);
    cache.delete(oldest);
  }
  return made;
}

/** The radius (CSS px) at which a 45° dot screen of this period covers everything. */
export const halftoneFullRadius = (period: number = DITHER.halftonePeriodPx): number => period / 2 + 0.5;
