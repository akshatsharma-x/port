/**
 * Images packed for the GPU (DESIGN.md §4.3 A4, A5): one buffer holding every image at one size, a
 * layer each, rows top to bottom (the shaders flip v) — RGBA8, or one byte a pixel from a channel
 * (A5's legend atlas is coverage only). Decoded with createImageBitmap and read through an
 * OffscreenCanvas, in whichever thread runs it. No worker here: the worker imports this, and
 * ./load-images.ts makes the worker (a worker importing its own spawner hung the build, Part 9).
 */
export interface ImagesRequest {
  urls: string[];
  width: number;
  height: number;
  /** "a": the alpha channel only, a byte a pixel */
  channel?: "rgba" | "a";
}

export async function packImages({ urls, width, height, channel = "rgba" }: ImagesRequest): Promise<Uint8Array<ArrayBuffer>> {
  const bpp = channel === "a" ? 1 : 4;
  const layer = width * height * bpp;
  const out = new Uint8Array(new ArrayBuffer(layer * urls.length));
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("pack: no 2D context");
  const bitmaps = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`pack: ${url} → HTTP ${res.status}`);
      return createImageBitmap(await res.blob(), { resizeWidth: width, resizeHeight: height, resizeQuality: "high", colorSpaceConversion: "none", premultiplyAlpha: "none" });
    }),
  );
  bitmaps.forEach((bmp, k) => {
    g.clearRect(0, 0, width, height);
    g.drawImage(bmp, 0, 0, width, height);
    bmp.close();
    const px = g.getImageData(0, 0, width, height).data;
    if (bpp === 4) out.set(px, k * layer);
    else for (let i = 0, o = k * layer; i < width * height; i++) out[o + i] = px[i * 4 + 3] ?? 0;
  });
  return out;
}
