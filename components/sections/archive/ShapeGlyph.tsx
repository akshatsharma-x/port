import type { CitedVenueType } from "@/content/schema";
import { shapePath } from "@/lib/archive-shapes";
import { cx } from "@/lib/cx";

/**
 * One of A3's shapes as SVG (DESIGN.md §2.10: marks the mono font lacks — ✱ ⬢ ✚ — are drawn,
 * never left to a fallback font). The geometry is lib/archive-shapes.ts's, which the WebGL glyphs
 * read too: the legend is the star's own shape. Filled = published; a dashed outline = not yet.
 */
export function ShapeGlyph({ type, dashed = false, faint = false, tuned = false, className }: { type: CitedVenueType; dashed?: boolean; faint?: boolean; tuned?: boolean; className?: string }) {
  const d = shapePath(type, 10);
  return (
    <svg viewBox="-12 -12 24 24" className={cx("shape-glyph", faint && "shape-glyph--faint", tuned && "shape-glyph--tuned", className)} aria-hidden="true" focusable="false">
      {dashed ? <path d={d} className="shape-glyph__dash" /> : <path d={d} className="shape-glyph__fill" />}
    </svg>
  );
}
