import { deflateSync, inflateSync } from "node:zlib";

/**
 * A minimal, deterministic 1-bit PNG encoder (no dependencies): indexed color, two palette
 * entries, index 0 fully transparent — so the file is a pure alpha mask that CSS `mask` colorizes
 * with any token (DESIGN.md §8.2 posters: theme-agnostic, colorized through a CSS mask).
 */
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** `ink(x, y)` true = opaque. Rows are packed MSB-first with filter type 0. */
export function encodeMaskPng(width: number, height: number, ink: (x: number, y: number) => boolean): Buffer {
  const stride = Math.ceil(width / 8);
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    for (let x = 0; x < width; x++) {
      if (ink(x, y)) raw[row + 1 + (x >> 3)] = (raw[row + 1 + (x >> 3)] ?? 0) | (0x80 >> (x & 7));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 3; // indexed color
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("PLTE", Uint8Array.from([0, 0, 0, 255, 255, 255])),
    chunk("tRNS", Uint8Array.from([0, 255])), // index 0 transparent, index 1 opaque
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** 8-bit grayscale PNG — data textures (the blue-noise dither), lossless by construction. */
export function encodeGrayPng(width: number, height: number, gray: (x: number, y: number) => number): Buffer {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width + 1);
    for (let x = 0; x < width; x++) raw[row + 1 + x] = gray(x, y);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))]);
}

/** Truecolor (8-bit RGB) PNG — for dev fixtures only; the site's own rasters are 1-bit masks. */
export function encodeRgbPng(width: number, height: number, rgb: (x: number, y: number) => readonly [number, number, number]): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgb(x, y);
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))]);
}

/** The 8×8 Bayer threshold matrix, normalized to (0, 1). */
export const BAYER8: readonly number[] = (() => {
  const m = [0];
  let size = 1;
  let cur = m;
  while (size < 8) {
    const next = new Array<number>(size * 2 * size * 2);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = (cur[y * size + x] ?? 0) * 4;
        next[y * 2 * size + x] = v;
        next[y * 2 * size + x + size] = v + 2;
        next[(y + size) * 2 * size + x] = v + 3;
        next[(y + size) * 2 * size + x + size] = v + 1;
      }
    }
    cur = next;
    size *= 2;
  }
  return cur.map((v) => (v + 0.5) / 64);
})();

/**
 * Decodes an 8-bit, non-interlaced grayscale / RGB / RGBA PNG (what Playwright's screenshots are)
 * into its pixels — the posters script reads captured frames with it.
 */
export function decodePng(png: Uint8Array): { width: number; height: number; channels: number; data: Uint8Array } {
  const buf = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  if (buf.subarray(0, 8).compare(SIGNATURE) !== 0) throw new Error("not a PNG");
  let i = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString("ascii");
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      const colorType = data[9] ?? -1;
      const interlace = data[12];
      if (depth !== 8 || interlace !== 0) throw new Error("only 8-bit, non-interlaced PNGs");
      channels = ({ 0: 1, 2: 3, 6: 4 } as Record<number, number>)[colorType] ?? 0;
      if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
    } else if (type === "IDAT") idat.push(data);
    i += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)] ?? 0;
    const line = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? (out[y * stride + x - channels] ?? 0) : 0;
      const b = y > 0 ? (out[(y - 1) * stride + x] ?? 0) : 0;
      const c = x >= channels && y > 0 ? (out[(y - 1) * stride + x - channels] ?? 0) : 0;
      const v = raw[line + x] ?? 0;
      let p = 0;
      if (f === 1) p = a;
      else if (f === 2) p = b;
      else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = (v + p) & 255;
    }
  }
  return { width, height, channels, data: out };
}
