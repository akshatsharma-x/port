import type { ElementType, HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export interface GridProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "header" | "footer" | "main" | "article" | "ul" | "ol";
}

/** The 12-column layout grid (DESIGN.md §2.7): fluid gutters and margins, capped at 2048 px ≥ 2200 px. */
export function Grid({ as = "div", className, ...rest }: GridProps) {
  const Tag = as as ElementType;
  return <Tag className={cx("layout-grid", className)} {...rest} />;
}

export interface ColProps extends HTMLAttributes<HTMLDivElement> {
  /** columns to span (1–12); omit to size with responsive classes instead */
  span?: number;
  /** first column (1–12) */
  start?: number;
}

export function Col({ span, start, style, ...rest }: ColProps) {
  const gridColumn = span ? (start ? `${start} / span ${span}` : `span ${span} / span ${span}`) : start ? `${start}` : undefined;
  return <div style={gridColumn ? { gridColumn, ...style } : style} {...rest} />;
}
