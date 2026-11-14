import { BAYER8 } from "./dither";
import { duration, identity } from "./motion";

/**
 * 02 · IDENTITY (DESIGN.md §7.4): the portrait's dot-matrix — an ordered (Bayer) dither at 180 ×
 * 225 cells over the real photo, with an exposure lamp that develops it where it shines.
 * Pure functions on flat buffers, so the component only wires pointer, ticker and canvas.
 */
export const PORTRAIT = {
  cols: 180,
  rows: 225,
  /** exposure at rest: an underexposed print the lamp develops */
  rest: 0.3,
  /** the reduced-motion edition: a static half exposure */
  reduced: 0.5,
  /** the lamp's soft edge, as a share of its radius */
  lampEdge: 0.35,
  /**
   * Luma at or below this is ground: no ink. Without it a dark background's faint luma clears the
   * lowest Bayer thresholds and prints a regular grid of dots, one cell in 64.
   */
  blackPoint: 0.1,
} as const;

export interface Lamp {
  /** cell coordinates (0–cols, 0–rows) */
  x: number;
  y: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * One frame of exposure (dt in ms): everything fades toward rest with τ, and under the lamp it
 * develops toward full over duration.micro.in. Returns whether anything is still above rest — the
 * caller stops its loop when it isn't (it only computes while you interact or the exposure decays).
 */
export function stepExposure(E: Float32Array, dtMs: number, lamp: Lamp | null, rest: number = PORTRAIT.rest): boolean {
  const { cols, rows } = PORTRAIT;
  const fade = Math.exp(-dtMs / identity.lampTauMs);
  let moving = false;
  for (let i = 0; i < E.length; i++) {
    const e = rest + ((E[i] ?? rest) - rest) * fade;
    E[i] = e;
    if (e - rest > 1e-3) moving = true;
  }
  if (!lamp) return moving;
  const develop = 1 - Math.exp(-dtMs / duration.micro.in);
  const r = identity.lampRadius * cols;
  const inner = r * (1 - PORTRAIT.lampEdge);
  const x0 = Math.max(0, Math.floor(lamp.x - r));
  const x1 = Math.min(cols - 1, Math.ceil(lamp.x + r));
  const y0 = Math.max(0, Math.floor(lamp.y - r));
  const y1 = Math.min(rows - 1, Math.ceil(lamp.y + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - lamp.x, y + 0.5 - lamp.y);
      if (d >= r) continue;
      const lit = rest + (1 - rest) * (d <= inner ? 1 : 1 - smooth((d - inner) / (r - inner)));
      const i = y * cols + x;
      const e = E[i] ?? rest;
      if (lit > e) E[i] = e + (lit - e) * develop;
    }
  }
  return true;
}

/** The dot-matrix: a cell is ink when its luma × exposure clears its Bayer threshold. RGBA out. */
export function ditherInto(out: Uint8ClampedArray, luma: Uint8Array, E: Float32Array, rgb: readonly [number, number, number]): number {
  const { cols, rows } = PORTRAIT;
  let ink = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const v = Math.max(0, ((luma[i] ?? 0) / 255 - PORTRAIT.blackPoint) / (1 - PORTRAIT.blackPoint)) * (E[i] ?? 0);
      const on = v > ((BAYER8[(y & 7) * 8 + (x & 7)] ?? 0) + 0.5) / 64;
      const o = i * 4;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = on ? 255 : 0;
      if (on) ink++;
    }
  }
  return ink;
}
