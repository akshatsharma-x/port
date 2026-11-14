import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { THEMES, type Theme } from "./tokens";

export const STORAGE_KEY = "retrograde:ui";

export type MotionOverride = "system" | "reduce" | "full";
export type BootState = "pending" | "running" | "done" | "skipped";
export type GfxOverride = "auto" | "low";

export interface UIState {
  theme: Theme;
  sound: boolean;
  boot: BootState;
  terminalOpen: boolean;
  /** the dev overlay (?debug=1, or the terminal's `debug`); not persisted */
  debug: boolean;
  grid: boolean;
  /** the "G" overlay shown for a moment (the hero's lattice landing); not persisted */
  gridFlash: boolean;
  gfx: GfxOverride;
  /** dev override for the reduced-motion edition (kitchen sink); not persisted */
  motionOverride: MotionOverride;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  setSound: (on: boolean) => void;
  setBoot: (boot: BootState) => void;
  setTerminalOpen: (open: boolean) => void;
  setDebug: (on: boolean) => void;
  toggleGrid: (force?: boolean) => void;
  /** shows the "G" overlay for `ms`, unless it's already on */
  flashGrid: (ms: number) => void;
  setGfx: (gfx: GfxOverride) => void;
  setMotionOverride: (m: MotionOverride) => void;
}

const memory: StateStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

/**
 * Global UI state. Starts from constant defaults on server and client (so hydration matches);
 * UIEffects rehydrates the persisted part after mount. The inline head script has already
 * applied the persisted theme to <html> before first paint, so nothing flashes.
 */
export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      theme: "phosphor",
      sound: false,
      boot: "pending",
      terminalOpen: false,
      debug: false,
      grid: false,
      gridFlash: false,
      gfx: "auto",
      motionOverride: "system",
      setTheme: (theme) => set({ theme }),
      cycleTheme: () => {
        const i = THEMES.indexOf(get().theme);
        set({ theme: THEMES[(i + 1) % THEMES.length] ?? "phosphor" });
      },
      setSound: (sound) => set({ sound }),
      setBoot: (boot) => set({ boot }),
      setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
      setDebug: (debug) => set({ debug }),
      toggleGrid: (force) => set((s) => ({ grid: force ?? !s.grid, gridFlash: false })),
      flashGrid: (ms) => {
        if (get().grid || get().gridFlash) return;
        set({ gridFlash: true });
        window.setTimeout(() => set({ gridFlash: false }), ms);
      },
      setGfx: (gfx) => set({ gfx }),
      setMotionOverride: (motionOverride) => set({ motionOverride }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => (typeof window === "undefined" ? memory : window.localStorage)),
      partialize: (s) => ({ theme: s.theme, sound: s.sound, gfx: s.gfx }),
      skipHydration: true,
    },
  ),
);
