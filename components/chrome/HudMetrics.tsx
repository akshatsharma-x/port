"use client";

import { useEffect } from "react";

/**
 * Keeps scroll-padding equal to the chrome's bands (WCAG 2.4.11, Focus Not Obscured): the top
 * band (readout + nav) and the bottom band (the front panel) are measured — they wrap on narrow
 * screens — and written straight to html's scroll-padding, which styles/chrome.css gives a
 * fallback for the first paint. Layout reads on resize only.
 *
 * Straight to the property, not through custom properties on html: those inherit, so each write
 * restyled all ~830 elements, and the next layout read in the hydration commit paid for it — two
 * forced full-document recalcs, ~15 ms each at Lighthouse's 4× CPU (Part 7 trace). scroll-padding
 * doesn't inherit: a write restyles html alone. Both bands are read before either is written, and
 * an unchanged value isn't written at all.
 */
export function HudMetrics() {
  useEffect(() => {
    const top = document.querySelector<HTMLElement>(".hud-top");
    const bottom = document.querySelector<HTMLElement>(".hud-bottom");
    if (!top || !bottom) return;
    const style = document.documentElement.style;
    const write = () => {
      const t = `${Math.ceil(top.getBoundingClientRect().bottom)}px`;
      const b = `${Math.ceil(window.innerHeight - bottom.getBoundingClientRect().top)}px`;
      if (style.scrollPaddingTop !== t) style.scrollPaddingTop = t;
      if (style.scrollPaddingBottom !== b) style.scrollPaddingBottom = b;
    };
    // the observer's first notification comes after layout, so its reads cost nothing; a
    // synchronous first measure here would force the commit's layout
    const ro = new ResizeObserver(write);
    ro.observe(top);
    ro.observe(bottom);
    window.addEventListener("resize", write);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", write);
    };
  }, []);
  return null;
}
