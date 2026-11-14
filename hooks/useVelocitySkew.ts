"use client";

import { useEffect, type RefObject } from "react";
import { clamp } from "@/lib/damp";
import { scrollSignal } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";
import { useReducedMotion } from "./useReducedMotion";

/** VELOCITY SKEW (DESIGN.md §3.7): ≤ 3°, from the λ 6 damped signal. Media frames and marquees only — never text. */
export const SKEW = { maxDeg: 3, saturatePxPerS: 3000 } as const;

export const skewFor = (velocity: number): number => Math.round(clamp(velocity / SKEW.saturatePxPerS, -1, 1) * SKEW.maxDeg * 100) / 100;

export function useVelocitySkew<T extends HTMLElement>(ref: RefObject<T | null>, enabled = true): void {
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !enabled) return;
    let last = 0;
    const off = onTick(() => {
      const deg = skewFor(scrollSignal.velocity);
      if (deg === last) return;
      last = deg;
      el.style.transform = deg ? `skewY(${deg}deg)` : "";
    });
    return () => {
      off();
      el.style.transform = "";
    };
  }, [ref, reduced, enabled]);
}
