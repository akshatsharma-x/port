import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { SCENE_IDS } from "@/lib/tier";
import { BAYER8, crc32, encodeMaskPng } from "../scripts/bake/png";
import { POSTER_SIZE, renderPoster } from "../scripts/bake/posters";

/** Placeholder posters (DESIGN.md §8.2): valid 1-bit alpha-mask PNGs, deterministic, small. */
function chunks(png: Buffer) {
  const out: { type: string; data: Buffer; crcOk: boolean }[] = [];
  let i = 8;
  while (i < png.length) {
    const len = png.readUInt32BE(i);
    const type = png.subarray(i + 4, i + 8).toString("ascii");
    const data = png.subarray(i + 8, i + 8 + len);
    const crc = png.readUInt32BE(i + 8 + len);
    out.push({ type, data, crcOk: crc === crc32(png.subarray(i + 4, i + 8 + len)) });
    i += 12 + len;
  }
  return out;
}

describe("posters", () => {
  it("are 1-bit indexed PNGs whose index 0 is transparent (a pure alpha mask)", () => {
    const png = renderPoster("system");
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const c = chunks(png);
    expect(c.map((x) => x.type)).toEqual(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
    expect(c.every((x) => x.crcOk)).toBe(true);
    const ihdr = c[0]?.data as Buffer;
    expect([ihdr.readUInt32BE(0), ihdr.readUInt32BE(4), ihdr[8], ihdr[9]]).toEqual([POSTER_SIZE.width, POSTER_SIZE.height, 1, 3]);
    expect([...(c[2]?.data ?? [])]).toEqual([0, 255]);
  });

  it("decode to the drawn pixels", () => {
    const png = encodeMaskPng(10, 2, (x, y) => (x + y) % 3 === 0);
    const raw = inflateSync(chunks(png).find((x) => x.type === "IDAT")?.data as Buffer);
    expect(raw.length).toBe((Math.ceil(10 / 8) + 1) * 2);
    const bit = (x: number, y: number) => ((raw[y * 3 + 1 + (x >> 3)] ?? 0) >> (7 - (x & 7))) & 1;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 10; x++) expect(bit(x, y)).toBe((x + y) % 3 === 0 ? 1 : 0);
  });

  it("are deterministic, distinct per scene, and small", () => {
    const all = SCENE_IDS.map((id) => renderPoster(id));
    expect(SCENE_IDS.map((id) => renderPoster(id).equals(all[SCENE_IDS.indexOf(id)] as Buffer))).toEqual(SCENE_IDS.map(() => true));
    expect(new Set(all.map((b) => b.toString("base64"))).size).toBe(SCENE_IDS.length);
    expect(all.reduce((n, b) => n + b.length, 0)).toBeLessThan(40 * 1024);
  });

  it("dither with a true 8×8 Bayer matrix", () => {
    expect(BAYER8).toHaveLength(64);
    expect(new Set(BAYER8.map((v) => Math.round(v * 64 - 0.5))).size).toBe(64);
    expect(BAYER8.slice(0, 4).map((v) => Math.round(v * 64 - 0.5))).toEqual([0, 32, 8, 40]);
  });
});
