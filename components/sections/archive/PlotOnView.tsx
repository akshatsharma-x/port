"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Marks its block data-plotted the first time it's on screen: CSS plots the drawing's edges in. */
export function PlotOnView({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      el.dataset.plotted = "";
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
