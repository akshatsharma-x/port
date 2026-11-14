/** Runs `cb` when the main thread is idle (≤ 1.5 s), or soon where requestIdleCallback is missing. Returns a cancel. */
export function whenIdle(cb: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(cb, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 200);
  return () => window.clearTimeout(id);
}
