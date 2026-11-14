"use client";

import { useEffect, useRef } from "react";
import { clamp } from "@/lib/damp";
import { springs } from "@/lib/motion";
import { onPointerMove, pointer, retainPointer } from "@/lib/pointer";
import { Spring } from "@/lib/spring";
import { onTick } from "@/lib/ticker";
import { useBreakpoint } from "./useBreakpoint";
import { useReducedMotion } from "./useReducedMotion";

/** Pull zone: 1.4× the element (DESIGN.md §3.7) → 20 % of its size on every side. */
const INFLATE = 0.2;
const MAX_PX = 6;

/**
 * Magnetic pull toward the pointer on spring `magnetic`, ≤ 6 px. Writes --mag-x / --mag-y on the
 * element (styles/primitives.css moves the button by it and its label by 1.5×). Off for coarse
 * pointers and in the reduced-motion edition. The spring only ticks while it is moving.
 */
export function useMagnetic<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const reduced = useReducedMotion();
  const { coarse } = useBreakpoint();
  const active = enabled && !reduced && !coarse;

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const sx = new Spring(springs.magnetic);
    const sy = new Spring(springs.magnetic);
    let rect = el.getBoundingClientRect();
    let stopTick: (() => void) | null = null;

    const write = () => {
      el.style.setProperty("--mag-x", `${sx.value.toFixed(3)}px`);
      el.style.setProperty("--mag-y", `${sy.value.toFixed(3)}px`);
    };

    const ensureTicking = () => {
      if (stopTick) return;
      stopTick = onTick((dt) => {
        sx.step(dt);
        sy.step(dt);
        write();
        if (sx.target === 0 && sy.target === 0 && sx.isSettled(0.01) && sy.isSettled(0.01)) {
          stopTick?.();
          stopTick = null;
          el.style.removeProperty("--mag-x");
          el.style.removeProperty("--mag-y");
        }
      });
    };

    const update = () => {
      const w = rect.width * (0.5 + INFLATE);
      const h = rect.height * (0.5 + INFLATE);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = pointer.x - cx;
      const dy = pointer.y - cy;
      const inside = pointer.active && Math.abs(dx) <= w && Math.abs(dy) <= h;
      const tx = inside ? clamp(dx / w, -1, 1) * MAX_PX : 0;
      const ty = inside ? clamp(dy / h, -1, 1) * MAX_PX : 0;
      if (tx === sx.target && ty === sy.target) return;
      sx.setTarget(tx);
      sy.setTarget(ty);
      ensureTicking();
    };

    const refresh = () => {
      rect = el.getBoundingClientRect();
    };

    const release = retainPointer();
    const offMove = onPointerMove(update);
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);

    return () => {
      offMove();
      release();
      ro.disconnect();
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      stopTick?.();
      el.style.removeProperty("--mag-x");
      el.style.removeProperty("--mag-y");
    };
  }, [active]);

  return ref;
}
