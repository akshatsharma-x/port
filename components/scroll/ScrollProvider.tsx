"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { whenIdle } from "@/lib/idle";
import { bindRouter, installNavigation, notifyPath } from "@/lib/navigation";
import { onScrollRefresh, scrollSignal, setJumping, startScroll, teleport } from "@/lib/scroll";
import { loadTransitions } from "@/lib/signatures";
import { useUI } from "@/lib/store";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** The effective preference, read live (the hook reports the server snapshot on the hydration pass). */
function prefersReducedMotion(): boolean {
  const override = useUI.getState().motionOverride;
  return override === "system" ? window.matchMedia(REDUCE_QUERY).matches : override === "reduce";
}

/**
 * Starts the scroll layer (lib/scroll.ts) and the navigation rules (lib/navigation.ts) once, in
 * the root layout. A deep link's #hash lands after the pins have measured — unless the visitor
 * has already scrolled.
 */
export function ScrollProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const stopScroll = startScroll({ reduced: prefersReducedMotion() });
    const stopNav = installNavigation();
    // analytics' routes, clicks and scripts after idle (lib/analytics-start.ts): not first-load JS
    let stopAnalytics: (() => void) | null = null;
    let live = true;
    const cancelAnalytics = whenIdle(() => void import("@/lib/analytics-start").then((m) => live && (stopAnalytics = m.startAnalytics())));
    // the number keys' channels (lib/channels.ts, a seeded delight): after idle, in its own small chunk
    let stopChannels: (() => void) | null = null;
    const cancelChannels = whenIdle(() => void import("@/lib/channels").then((m) => live && (stopChannels = m.startChannels())));
    const loadedAt = performance.now();
    // a deep link lands once (after the first measure), as a jump: no SECTION cue, no glitch
    const offRefresh = onScrollRefresh(function landHash() {
      offRefresh();
      const id = location.hash.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target || scrollSignal.lastInput >= loadedAt) return;
      setJumping(true);
      teleport(target);
      setJumping(false);
    });
    // the transition grammar (and its fx-gl programs) on idle, well before the first jump
    const cancelIdle = whenIdle(() => void loadTransitions());
    return () => {
      live = false;
      cancelAnalytics();
      stopAnalytics?.();
      cancelChannels();
      stopChannels?.();
      cancelIdle();
      offRefresh();
      stopNav();
      stopScroll();
    };
  }, [reduced]);

  return (
    <>
      <NavigationBridge />
      {children}
    </>
  );
}

/** Hands the Next.js router to lib/navigation.ts and reports every committed pathname. */
function NavigationBridge() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    bindRouter(router);
    return () => bindRouter(null);
  }, [router]);
  useEffect(() => {
    notifyPath(pathname);
  }, [pathname]);
  return null;
}
