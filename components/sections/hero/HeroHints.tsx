"use client";

import { useEffect, useRef, useState } from "react";
import { HERO } from "@/lib/hero";
import { TERMINAL } from "@/lib/terminal";

const IDLE_KEY = "retrograde:hint-terminal";
const INPUTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * The hero's two hints (DESIGN.md §7.4 SYSTEM). The scroll hint shows until the first scroll and
 * fades. The idle hint — "PRESS ~ FOR TERMINAL" — appears once ever, after 25 s with no input, and
 * leaves on the next one; it's held until the terminal exists (lib/terminal.ts), since a hint for a
 * key that does nothing would be untrue. `?debug=1&hint=terminal` shows it for the gate.
 */
export function HeroHints({ scroll, idle }: { scroll: string; idle: string }) {
  const scrollRef = useRef<HTMLParagraphElement>(null);
  const [idleShown, setIdleShown] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (window.scrollY <= 0) return;
      el.dataset.gone = "";
      window.removeEventListener("scroll", onScroll);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const forced = q.get("debug") === "1" && q.get("hint") === "terminal";
    if (!TERMINAL.ready && !forced) return;
    try {
      if (!forced && window.localStorage.getItem(IDLE_KEY)) return;
    } catch {
      /* no storage: show it, once per visit */
    }
    let timer = 0;
    let shown = false;
    const arm = () => {
      window.clearTimeout(timer);
      if (shown) {
        setIdleShown(false);
        for (const t of INPUTS) window.removeEventListener(t, arm);
        return;
      }
      timer = window.setTimeout(() => {
        shown = true;
        setIdleShown(true);
        try {
          window.localStorage.setItem(IDLE_KEY, "1");
        } catch {
          /* once per visit, then */
        }
      }, HERO.idleHintMs);
    };
    for (const t of INPUTS) window.addEventListener(t, arm, { passive: true });
    arm();
    return () => {
      window.clearTimeout(timer);
      for (const t of INPUTS) window.removeEventListener(t, arm);
    };
  }, []);

  return (
    <>
      <p ref={scrollRef} className="hero-hint hero-hint--scroll t-micro" aria-hidden="true">
        {scroll}
        <span className="hero-hint__glyph">↓</span>
      </p>
      {/* role=status: announced once when it appears */}
      <p className="hero-hint hero-hint--idle t-micro" role="status" data-shown={idleShown || undefined}>
        {idleShown ? idle : ""}
      </p>
    </>
  );
}
