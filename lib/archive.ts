import { create } from "zustand";
import type { LayoutName } from "@/content/schema";

/**
 * A3 · RESEARCH "ARCHIVE" (DESIGN.md §4.3, §7.4): the citation constellation's constants, and the
 * pure pieces of it that need no WebGL — the camera's retrograde loop, glyph sizing, the ARCHIVE
 * cue's notes — plus the store the stage and the page's HTML share (layout, hover, focus, the open
 * record). World units are the baked layouts' (content/graph.json fits a sphere of radius 10).
 */
/** A3's budget (DESIGN.md §4.3): ≤ 200 glyph quads in one InstancedMesh, ≤ 2,000 edges in one LineSegments */
export const SKY_LIMITS = { nodes: 200, edges: 2000 } as const;

export const ARCHIVE = {
  /** the pin's soft detents: in on a prograde arc, the loop back over the densest cluster, out */
  steps: 3,
  camera: {
    /** azimuth swept across the whole pin (deg), centered on the densest cluster */
    sweepDeg: 120,
    /** the retrograde term: > 1 runs the azimuth backward through the middle of the pin (§4.3) */
    loop: 1.6,
    /** elevation at the arcs and how much higher the loop rides (deg): the loop is a loop */
    elevationDeg: 10,
    loopRiseDeg: 16,
    /** the loop dives this much closer to the cluster than the arcs (a share of the distance) */
    dive: 0.24,
    /** the sky's radius fills this share of the shorter screen side at the arcs' distance */
    fill: 0.62,
    /** the dossier dolly stops this many glyph-radii from the open record */
    dollyRadii: 9,
    /** …and holds it this share of the view's width left of center, clear of the dossier at the right (landscape only) */
    dollyShift: 0.24,
    /** a slow drift at rest (deg, s): the sky is never a still image while live */
    drift: { yawDeg: 3, periodS: 41 },
  },
  node: {
    /** radius (world units): my records, then the works they cite, from least to most cited */
    record: { min: 0.42, max: 0.85 },
    cited: { min: 0.15, max: 0.32 },
    /** the quad's margin around the glyph, for its glow */
    margin: 1.9,
    hoverScale: 1.55,
    focusScale: 1.22,
    pulse: { periodS: 3.4, depth: 0.07 },
    glow: 0.16,
    /** a not-yet-published record: a dashed outline of its shape */
    dash: { count: 12, duty: 0.56, stroke: 0.12 },
    /** a cited work's light, against a record's (1) */
    citedLight: 0.34,
  },
  edges: {
    /** each edge draws in like a pen plotter, staggered by its distance from the camera: draw + stagger ≤ 900 ms (law 7) */
    drawMs: 340,
    staggerMs: 540,
    light: { record: 0.55, cited: 0.32, lit: 1 },
  },
  /** depth fog toward the ground: past `start` (world units from the camera), density² */
  fog: { start: 18, density: 0.045 },
  /** hover / focus+context: everything not the hovered node or its neighbors recedes this far */
  recede: 0.78,
  /** state changes ease at this rate (1/s; τ ≈ 110 ms) */
  ease: 9,
  /** pointer pick: the glyph's screen radius plus this much (CSS px), and never under a 24 px target */
  pick: { slopPx: 10, minPx: 12 },
  /** the dial: the node nearest the view's center takes focus, within this share of the shorter side; a rival must be this much nearer (px) */
  dial: { hysteresisPx: 18, within: 0.4 },
  /** labels: at most this many year ticks show in the YEAR layout (always the first, the last and my years) */
  yearTicks: 7,
  /** the unit chart (§7.4): a cell per paper (px), a 2 px surface gap, a column per year */
  unit: { cell: 16, gap: 2, column: 26, tick: 5, label: 18 },
  /**
   * the SVG constellation (lib/archive-svg.ts): drawn about 1:1, so its glyphs keep the stage's
   * sizes and their shapes stay legible — wide from 48rem, tall below it (a phone's frame is
   * portrait; the wide drawing there scaled every glyph to half, too small to tell ● from ◆)
   */
  drawing: { wide: { width: 720, height: 440 }, tall: { width: 360, height: 560 }, pad: 28 },
} as const;

// ── the ARCHIVE cue (§6.4): pitch = year on A-minor pentatonic, 220–880 Hz; length ∝ citations ────

/** A minor pentatonic, A3 → A5: A C D E G across two octaves (equal temperament, A4 = 440 Hz). */
export const PENTATONIC_HZ = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24].map((semis) => 220 * 2 ** (semis / 12));
export const CUE_MS = { min: 40, max: 120 } as const;

/** The note a year plays: the sky's years spread linearly over the scale, snapped to its notes. */
export function yearNote(year: number, from: number, to: number): number {
  const t = to > from ? (year - from) / (to - from) : 0.5;
  const i = Math.round(Math.min(1, Math.max(0, t)) * (PENTATONIC_HZ.length - 1));
  return PENTATONIC_HZ[i] ?? 440;
}

/** The blip's length: 40 ms uncited, 120 ms for the most-cited in the sky (log scale). */
export function citationMs(citations: number, maxCitations: number): number {
  return CUE_MS.min + (CUE_MS.max - CUE_MS.min) * citationNorm(citations, maxCitations);
}

/** 0–1 on a log scale, so one landmark paper doesn't flatten the rest. */
export function citationNorm(citations: number, maxCitations: number): number {
  return maxCitations > 0 ? Math.log1p(Math.max(0, citations)) / Math.log1p(maxCitations) : 0;
}

/**
 * A glyph's radius. Size = citations, normalized within its class: my records against my most-cited
 * record, the works they cite against the most-cited of those — and every cited work stays smaller
 * than any record of mine, so the sky's brightest stars are always my papers.
 */
export function glyphRadius(kind: 0 | 1, citations: number, maxInClass: number): number {
  const r = kind === 0 ? ARCHIVE.node.record : ARCHIVE.node.cited;
  return r.min + (r.max - r.min) * citationNorm(citations, maxInClass);
}

// ── the camera's retrograde loop (§4.3) ─────────────────────────────────────────────────────────

export interface LoopPose {
  /** around the sky's vertical axis, from the densest cluster's direction (rad) */
  azimuth: number;
  elevation: number;
  /** the camera's distance as a share of the arcs' distance */
  distance: number;
}

const DEG = Math.PI / 180;

/**
 * The pose at pin progress p ∈ [0, 1]: a prograde arc, a loop back, then prograde again, passing
 * the densest cluster twice from two angles. azimuth(p) = sweep · (p − λ · sin(2π(p − ½)) / 2π)
 * runs backward through the middle wherever λ·cos(2π(p − ½)) > 1; the loop rides higher and
 * closer than the arcs, so its backward pass sees the cluster from above.
 */
export function loopPose(p: number): LoopPose {
  const c = ARCHIVE.camera;
  const t = Math.min(1, Math.max(0, p));
  const phase = 2 * Math.PI * (t - 0.5);
  const sweep = c.sweepDeg * DEG;
  const azimuth = sweep * (t - 0.5 - (c.loop * Math.sin(phase)) / (2 * Math.PI));
  const lift = 0.5 + 0.5 * Math.cos(phase); // 0 at the ends, 1 at the loop's apex
  return { azimuth, elevation: (c.elevationDeg + c.loopRiseDeg * lift) * DEG, distance: 1 - c.dive * lift };
}

/** Where the loop runs backward: the p-range in which the azimuth decreases. */
export function retrogradeSpan(): [number, number] {
  const k = Math.acos(1 / ARCHIVE.camera.loop) / (2 * Math.PI);
  return [0.5 - k, 0.5 + k];
}

// ── the store the stage and the page share ───────────────────────────────────────────────────────

export interface ArchiveState {
  layout: LayoutName;
  /** a keyword chip's filter, and the graph indices of the records that carry it */
  keyword: { word: string; matches: number[] } | null;
  /** the record whose dossier is open (graph index): HOT in the sky */
  hot: number | null;
  /** a node the page points at — a ledger row's, a unit chart cell's, a focused node button's (graph index) */
  pointed: number | null;
  /** the node the stage shows focused (the dial, the cursor or the keyboard), for the HTML readout */
  focused: number | null;
  setLayout(layout: LayoutName): void;
  setKeyword(keyword: { word: string; matches: number[] } | null): void;
  setHot(index: number | null): void;
  point(index: number | null): void;
  setFocused(index: number | null): void;
}

/** Graph indices throughout: content/graph.ts's node order, which the stage data and the page share. */
export const useArchive = create<ArchiveState>()((set) => ({
  layout: "topic",
  keyword: null,
  hot: null,
  pointed: null,
  focused: null,
  setLayout: (layout) => set({ layout }),
  setKeyword: (keyword) => set({ keyword }),
  setHot: (hot) => set({ hot }),
  point: (pointed) => set({ pointed }),
  setFocused: (focused) => set({ focused }),
}));

/**
 * What the stage publishes for the page's HTML each frame it draws: every node's and label's screen
 * position (CSS px in the slot; depth 0–1, ∞ when behind the camera), and the slot's size. The
 * overlay reads it on the ticker and moves its labels and tooltip by transform only.
 */
export const skyView = {
  version: 0,
  width: 0,
  height: 0,
  /** x, y, depth, radius (px) per node */
  nodes: new Float32Array(0) as Float32Array,
  /** x, y, depth per label of the current layout */
  labels: new Float32Array(0) as Float32Array,
  /** the layout the label positions are for, and the hovered node (-1 none) */
  layout: "topic" as LayoutName,
  hovered: -1,
};
