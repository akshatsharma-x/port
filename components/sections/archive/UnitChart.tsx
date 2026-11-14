import { derived } from "@/content/derive";
import { ARCHIVE } from "@/lib/archive";
import { UnitChartTips } from "./UnitChartTips";

/**
 * PUBLICATIONS BY YEAR (DESIGN.md §7.4) — a unit chart in plain SVG, no chart library: one cell per
 * paper, and every cell is its dossier's link. --accent-fill cells with a 2 px surface gap; under
 * review or in prep, hollow. A hairline baseline and tabular mono year ticks, every year in range
 * (gaps kept: a truthful axis) through this year; only the peak year and this year are labelled.
 * A single series, so no legend; the ledger is its table view. A hover/focus tooltip per cell.
 */
export function UnitChart() {
  const d = derived;
  const L = d.site.labels.archive;
  const U = ARCHIVE.unit;
  const index = new Map(d.graph.nodes.map((n, i) => [n.id, i]));
  const bySlug = new Map(d.publications.map((p) => [p.slug, p]));
  const current = Number(d.buildDate.slice(0, 4));
  const first = d.research.byYear[0]?.year ?? current;
  const years = Array.from({ length: Math.max(current, d.research.byYear.at(-1)?.year ?? current) - first + 1 }, (_, k) => {
    const year = first + k;
    return { year, papers: d.research.byYear.find((y) => y.year === year)?.papers ?? [] };
  });
  const most = Math.max(1, ...years.map((y) => y.papers.length));
  const peak = [...years].reverse().find((y) => y.papers.length === most)?.year ?? current;
  const pitch = U.cell + U.gap;
  const width = years.length * U.column;
  const plot = most * pitch;
  const height = plot + U.tick + U.label;
  const x = (k: number) => k * U.column + (U.column - U.cell) / 2;

  return (
    <figure className="unit-chart">
      <figcaption className="unit-chart__title t-micro">{L.byYear.title}</figcaption>
      <UnitChartTips>
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="unit-chart__svg" role="group" aria-label={L.byYear.title}>
          {years.map((y, k) =>
            y.papers.map((p, j) => {
              const pub = bySlug.get(p.slug);
              const tip = [p.title, pub?.venueShort, String(y.year), p.counted ? null : L.status[p.status]].filter(Boolean).join(" · ");
              return (
                <a key={p.slug} href={`/research/${p.slug}`} className="unit-chart__cell" data-cell data-transition="dossier" data-i={index.get(p.slug)} data-tip={tip} aria-label={tip}>
                  <rect
                    x={x(k) + (p.counted ? 0 : 0.75)}
                    y={plot - (j + 1) * pitch + U.gap + (p.counted ? 0 : 0.75)}
                    width={U.cell - (p.counted ? 0 : 1.5)}
                    height={U.cell - (p.counted ? 0 : 1.5)}
                    className={p.counted ? "unit-chart__fill" : "unit-chart__hollow"}
                  />
                </a>
              );
            }),
          )}
          <line x1={0} x2={width} y1={plot + 0.5} y2={plot + 0.5} className="unit-chart__baseline" />
          {years.map((y, k) => (
            <line key={y.year} x1={x(k) + U.cell / 2} x2={x(k) + U.cell / 2} y1={plot} y2={plot + U.tick} className="unit-chart__tick" />
          ))}
          {years
            .filter((y) => y.year === peak || y.year === current)
            .map((y) => (
              <text key={y.year} x={x(years.indexOf(y)) + U.cell / 2} y={height - 2} textAnchor="middle" className="unit-chart__year">
                {String(y.year)}
              </text>
            ))}
        </svg>
      </UnitChartTips>
      <p className="unit-chart__note t-micro">{`${L.byYear.peak} ${peak} · ${L.byYear.current} ${current}${d.research.underReview + d.research.inPrep > 0 ? ` · ${L.byYear.hollow}` : ""}`}</p>
    </figure>
  );
}
