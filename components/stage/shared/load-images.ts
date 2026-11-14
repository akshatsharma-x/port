import { packImages, type ImagesRequest } from "./pack";

/**
 * Packs images for a texture (./pack.ts) in a module worker where the browser has OffscreenCanvas
 * there, so the main thread never decodes or reads a pixel; on the main thread otherwise.
 */
export function loadImages(req: ImagesRequest): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return packImages(req);
  return new Promise((resolve, reject) => {
    let w: Worker;
    try {
      w = new Worker(new URL("./pack.worker.ts", import.meta.url), { type: "module" });
    } catch {
      packImages(req).then(resolve, reject);
      return;
    }
    w.onmessage = (e: MessageEvent<{ ok: true; pixels: Uint8Array<ArrayBuffer> } | { ok: false; error: string }>) => {
      w.terminate();
      if (e.data.ok) resolve(e.data.pixels);
      else packImages(req).then(resolve, reject); // e.g. no AVIF decode in this worker: try here
    };
    w.onerror = () => {
      w.terminate();
      packImages(req).then(resolve, reject);
    };
    w.postMessage(req);
  });
}
