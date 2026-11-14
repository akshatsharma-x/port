"use client";

import { useEffect, useRef, type ElementType, type HTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { clamp01 } from "@/lib/damp";
import { springs } from "@/lib/motion";
import { Spring } from "@/lib/spring";
import { onTick } from "@/lib/ticker";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface TiltProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "article" | "li" | "figure" | "section";
  /** max rotation in degrees (DESIGN.md: 8°; record cards use 6°) */
  max?: number;
}

/** The "pleasing fixed angle" for reduced motion and touch (DESIGN.md §4.4). */
export const REST_LAMP = { mx: 0.62, my: 0.38 } as const;
const WILL_CHANGE_LINGER_MS = 300;

/**
 * Tier-B one-lamp model: rotateX/Y from the pointer on spring `tilt`, max 8°. Writes --mx/--my
 * (registered with @property, inherited by children for highlights and foil), --tilt-x/-y and the
 * cast-shadow vector --shadow-x/-y/-blur + --tilt-mag. will-change only while interacting.
 */
export function Tilt({ as = "div", max = 8, className, children, ...rest }: TiltProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { coarse } = useBreakpoint();
  const live = !reduced && !coarse;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const write = (mx: number, my: number, rx: number, ry: number) => {
      const mag = Math.min(1, Math.hypot(rx, ry) / max);
      el.style.setProperty("--mx", mx.toFixed(4));
      el.style.setProperty("--my", my.toFixed(4));
      el.style.setProperty("--tilt-x", `${rx.toFixed(3)}deg`);
      el.style.setProperty("--tilt-y", `${ry.toFixed(3)}deg`);
      el.style.setProperty("--tilt-mag", mag.toFixed(4));
      el.style.setProperty("--shadow-x", `${((0.5 - mx) * 16).toFixed(2)}px`);
      el.style.setProperty("--shadow-y", `${((0.5 - my) * 16 + 10).toFixed(2)}px`);
      el.style.setProperty("--shadow-blur", `${(18 + 12 * mag).toFixed(2)}px`);
    };

    if (!live) {
      write(REST_LAMP.mx, REST_LAMP.my, 0, 0);
      return;
    }

    const mx = new Spring(springs.tilt, 0.5);
    const my = new Spring(springs.tilt, 0.5);
    const rx = new Spring(springs.tilt);
    const ry = new Spring(springs.tilt);
    let rect = el.getBoundingClientRect();
    let hovering = false;
    let stop: (() => void) | null = null;
    let linger = 0;
    write(0.5, 0.5, 0, 0);

    const tick = (dt: number) => {
      mx.step(dt);
      my.step(dt);
      rx.step(dt);
      ry.step(dt);
      write(mx.value, my.value, rx.value, ry.value);
      if (!hovering && rx.isSettled(0.01) && ry.isSettled(0.01) && mx.isSettled(1e-4) && my.isSettled(1e-4)) {
        stop?.();
        stop = null;
        linger = window.setTimeout(() => {
          el.style.willChange = "";
        }, WILL_CHANGE_LINGER_MS);
      }
    };
    const ensure = () => {
      stop ??= onTick(tick);
    };

    const onMove = (e: PointerEvent) => {
      const nx = clamp01((e.clientX - rect.left) / rect.width);
      const ny = clamp01((e.clientY - rect.top) / rect.height);
      mx.setTarget(nx);
      my.setTarget(ny);
      ry.setTarget((nx - 0.5) * 2 * max);
      rx.setTarget((0.5 - ny) * 2 * max);
      ensure();
    };
    const onEnter = (e: PointerEvent) => {
      rect = el.getBoundingClientRect();
      window.clearTimeout(linger);
      el.style.willChange = "transform";
      hovering = true;
      onMove(e);
    };
    const onLeave = () => {
      hovering = false;
      mx.setTarget(0.5);
      my.setTarget(0.5);
      rx.setTarget(0);
      ry.setTarget(0);
      ensure();
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      stop?.();
      window.clearTimeout(linger);
      el.style.willChange = "";
    };
  }, [live, max]);

  const Tag = as as ElementType;
  return (
    <Tag ref={ref} className={cx("tilt", className)} {...rest}>
      {children}
    </Tag>
  );
}
