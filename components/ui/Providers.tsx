"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";
import "@/lib/gsap"; // registers GSAP plugins + the DESIGN.md easing tokens once, client-side
import { FocusBrackets } from "./FocusBrackets";
import { GridOverlay } from "./GridOverlay";
import { ScrollProvider } from "@/components/scroll/ScrollProvider";
import { UIEffects } from "./UIEffects";

// Animation features stream in after first paint; `m` components render statically until then.
const loadDomAnimation = () => import("./motion-dom-animation").then((m) => m.default);

/**
 * App-wide client providers. Motion runs through LazyMotion + `m` in strict mode (a `motion.*`
 * component throws). Both feature bundles load asynchronously, so neither is in first-load JS:
 * `domAnimation` here, `domMax` in <LayoutMotion>.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadDomAnimation} strict>
      <ScrollProvider>
        <UIEffects />
        {children}
        <GridOverlay />
        <FocusBrackets />
      </ScrollProvider>
    </LazyMotion>
  );
}
