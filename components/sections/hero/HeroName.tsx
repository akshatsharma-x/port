"use client";

import { useLayoutEffect, useRef } from "react";
import { NameRise } from "@/components/boot/NameRise";
import { Text } from "@/components/ui/Text";
import { solveWdth, type NameFitModel } from "@/lib/name-fit";

/**
 * The hero name (DESIGN.md §7.4 SYSTEM; §2.5 "fit, don't shrink"): --step-5, fitted across the 12
 * columns by solving the wdth axis (75–125) from the name's measured width model
 * (content/name-fit.json) — never by measuring the DOM, so it's right before the face has loaded.
 * The server's bands set it for the first paint; this refines it to the exact column width, and
 * keeps it there on resize. The line count is fixed in CSS (two lines only where one would need
 * wdth < 75), so a refit only changes the text's width — nothing moves (no layout shift).
 *
 * One line is a fixed-width box: the name is the page's first H-HOLD heading (data-hhold), and
 * the box clips the jump to 125 — "loses horizontal hold". The per-character rise is NameRise.
 */
export function HeroName({ text, fit }: { text: string; fit: NameFitModel }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const oneLine = window.innerWidth >= fit.oneLineMinViewport;
      const fontPx = Number.parseFloat(getComputedStyle(el).fontSize);
      el.style.setProperty("--fit-wdth", `${solveWdth(oneLine ? fit.oneLine : fit.twoLine, el.clientWidth, fontPx)}%`);
      if (oneLine) el.dataset.hhold = "";
      else delete el.dataset.hhold;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <Text as="h1" step="mega" ref={ref} className="hero-name col-span-12">
      <NameRise text={text} />
    </Text>
  );
}
