import type { ReactNode } from "react";
import type { Column } from "@/components/ui/Table";
import { audit } from "@/content/dev";

/**
 * Renders any parsed value exactly as data.ts holds it — raw numbers, raw enums, every list item —
 * so the audit shows what the site will read, not a prettified guess.
 */
const isLong = (v: unknown) =>
  (typeof v === "string" && v.length > 60) || (Array.isArray(v) && v.some((x) => (typeof x === "string" && x.length > 40) || (typeof x === "object" && x !== null)));

/** Prose past this length collapses to a native <details>, so a row stays a row. */
const COLLAPSE_AT = 180;
const SNIPPET = 120;
const snippet = (s: string) => {
  const cut = s.slice(0, SNIPPET);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), SNIPPET / 2))}…`;
};

/** An object on one flowing line: key value · key value. */
function Inline({ of }: { of: object }) {
  return (
    <span>
      {Object.entries(of).map(([k, x], i) => (
        <span key={k}>
          {i > 0 && <span className="text-fg-3"> · </span>}
          <span className="text-fg-3">{k}</span> <Value v={x} />
        </span>
      ))}
    </span>
  );
}

export function Value({ v }: { v: unknown }): ReactNode {
  if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) return <span className="text-fg-3">{audit.empty}</span>;
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (/^https:\/\//.test(v)) {
      return (
        <a href={v} className="text-fg-2 underline decoration-line-2 underline-offset-2 hover:text-fg-1" target="_blank" rel="noreferrer">
          {v}
        </a>
      );
    }
    const text = v.includes("\n") ? <span className="whitespace-pre-wrap">{v}</span> : v;
    if (v.length <= COLLAPSE_AT) return text;
    return (
      <details className="group">
        <summary className="cursor-pointer text-fg-2 group-open:text-fg-3">{snippet(v.replace(/\s+/g, " "))}</summary>
        <div className="pt-2">{text}</div>
      </details>
    );
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object" || x === null) && !isLong(v)) return v.map(String).join(" · ");
    return (
      <ul className="grid gap-1">
        {v.map((x, i) => (
          <li key={i}>{typeof x === "object" && x !== null && !Array.isArray(x) ? <Inline of={x} /> : <Value v={x} />}</li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object") {
    return (
      <span className="grid gap-0.5">
        {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
          <span key={k}>
            <span className="text-fg-3">{k}</span> <Value v={x} />
          </span>
        ))}
      </span>
    );
  }
  return String(v);
}

/** Columns for a raw table: the union of the records' own keys, in first-seen order. */
export function rawColumns<T extends object>(rows: readonly T[]): Column<T>[] {
  const keys: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
  return keys.map((key) => {
    const values = rows.map((r) => (r as Record<string, unknown>)[key]);
    return {
      key,
      header: key,
      numeric: values.every((v) => typeof v === "number"),
      wide: values.some(isLong),
      cell: (r: T) => <Value v={(r as Record<string, unknown>)[key]} />,
    };
  });
}
