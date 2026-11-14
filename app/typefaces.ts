import localFont from "next/font/local";

/**
 * DESIGN.md §2.5 — three OFL variable families, baked by scripts/fonts (Latin, axes trimmed).
 * Display + mono preload; body loads lazily. Mona Sans gets next/font's metric-adjusted Arial
 * fallback; Hubot Sans gets one measured at each display step's width (styles/font-fallbacks-
 * display.css); mono uses the hand-tuned faces in styles/font-fallbacks.css.
 */
export const hubotSans = localFont({
  src: "./fonts/HubotSans-Variable.woff2",
  variable: "--ff-display",
  weight: "500 900",
  style: "normal",
  display: "swap",
  preload: true,
  // next/font would match the file's condensed default instance (Arial at 76%); the display steps
  // run at 100–125% width, so their fallbacks are measured per step (styles/font-fallbacks-display.css)
  adjustFontFallback: false,
  fallback: ["Hubot Sans Fallback heading", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
  declarations: [{ prop: "font-stretch", value: "75% 125%" }],
});

export const monaSans = localFont({
  src: "./fonts/MonaSans-Variable.woff2",
  variable: "--ff-body",
  weight: "300 700",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

export const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--ff-mono",
  weight: "400 800",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  fallback: [
    "JetBrains Mono Fallback",
    "JetBrains Mono Fallback W",
    "ui-monospace",
    "SF Mono",
    "Cascadia Mono",
    "Roboto Mono",
    "Menlo",
    "Consolas",
    "monospace",
  ],
});
