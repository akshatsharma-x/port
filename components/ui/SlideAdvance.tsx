"use client";

import { AnimatePresence, m } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cx } from "@/lib/cx";
import { duration, ease, sec } from "@/lib/motion";

export interface SlideAdvanceProps {
  /** the slide's identity: a change pushes the old one out and the new one in */
  slideKey: string;
  /** +1 next (enters from the right), −1 previous */
  direction: 1 | -1;
  children: ReactNode;
  className?: string;
}

const variants = {
  enter: (d: number) => ({ x: `${d * 100}%` }),
  center: { x: "0%" },
  exit: (d: number) => ({ x: `${-d * 100}%` }),
};

/**
 * SLIDE ADVANCE (DESIGN.md §3.7): a push (element tier, `transit`) plus a DITHER RESOLVE — the
 * incoming slide's <DitherImage>s resolve as they arrive. Project prev/next uses it. Reduced
 * motion: an instant swap (and the images swap instantly too).
 */
export function SlideAdvance({ slideKey, direction, children, className }: SlideAdvanceProps) {
  const reduced = useReducedMotion();
  return (
    <div className={cx("slide-advance", className)}>
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <m.div
          key={slideKey}
          className="slide-advance__slide"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={reduced ? { duration: 0 } : { duration: sec(duration.element.in), ease: [...ease.transit] }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
