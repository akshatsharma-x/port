"use client";

import { useSyncExternalStore } from "react";
import { useUI } from "@/lib/store";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** The OS preference alone. Server snapshot: no preference. */
export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** The effective preference: the OS setting unless the dev override (kitchen sink) says otherwise. */
export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion();
  const override = useUI((s) => s.motionOverride);
  return override === "system" ? system : override === "reduce";
}

/** Imperative read for non-React code (set by the head script and UIEffects). */
export const isReducedMotion = (): boolean =>
  typeof document !== "undefined" && document.documentElement.dataset.motion === "reduce";

function subscribeEdition(onChange: () => void): () => void {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => mo.disconnect();
}

/**
 * The edition actually rendered — html[data-motion], stamped by the head script before first paint
 * and kept in sync by UIEffects. Effects that branch on the edition should read isReducedMotion()
 * inside and list this hook's value as a dependency: they re-run after the attribute changed.
 */
export function useReducedEdition(): boolean {
  return useSyncExternalStore(subscribeEdition, isReducedMotion, () => false);
}
