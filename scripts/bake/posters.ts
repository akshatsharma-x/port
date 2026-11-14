import { join } from "node:path";
import { POSTER_CAPTURES, POSTER_DRAWINGS } from "../../components/stage/posters";
import { hashSeed, rng } from "../../lib/motion";
import { SCENE_IDS, type SceneId } from "../../lib/tier";
import { ROOT, writeIfChanged } from "./lib";
import { BAYER8, encodeMaskPng, encodeRgbPng } from "./png";

/**
 * posters (DESIGN.md §8.2) → public/posters/<scene>.png: what a slot shows until its scene is LIVE
 * (gap protection, context loss, tier OFF, no JS). 1-bit ordered dither, theme-agnostic, tinted by
 * a CSS mask.
 *
 * Registered scenes (components/stage/posters.ts) are captured from the live scene by
 * scripts/posters.ts and kept in the tree; this draws placeholder fields for the rest, until their
 * parts register them — and never overwrites a captured poster.
 */
export const POSTER_SIZE = { width: 640, height: 360 } as const;
/**
 * Captured scenes also get a portrait poster (phones): the scene fits a portrait frame differently.
 * 9:19.5, the phones' own aspect: the slot covers it, so on a phone it scales by width, as the
 * scene's width-limited subject does. A 9:16 frame scaled by height instead, and its subject came
 * out 22% larger than the live one, cut at both edges (measured at 390 × 844).
 */
export const POSTER_SIZE_PORTRAIT = { width: 360, height: 780 } as const;
/**
 * …and a tablet poster, 3:4, for portrait screens wider than 3:5. The phone-shaped one scaled by
 * width there too, and its subject sat 110 px above the live one, cut at the top (768 × 1024).
 */
export const POSTER_SIZE_TABLET = { width: 480, height: 640 } as const;

type Field = (u: number, v: number) => number;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const box = (u: number, v: number, cx: number, cy: number, hw: number, hh: number, edge: number, fill: number) => {
  const dx = Math.abs(u - cx) - hw;
  const dy = Math.abs(v - cy) - hh;
  if (dx > 0 || dy > 0) return 0;
  return dx > -edge || dy > -edge ? 1 : fill;
};

function field(id: SceneId): Field {
  const A = POSTER_SIZE.width / POSTER_SIZE.height;
  switch (id) {
    case "system": // a phosphor orb with a ring
      return (u, v) => {
        const d = Math.hypot((u - 0.5) * A, v - 0.5);
        return clamp01(Math.exp(-d * d * 9) * 0.85 + Math.exp(-(((d - 0.34) / 0.012) ** 2)) * 0.9);
      };
    case "log": // cards receding along a rail
      return (u, v) => {
        let f = 0;
        for (let i = 0; i < 7; i++) {
          const s = 0.8 ** i;
          f = Math.max(f, box(u, v, 0.32 + 0.085 * i * (2 - s), 0.5, 0.17 * s, 0.075 * s * A, 0.004, 0.22 * s + 0.08));
        }
        return f;
      };
    case "archive": {
      // a star chart
      const random = rng(hashSeed("poster:archive"));
      const stars = Array.from({ length: 90 }, () => ({ u: random(), v: random(), s: 0.002 + random() ** 3 * 0.012 }));
      return (u, v) => {
        let f = 0;
        for (const st of stars) f += Math.exp(-(((u - st.u) * A) ** 2 + (v - st.v) ** 2) / (st.s * st.s));
        return clamp01(f);
      };
    }
    case "work": // slides on a concave arc
      return (u, v) => {
        let f = 0;
        for (let i = -2; i <= 2; i++) {
          const a = i * 0.36;
          const scale = 0.55 + 0.45 * Math.cos(a);
          f = Math.max(f, box(u, v, 0.5 + Math.sin(a) * 0.4, 0.5, 0.075 * scale, 0.12 * scale * A * 0.6, 0.003, i === 0 ? 0.55 : 0.25));
        }
        return f;
      };
    case "capabilities": // a bed of keycaps
      return (u, v) => {
        const cols = 9;
        const rows = 4;
        const gx = 0.075;
        const gy = gx * A;
        const x0 = 0.5 - ((cols - 1) * gx) / 2;
        const y0 = 0.5 - ((rows - 1) * gy) / 2;
        let f = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const primary = (r * cols + c) % 7 === 3;
            f = Math.max(f, box(u, v, x0 + c * gx, y0 + r * gy, gx * 0.4, gy * 0.4, 0.003, primary ? 0.75 : 0.28));
          }
        }
        return f;
      };
  }
}

export function renderPoster(id: SceneId): Buffer {
  const { width, height } = POSTER_SIZE;
  const f = field(id);
  return encodeMaskPng(width, height, (x, y) => f((x + 0.5) / width, (y + 0.5) / height) > (BAYER8[(y % 8) * 8 + (x % 8)] ?? 0.5));
}

/**
 * DEV FIXTURE: a color test card for <DitherImage> on /dev/kitchen-sink (public/fixtures/, generated,
 * never shipped as content). Color bars over a luma ramp, a zone plate and a grid: fine detail, so
 * a resolve that loses cells or softens edges is visible.
 */
export const TEST_CARD = { width: 960, height: 540 } as const;
const BARS: readonly (readonly [number, number, number])[] = [
  [192, 192, 192],
  [192, 192, 0],
  [0, 192, 192],
  [0, 192, 0],
  [192, 0, 192],
  [192, 0, 0],
  [0, 0, 192],
];

export function renderTestCard(): Buffer {
  const { width, height } = TEST_CARD;
  return encodeRgbPng(width, height, (x, y) => {
    const u = x / width;
    const v = y / height;
    const cx = x - width * 0.75;
    const cy = y - height * 0.6;
    if (Math.hypot(cx, cy) < height * 0.28) {
      const z = Math.round(127.5 + 127.5 * Math.cos((cx * cx + cy * cy) / 260)); // zone plate
      return [z, z, z];
    }
    if (x % 60 === 0 || y % 60 === 0) return [235, 235, 235]; // the grid
    if (v < 0.55) return BARS[Math.min(BARS.length - 1, Math.floor(u * BARS.length))] ?? [0, 0, 0];
    if (v < 0.7) {
      const l = Math.round(u * 255); // luma ramp
      return [l, l, l];
    }
    return [Math.round(u * 255), Math.round((1 - u) * 160), Math.round(v * 255)];
  });
}

export async function postersStep(): Promise<string> {
  let bytes = 0;
  let changed = 0;
  const placeholders = SCENE_IDS.filter((id) => !POSTER_CAPTURES[id] && !POSTER_DRAWINGS[id]);
  for (const id of placeholders) {
    const png = renderPoster(id);
    bytes += png.byteLength;
    if (await writeIfChanged(join(ROOT, "public/posters", `${id}.png`), png)) changed++;
  }
  await writeIfChanged(join(ROOT, "public/fixtures", "test-card.png"), renderTestCard());
  const captured = SCENE_IDS.length - placeholders.length;
  return `${placeholders.length} placeholder posters (${POSTER_SIZE.width}×${POSTER_SIZE.height}, 1-bit) · ${(bytes / 1024).toFixed(1)} KB${changed ? "" : " · unchanged"} · ${captured} captured (scripts/posters.ts)`;
}
