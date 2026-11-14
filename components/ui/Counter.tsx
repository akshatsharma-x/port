"use client";

import { useEffect, useMemo, useRef } from "react";
import { bootStore } from "@/lib/boot";
import { cx } from "@/lib/cx";
import { artifact, bezier, duration, ease } from "@/lib/motion";
import { onTick } from "@/lib/ticker";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface CounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /**
   * "view" (default): counts up when it scrolls into view. "boot": on screen from the start (the
   * hero), so it counts up on the first boot only, from the frame the beam opens (§7.4); otherwise
   * it shows its value.
   */
  trigger?: "view" | "boot";
}

const settle = bezier(ease.settle);

/**
 * Counts up when 50 % visible: scene tier (900 ms) on `settle`, digits stepped at 30 fps (digits
 * are artifacts), mono. The final value is in the SSR HTML; width is reserved in ch so counting
 * never shifts layout; screen readers get the final value only. Counters already on screen at
 * load stay put (no count-down flash).
 */
export function Counter({ value, decimals = 0, prefix = "", suffix = "", className, trigger = "view" }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const format = useMemo(() => {
    const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return (n: number) => nf.format(n);
  }, [decimals]);
  const final = format(value);

  useEffect(() => {
    const root = ref.current;
    const digits = root?.querySelector<HTMLElement>("[data-digits]");
    if (!root || !digits || reduced) return;

    let stop: (() => void) | null = null;
    const run = () => {
      let elapsed = 0;
      let lastFrame = -1;
      const frameMs = 1000 / artifact.fps;
      stop = onTick((dt) => {
        elapsed += dt * 1000;
        const t = Math.min(1, elapsed / duration.scene.in);
        const frame = Math.floor(elapsed / frameMs);
        if (frame !== lastFrame || t === 1) {
          lastFrame = frame;
          digits.textContent = t === 1 ? format(value) : format(value * settle(t));
        }
        if (t === 1) {
          stop?.();
          stop = null;
        }
      });
    };
    if (trigger === "boot") {
      // under the boot overlay from 0, counting from the beam's open frame; any other load keeps the truth
      if (document.documentElement.dataset.boot !== "run" || bootStore.getState().phase === "done") return;
      digits.textContent = format(0);
      const unsubscribe = bootStore.subscribe((s, prev) => {
        if (s.beamOpenAt === null || prev.beamOpenAt !== null) return;
        unsubscribe();
        if (s.skipped) digits.textContent = format(value);
        else run();
      });
      return () => {
        unsubscribe();
        stop?.();
        digits.textContent = format(value);
      };
    }
    // Already on screen keeps the truth; off screen, it waits at 0 to count up as it arrives. The
    // observer's first report says which, after layout: reading the rect here forced a layout per
    // counter in the hydration commit, each one dirtied by the last one's write (Part 8 trace).
    let first = true;
    const io = new IntersectionObserver(
      (entries) => {
        const shown = entries.some((e) => e.intersectionRatio >= 0.5);
        if (first) {
          first = false;
          if (shown) {
            io.disconnect();
            return;
          }
          digits.textContent = format(0);
          return;
        }
        if (shown) {
          io.disconnect();
          run();
        }
      },
      { threshold: [0, 0.5] },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      stop?.();
      digits.textContent = format(value);
    };
  }, [value, format, reduced, trigger]);

  return (
    <span ref={ref} className={cx("counter numeral", className)}>
      <span className="sr-only">
        {prefix}
        {final}
        {suffix}
      </span>
      <span aria-hidden="true" className="counter__wrap">
        {prefix}
        <span data-digits="" className="counter__digits" style={{ minWidth: `${final.length}ch` }}>
          {final}
        </span>
        {suffix}
      </span>
    </span>
  );
}
