/**
 * A figure's provenance (DESIGN.md §7.4: every number says where it comes from): its source, then
 * "as of" and the date held on one line, so a narrow column wraps before "as of", never inside the
 * date (the phone edition read "AS OF 2026-" / "11-11", Part 8).
 */
export function Provenance({ source, asOf, label }: { source: string; asOf: string | null; label: string }) {
  return (
    <>
      {source}
      {asOf && (
        <>
          {" · "}
          <span className="whitespace-nowrap">
            {`${label} `}
            <time dateTime={asOf}>{asOf}</time>
          </span>
        </>
      )}
    </>
  );
}
