import { gsap } from "gsap";
import { MAX_DT } from "./spring";

/**
 * The one frame loop (DESIGN.md §4.1): every per-frame callback in the app runs on gsap.ticker,
 * which also drives Lenis and (from Part 3) R3F's advance(). No other requestAnimationFrame loops.
 */
export type TickHandler = (dt: number, time: number) => void;

export function onTick(handler: TickHandler, options: { first?: boolean } = {}): () => void {
  const callback = (time: number, deltaTimeMs: number) => handler(Math.min(deltaTimeMs / 1000, MAX_DT), time);
  gsap.ticker.add(callback, false, options.first ?? false);
  return () => gsap.ticker.remove(callback);
}
