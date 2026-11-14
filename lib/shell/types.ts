import type { SearchIndex } from "@/content/search-index";
import type { GfxOverride } from "@/lib/store";
import type { Theme } from "@/lib/tokens";

/**
 * The terminal's vocabulary (DESIGN.md §7.4 SHELL). A command returns lines — runs of styled text —
 * and effects, which the panel carries out (navigation, the clipboard, the HUD's switches).
 */
export type Tone = "dim" | "accent" | "hot" | "warn" | "bold" | "mark";

export interface Seg {
  t: string;
  k?: Tone;
  /** a link the output carries (a URL that opens in a new tab) */
  href?: string;
  /** drawn, not prose (a punch card, the portrait): it scrolls sideways rather than wrapping */
  nowrap?: boolean;
}

export type Line = Seg[];

export type Effect =
  | { kind: "clear" }
  | { kind: "copy"; text: string }
  /** a page elsewhere, in a new tab */
  | { kind: "url"; href: string }
  /** a route on this site: the panel powers off, then the page goes there with a TRACKING TEAR */
  | { kind: "navigate"; href: string }
  /** CONNECT's form; `behind`: the panel stays, the page jumps underneath, Esc lands in the form */
  | { kind: "contact"; behind: boolean }
  | { kind: "theme"; theme: Theme }
  | { kind: "sound"; on: boolean }
  | { kind: "grid" }
  | { kind: "gfx"; gfx: GfxOverride }
  | { kind: "debug" }
  | { kind: "rain" };

export interface Result {
  lines: Line[];
  effects?: Effect[];
  /** something went wrong: the panel plays SHELL's error */
  error?: boolean;
}

/** What a command can see: the index (a command runs only once it has loaded), and the machine's state. */
export interface Context {
  ix: SearchIndex;
  /** the panel's width in cells */
  columns: number;
  theme: Theme;
  sound: boolean;
  grid: boolean;
  gfx: GfxOverride;
  debug: boolean;
  /** how long this page has been running (ms), and when it started */
  uptimeMs: number;
  startedAt: Date;
  now: Date;
  /** the visitor's IANA zone (Intl) */
  zone: string;
  history: readonly string[];
  /** the path the panel was opened on ("/" on home) */
  path: string;
}

export type Labels = SearchIndex["labels"];
