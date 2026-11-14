"use client";

import { useStore } from "zustand";
import { governor, type StageSnapshot } from "@/lib/sceneManager";

/** Subscribes a component to the governor's (rarely changing) snapshot. Never per-frame stats. */
export function useStage<T>(selector: (s: StageSnapshot) => T): T {
  return useStore(governor.store, selector);
}
