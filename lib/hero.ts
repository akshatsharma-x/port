/**
 * A1 · HERO "SYSTEM" (DESIGN.md §4.3, §7.4) — the scene's design constants, and the contract
 * between the page, the morph-target worker and the scene. Motion values come from lib/motion.ts
 * (followers.heroParallax / heroRepel); particle counts and DPR caps from lib/tier.ts.
 *
 * Four TRUE states, one Points draw: INITIALS → CONSTELLATION (content/graph.json) → GLOBE (a live
 * terminator, the owner's city lit) → GRID LATTICE (the site's own grid, in screen space, landing
 * as the About layout). Every target is generated in a worker (OffscreenCanvas for the initials)
 * as normalized Int16 — 6 B per particle per target. No position data is downloaded.
 */
export const HERO_STATES = ["initials", "constellation", "globe", "lattice"] as const;
export type HeroState = (typeof HERO_STATES)[number];

export const HERO = {
  /** world states are normalized to ±1 and scaled by the scene's fit; the lattice is NDC */
  targets: HERO_STATES.length,
  bytesPerTarget: 6,
  /** the subject's box in the frame: share of the visible width / height, and its center lift */
  frame: { width: 0.8, height: 0.42, lift: 0.215, phoneLift: 0.22 },
  /** camera: distance (world units) for the stage's 35° lens; parallax ±3° yaw / ±2° pitch */
  camera: { distance: 9.5, yawDeg: 3, pitchDeg: 2 },
  /** cursor force field: radius as a share of the viewport height; push at its center, NDC */
  repel: { radiusVh: 0.12, push: 0.08 },
  /**
   * The morph. Each transition gives every particle a random start inside the first `spread`
   * of the segment; it then travels for the rest on a quintic ease, displaced along curl noise by
   * a bell that peaks mid-flight — scatter, then reassemble. Never a straight lerp.
   */
  morph: {
    spread: 0.42,
    scatter: 0.16,
    /** an outward burst along the particle's own direction, as share of the scatter */
    burst: 0.35,
    curlFrequency: 0.62,
    /** the field drifts (s⁻¹), so particles caught mid-flight keep swirling */
    curlDrift: 0.07,
    /** at rest every particle breathes on its own phase: about 2 px (world units) */
    idle: 0.012,
    /** scroll velocity (px/s) at which turbulence saturates, and its displacement */
    turbulenceVelocity: 3200,
    turbulence: 0.06,
  },
  /** point sprites, CSS px before DPR: base size, its random spread, and the share that runs hot */
  sprite: { sizePx: 2.1, spread: 0.55, hotShare: 0.012 },
  /**
   * The light: per-particle HDR intensity at HIGH (dark themes) and ink density (Paper). Other
   * tiers scale by √(HIGH / n) so the field reads the same, LOW by `lowGain` more (its sprite is
   * larger); the hot share runs `hotGain`× brighter. The sprite's profile is exp(−r²·a) +
   * b·exp(−r²·c): a tight core (`glow`), and on LOW — no bloom — a halo baked into a sprite
   * `haloScale`× larger (DESIGN.md §4.2).
   */
  light: { dark: 0.3, ink: 0.3, lowGain: 0.8, hotGain: 4, glow: [3.2, 0, 1], halo: [4.2, 0.3, 0.9], haloScale: 1.7 },
  /** INITIALS: the raster the worker draws the glyphs into, and the slab's depth (±, normalized) */
  initials: { rasterHeight: 360, alphaFloor: 96, edgeShare: 0.28, depth: 0.075 },
  /** CONSTELLATION: shares on nodes, edges and the sky behind; the chart's radius; blob size (normalized) */
  constellation: { nodes: 0.5, edges: 0.36, field: 0.14, radius: 0.66, nodeSigma: 0.018, nodeSigmaPerWeight: 0.01, edgeJitter: 0.005, citedWeight: 0.25 },
  /** GLOBE: shares; graticule every 15°; the city's glow (degrees); the city faces the viewer this far above center */
  globe: { land: 0.72, ocean: 0.08, graticule: 0.16, city: 0.04, graticuleDeg: 15, citySigmaDeg: 1.6, tiltDeg: 18, landmask: { width: 256, height: 128, url: "/data/land-256x128.bin" } },
  /**
   * LATTICE: shares; the rules' dot pitch, the bare grid's dot pitch (CSS px, on every third
   * baseline), and the About layout's own fill pitch
   */
  lattice: { rules: 0.3, baseline: 0.16, blocks: 0.54, rulePitchPx: 3, gridPitchPx: 12, gridRows: 3, blockPitchPx: 8, blockOutline: 0.5 },
  /** the "G" overlay flashes once as the lattice lands (ms) */
  gridFlashMs: 600,
  /** idle hint "PRESS ~ FOR TERMINAL": after this long without input, once ever */
  idleHintMs: 25_000,
} as const;

/** What the page tells the worker about its own grid (CSS px, the hero slot's viewport). */
export interface LatticeSpec {
  width: number;
  height: number;
  /** each layout column's [left, right] edge */
  columns: [number, number][];
  /** the baseline unit (DESIGN.md §2.9: 8 px) */
  baseline: number;
  /** the About layout, as it will stand: solid blocks (the portrait) and text lines (the bio) */
  blocks: { x: number; y: number; w: number; h: number }[];
  lines: { x: number; y: number; w: number }[];
}

/** /data/stage.json — what the scenes download (built from content/derive.ts, never shipped as JS). */
export interface StageData {
  v: 1;
  hero: { initials: string; city: { lat: number; lon: number }; timezone: string };
  /**
   * The research sky (DESIGN.md §4.3 A3), shared by the hero's CONSTELLATION and ARCHIVE: my
   * records first, then the works they cite (v1.9). Labels are ids and positions only; their text
   * is the page's HTML.
   */
  graph: {
    nodes: {
      topic: [number, number, number];
      year: [number, number, number];
      venue: [number, number, number];
      /** 0 = my record, 1 = a work it cites */
      kind: 0 | 1;
      /** lib/archive-shapes.ts SHAPE_ORDER index; 7 = a plain point */
      shape: number;
      /** under review or in prep: a dashed outline of the same shape */
      dashed: boolean;
      /** the year it appeared (the ARCHIVE cue's pitch) */
      pubYear: number;
      /** as counted; 0 where unknown (a cited work without a DOI) */
      citations: number;
      featured: boolean;
    }[];
    /** [source index, target index, weight, kinds: 1 author · 2 related · 4 topic · 8 cites] */
    edges: [number, number, number, number][];
    labels: Record<"topic" | "year" | "venue", { id: string; at: [number, number, number] }[]>;
  };
  /** A2's deck, in deck order (newest role first): each card's slug and the text its holes punch */
  log: { cards: { slug: string; text: string }[] };
  /**
   * A4's slides (DESIGN.md §4.3 A4), the featured projects in content order: what each mount prints
   * (its number, title and category — the year once it's known) and its cover at each tier's size
   * (scripts/bake/covers.ts). The cover's own words are in the image.
   */
  work: { slides: { slug: string; number: string; title: string; category: string; year: number | null; covers: Record<"1024" | "768" | "640", string> }[] };
  /**
   * A5's keys (DESIGN.md §4.3 A5), the content's skills in order: each one's category (an index),
   * whether it's primary (an accent cap), and its cell in the legend atlas; the atlas and the
   * matcaps (scripts/bake/keycaps.ts). Names and words are the page's HTML.
   */
  keys: { keys: { slug: string; category: number; primary: boolean; cell: number }[]; categories: number; legends: string; matcaps: Record<"phosphor" | "amber" | "paper", string> };
}
export const STAGE_DATA_URL = "/data/stage.json";

export interface HeroTargetsRequest {
  kind: "targets";
  count: number;
  data: StageData;
  land: ArrayBuffer;
  /** the display face for the initials (its @font-face src), or null for the system fallback */
  font: { url: string; weight: number; stretch: string } | null;
  lattice: LatticeSpec;
  seed: number;
}
export interface HeroLatticeRequest {
  kind: "lattice";
  count: number;
  lattice: LatticeSpec;
  seed: number;
}
export interface HeroTargets {
  count: number;
  /** four Int16 xyz arrays, normalized (±32767 = ±1); the lattice in NDC */
  targets: [Int16Array, Int16Array, Int16Array, Int16Array];
  /** the initials' bounding box aspect (width / height), for the scene's fit */
  initialsAspect: number;
  /** which face drew the initials: the page's display face, or the system's when it didn't load */
  initialsFace: "display" | "system";
  /** where the city sits on the unit sphere (Earth-fixed: y north, z toward 0° E) */
  city: [number, number, number];
  ms: number;
}
