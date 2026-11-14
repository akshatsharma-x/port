"use client";

import { useEffect } from "react";
import { useUI } from "@/lib/store";
import { useSystemReducedMotion } from "@/hooks/useReducedMotion";
import { installSound } from "@/lib/sound";

/**
 * Keeps <html> in sync with the UI store. Persisted settings are rehydrated after mount (the head
 * script already applied the theme before first paint). The theme is written from the store's
 * live state — never from a render-time default — so a persisted theme never flashes back to
 * Phosphor for a frame. The effective motion preference is mirrored to data-motion.
 */
export function UIEffects() {
  const override = useUI((s) => s.motionOverride);
  const system = useSystemReducedMotion();

  useEffect(() => {
    // The reveal failsafe (styles/primitives.css) only runs while this attribute is missing.
    document.documentElement.dataset.hydrated = "";
    return installSound(); // S, resume-on-gesture, suspend-when-hidden (DESIGN.md §6.2)
  }, []);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = useUI.getState().theme;
    };
    const offHydrated = useUI.persist.onFinishHydration(apply);
    const offChange = useUI.subscribe((s, prev) => {
      if (s.theme !== prev.theme && useUI.persist.hasHydrated()) apply();
    });
    void useUI.persist.rehydrate();
    return () => {
      offHydrated();
      offChange();
    };
  }, []);

  useEffect(() => {
    // the live query, not `system`: on the hydration pass the hook reports the server snapshot
    // (no preference), and writing that would flip a reduced-motion visitor to the motion edition
    // for a commit — pins and all. `system` stays a dependency so a change still re-runs this.
    const live = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reduce = override === "system" ? live : override === "reduce";
    document.documentElement.dataset.motion = reduce ? "reduce" : "full";
  }, [override, system]);

  return null;
}
