/**
 * The hero name's wdth solver (DESIGN.md §7.4 SYSTEM: fit, don't shrink — wdth 75–125 at a fixed
 * --step-5). Client-safe: no schema, no content — the model arrives as a prop
 * (content/name-fit.ts validates it on the server).
 */
export const WDTH_RANGE = { min: 75, max: 125 } as const;

export type WidthSamples = readonly (readonly [number, number])[];

/** The page's model of the name: [wdth, width in em] samples, as one line and as its longer line. */
export interface NameFitModel {
  oneLine: WidthSamples;
  twoLine: WidthSamples;
  /** the narrowest viewport (CSS px) at which the name fits on one line */
  oneLineMinViewport: number;
}

/**
 * The wdth at which the text fills `containerPx` at `fontPx` (the model's em widths grow with
 * wdth; between samples the width is linear, as a variable font's advances are between masters).
 * Clamped to the axis: below 75 it can't get narrower (that's when the name takes two lines).
 */
export function solveWdth(samples: WidthSamples, containerPx: number, fontPx: number): number {
  if (!(containerPx > 0 && fontPx > 0) || samples.length < 2) return WDTH_RANGE.max;
  const targetEm = containerPx / fontPx;
  const first = samples[0] as readonly [number, number];
  const last = samples[samples.length - 1] as readonly [number, number];
  if (targetEm <= first[1]) return first[0];
  if (targetEm >= last[1]) return last[0];
  for (let i = 1; i < samples.length; i++) {
    const [w1, e1] = samples[i] as readonly [number, number];
    const [w0, e0] = samples[i - 1] as readonly [number, number];
    if (targetEm <= e1) return Math.round((w0 + ((targetEm - e0) / (e1 - e0)) * (w1 - w0)) * 100) / 100;
  }
  return last[0];
}
