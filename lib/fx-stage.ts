/**
 * The stage's post-processing intensities — DESIGN.md §5.2, the stage rows (lib/fx-css.ts holds
 * the #fx-css rows; tiers decide what runs: lib/tier.ts bloomMips, trails, restChromaticAberrationPx).
 * tests/fx-stage.test.ts re-reads the §5.2 table.
 */
export type StageTheme = "phosphor" | "amber" | "paper";

export const STAGE_FX = {
  /** opt-in by luminance (§5.3): only emissives above 1.0 in linear HDR glow; Paper: ink doesn't glow */
  bloom: { threshold: 1.0, smoothing: 0.15, radius: 0.72, intensity: { phosphor: 1.15, amber: 0.95, paper: 0 } },
  /** phosphor persistence per 1/60 s (dt-corrected): the tubes differ in physics; Paper: off */
  persistence: { phosphor: 0.84, amber: 0.88, paper: 0 },
  /** radial aberration: the rest value is the tier's; a fling adds up to this (HIGH, MID) */
  aberration: { flingPx: 4, flingVelocity: 3200 },
  /** the stage vignette (dark themes), and Paper's scanned-page falloff (on the ink) */
  vignette: { offset: 0.35, darkness: 0.45, paper: 0.15 },
  /** ±1 LSB of blue noise at the output (scripts/bake/bluenoise.ts) */
  dither: { url: "/textures/bluenoise-64.png", size: 64 },
} as const;

export const stageTheme = (value: string | undefined): StageTheme => (value === "amber" || value === "paper" ? value : "phosphor");
