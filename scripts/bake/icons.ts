/**
 * icons (PROMPTS.md Part 15) → app/favicon.ico, app/apple-icon.png, public/icons/*.png: the icon set,
 * rasterized from app/icon.svg (the one drawing; Next links each by its file convention, the
 * manifest by lib/icons.ts). The ICO holds PNG images (every browser since 2008 reads them), so a
 * favicon is the same pixels as the rest. Deterministic: unchanged input, unchanged files.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ICONS } from "../../lib/icons";
import { ROOT, writeIfChanged } from "./lib";

const SOURCE = join(ROOT, "app/icon.svg");

const png = (svg: Buffer, size: number) => sharp(svg, { density: Math.ceil((72 * size) / 32) }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** An ICO of PNG images: ICONDIR, one ICONDIRENTRY each, then the PNGs. */
export function ico(images: { size: number; data: Buffer }[]): Buffer {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt8(0, e + 2);
    head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

export async function iconsStep(): Promise<string> {
  const svg = readFileSync(SOURCE);
  const favicon = ico(await Promise.all(ICONS.favicon.map(async (size) => ({ size, data: await png(svg, size) }))));
  const outs: [string, Buffer][] = [
    ["app/favicon.ico", favicon],
    ["app/apple-icon.png", await png(svg, ICONS.apple)],
    ...(await Promise.all(ICONS.manifest.map(async (i): Promise<[string, Buffer]> => [join("public", i.src), await png(svg, i.size)]))),
  ];
  let written = 0;
  for (const [path, buf] of outs) if (await writeIfChanged(join(ROOT, path), buf)) written++;
  const kb = (outs.reduce((n, [, b]) => n + b.length, 0) / 1024).toFixed(1);
  return `${outs.length} icons from app/icon.svg (favicon.ico ${ICONS.favicon.join("/")}, apple ${ICONS.apple}, manifest ${ICONS.manifest.map((i) => i.size).join("/")}) · ${kb} KB${written ? "" : " · unchanged"}`;
}
