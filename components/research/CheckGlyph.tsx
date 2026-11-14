/** ✓ from the 12 × 12 pixel-grid set (DESIGN.md §2.10): the mono font has no check mark. */
const PIXELS: readonly (readonly [number, number])[] = [
  [9, 3], [10, 3], [8, 4], [9, 4], [7, 5], [8, 5], [1, 6], [2, 6], [6, 6], [7, 6], [2, 7], [3, 7], [5, 7], [6, 7], [3, 8], [4, 8], [5, 8], [4, 9],
];

export function CheckGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="1em" height="1em" shapeRendering="crispEdges" aria-hidden="true" focusable="false" className="pixel-glyph">
      <path d={PIXELS.map(([x, y]) => `M${x},${y}h1v1h-1z`).join("")} fill="currentColor" />
    </svg>
  );
}
