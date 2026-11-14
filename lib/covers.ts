/**
 * A project's cover files (scripts/bake/covers.ts; DESIGN.md §4.3 A4, §8.2): one 3:2 picture at
 * four sizes. The master serves the DOM through next/image (the case study's hero, the CSS
 * carousel, the INDEX preview); the stage samples the size its tier names (lib/tier.ts `covers`),
 * each an AVIF of at most 120 KB. Until a screenshot is dropped into content/covers/<slug>.*, the
 * cover is a title card set from the project's own words — plainly type, never a fake screenshot.
 */
export const COVER = {
  master: { width: 2400, height: 1600 },
  /** the stage's: HIGH, MID, LOW (lib/tier.ts) */
  tiers: [
    { width: 1024, height: 683 },
    { width: 768, height: 512 },
    { width: 640, height: 427 },
  ],
  /** A4's budget per tier file */
  maxBytes: 120_000,
  /** the master is the DOM's: next/image re-encodes it per width, so it's held looser */
  maxMasterBytes: 400_000,
  /** the share cards' size (lib/og.tsx, Part 15): 1.91:1, Open Graph's and X's large card */
  og: { width: 1200, height: 630 },
  /** where a real screenshot goes, any of these */
  sources: ["avif", "webp", "png", "jpg", "jpeg"],
} as const;

export type CoverTierWidth = "1024" | "768" | "640";

export const coverSrc = (slug: string): string => `/media/projects/${slug}/cover.avif`;
export const coverTierSrc = (slug: string, width: number): string => `/media/projects/${slug}/cover-${width}.avif`;

/** The stage's three files for a project, keyed by width. */
export function coverSizes(slug: string): Record<CoverTierWidth, string> {
  return { "1024": coverTierSrc(slug, 1024), "768": coverTierSrc(slug, 768), "640": coverTierSrc(slug, 640) };
}

/**
 * Each title card's light, by its place in the content (OKLCH): five hues a third of the wheel
 * apart in turn, at one lightness and chroma, so no card outshouts another. A screenshot has its
 * own colors; this is only the card's.
 */
export const TITLE_CARD = {
  hues: [152, 32, 268, 92, 212, 332, 122, 2],
  lightness: 0.72,
  chroma: 0.14,
  ground: "#0b0e0d",
  ink: "#eef3ef",
} as const;
