import { join } from "node:path";
import sharp from "sharp";
import { hashSeed, rng } from "../../lib/motion";
import { BakeError, ROOT, writeIfChanged } from "./lib";

/**
 * foil-grain (DESIGN.md §4.4 B1, "the whole stack is masked by a 128 px diffraction-noise tile") →
 * public/textures/foil-grain.webp: what makes the foil shimmer like a grating, not clean plastic.
 * A fine grating (about 3 px pitch, at 25°), its lines wavering by a smooth phase noise, flecked
 * with speckle; as a luminance mask from `floor` to full. Tileable: the grating's wave vector is a
 * whole number of cycles across the tile, and the phase noise wraps. Deterministic: same seed,
 * same bytes. Lossy WebP, gray.
 */
export const FOIL_GRAIN = {
  size: 128,
  /** the grating: whole cycles across the tile in x and y (pitch ≈ 128 / √(38² + 18²) = 3.05 px, at 25°) */
  cycles: [38, 18] as const,
  /** the phase noise: a lattice of this many cells across, and how far it bends the lines (of a cycle) */
  wander: { cells: 8, depth: 0.55 },
  /** speckle's share of the value, and the mask's floor (the foil never drops out entirely) */
  speckle: 0.22,
  floor: 0.45,
  quality: 72,
  maxBytes: 8_000,
  seed: "foil-grain",
  file: "public/textures/foil-grain.webp",
} as const;

/** The tile's values, 0–255, row by row. */
export function foilGrainPixels(G: typeof FOIL_GRAIN = FOIL_GRAIN): Uint8Array {
  const N = G.size;
  const random = rng(hashSeed(G.seed));
  const C = G.wander.cells;
  const lattice = Float64Array.from({ length: C * C }, () => random());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const gx = (x / N) * C;
    const gy = (y / N) * C;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const at = (i: number, j: number) => lattice[(((j % C) + C) % C) * C + (((i % C) + C) % C)] ?? 0;
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
  const out = new Uint8Array(N * N);
  const [cx, cy] = G.cycles;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const phase = ((cx * x + cy * y) / N + noise(x, y) * G.wander.depth) * Math.PI * 2;
      const grating = 0.5 + 0.5 * Math.sin(phase);
      const v = grating * (1 - G.speckle) + random() * G.speckle;
      out[y * N + x] = Math.round(255 * (G.floor + (1 - G.floor) * v));
    }
  }
  return out;
}

export async function foilGrainStep(): Promise<string> {
  const G = FOIL_GRAIN;
  const webp = await sharp(Buffer.from(foilGrainPixels()), { raw: { width: G.size, height: G.size, channels: 1 } })
    .webp({ quality: G.quality, effort: 6 })
    .toBuffer();
  if (webp.length > G.maxBytes) throw new BakeError(`foil-grain: ${(webp.length / 1000).toFixed(1)} KB, over its ${G.maxBytes / 1000} (DESIGN.md §4.4 B1: ≈ 6 KB)`);
  const changed = await writeIfChanged(join(ROOT, G.file), webp);
  return `${G.size}² gray WebP ${(webp.length / 1000).toFixed(1)} KB${changed ? "" : " · unchanged"}`;
}

if (process.argv[1]?.endsWith("foil-grain.ts")) void foilGrainStep().then((s) => console.log(`foil-grain: ${s}`));
