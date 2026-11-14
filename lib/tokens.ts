/**
 * The few token values code needs outside CSS (meta theme-color now, stage clear colors in
 * Part 3). tests/tokens-sync.test.ts asserts these equal styles/tokens.css.
 */
export const THEMES = ["phosphor", "amber", "paper"] as const;
export type Theme = (typeof THEMES)[number];

/** HUD labels by tube type (DESIGN.md §2.3). */
export const THEME_LABEL: Record<Theme, string> = { phosphor: "P1", amber: "P3", paper: "PPR" };

export const THEME_BG: Record<Theme, string> = { phosphor: "#050505", amber: "#080605", paper: "#F2F0EB" };

/** DESIGN.md §2.7 breakpoints (px). */
export const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1440, "2xl": 2200 } as const;

export const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);
