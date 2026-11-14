import type { SceneLoaders } from "@/lib/sceneManager";
import { POSTER_CAPTURES, POSTER_DRAWINGS } from "./posters";
import type { SceneId } from "@/lib/tier";

/**
 * The five Tier-A scenes, each its own lazily imported chunk (≤ 35 KB gz, DESIGN.md §8.3).
 * Parts 6–10 replace the placeholders behind these ids.
 */
export const sceneLoaders: SceneLoaders = {
  system: () => import("./scenes/system"),
  log: () => import("./scenes/log"),
  archive: () => import("./scenes/archive"),
  work: () => import("./scenes/work"),
  capabilities: () => import("./scenes/capabilities"),
};

/** The 1-bit poster for a scene (scripts/bake/posters.ts), colorized by a CSS mask. */
export const posterSrc = (id: SceneId): string => `/posters/${id}.png`;
/** …and its portrait capture, for the scenes that have one (components/stage/posters.ts) */
const framed = (id: SceneId) => !!(POSTER_CAPTURES[id] ?? POSTER_DRAWINGS[id]);
export const posterPortraitSrc = (id: SceneId): string | null => (framed(id) ? `/posters/${id}-portrait.png` : null);
/** …and its tablet capture (3:4), for portrait screens wider than 3:5 */
export const posterTabletSrc = (id: SceneId): string | null => (framed(id) ? `/posters/${id}-tablet.png` : null);
