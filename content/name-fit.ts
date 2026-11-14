import { z } from "zod";
import { WDTH_RANGE } from "@/lib/name-fit";

export { solveWdth, WDTH_RANGE } from "@/lib/name-fit";

/**
 * The hero name's width model (content/name-fit.json, written by scripts/fonts/name-fit.ts) and
 * the solver the page uses with it (DESIGN.md §7.4 SYSTEM: fit, don't shrink — wdth 75–125 at a
 * fixed --step-5; two lines only below 75). Pure: tests/name-fit.test.ts checks the solver.
 */
const sample = z.tuple([z.number(), z.number().positive()]);
export const NameFitFileSchema = z.strictObject({
  version: z.literal(1),
  inputHash: z.string(),
  text: z.string().min(1),
  weight: z.number(),
  trackingEm: z.number(),
  lines: z.array(z.string()).min(1).max(2),
  /** [wdth, width in em] — the whole name on one line, and the longer of its two lines */
  oneLine: z.array(sample).min(2),
  twoLine: z.array(sample).min(2),
  /** the narrowest viewport (CSS px) at which the name fits on one line */
  oneLineMinViewport: z.number().int().min(0),
  /** first paint, before any script: [min viewport px, wdth] — the page's own fit refines it */
  bands: z.array(z.tuple([z.number().int(), z.number()])).min(1),
});
export type NameFit = z.infer<typeof NameFitFileSchema>;

/** The two lines the name breaks into: at the space nearest its middle. */
export function nameLines(name: string): [string, string?] {
  const spaces = [...name.matchAll(/ /g)].map((m) => m.index ?? 0);
  if (spaces.length === 0) return [name];
  const mid = name.length / 2;
  const at = spaces.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  return [name.slice(0, at), name.slice(at + 1)];
}

/** Everything the model depends on: the text, the face, the mega step, and the fluid size and margin the bands are solved against. */
export interface NameFitInputs {
  text: string;
  /** sha256 of the baked face's file (hex, 16 chars) */
  fontHash: string;
  weight: number;
  trackingEm: number;
  /** the tokens' own expressions: --step-5 and --margin */
  step5: string;
  margin: string;
}

/**
 * FNV-1a over the model's inputs. The bake stores it; tests/hero.test.ts recomputes it from the
 * repo, so changing any input without re-running scripts/fonts/name-fit.ts fails.
 */
export function nameFitInputHash(i: NameFitInputs): string {
  let h = 0x811c9dc5;
  for (const ch of [i.text, i.fontHash, i.weight, i.trackingEm, i.step5, i.margin].join("|")) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** First paint, before any script: the model's viewport bands as plain CSS (server-rendered). */
export function nameFitCss(fit: NameFit): string {
  const [first, ...rest] = fit.bands;
  // --fit-em-max: the one-line width at wdth 125, in em — once the axis is spent, the name's size
  // grows to fill the measure instead (styles/hero.css)
  const emMax = fit.oneLine.at(-1)?.[1] ?? 1;
  const rules = [`.hero-name{--fit-wdth:${first?.[1] ?? WDTH_RANGE.max}%;--fit-em-max:${emMax};white-space:nowrap}`];
  for (const [vw, w] of rest) rules.push(`@media (min-width:${vw}px){.hero-name{--fit-wdth:${w}%}}`);
  if (fit.oneLineMinViewport > 0) rules.push(`@media (max-width:${fit.oneLineMinViewport - 0.02}px){.hero-name{white-space:normal}}`);
  return rules.join("");
}
