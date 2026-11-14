import { hexToRgb, linearToSrgb, oklchToLinear, parseOklch, srgbToLinear, type Vec3 } from "./color";

/**
 * Colors for GL come from the same tokens as the DOM (styles/tokens.css): read live from the
 * computed style, so they follow the theme. Handles both token forms — sRGB hex and the P3
 * upgrade's oklch() (clamped to sRGB: neither canvas is wide-gamut yet).
 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Gamma-encoded sRGB 0–1 (for raw WebGL without color management, e.g. #fx-gl). */
export function tokenSrgb(name: string): Vec3 {
  const v = readToken(name);
  if (v.startsWith("#")) return hexToRgb(v);
  const ok = parseOklch(v);
  if (ok) {
    const [r, g, b] = oklchToLinear(ok);
    return [clamp01(linearToSrgb(r)), clamp01(linearToSrgb(g)), clamp01(linearToSrgb(b))];
  }
  return [1, 1, 1];
}

/** Linear-light sRGB 0–1 (for three.js colors in its linear working space). */
export function tokenLinear(name: string): Vec3 {
  const [r, g, b] = tokenSrgb(name);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}
