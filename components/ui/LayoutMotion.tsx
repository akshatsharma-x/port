"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadDomMax = () => import("./motion-features").then((m) => m.default);

/**
 * Wrap subtrees that need Motion layout animations (shared-layout nav indicator, filter FLIP).
 * The root provider only ships `domAnimation`; `domMax` streams in here, asynchronously.
 */
export function LayoutMotion({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadDomMax} strict>
      {children}
    </LazyMotion>
  );
}
