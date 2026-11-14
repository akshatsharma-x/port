import { guillocheFigures } from "@/lib/guilloche";

/**
 * The figures the cards share (DESIGN.md §4.4 B1), drawn once per page and placed by each card's
 * own `<use>`s: the guilloche's rosettes and wave band (lib/guilloche.ts) and the issuer seal.
 */
export function CredDefs() {
  const g = guillocheFigures();
  return (
    <svg className="sr-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {g.rings.map((r) => (
          <g key={r.id} id={r.id}>
            {r.ellipses.map((e) => (
              <ellipse key={e.turn} cx={e.cx} rx={e.rx} ry={e.ry} transform={`rotate(${e.turn})`} />
            ))}
          </g>
        ))}
        <path id={`${g.wave.id}-line`} d={g.wave.d} />
        <g id={g.wave.id}>
          {g.wave.lines.map((l) => (
            <use key={l.dy} href={`#${g.wave.id}-line`} x={l.dx} y={l.dy} />
          ))}
        </g>
        <g id={g.seal.id}>
          <path d={g.seal.d} />
          {g.seal.rings.map((r) => (
            <circle key={r} r={r} />
          ))}
        </g>
      </defs>
    </svg>
  );
}

/** RECORDS' kind glyphs (§4.4 B2), 16 × 16, drawn once. */
export function RecordDefs() {
  return (
    <svg className="sr-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <path id="rec-award" d="M8 1.5l1.9 4.2 4.6.4-3.5 3 1.1 4.5L8 11.2l-4.1 2.4 1.1-4.5-3.5-3 4.6-.4z" />
        <g id="rec-honor">
          <path d="M8 1.5 14.5 8 8 14.5 1.5 8z" />
          <path d="M8 5l3 3-3 3-3-3z" />
        </g>
        <path id="rec-speaking" d="M6 2.5h4v6a2 2 0 0 1-4 0zM3.8 7.5a4.2 4.2 0 0 0 8.4 0M8 11.7v2.8M5.5 14.5h5" />
        <g id="rec-oss">
          <circle cx="5" cy="3" r="1.6" />
          <circle cx="5" cy="13" r="1.6" />
          <circle cx="11" cy="5" r="1.6" />
          <path d="M5 4.6v6.8M11 6.6c0 3-6 2-6 5" />
        </g>
        <path id="rec-press" d="M2.5 3.5h9v9h-9zM11.5 6h2v6.5h-2M4.5 6h5M4.5 8.5h5M4.5 11h3" />
        <g id="rec-grant">
          <ellipse cx="8" cy="4.5" rx="5" ry="2" />
          <path d="M3 4.5v3c0 1.1 2.2 2 5 2s5-.9 5-2v-3M3 7.5v3c0 1.1 2.2 2 5 2s5-.9 5-2v-3" />
        </g>
        <g id="rec-patent">
          <circle cx="8" cy="7" r="4" />
          <path d="M5.5 10.5l-1 4L8 12.8l3.5 1.7-1-4" />
        </g>
      </defs>
    </svg>
  );
}
