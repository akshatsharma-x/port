"use client";

import { useRef } from "react";
import { scrollSignal } from "@/lib/scroll";

export interface ScrollVelocity {
  /** px/s, signed (positive = scrolling down), damped at λ = followers.scrollVelocity */
  velocity: number;
  /** last non-trivial direction: 1 down, -1 up */
  direction: 1 | -1;
}

/**
 * The page's scroll velocity — one signal for the whole site, computed on the scroll tick
 * (lib/scroll.ts). A ref that never re-renders; read it in a tick.
 */
export function useScrollVelocity(): { readonly current: ScrollVelocity } {
  return useRef<ScrollVelocity>(scrollSignal);
}
