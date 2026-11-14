import { create } from "zustand";

/**
 * A5 · SKILLS "CAPABILITIES" (DESIGN.md §4.3 A5, §7.4): the keycap pile's constants, the panel's
 * words, type-to-press, and the store, input sink and view bus between the stage and the page. The
 * pile's layout is lib/capabilities-layout.ts (the stage's alone); the scene is
 * components/stage/scenes/capabilities.tsx (a lazy chunk).
 *
 * World units are keycaps: a 1u cap's base is 1 × 1. The camera sits at the origin looking down −z;
 * a cap's legend faces +z (toward it) at rest.
 */
export const KEYS = {
  /** A5's budget: at most 40 caps (one InstancedMesh, ≤ 1.5k triangles each) */
  maxKeys: 40,
  /** the sculpted cap: base and top sizes, height, the top's dish, corner radii — keycap units */
  cap: { base: 1, top: 0.78, height: 0.52, dish: 0.035, topRadius: 0.1, rings: 6, grid: 8 },
  /** the legend atlas (scripts/bake/keycaps.ts): 1024² lossless WebP, a square cell per key */
  atlas: { size: 1024, cols: 7, maxBytes: 90_000 },
  /** one 256² matcap per theme, a layer each, ≤ 12 KB */
  matcap: { size: 256, maxBytes: 12_000 },
  /** the cloud: where the pile floats and how it fills the band */
  cloud: {
    /** the pile spans this share of the band's width (phones never get the stage) */
    fill: 0.82,
    /** the sim's front wall, at least this far before the cloud's middle (keycaps), and past a gathered pile's front */
    depth: 3.2,
    /**
     * neighbours in a cluster sit this far apart, centre to centre (keycaps): a hexagonal lattice
     * over two of the sim's sphere radii, so every key can rest at home and the pile can sleep
     */
    spacing: 1.36,
    /** a home wanders this far off its lattice point, each axis (keycaps): never a pair under two radii */
    jitter: 0.04,
    /** …and this far in depth, either way (keycaps) */
    depthJitter: 0.3,
    /** each cluster's lattice turns by up to this, seeded (rad): a hexagon looks the same past 30° */
    turn: 0.5,
    /** clusters stand this far apart, the nearest keys' centres (keycaps), and step up or down by `stagger` */
    gap: 1.8,
    stagger: 0.45,
    /** each key's resting tilt, at most (rad): a loose pile, never a grid */
    tilt: 0.22,
    /** …and the share of the band's height it may fill */
    fillHeight: 0.62,
  },
  /**
   * gathering by a category (the chips): it comes forward to the middle by this share of the cloud's
   * depth, while the rest part around it, back by this share, dimmed to `recede` of a hover's dim —
   * shares, so a gathered pile looks the same however far the band puts it. Laid out as it looks, so
   * on screen nothing stands behind the gathered keys; in depth they're far clear of each other.
   * The sim's back wall stands `wall` keycaps past the receding keys.
   */
  gather: { front: 0.1, back: 0.45, recede: 0.7, wall: 1 },
  /** the micro-sim (HIGH): a fixed step, springs, sphere proxies, walls */
  sim: {
    step: 1 / 120,
    maxSteps: 4,
    /** the sphere proxy's radius (keycaps): caps touch before they overlap */
    radius: 0.6,
    /** the home spring, its damping ratio, and the grab spring (s⁻²) */
    anchor: 26,
    anchorZeta: 0.9,
    grab: 260,
    grabZeta: 1,
    /** the legend-up spring (s⁻²) and its damping ratio */
    orient: 90,
    orientZeta: 0.8,
    /** restitution between caps and off the walls */
    bounce: 0.32,
    wallBounce: 0.45,
    /** a throw's speed is capped (keycaps/s) */
    maxThrow: 26,
    /** asleep below these for this long (s) */
    sleepSpeed: 0.004,
    sleepAfter: 0.5,
    /** a contact this hard (keycaps/s) clacks; the KEYCAP cue's gain follows it to `clackFull` */
    clackMin: 1.4,
    clackFull: 9,
  },
  /** MID: no physics — the keys float on a sine at their homes, easing to new ones (s⁻¹) */
  float: { amplitude: 0.08, periodS: 3.6, spin: 0.05, follow: 6 },
  /** the plastics and the legends: charcoal (the raised ground toward --fg-3), Paper's beige, the backlit level */
  legend: { emissive: 2.2, charcoal: 0.09, beige: [0.94, 0.89, 0.78] as [number, number, number] },
  /** the blob shadows on a wall this far behind the cloud's middle (keycaps); a key within `fade` of it casts less, behind it none */
  shadow: { opacity: 0.5, paper: 0.16, spread: 0.18, offset: 0.16, wall: 2, fade: 0.4 },
  /** state eases (dim, lift, lit) at this rate (s⁻¹) */
  ease: 12,
  /** interaction */
  hover: { lift: 0.42, dim: 0.55 },
  /** a press dips the key this deep for this long; on HIGH it's an impulse into the sim too */
  press: { depth: 0.22, ms: 180, kick: 3.5 },
  /** a pressed or typed key's row stays lit in the panel this long (ms) */
  litMs: 1800,
  /** type-to-press: the typed run resets after this pause (ms) */
  typeResetMs: 900,
  /** the pointer picks a key within its radius on screen, never under a 24 px target */
  pick: { minPx: 12 },
} as const;

/** A skill as the stage needs it: its index, category, primary flag and atlas cell. */
export interface KeySpec {
  slug: string;
  category: number;
  primary: boolean;
  cell: number;
}

/** A seeded unit hash of a string (FNV-1a): the pile's jitter, the same every load. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0xffffffff;
}

/** A spring's damping for its stiffness and damping ratio (unit mass). */
export const dampingFor = (k: number, zeta: number): number => 2 * zeta * Math.sqrt(k);

/** "python", "tailwindcss": what a typed run is compared with — letters and digits, lower case. */
export const typeKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

/**
 * Type-to-press: the key a typed run names. A run matches a skill when it ends in the skill's name,
 * an alias or its legend's label (compared as typeKey), longest match first — so "java" presses
 * Java, and "javascript" goes on to press JavaScript.
 */
export function matchTyped(run: string, names: readonly (readonly string[])[]): number | null {
  const typed = typeKey(run);
  let best: { i: number; len: number } | null = null;
  names.forEach((terms, i) => {
    for (const t of terms) {
      const k = typeKey(t);
      if (k.length >= 2 && typed.endsWith(k) && (!best || k.length > best.len)) best = { i, len: k.length };
    }
  });
  return (best as { i: number; len: number } | null)?.i ?? null;
}

/** The rubric's label for a level: "L2 BUILT" (DESIGN.md §7.4). */
export const levelLabel = (prefix: string, level: number, rubric: string): string => `${prefix}${level} ${rubric}`.toUpperCase();

/** "3 years", "1 year". */
export const yearsLabel = (n: number, L: { one: string; many: string }): string => `${n} ${n === 1 ? L.one : L.many}`;

export interface EvidenceLabels {
  in: string;
  project: string;
  projects: string;
  paper: string;
  papers: string;
  role: string;
  roles: string;
  none: string;
}

/**
 * A skill's evidence as the panel says it (DESIGN.md §7.4), derived from the content: "In 4
 * projects · 2 papers" — what it was used in, never a rating. Nothing yet says so.
 */
export function evidenceLine(e: { projects: readonly unknown[]; papers: readonly unknown[]; roles: readonly unknown[] }, L: EvidenceLabels): string {
  const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : null);
  const parts = [count(e.projects.length, L.project, L.projects), count(e.papers.length, L.paper, L.papers), count(e.roles.length, L.role, L.roles)].filter((x): x is string => x !== null);
  return parts.length ? `${L.in} ${parts.join(" · ")}` : L.none;
}

/** A contact's clack: silent under `sim.clackMin` (keycaps/s), full at `sim.clackFull`, linear between. */
export const clackIntensity = (speed: number): number => (speed <= KEYS.sim.clackMin ? 0 : Math.min(1, (speed - KEYS.sim.clackMin) / (KEYS.sim.clackFull - KEYS.sim.clackMin)));

// ── the store the stage and the page share ───────────────────────────────────────────────────────

export interface KeysState {
  /** the key under the pointer (the tooltip's) */
  hovered: number | null;
  /** the key last pressed or typed: its row lights in the panel */
  lit: { index: number; seq: number } | null;
  /** the category the pile is gathered by (null: all) */
  cluster: number | null;
  hover(index: number | null): void;
  light(index: number | null): void;
  gather(category: number | null): void;
}

/** Key indices throughout: the stage data's order (the content's skills, in order). */
export const useKeys = create<KeysState>()((set, get) => ({
  hovered: null,
  lit: null,
  cluster: null,
  hover: (hovered) => set({ hovered }),
  light: (index) => set({ lit: index === null ? null : { index, seq: (get().lit?.seq ?? 0) + 1 } }),
  gather: (cluster) => set({ cluster }),
}));

/** The pile's input, from the page's HTML layer to the stage, installed while the scene is mounted. */
export interface KeysInput {
  /** a press at a point in the slot (CSS px): returns the key under it, if any */
  down(x: number, y: number, t: number): number | null;
  move(x: number, y: number, t: number): void;
  /** the release: true when it was a click (a press, not a throw) */
  up(t: number): boolean;
  /** a key goes down (a click, or its name typed) */
  press(index: number, strength?: number): void;
}
export const keysInput: { sink: KeysInput | null } = { sink: null };

/** What the stage publishes for the page each frame it draws: the hovered key's place, for the tooltip. */
export const keysView = { version: 0, width: 0, height: 0, x: 0, y: 0, r: 0, hovered: -1 };
