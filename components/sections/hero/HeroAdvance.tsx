"use client";

import type { MouseEvent, ReactNode } from "react";
import { glideTo, pinProgress, scrollToStep } from "@/lib/scroll";
import { HERO } from "@/lib/hero";

// tabindex -1 is focusable by script, not a control: <main id="main"> (the skip link's landing) wraps
// the hero, and counting it made every click on the hero a click on a control (Part 14)
const INTERACTIVE = "a, button, input, select, textarea, summary, label, [role='button'], [tabindex]:not([tabindex='-1'])";

/**
 * Scroll owns the morph (DESIGN.md §7.4): a click on the hero scrolls to the next checkpoint
 * (0, ⅓, ⅔, 1) — Lenis eases there, so there's one source of truth. Clicks on links and buttons,
 * and clicks that end a text selection, are left alone; from the last checkpoint it moves on to
 * the next section. Keyboard users scroll the page itself (PgDn, Space, arrows).
 */
export function HeroAdvance({ next, children }: { next: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || (e.target as Element).closest(INTERACTIVE)) return;
    if (window.getSelection()?.isCollapsed === false) return;
    // the next checkpoint ahead (a hair of tolerance at the nodes themselves)
    const last = HERO.targets - 1;
    const step = Math.floor(pinProgress("system") * last + 1e-3);
    if (step < last) scrollToStep("system", step + 1);
    else glideTo(next);
  };
  return (
    // a pointer convenience over the stage, not a control: the keyboard path is the page's own scroll
    <div className="hero-advance" onClick={onClick}>
      {children}
    </div>
  );
}
