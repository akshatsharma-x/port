import { cssToLinear, hexToRgb, linearToSrgb, srgbToLinear, type Vec3 } from "./color";

/**
 * Colors for GL come from the same tokens as the DOM (styles/tokens.css): read live from the
 * computed style, so they follow the theme. A token computes to sRGB hex, or for the P3 upgrades
 * (§2.3) to lab(): the build's CSS minifier rewrites the authored oklch() as lab() under
 * `@supports`, so that's what any P3 screen returns. Clamped to sRGB: neither canvas is wide-gamut
 * yet. (Until Part 15 only oklch() was read, so on every P3 screen the scenes drew the accent white;
 * headless browsers report sRGB, so no gate saw it — scripts/hero-gate.mjs now emulates P3.)
 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Gamma-encoded sRGB 0–1 (for raw WebGL without color management, e.g. #fx-gl). */
export function tokenSrgb(name: string): Vec3 {
  const v = readToken(name);
  if (v.startsWith("#")) return hexToRgb(v);
  const lin = cssToLinear(v);
  if (lin) {
    const [r, g, b] = lin;
    return [clamp01(linearToSrgb(r)), clamp01(linearToSrgb(g)), clamp01(linearToSrgb(b))];
  }
  return [1, 1, 1];
}

/** Linear-light sRGB 0–1 (for three.js colors in its linear working space). */
export function tokenLinear(name: string): Vec3 {
  const [r, g, b] = tokenSrgb(name);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}
