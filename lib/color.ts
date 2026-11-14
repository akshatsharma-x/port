/**
 * Color math for DESIGN.md §2: WCAG 2 contrast and OKLCH / Display-P3 conversion.
 * One implementation, used by tests/contrast.test.ts (which proves it reproduces the
 * DESIGN.md tables) and by the kitchen-sink live audit.
 */
export type Vec3 = readonly [number, number, number];

export interface Oklch {
  /** lightness 0–1 */
  L: number;
  C: number;
  /** hue in degrees */
  H: number;
}

export function hexToRgb(hex: string): Vec3 {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4)];
}

export const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function hexToLinear(hex: string): Vec3 {
  const [r, g, b] = hexToRgb(hex);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

/** WCAG 2 relative luminance of linear-light sRGB (also valid for out-of-gamut values). */
export const luminanceOfLinear = ([r, g, b]: Vec3): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export const relativeLuminance = (hex: string): number => luminanceOfLinear(hexToLinear(hex));

export function contrastFromLuminance(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2 contrast ratio between two hex colors. */
export const contrast = (a: string, b: string): number => contrastFromLuminance(relativeLuminance(a), relativeLuminance(b));

// ── OKLab / OKLCH (Björn Ottosson) ────────────────────────────────────────────────

export function linearToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex: string): Oklch {
  const [L, a, b] = linearToOklab(hexToLinear(hex));
  return { L, C: Math.hypot(a, b), H: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

export function oklchToLinear({ L, C, H }: Oklch): Vec3 {
  const h = (H * Math.PI) / 180;
  return oklabToLinear([L, C * Math.cos(h), C * Math.sin(h)]);
}

/** Formats like the DESIGN.md tables: `oklch(88.0% 0.211 156.6)`, achromatic as `oklch(11.5% 0 0)`. */
export function formatOklch(hex: string): string {
  const { L, C, H } = hexToOklch(hex);
  return C > 0.0015 ? `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})` : `oklch(${(L * 100).toFixed(1)}% 0 0)`;
}

/** Parses `oklch(87% 0.25 156.6)` (percent or 0–1 lightness). */
export function parseOklch(value: string): Oklch | null {
  const m = /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)/i.exec(value);
  if (!m) return null;
  const L = Number(m[1]) / (m[2] ? 100 : 1);
  return { L, C: Number(m[3]), H: Number(m[4]) };
}

// ── Display-P3 ────────────────────────────────────────────────────────────────────

export function linearSrgbToLinearP3([r, g, b]: Vec3): Vec3 {
  const X = 0.4123908 * r + 0.3575843 * g + 0.1804808 * b;
  const Y = 0.212639 * r + 0.7151687 * g + 0.0721923 * b;
  const Z = 0.0193308 * r + 0.1191948 * g + 0.9505322 * b;
  return [
    2.4934969 * X - 0.9313836 * Y - 0.4027108 * Z,
    -0.829489 * X + 1.7626641 * Y + 0.0236247 * Z,
    0.0358458 * X - 0.0761724 * Y + 0.9568845 * Z,
  ];
}

export function inGamut(v: Vec3, eps = 1e-4): boolean {
  return v.every((c) => c >= -eps && c <= 1 + eps);
}

export const inSrgb = (c: Oklch): boolean => inGamut(oklchToLinear(c));
export const inP3 = (c: Oklch): boolean => inGamut(linearSrgbToLinearP3(oklchToLinear(c)));

/** Luminance of any OKLCH color (wide-gamut colors included — Y is linear in RGB). */
export const luminanceOfOklch = (c: Oklch): number => luminanceOfLinear(oklchToLinear(c));

/** Luminance of a CSS color string we author: hex or oklch(). */
export function luminanceOf(value: string): number {
  const v = value.trim();
  if (v.startsWith("#")) return relativeLuminance(v);
  const ok = parseOklch(v);
  if (!ok) throw new Error(`Unsupported color: ${value}`);
  return luminanceOfOklch(ok);
}

export const contrastOf = (a: string, b: string): number => contrastFromLuminance(luminanceOf(a), luminanceOf(b));
