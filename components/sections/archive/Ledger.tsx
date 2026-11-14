"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useArchive } from "@/lib/archive";

export interface LedgerRow {
  slug: string;
  /** graph index: hovering the row lights this star */
  i: number;
  year: number;
  /** year then month, for the in-year order */
  date: number;
  venueShort: string;
  title: string;
  /** in the paper's order; me in --accent at 600, co-authors in --fg-2 mono */
  authors: readonly { name: string; me: boolean }[];
  /** "0" or a count; the unknown mark when nobody's counted */
  citations: number;
  /** "Under review" / "In prep" for an unpublished record, else null */
  status: string | null;
}

type SortKey = "year" | "citations" | "venue";

/**
 * THE LEDGER (DESIGN.md §7.4): every publication in a real <table> — scannable, crawlable, the
 * accessible path through the archive and the unit chart's table view. Sorted by year it's grouped
 * under sticky year headers; by citations or venue, one run. The active column carries aria-sort.
 * Green-bar banding (--bg-band). A row's title is its dossier link; pointing at a row lights its
 * star in the sky above.
 */
export function Ledger({
  rows,
  caption,
  labels,
}: {
  rows: readonly LedgerRow[];
  caption: string;
  labels: { year: string; venue: string; title: string; authors: string; citations: string };
}) {
  const [key, setKey] = useState<SortKey>("year");
  const [desc, setDesc] = useState(true);
  const point = useArchive((s) => s.point);
  // a keyword from a dossier lights its records here too: the stage-less editions' only sky is this
  const keyword = useArchive((s) => s.keyword);

  const sorted = useMemo(() => {
    const dir = desc ? -1 : 1;
    const by: Record<SortKey, (a: LedgerRow, b: LedgerRow) => number> = {
      year: (a, b) => dir * (a.date - b.date) || (a.slug < b.slug ? -1 : 1),
      citations: (a, b) => dir * (a.citations - b.citations) || b.date - a.date,
      venue: (a, b) => dir * a.venueShort.localeCompare(b.venueShort, "en") || b.date - a.date,
    };
    return [...rows].sort(by[key]);
  }, [rows, key, desc]);

  const groups = key === "year" ? [...new Set(sorted.map((r) => r.year))].map((y) => ({ year: y, rows: sorted.filter((r) => r.year === y) })) : [{ year: null, rows: sorted }];

  const header = (k: SortKey, text: string, className: string) => {
    const on = key === k;
    return (
      <th scope="col" className={className} aria-sort={on ? (desc ? "descending" : "ascending") : "none"}>
        <button
          type="button"
          className="ledger__sort"
          onClick={() => {
            if (on) setDesc(!desc);
            else {
              setKey(k);
              setDesc(k !== "venue");
            }
          }}
        >
          {/* its name is the column's word; the order is the header's aria-sort, which a screen reader
              says with it ("Year, sorted descending") — a spelled-out "Sort by Year, descending" said
              it twice (Part 14's accessibility-tree review) */}
          <span>{text}</span>
          <span aria-hidden="true">{on ? (desc ? "▼" : "▲") : "△"}</span>
        </button>
      </th>
    );
  };

  return (
    <table className="ledger">
      <caption className="ledger__caption t-micro">{caption}</caption>
      <thead>
        <tr>
          {header("year", labels.year, "ledger__year")}
          {header("venue", labels.venue, "ledger__venue")}
          <th scope="col" className="ledger__title">
            {labels.title}
          </th>
          <th scope="col" className="ledger__authors">
            {labels.authors}
          </th>
          {header("citations", labels.citations, "ledger__cites")}
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.year ?? "all"} className="ledger__group">
          {g.year !== null && (
            <tr className="ledger__year-row">
              <th scope="rowgroup" colSpan={5} className="ledger__year-head t-micro">
                {String(g.year)}
              </th>
            </tr>
          )}
          {g.rows.map((r) => (
            <tr
              key={r.slug}
              className="ledger__row"
              data-status={r.status ? "pending" : undefined}
              data-lit={keyword?.matches.includes(r.i) || undefined}
              onPointerEnter={() => point(r.i)}
              onPointerLeave={() => point(null)}
            >
              <td className="ledger__year numeral">{r.year}</td>
              <td className="ledger__venue t-micro">{r.venueShort}</td>
              <th scope="row" className="ledger__title">
                <Link href={`/research/${r.slug}`} scroll={false} data-transition="dossier" className="ledger__link" onFocus={() => point(r.i)} onBlur={() => point(null)}>
                  {r.title}
                </Link>
                {r.status && <span className="ledger__status t-micro">{r.status}</span>}
              </th>
              <td className="ledger__authors">
                {r.authors.map((a) => (
                  <span key={a.name} className={a.me ? "author-me" : "author-co"}>
                    {a.name}
                  </span>
                ))}
              </td>
              <td className="ledger__cites numeral">
                {/* a phone's record card has no column header over it: the cell says what it counts */}
                <span className="ledger__cell-label t-micro" aria-hidden="true">
                  {labels.citations}
                </span>
                {r.citations}
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}
