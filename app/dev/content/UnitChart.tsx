/**
 * Publications by year as a unit chart (DESIGN.md §7.4): one cell per record, a 2 px surface gap,
 * filled = counted, hollow = under review / in prep. Every year in range keeps its column, gaps
 * included. One series, so no legend box; the note says what hollow means.
 */
export interface UnitChartProps {
  title: string;
  years: readonly { year: number; papers: readonly { slug: string; title: string; status: string; counted: boolean }[] }[];
}

const CELL = 16;
const GAP = 2; // the surface gap
const COL_GAP = 18;
const AXIS = 18;
const EDGE = 8; // a year tick is wider than its cell: room at both ends

export function UnitChart({ title, years }: UnitChartProps) {
  const tallest = Math.max(1, ...years.map((y) => y.papers.length));
  const width = years.length * (CELL + COL_GAP) - COL_GAP + 2 * EDGE;
  const height = tallest * (CELL + GAP) + AXIS;
  const base = tallest * (CELL + GAP);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title} className="h-auto max-w-full">
      <line x1={0} x2={width} y1={base + 0.5} y2={base + 0.5} stroke="var(--line-2)" strokeWidth={1} />
      {years.map((y, col) => {
        const x = EDGE + col * (CELL + COL_GAP);
        return (
          <g key={y.year}>
            {y.papers.map((p, i) => {
              const top = base - (i + 1) * (CELL + GAP);
              return p.counted ? (
                <rect key={p.slug} x={x} y={top} width={CELL} height={CELL} rx={2} fill="var(--accent-fill)">
                  <title>{`${p.title} · ${y.year} · ${p.status}`}</title>
                </rect>
              ) : (
                <rect key={p.slug} x={x + 0.5} y={top + 0.5} width={CELL - 1} height={CELL - 1} rx={2} fill="none" stroke="var(--accent)" strokeWidth={1}>
                  <title>{`${p.title} · ${y.year} · ${p.status}`}</title>
                </rect>
              );
            })}
            <text x={x + CELL / 2} y={base + AXIS - 4} textAnchor="middle" fill="var(--fg-3)" fontFamily="var(--ff-mono)" fontSize={10}>
              {y.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
