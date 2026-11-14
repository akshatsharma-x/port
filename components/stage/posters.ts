import type { SceneId } from "../../lib/tier";

/**
 * Scenes whose 1-bit posters are captured from the live scene (scripts/posters.ts, DESIGN.md §8.2)
 * at their canonical state — the frame the slot shows until the scene draws, and the image the
 * stage DITHER-RESOLVEs from. The rest keep the bake's placeholder fields until their parts
 * register here. (No React, no three: the bake reads this too.)
 */
export const POSTER_CAPTURES: Partial<Record<SceneId, { route: string; hash?: string; canonical: string; align?: "slot" }>> = {
  system: { route: "/", canonical: "INITIALS — the hero at rest, pin progress 0" },
  log: { route: "/", hash: "log", canonical: "the deck at its first card, newest role, nothing hovered" },
  // its slot sits below the section's header strip: the capture puts the slot's top at the frame's
  work: { route: "/", hash: "work", canonical: "the rail at rest, slide 01 in the gate", align: "slot" },
  capabilities: { route: "/", hash: "capabilities", canonical: "the pile at rest by category, nothing hovered", align: "slot" },
};

/**
 * Scenes whose posters are drawn at build rather than captured: A3's is the build-time SVG
 * constellation straight from content/graph.json (lib/archive-svg.ts, DESIGN.md §4.3 A3) — the
 * stage-less editions' header — rasterized and dithered like a capture. No browser, no stage.
 */
export const POSTER_DRAWINGS: Partial<Record<SceneId, { canonical: string }>> = {
  archive: { canonical: "the constellation, TOPIC, drawn from graph.json" },
};
