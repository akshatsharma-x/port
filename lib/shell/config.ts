/**
 * The terminal's fixed numbers (DESIGN.md §7.4 SHELL). Timings live in lib/motion.ts (the output's
 * 120 lines/s, the rain); colors in styles/tokens.css. Read by the lazy terminal and by the bake.
 */
export const SHELL = {
  /** /search-index.json's format (content/search-index.ts); the panel refuses another */
  indexVersion: 2,
  /** the panel's own scanlines, over its glass (Paper has none: §5.4) */
  scanAlpha: 0.1,
  /** a terminal cell: JetBrains Mono's advance (600 / 1000 em) on --lh--1 (styles/tokens.css) */
  advanceEm: 0.6,
  lineHeight: 1.4286,
  /** lines kept on screen; older ones scroll away */
  scrollback: 2000,
  /** commands kept per visit (sessionStorage) */
  history: 100,
  historyKey: "retrograde:shell-history",
  /** help's usage column: a usage longer than this takes a line of its own */
  helpUsageMax: 24,
  /** grep prints at most this many hits */
  grepHits: 12,
  /** "did you mean": edit distance (§7.4) */
  suggestDistance: 2,
  /** neofetch's portrait: this many cells wide (its rows follow from the photo's aspect and the cell's) */
  portraitColumns: 28,
  /** rain's pool takes this many recent commits */
  commits: 24,
  /** rain: a drop's trail, in cells */
  rainTrail: 14,
} as const;

/** How much taller a cell is than wide: the portrait's rows come from it. */
export const cellAspect = SHELL.lineHeight / SHELL.advanceEm;
