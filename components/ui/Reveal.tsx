"use client";

import { useEffect, useId, useRef, type ElementType, type HTMLAttributes } from "react";
import type { SplitText } from "gsap/SplitText";
import { gsap, loadSplitText } from "@/lib/gsap";
import { charDelays, duration, gsapDelays, lineDelays, sec } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type RevealMode = "lines" | "chars" | "block";

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "p" | "span" | "h1" | "h2" | "h3" | "h4" | "blockquote" | "li" | "figcaption";
  /** lines (default) · chars · block (the whole element as one wipe) */
  mode?: RevealMode;
  /** ms before the reveal starts once in view */
  delay?: number;
}

const HIDDEN = "inset(0% 100% 0% 0%)";
const SHOWN = "inset(0% 0% 0% 0%)";

/**
 * RAIL REVEAL (DESIGN.md §3.7): a clip-path wipe from the left edge, per line (60 ms, max 6) or
 * per character (min(28 ms, 400 ms / n)), on `settle`. Never an opacity fade, never a float-up.
 * Reveals once; content is in the SSR HTML and stays interactive; nothing hides without JS or
 * in the reduced-motion edition. The split DOM is reverted when the wipe finishes.
 * Don't wrap LCP elements in it: the pre-reveal state (opacity 0) is not an LCP candidate.
 */
export function Reveal({ as = "div", mode = "lines", delay = 0, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const seed = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el || el.dataset.revealed !== undefined) return;
    if (reduced) {
      el.dataset.revealed = "";
      return;
    }

    let split: SplitText | null = null;
    let tween: gsap.core.Tween | null = null;
    let cancelled = false;

    const finish = () => {
      el.dataset.revealed = "";
      delete el.dataset.revealing;
      split?.revert();
      split = null;
      gsap.set(el, { clearProps: "clipPath" });
    };

    const start = async () => {
      await document.fonts.ready; // split on final metrics
      if (cancelled) return;
      if (mode === "block") {
        // same task: lift the opacity pre-state and apply the clip before the next paint
        el.dataset.revealing = "";
        tween = gsap.fromTo(el, { clipPath: HIDDEN }, { clipPath: SHOWN, duration: sec(duration.element.in), ease: "settle", delay: delay / 1000, onComplete: finish });
        return;
      }
      const Split = await loadSplitText(); // lazy: SplitText stays out of first-load JS
      if (cancelled) return;
      split = Split.create(el, {
        type: mode === "chars" ? "words,chars" : "lines",
        aria: "auto",
        autoSplit: true,
        onSplit(self) {
          const targets = mode === "chars" ? self.chars : self.lines;
          const delays = mode === "chars" ? charDelays(targets.length, seed) : lineDelays(targets.length, seed);
          el.dataset.revealing = ""; // lifted in the same task the clip is applied: no flash
          tween = gsap.fromTo(
            targets,
            { clipPath: HIDDEN },
            {
              clipPath: SHOWN,
              duration: sec(mode === "chars" ? duration.micro.in : duration.element.in),
              ease: "settle",
              delay: delay / 1000,
              stagger: gsapDelays(delays),
              onComplete: finish,
            },
          );
          return tween;
        },
      });
    };

    // Trigger when the top edge crosses 90 % of the viewport (edge-based, so tall blocks work too).
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      tween?.kill();
      split?.revert();
    };
  }, [mode, delay, reduced, seed]);

  const Tag = as as ElementType;
  return (
    <Tag ref={ref} data-reveal={mode} {...rest}>
      {children}
    </Tag>
  );
}
