"use client";

import { useSyncExternalStore } from "react";
import { getLenis, subscribeLenis } from "@/lib/lenis";

/** The live Lenis instance, or null (server, reduced motion). */
export function useLenis() {
  return useSyncExternalStore(subscribeLenis, getLenis, () => null);
}
