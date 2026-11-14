import type Lenis from "lenis";

/** Holds the live Lenis instance (null under reduced motion, where native scroll is used). */
let instance: Lenis | null = null;
const listeners = new Set<() => void>();

export const getLenis = (): Lenis | null => instance;

export function setLenis(next: Lenis | null): void {
  instance = next;
  for (const l of listeners) l();
}

export function subscribeLenis(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
