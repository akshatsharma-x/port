import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** right-aligned tabular figures: numbers that line up in a column (§2.5) */
  numeric?: boolean;
  /** prose: wraps at a reading measure instead of staying on one line */
  wide?: boolean;
}

export interface TableProps<T> {
  /** the DOM id; the caption labels the scroll region by it */
  id: string;
  caption: ReactNode;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  /** the first column names the row (<th scope="row">) and stays pinned while scrolling sideways */
  rowHeader?: boolean;
  className?: string;
}

/**
 * A real <table> — the ledger (DESIGN.md §7.4): mono, hairline rules, green-bar banding. The
 * wrapper scrolls sideways and takes focus, so a keyboard can scroll a wide table too.
 */
export function Table<T>({ id, caption, columns, rows, rowKey, rowHeader = false, className }: TableProps<T>) {
  const captionId = `${id}-caption`;
  return (
    <div className={cx("table-wrap", className)} role="region" aria-labelledby={captionId} tabIndex={0}>
      <table id={id} className="table" data-row-header={rowHeader || undefined}>
        <caption id={captionId} className="table__caption">
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" data-numeric={c.numeric || undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)}>
              {columns.map((c, j) => {
                const Cell = rowHeader && j === 0 ? "th" : "td";
                return (
                  <Cell key={c.key} scope={Cell === "th" ? "row" : undefined} data-numeric={c.numeric || undefined} data-wide={c.wide || undefined}>
                    {c.cell(row, i)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
