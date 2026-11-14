/**
 * Images packed off the main thread (./pack.ts): fetch, createImageBitmap, OffscreenCanvas, one
 * transferred buffer back.
 */
import { packImages, type ImagesRequest } from "./pack";

interface WorkerScope {
  onmessage: ((e: MessageEvent<ImagesRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

scope.onmessage = (e) => {
  packImages(e.data).then(
    (pixels) => scope.postMessage({ ok: true, pixels }, [pixels.buffer]),
    (error: unknown) => scope.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
};
