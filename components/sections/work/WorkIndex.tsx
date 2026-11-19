import type { Content } from "@/content/schema";
import type { CoverImg } from "./Work";
import { IndexEnhance } from "./IndexEnhance";

export interface IndexRow {
  slug: string;
  href: string;
  number: string;
  title: string;
  role: string | null;
  year: number | null;
  category: string;
  stack: readonly string[];
  /** its slide on the rail (−1: not on it) */
  slide: number;
  cover: CoverImg;
}

type Labels = Content["site"]["labels"]["work"]["index"];

/** A fact not in yet: a dash on screen, "to come" to a screen reader. */
function Pending({ text }: { text: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{text}</span>
    </>
  );
}

/**
 * WORK's INDEX (DESIGN.md §7.4): every project in a dense table — # · TITLE · ROLE · YEAR · STACK
 * · → — server-rendered, so it's crawlable and whole without JS; each title is its case study's
 * link and the row is its target. The filter chips (by category, by any stack two projects share)
 * are HTML too; their behavior, the rows' FLIP and the B4 cover preview arrive lazily on idle
 * (IndexEnhance). A year or role not yet in shows as pending.
 */
export function WorkIndex({ rows, labels, pending }: { rows: IndexRow[]; labels: Labels; pending: string }) {
  // a column no row fills yet isn't drawn (Part 16; §10 #42 refined): a dash marks a pending fact in
  // a drawn column, but a column of nothing but dashes is no column — and its width wrapped titles
  const hasRole = rows.some((r) => r.role !== null);
  const hasYear = rows.some((r) => r.year !== null);
  const categories = [...new Set(rows.map((r) => r.category))];
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r.stack) counts.set(t, (counts.get(t) ?? 0) + 1);
  const shared = [...counts].filter(([, n]) => n > 1).map(([t]) => t).sort((a, b) => a.localeCompare(b, "en"));
  const group = (key: "category" | "stack", legend: string, values: string[]) => (
    <fieldset className="work-filters__group">
      <legend className="t-micro">{legend}</legend>
      <button type="button" className="chip chip--toggle t-micro" aria-pressed="true" data-filter={key} data-value="">
        <span aria-hidden="true">■</span>
        {labels.all}
      </button>
      {values.map((v) => (
        <button key={v} type="button" className="chip chip--toggle t-micro" aria-pressed="false" data-filter={key} data-value={v}>
          <span aria-hidden="true">□</span>
          {v}
        </button>
      ))}
    </fieldset>
  );
  return (
    <div className="work-index col-span-12" data-work-index="">
      <div className="work-filters" role="group" aria-label={labels.filters}>
        {group("category", labels.category, categories)}
        {shared.length > 0 && group("stack", labels.stackGroup, shared)}
        <p className="work-filters__count t-micro" aria-live="polite" data-index-count="" />
      </div>
      <table className="work-table">
        <caption className="work-table__caption t-micro">{labels.caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="work-table__num">
              {labels.number}
            </th>
            <th scope="col">{labels.title}</th>
            {hasRole && <th scope="col">{labels.role}</th>}
            {hasYear && <th scope="col">{labels.year}</th>}
            <th scope="col" className="work-table__stack">
              {labels.stack}
            </th>
            <th scope="col" className="work-table__go">
              <span className="sr-only">{labels.open}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slug} className="work-table__row" data-slug={r.slug} data-category={r.category} data-stack={r.stack.join("|")} data-slide={r.slide}>
              <td className="work-table__num numeral">{r.number}</td>
              <th scope="row" className="work-table__title">
                <a href={r.href} className="work-table__link">
                  {r.title}
                </a>
              </th>
              {hasRole && <td className="work-table__role">{r.role ?? <Pending text={pending} />}</td>}
              {hasYear && <td className="work-table__year numeral">{r.year === null ? <Pending text={pending} /> : String(r.year)}</td>}
              <td className="work-table__stack t-micro">{r.stack.join(" · ")}</td>
              <td className="work-table__go" aria-hidden="true">
                →
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="work-index__none t-small" data-index-none="" hidden>
        {labels.none}
      </p>
      <IndexEnhance covers={Object.fromEntries(rows.map((r) => [r.slug, r.cover]))} labels={{ of: labels.of, shown: labels.shown }} total={rows.length} />
    </div>
  );
}
