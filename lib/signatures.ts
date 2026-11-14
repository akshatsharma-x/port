import type { Theme } from "./tokens";
import type { PowerOnOptions, TearOptions } from "./transitions";
import { setJumping } from "./scroll";
import { useUI } from "./store";

/**
 * The signature transitions, as first-load code sees them (DESIGN.md §3.6). The grammar itself —
 * lib/transitions.ts, its timelines and its fx-gl programs — is a lazy chunk, fetched on idle after
 * load (ScrollProvider) because nothing needs it before the first jump or switch: first-load JS
 * stays inside the §8.3 budget.
 *
 * Navigation never waits on decoration: a jump that comes before the chunk has landed happens at
 * once, uncovered, with the same history and scroll rules; a theme switch swaps instantly.
 */
type Grammar = typeof import("./transitions");

let grammar: Grammar | null = null;
let loading: Promise<Grammar> | null = null;

/** The grammar has landed: a power cycle can start this frame (the boot picks its fallback by it). */
export const transitionsLoaded = (): boolean => grammar !== null;

export function loadTransitions(): Promise<Grammar> {
  loading ??= import("./transitions").then((m) => (grammar = m));
  return loading;
}

/** Discontinuity — see lib/transitions.ts tear(). */
export async function tear(options: TearOptions): Promise<void> {
  if (grammar) return grammar.tear(options);
  void loadTransitions();
  setJumping(true);
  try {
    await options.atCut();
  } finally {
    setJumping(false);
  }
}

/** Existence: the theme switch's POWER CYCLE (or an instant swap before the chunk lands). */
export function switchTheme(next: Theme): Promise<void> {
  if (grammar) return grammar.switchTheme(next);
  void loadTransitions();
  document.documentElement.dataset.theme = next;
  useUI.getState().setTheme(next);
  return Promise.resolve();
}

/** POWER OFF / ON are deliberate (the footer's halt, the boot): they wait for the grammar. */
export const powerOff = (options?: { cue?: "POWER" | "HALT" }): Promise<void> => loadTransitions().then((m) => m.powerOff(options));
export const powerOn = (options?: PowerOnOptions): Promise<void> => loadTransitions().then((m) => m.powerOn(options));
