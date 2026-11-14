"use client";

import { useEffect, useRef, type ElementType } from "react";
import { cx } from "@/lib/cx";
import { artifact } from "@/lib/motion";
import { onTick } from "@/lib/ticker";

export interface TypewriterProps {
  /** one line: the boot banner and one-line swaps only (DESIGN.md §3.7) */
  text: string;
  as?: ElementType;
  className?: string;
}

/** The block caret rides as the last character of the typed text (mono, §2.10). */
const CARET = "█";

/**
 * TYPEWRITER at 45 cps, on first arrival and on every `text` change (the CURRENTLY swap). Rate-based,
 * so a long line may run past the 900 ms ceiling (law 7's one exception). The full line is always in
 * the DOM and reserves the box; the typed copy is an aria-hidden layer. Reduced motion: final text.
 *
 * The caret is a character of the typed text node, not an element after it: appending to a text
 * node never moves its start, so typing is not a layout shift (a caret element would shift every
 * character). It's solid while typing, as a terminal cursor is; the boot's blinking caret is Part 5's.
 */
export function Typewriter({ text, as: Tag = "span", className }: TypewriterProps) {
  const rootRef = useRef<HTMLElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const live = liveRef.current;
    if (!root || !live || document.documentElement.dataset.motion === "reduce") return;
    const chars = [...text];
    let off: (() => void) | null = null;
    const stop = () => {
      off?.();
      off = null;
      delete root.dataset.typing;
      live.textContent = "";
    };
    const type = () => {
      let elapsed = 0;
      let shown = -1;
      root.dataset.typing = "";
      off = onTick((dt) => {
        elapsed += dt;
        const n = Math.min(chars.length, Math.floor(elapsed * artifact.typewriterCps));
        if (n === shown) return;
        shown = n;
        if (n >= chars.length) stop();
        else live.textContent = `${chars.slice(0, n).join("")}${CARET}`;
      });
    };
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      type();
    });
    io.observe(root);
    return () => {
      io.disconnect();
      stop();
    };
  }, [text]);

  return (
    <Tag ref={rootRef} className={cx("typewriter", className)}>
      <span className="typewriter__text">{text}</span>
      <span ref={liveRef} className="typewriter__live" aria-hidden="true" />
    </Tag>
  );
}
