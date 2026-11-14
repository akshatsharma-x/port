import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, writeIfChanged } from "./lib";

/**
 * The hero globe's land mask (DESIGN.md §4.3 A1: "a 4 KB land mask") — a one-off bake, not a step
 * of every build: the output is kept in the tree, and this regenerates it from its source.
 *
 *   npx tsx scripts/bake/landmask.ts <path to ne_110m_land.geojson>
 *
 * Source: Natural Earth 1:110m land polygons (public domain, naturalearthdata.com), e.g.
 * https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
 * The file is read as data only (JSON.parse) from wherever it was downloaded.
 *
 * Output: public/data/land-256x128.bin — 256 × 128 cells, equirectangular (1.40625° per cell),
 * one bit per cell (1 = land), rows north → south, columns west → east from 180° W, MSB first.
 * 4,096 bytes. A cell is land when at least half of its 4 × 4 samples are.
 */
export const LANDMASK = { width: 256, height: 128, samples: 4, file: "public/data/land-256x128.bin" } as const;

type Ring = readonly (readonly [number, number])[];
type Polygon = readonly Ring[];

interface GeoJson {
  type: string;
  features: { geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } }[];
}

function polygonsOf(json: GeoJson): Polygon[] {
  const out: Polygon[] = [];
  for (const f of json.features) {
    const g = f.geometry;
    if (g.type === "Polygon") out.push(g.coordinates as Polygon);
    else if (g.type === "MultiPolygon") out.push(...(g.coordinates as Polygon[]));
  }
  return out;
}

/** Even-odd ray cast over every ring of the polygon (holes included), in lon/lat space. */
function inside(poly: Polygon, lon: number, lat: number): boolean {
  let hit = false;
  for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as readonly [number, number];
      const [xj, yj] = ring[j] as readonly [number, number];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

export function rasterize(polys: readonly Polygon[]): Uint8Array {
  const { width: W, height: H, samples: S } = LANDMASK;
  const bounds = polys.map((p) => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y] of p[0] ?? []) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  });
  const bits = new Uint8Array((W * H) / 8);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let land = 0;
      for (let sy = 0; sy < S; sy++) {
        const lat = 90 - ((j + (sy + 0.5) / S) * 180) / H;
        for (let sx = 0; sx < S; sx++) {
          const lon = -180 + ((i + (sx + 0.5) / S) * 360) / W;
          for (let k = 0; k < polys.length; k++) {
            const b = bounds[k];
            if (!b || lon < b.x0 || lon > b.x1 || lat < b.y0 || lat > b.y1) continue;
            if (inside(polys[k] as Polygon, lon, lat)) {
              land++;
              break;
            }
          }
        }
      }
      if (land * 2 >= S * S) {
        const n = j * W + i;
        bits[n >> 3] = (bits[n >> 3] ?? 0) | (0x80 >> (n & 7));
      }
    }
  }
  return bits;
}

/** Share of the Earth's surface that's land in the mask (cells weighted by cos latitude). */
export function landFraction(bits: Uint8Array): number {
  const { width: W, height: H } = LANDMASK;
  let land = 0;
  let total = 0;
  for (let j = 0; j < H; j++) {
    const w = Math.cos((((j + 0.5) / H) * 180 - 90) * (Math.PI / 180));
    for (let i = 0; i < W; i++) {
      const n = j * W + i;
      total += w;
      if ((bits[n >> 3] ?? 0) & (0x80 >> (n & 7))) land += w;
    }
  }
  return land / total;
}

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error("usage: npx tsx scripts/bake/landmask.ts <ne_110m_land.geojson>");
  const json = JSON.parse(await readFile(source, "utf8")) as GeoJson;
  if (json.type !== "FeatureCollection" || !Array.isArray(json.features)) throw new Error("not a GeoJSON FeatureCollection");
  const polys = polygonsOf(json);
  const bits = rasterize(polys);
  const changed = await writeIfChanged(join(ROOT, LANDMASK.file), Buffer.from(bits));
  console.log(`landmask: ${polys.length} polygons → ${LANDMASK.width}×${LANDMASK.height} · ${bits.byteLength} B · land ${(landFraction(bits) * 100).toFixed(1)}% of the surface${changed ? "" : " · unchanged"}`);
}

if (process.argv[1]?.endsWith("landmask.ts")) void main();
