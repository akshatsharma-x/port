import { join } from "node:path";
import { rng } from "../../lib/motion";
import { ROOT, writeIfChanged } from "./lib";
import { encodeGrayPng } from "./png";

/**
 * bluenoise (DESIGN.md §5.2 "output dither: ±1 LSB blue noise") → public/textures/bluenoise-64.png:
 * a 64 × 64 tileable blue-noise threshold map, made by void-and-cluster (Ulichney 1993) with a
 * toroidal Gaussian (σ 1.5). Every value 0–255 appears 16 times. Deterministic: same seed, same
 * bytes. The stage's RetroEffect adds it, centered, as the last ±1 LSB before the 8-bit output.
 */
export const BLUE_NOISE = { size: 64, sigma: 1.5, seed: 0x5eed, initialShare: 0.1, file: "public/textures/bluenoise-64.png" } as const;

/** Ranks 0…N−1 per pixel (N = size²): the order in which void-and-cluster fills the tile. */
export function voidAndCluster(size: number, sigma: number, seed: number, initialShare: number): Uint16Array {
  const N = size * size;
  const kernel = new Float64Array(N);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - x);
      const dy = Math.min(y, size - y);
      kernel[y * size + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  const energy = new Float64Array(N);
  const bits = new Uint8Array(N);
  const splat = (i: number, sign: 1 | -1) => {
    const ix = i % size;
    const iy = (i - ix) / size;
    for (let y = 0; y < size; y++) {
      const krow = ((y - iy + size) % size) * size;
      const row = y * size;
      for (let x = 0; x < size; x++) energy[row + x] = (energy[row + x] ?? 0) + sign * (kernel[krow + ((x - ix + size) % size)] ?? 0);
    }
  };
  const tightestCluster = () => {
    let best = -1;
    let e = -Infinity;
    for (let i = 0; i < N; i++) if (bits[i] && (energy[i] ?? 0) > e) [e, best] = [energy[i] ?? 0, i];
    return best;
  };
  const largestVoid = () => {
    let best = -1;
    let e = Infinity;
    for (let i = 0; i < N; i++) if (!bits[i] && (energy[i] ?? 0) < e) [e, best] = [energy[i] ?? 0, i];
    return best;
  };

  // the initial binary pattern, then relaxed until the tightest cluster is the largest void
  const random = rng(seed);
  const initial = Math.round(N * initialShare);
  for (let placed = 0; placed < initial; ) {
    const i = Math.floor(random() * N);
    if (bits[i]) continue;
    bits[i] = 1;
    splat(i, 1);
    placed++;
  }
  for (;;) {
    const c = tightestCluster();
    bits[c] = 0;
    splat(c, -1);
    const v = largestVoid();
    bits[v] = 1;
    splat(v, 1);
    if (v === c) break;
  }
  const prototype = bits.slice();
  const prototypeEnergy = energy.slice();
  const rank = new Uint16Array(N);
  // phase 1: rank the prototype's minority pixels, tightest cluster first (highest ranks)
  for (let ones = initial; ones > 0; ) {
    const c = tightestCluster();
    bits[c] = 0;
    splat(c, -1);
    rank[c] = --ones;
  }
  // phases 2–3: from the prototype, fill the largest void each time (the tightest cluster of the
  // zeros is the largest void of the ones, so one loop covers both halves)
  bits.set(prototype);
  energy.set(prototypeEnergy);
  for (let ones = initial; ones < N; ones++) {
    const v = largestVoid();
    bits[v] = 1;
    splat(v, 1);
    rank[v] = ones;
  }
  return rank;
}

export async function blueNoiseStep(): Promise<string> {
  const { size, sigma, seed, initialShare, file } = BLUE_NOISE;
  const rank = voidAndCluster(size, sigma, seed, initialShare);
  const N = size * size;
  const png = encodeGrayPng(size, size, (x, y) => Math.floor(((rank[y * size + x] ?? 0) * 256) / N));
  const changed = await writeIfChanged(join(ROOT, file), png);
  return `${size}×${size} void-and-cluster · ${png.byteLength} B${changed ? "" : " · unchanged"}`;
}
