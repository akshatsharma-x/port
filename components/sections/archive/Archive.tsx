import { StickyStack } from "@/components/scroll/StickyStack";
import { StageSlot } from "@/components/stage/StageSlot";
import { Grid } from "@/components/ui/Grid";
import { derived } from "@/content/derive";
import { LAYOUTS, type CitedVenueType } from "@/content/schema";
import { ARCHIVE } from "@/lib/archive";
import { SHAPE_ORDER } from "@/lib/archive-shapes";
import { LayoutChips } from "./LayoutChips";
import { Ledger, type LedgerRow } from "./Ledger";
import { Metrics } from "./Metrics";
import { QueryScope } from "./QueryScope";
import { ShapeGlyph } from "./ShapeGlyph";
import { SkyLayer } from "./SkyLayer";
import type { SkyLabel, SkyNode } from "./SkyOverlay";
import { SkySvg } from "./SkySvg";
import { UnitChart } from "./UnitChart";

/**
 * 04 · ARCHIVE — Research & Publications (DESIGN.md §7.4, §4.3 A3). A microfiche terminal that
 * renders in real-time 3D:
 *   - the pin (≤ 150 svh): the citation constellation behind the ARCHIVE QUERY bar — the live
 *     counts, the layout chips, the shape legend (always visible) — and its HTML layer (labels,
 *     tooltip, keyboard-navigable stars)
 *   - the document after it (the interlock to WORK): the metrics, the unit chart, the ledger
 * Without a stage (phones, reduced motion, LOW) the build-time SVG constellation is the header.
 */
export function Archive() {
  const d = derived;
  const L = d.site.labels.archive;
  const nf = new Intl.NumberFormat("en-US");
  const pubs = new Map(d.publications.map((p) => [p.slug, p]));
  const citedWorks = new Map(d.citedWorks.map((w) => [w.id, w]));
  const index = new Map(d.graph.nodes.map((n, i) => [n.id, i]));
  const count = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`;
  const cites = (n: number) => count(n, L.query.citation, L.query.citations);

  const nodes: SkyNode[] = d.graph.nodes.flatMap((n, i): SkyNode[] => {
    const p = pubs.get(n.id);
    if (p) {
      const status = p.counted ? "" : ` · ${L.status[p.status]}`;
      return [
        {
          i,
          kind: "record",
          title: p.title,
          meta: `${p.venueShort} · ${p.year} · ${cites(p.citations)}${status}`,
          label: `${p.title}. ${L.venueTypes[p.venueType]}, ${p.venueShort}, ${p.year}. ${cites(p.citations)}.${status}`,
          href: `/research/${p.slug}`,
        },
      ];
    }
    const w = citedWorks.get(n.id);
    if (!w) return [];
    const counted = w.citations === null ? null : cites(w.citations);
    return [
      {
        i,
        kind: "cited",
        title: w.title,
        meta: [w.venue, String(w.year), counted].filter(Boolean).join(" · "),
        label: `${w.title}, ${w.authors}. ${w.venue}, ${w.year}. ${L.sky.citedBy}: ${w.citedByTitles.join("; ")}.`,
        href: w.link,
      },
    ];
  });

  const years = d.graph.labels.year.map((l) => Number(l.id));
  const mine = new Set(d.publications.map((p) => p.year));
  const labels: Record<(typeof LAYOUTS)[number], SkyLabel[]> = {
    topic: d.graph.labels.topic.map((l, k) => ({ k, text: d.site.topicClusters[l.id] ?? l.id })),
    year: yearTicks(years, mine, ARCHIVE.yearTicks).map((k) => ({ k, text: String(years[k]) })),
    venue: d.graph.labels.venue.map((l, k) => ({ k, text: L.venueTypes[l.id as CitedVenueType] ?? l.id })),
  };

  const rows: LedgerRow[] = d.publications.map((p) => ({
    slug: p.slug,
    i: index.get(p.slug) ?? -1,
    year: p.year,
    date: p.year * 100 + (p.month ?? 0),
    venueShort: p.venueShort,
    title: p.title,
    authors: p.authors.map((a) => ({ name: a.name, me: a.isMe })),
    citations: p.citations,
    status: p.counted ? null : L.status[p.status],
  }));

  const allYears = d.publications.map((p) => p.year);
  const span = allYears.length ? (Math.min(...allYears) === Math.max(...allYears) ? String(allYears[0]) : `${Math.min(...allYears)}–${Math.max(...allYears)}`) : null;
  const hasCited = d.citedWorks.length > 0;
  const query = [
    <QueryScope key="scope" all={L.query.all} scope={L.query.scope} match={L.query.match} matches={L.query.matches} clear={L.query.clear} />,
    count(d.research.total, L.query.record, L.query.records),
    ...(hasCited ? [`${nf.format(d.citedWorks.length)} ${L.query.cited}`] : []),
    cites(d.research.citations),
    ...(span ? [span] : []),
  ];

  return (
    <>
      <StickyStack
        id="archive"
        steps={ARCHIVE.steps}
        className="archive-pin"
        backdrop={
          <div className="archive-backdrop">
            <StageSlot id="archive" className="h-[100svh]" />
          </div>
        }
      >
        <div className="archive-frame">
          <div className="archive-query" role="group" aria-label={L.query.label} tabIndex={-1}>
            <p className="archive-query__counts t-micro">
              {/* each ▸ travels with the item after it, so a wrapped line never ends on a separator */}
              {query.map((text, k) => (
                <span key={k} className="archive-query__item">
                  {k > 0 && <span aria-hidden="true">▸</span>}
                  {text}
                </span>
              ))}
            </p>
            <LayoutChips legend={L.query.layout} options={LAYOUTS.map((value) => ({ value, label: L.layouts[value] }))} />
            <ul className="shape-legend" aria-label={L.legend.label}>
              {SHAPE_ORDER.map((t) => (
                <li key={t} className="shape-legend__item t-micro">
                  <ShapeGlyph type={t} />
                  {L.venueTypes[t]}
                </li>
              ))}
              <li className="shape-legend__item shape-legend__item--key t-micro">
                <ShapeGlyph type="journal" dashed />
                {L.legend.dashed}
              </li>
              {hasCited && (
                <li className="shape-legend__item shape-legend__item--key t-micro">
                  <ShapeGlyph type="journal" faint />
                  {L.legend.cited}
                </li>
              )}
            </ul>
          </div>
          {/* without a stage the drawing is the header, in the frame's flow under the query bar: it fills
              what the bar leaves (the bar's height varies with the width; a fixed offset collided at 360 px) */}
          <SkySvg label={L.sky.label} topics={labels.topic.map((l) => l.text)} className="archive-sky-svg" />
          <SkyLayer nodes={nodes} labels={labels} listLabel={L.sky.label} hint={L.sky.hint} />
          <p className="sr-only">{`${L.sky.stage} ${L.sky.keys}`}</p>
        </div>
      </StickyStack>

      <Grid className="archive-doc">
        <div className="col-span-12 lg:col-span-5">
          <Metrics />
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <UnitChart />
        </div>
        <div className="col-span-12">
          <Ledger
            rows={rows}
            caption={L.ledger.caption}
            labels={{ year: L.ledger.year, venue: L.ledger.venue, title: L.ledger.title, authors: L.ledger.authors, citations: L.ledger.citations, sortBy: L.ledger.sortBy, ascending: L.ledger.ascending, descending: L.ledger.descending }}
          />
        </div>
      </Grid>
    </>
  );
}

/** Which year labels show: the first, the last and every year with a record of mine, then evenly spaced others, up to `max`. */
function yearTicks(years: readonly number[], mine: ReadonlySet<number>, max: number): number[] {
  if (years.length <= max) return years.map((_, k) => k);
  const keep = new Set<number>([0, years.length - 1, ...years.flatMap((y, k) => (mine.has(y) ? [k] : []))]);
  const room = Math.max(0, max - keep.size);
  for (let j = 1; j <= room; j++) keep.add(Math.round((j * (years.length - 1)) / (room + 1)));
  return [...keep].sort((a, b) => a - b);
}
