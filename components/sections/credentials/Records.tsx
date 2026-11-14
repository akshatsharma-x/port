import { Counter } from "@/components/ui/Counter";
import { Marquee } from "@/components/ui/Marquee";
import { Reveal } from "@/components/ui/Reveal";
import { Scramble } from "@/components/ui/Scramble";
import { Text } from "@/components/ui/Text";
import type { Derived } from "@/content/selectors";
import { RecordDefs } from "./Defs";

/** A scramble runs over one line at most (§7.4: ≤ 40 characters). */
const SCRAMBLE_MAX = 40;

/**
 * 07 · RECORDS (DESIGN.md §7.4, §4.4 B2), server HTML: one figure in LED numerals and up to three
 * tiles under it, every one counted from the records (content/selectors.ts recordFigures); the
 * records as bracketed cards, each with its kind's glyph, in a staggered masonry (their tilt, at most
 * 6°, arrives on idle); the press as a marquee and the testimonials as a transmission — each only
 * when there's one to show.
 */
export function Records({ d }: { d: Derived }) {
  const R = d.site.labels.records;
  const F = d.recordFigures;
  const press = d.achievements.filter((a) => a.kind === "press");
  return (
    <section className="records" aria-labelledby="records-title">
      <RecordDefs />
      <Text as="h3" variant="label" tone="fg-3" id="records-title" className="records__label">
        {R.label}
      </Text>
      <div className="records-figures">
        <figure className="records-lead">
          <Text as="p" variant="led" step="mega" className="records-lead__figure">
            <Counter value={F.lead} />
          </Text>
          <figcaption className="t-micro">
            {R.lead}
            <span className="records-from">{R.counted}</span>
          </figcaption>
        </figure>
        {F.tiles.length > 0 && (
          <dl className="records-tiles">
            {F.tiles.map((t) => (
              <div key={t.key} className="records-tile">
                <dt className="t-micro">{t.kind ? R.tiles[t.kind] : t.label}</dt>
                <dd className="records-tile__value numeral">
                  <Counter value={t.value} suffix={t.unit && t.unit !== "+" ? ` ${t.unit}` : (t.unit ?? "")} />
                </dd>
                {/* a tile says where it comes from only when it isn't the lead's: a record's own metric */}
                {t.from && <dd className="records-from t-micro">{t.from}</dd>}
              </div>
            ))}
          </dl>
        )}
      </div>
      <ul className="records-grid">
        {d.achievements.map((a) => (
          <li key={a.slug} className="record bracket" data-drawn="" data-kind={a.kind}>
            <p className="record__kind t-micro">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <use href={`#rec-${a.kind}`} />
              </svg>
              {R.kinds[a.kind]}
            </p>
            <h4 className="record__title">{a.title}</h4>
            <p className="record__meta t-micro">
              {a.issuer} · <time dateTime={a.date}>{a.date}</time>
            </p>
            <p className="record__desc">{a.description}</p>
            {a.proofUrl && (
              <a className="record__proof t-micro" href={a.proofUrl} target="_blank" rel="noopener noreferrer">
                {`${R.proof} ↗`}
              </a>
            )}
          </li>
        ))}
      </ul>
      {press.length > 0 && (
        <Marquee label={R.press} className="records-press">
          {press.map((p) => (
            <span key={p.slug} className="records-press__item t-micro">
              {p.issuer}
            </span>
          ))}
        </Marquee>
      )}
      {d.testimonials.length > 0 && (
        <section className="transmissions" aria-label={R.transmissions}>
          {d.testimonials.map((t) => (
            <figure key={`${t.name}-${t.company}`} className="transmission">
              <Reveal as="blockquote" mode="lines" className="transmission__quote">
                {t.quote}
              </Reveal>
              <figcaption className="transmission__from t-micro">
                {/* the name and role scramble in when they fit a 40-character line (§7.4), else the name; the rest is plain */}
                {`${t.name} · ${t.role}`.length <= SCRAMBLE_MAX ? (
                  <>
                    <Scramble text={`${t.name} · ${t.role}`} />
                    {`, ${t.company}`}
                  </>
                ) : (
                  <>
                    <Scramble text={t.name.slice(0, SCRAMBLE_MAX)} />
                    {` · ${t.role}, ${t.company}`}
                  </>
                )}
                <span className="transmission__rel">{t.relationship}</span>
              </figcaption>
            </figure>
          ))}
        </section>
      )}
    </section>
  );
}
