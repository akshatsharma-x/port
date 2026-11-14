"use client";

import { useEffect, useRef, type ElementType } from "react";
import { cx } from "@/lib/cx";
import { artifact } from "@/lib/motion";
import { markScrambled, runScramble, scrambledThisSession } from "@/lib/scramble";

export interface ScrambleProps {
  text: string;
  /** once per session per key (default: the text) */
  sessionKey?: string;
  as?: ElementType;
  className?: string;
}

/**
 * SCRAMBLE (DESIGN.md §3.7): titles and labels only, ≤ 40 characters, once per session, on first
 * arrival. The real text is always in the DOM (and the accessibility tree) and reserves the box;
 * the glyphs play in an aria-hidden layer on top, so nothing reflows. Reduced motion: final text.
 */
export function Scramble({ text, sessionKey, as: Tag = "span", className }: ScrambleProps) {
  const rootRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLSpanElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const done = doneRef.current;
    const glyphs = glyphRef.current;
    const key = sessionKey ?? text;
    if (!root || !done || !glyphs) return;
    if ([...text].length > artifact.scrambleMaxChars) {
      if (process.env.NODE_ENV !== "production") console.warn(`[Scramble] "${text}" is over ${artifact.scrambleMaxChars} characters: shown static (DESIGN.md §3.7)`);
      return;
    }
    if (document.documentElement.dataset.motion === "reduce" || scrambledThisSession(key)) return;
    let cancel: (() => void) | null = null;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      markScrambled(key);
      root.dataset.running = "";
      const chars = [...text];
      cancel = runScramble(text, (frame, resolved) => {
        if (resolved >= chars.length) {
          delete root.dataset.running;
          done.textContent = "";
          glyphs.textContent = "";
          return;
        }
        // the resolved prefix in the element's own face, the cycling glyphs in mono (§2.10)
        const f = [...frame];
        done.textContent = f.slice(0, resolved).join("");
        glyphs.textContent = f.slice(resolved).join("");
      });
    });
    io.observe(root);
    return () => {
      io.disconnect();
      cancel?.();
    };
  }, [text, sessionKey]);

  return (
    <Tag ref={rootRef} className={cx("scramble", className)}>
      <span className="scramble__text">{text}</span>
      <span className="scramble__live" aria-hidden="true">
        <span ref={doneRef} />
        <span ref={glyphRef} className="scramble__glyphs" />
      </span>
    </Tag>
  );
}
