"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { damp } from "@/lib/damp";
import { onTick } from "@/lib/ticker";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScrollVelocity } from "@/hooks/useScrollVelocity";
import { useVelocitySkew } from "@/hooks/useVelocitySkew";

export interface MarqueeProps {
  children: ReactNode;
  /** base speed in px/s (DESIGN.md §3.7: 40) */
  speed?: number;
  /** accessible name for the region */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const MAX_BOOST = 3; // scroll velocity adds up to 3× → ≤ 4× total
const VELOCITY_FOR_MAX = 2400; // px/s of scroll that saturates the boost
const SPEED_LAMBDA = 8;

/**
 * Infinite ticker: 40 px/s, up to 4× with scroll velocity, direction follows scroll, pauses on
 * hover/focus, static in the reduced-motion edition. The first copy is the readable one; the
 * repeats are aria-hidden.
 */
export function Marquee({ children, speed = 40, label, className, style }: MarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const velocity = useScrollVelocity();
  const [copies, setCopies] = useState(2);
  useVelocitySkew(rootRef);

  // Enough copies to always cover the viewport width.
  useEffect(() => {
    const root = rootRef.current;
    const copy = copyRef.current;
    if (!root || !copy) return;
    const ro = new ResizeObserver(() => {
      const w = copy.offsetWidth;
      if (w > 0) setCopies(Math.max(2, Math.ceil(root.offsetWidth / w) + 1));
    });
    ro.observe(root);
    ro.observe(copy);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const copy = copyRef.current;
    if (!root || !track || !copy || reduced) return;

    let x = 0;
    let current = speed;
    let paused = false;
    let width = copy.offsetWidth;
    const ro = new ResizeObserver(() => {
      width = copy.offsetWidth;
    });
    ro.observe(copy);

    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!root.contains(e.relatedTarget as Node | null)) resume();
    };
    root.addEventListener("pointerenter", pause);
    root.addEventListener("pointerleave", resume);
    root.addEventListener("focusin", pause);
    root.addEventListener("focusout", onFocusOut);

    const stop = onTick((dt) => {
      const v = velocity.current;
      const boost = 1 + Math.min(MAX_BOOST, Math.abs(v.velocity) / (VELOCITY_FOR_MAX / MAX_BOOST));
      current = damp(current, paused ? 0 : speed * boost, SPEED_LAMBDA, dt);
      x -= current * dt * v.direction;
      if (width > 0) {
        x %= width;
        if (x > 0) x -= width;
      }
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    });

    return () => {
      stop();
      ro.disconnect();
      root.removeEventListener("pointerenter", pause);
      root.removeEventListener("pointerleave", resume);
      root.removeEventListener("focusin", pause);
      root.removeEventListener("focusout", onFocusOut);
      track.style.transform = "";
    };
  }, [reduced, speed, velocity]);

  return (
    <div ref={rootRef} className={cx("marquee", className)} style={style} role="region" aria-label={label}>
      <div ref={trackRef} className="marquee__track">
        <div ref={copyRef} className="marquee__copy">
          {children}
        </div>
        {Array.from({ length: copies - 1 }, (_, i) => (
          <div key={i} className="marquee__copy" aria-hidden="true">
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
