/**
 * portrait (DESIGN.md §7.4 IDENTITY) → public/media/profile/portrait.png: the About portrait's
 * source, 180 × 225 8-bit grayscale — one pixel per dot-matrix cell (lib/identity.ts).
 *
 * From the owner's photo when there is one (public/media/profile/photo.{jpg,jpeg,png,webp,avif}):
 * turned upright by its EXIF orientation, cropped to 4:5 around the most salient region, grayscaled
 * and contrast-normalized. The dither wants a head and shoulders, so frame the photo that way (the
 * owner's is cut from a full-length shot, at 960 × 1200). Until then,
 * a placeholder — a soft-lit head-and-shoulders silhouette that reads as one in the dither and
 * says what it is in its alt text (content/data.ts).
 *
 *   npx tsx scripts/bake/portrait.ts      (scripts/bake.ts runs it too)
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PORTRAIT } from "../../lib/identity";
import { ROOT, writeIfChanged } from "./lib";
import { encodeGrayPng } from "./png";

export const PORTRAIT_OUT = "public/media/profile/portrait.png";
const PHOTO = ["jpg", "jpeg", "png", "webp", "avif"].map((ext) => `public/media/profile/photo.${ext}`);
/** supersampling for the placeholder's edges */
const SS = 4;

/** The placeholder's luma at a point (u across, v down, both 0–1): a lit head and shoulders. */
export function placeholderLuma(u: number, v: number): number {
  const A = PORTRAIT.rows / PORTRAIT.cols; // work in units of the width
  const x = u - 0.5;
  const y = v * A;
  const light = [-0.55, -0.62, 0.56] as const;
  const shade = (nx: number, ny: number) => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lambert = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
    // a rim on the shadow side, as from a window behind
    const rim = Math.max(0, nx) * Math.pow(1 - nz, 3) * 0.45;
    return 0.12 + 0.78 * lambert + rim;
  };
  // the head: an ellipsoid
  const hx = x / 0.2;
  const hy = (y - 0.43) / 0.255;
  if (hx * hx + hy * hy < 1) return shade(hx * 0.9, hy * 0.9);
  // the neck: a short cylinder, in the head's shadow
  if (Math.abs(x) < 0.085 && y > 0.6 && y < 0.78) return shade(x / 0.085, 0.15) * 0.55;
  // the shoulders: a wide ellipsoid rising from the bottom edge
  const sx = x / 0.47;
  const sy = (y - A - 0.06) / 0.4;
  if (sx * sx + sy * sy < 1) return shade(sx * 0.95, sy * 0.6) * 0.85;
  // the ground: dark, a little lighter behind the head
  const glow = Math.exp(-((x + 0.08) ** 2 + (y - 0.4) ** 2) / 0.09);
  return 0.04 + 0.1 * glow;
}

/** Renders the placeholder (supersampled) as 8-bit grayscale. */
export function placeholderPortrait(): Buffer {
  const { cols: W, rows: H } = PORTRAIT;
  return encodeGrayPng(W, H, (px, py) => {
    let sum = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) sum += placeholderLuma((px + (i + 0.5) / SS) / W, (py + (j + 0.5) / SS) / H);
    return Math.round(Math.min(1, Math.max(0, sum / (SS * SS))) * 255);
  });
}

export async function portraitStep(): Promise<string> {
  const photo = PHOTO.find((p) => existsSync(join(ROOT, p)));
  const png = photo
    ? await sharp(join(ROOT, photo))
        // upright first: a phone stores its pixels sideways and an EXIF Orientation to turn them by
        .rotate()
        .resize(PORTRAIT.cols, PORTRAIT.rows, { fit: "cover", position: sharp.strategy.attention })
        .grayscale()
        .normalise()
        .png({ compressionLevel: 9 })
        .toBuffer()
    : placeholderPortrait();
  const changed = await writeIfChanged(join(ROOT, PORTRAIT_OUT), png);
  return `${PORTRAIT.cols}×${PORTRAIT.rows} gray · ${photo ? `from ${photo.split("/").pop()}` : "placeholder (no public/media/profile/photo.*)"} · ${png.length} B${changed ? "" : " · unchanged"}`;
}

if (process.argv[1]?.endsWith("portrait.ts")) void portraitStep().then((s) => console.log(`portrait: ${s}`));
