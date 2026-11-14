import type { CSSProperties } from "react";

/** Inline style object that may also carry CSS custom properties (`--mx`, `--bracket-inset` …). */
export type CSSVars = CSSProperties & { [key: `--${string}`]: string | number | undefined };

export function vars(v: CSSVars): CSSProperties {
  return v as CSSProperties;
}
