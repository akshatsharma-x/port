"use client";

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { useReducedEdition } from "@/hooks/useReducedMotion";
import { cx } from "@/lib/cx";
import { PINS, pinSection, scrollToStep, type PinnedSection } from "@/lib/scroll";

export interface StickyStackProps {
  /** a PINS key: only the hero (100 svh), LOG (≤ 200 svh) and ARCHIVE (≤ 150 svh) pin */
  id: PinnedSection;
  /** discrete nodes the content advances through on scrub (≥ 2; the hero's morph has 4) */
  steps: number;
  /** what stays put behind everything (the stage slot) */
  backdrop?: ReactNode;
  /** one frame per step, shown one at a time (serializable, so a server page can pass them) */
  frames?: readonly ReactNode[];
  /** content that holds still through every step (the hero's name, while the stage morphs) */
  children?: ReactNode;
  className?: string;
}

/**
 * A pinned block whose inner content advances in discrete steps on scrub (DESIGN.md §3.8). Soft
 * detents pull to its nodes when the visitor is idle (lib/scroll.ts). The pin is native: the block
 * is sticky inside a track PINS[id] svh taller than it, sized in CSS from the server render on.
 *
 * Every frame is always in the HTML and in the accessibility tree. In the motion edition the
 * inactive frames are clipped to nothing; the active one wipes in (RAIL REVEAL). Keyboard focus
 * landing in an inactive frame scrolls to that frame's node, so focus is never invisible. In the
 * reduced-motion edition (html[data-motion], stamped before first paint, so nothing swaps at
 * hydration) there is no pin and the frames stack as static frames.
 */
export function StickyStack({ id, steps, backdrop, frames = [], children, className }: StickyStackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const reducedEdition = useReducedEdition();

  useEffect(() => {
    const el = ref.current;
    const track = trackRef.current;
    if (!el || !track) return;
    // pinSection reads the live edition itself; this effect re-runs when it changes
    const unpin = pinSection({ id, track, el, steps, onStep: setStep });
    return () => {
      unpin();
      setStep(0);
    };
  }, [id, steps, reducedEdition]);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const frame = (e.target as Element).closest<HTMLElement>("[data-frame]");
    const target = frame ? Number(frame.dataset.frame) : NaN;
    if (Number.isInteger(target) && target !== step) scrollToStep(id, target);
  };

  return (
    <div ref={trackRef} className="pin-track" style={{ "--pin": `${PINS[id]}svh` } as CSSProperties}>
      <div ref={ref} className={cx("sticky-stack", className)} data-pin={id} data-step={step} style={{ "--step": step } as CSSProperties} onFocus={onFocus}>
        {backdrop && <div className="sticky-stack__backdrop">{backdrop}</div>}
        {children && <div className="sticky-stack__content">{children}</div>}
        {frames.map((frame, i) => (
          <div key={i} className="sticky-stack__frame" data-frame={i} data-active={i === step || undefined}>
            {frame}
          </div>
        ))}
      </div>
    </div>
  );
}
