import { Counter } from "@/components/ui/Counter";
import { Provenance } from "@/components/ui/Provenance";
import { Text } from "@/components/ui/Text";
import { derived } from "@/content/derive";

/**
 * ARCHIVE's metrics (DESIGN.md §7.4): one hero figure in LED numerals, and tiles. The hero figure is
 * CITATIONS once anything is cited; until then it's the peer-reviewed papers, and CITATIONS stands
 * among the tiles (v1.9 — the owner's call: a committee shouldn't meet a zero first). Every figure
 * says where it comes from: the citation counts' source and date, or the ledger it's counted from;
 * the section links to the scholar profiles for the canonical numbers when there are any.
 */
export function Metrics() {
  const d = derived;
  const r = d.research;
  const L = d.site.labels.archive.metrics;
  const cited = r.citations > 0;
  const source = { source: r.provenance.sources.join(" + "), asOf: r.provenance.asOf };
  const ledger = { source: L.counted, asOf: d.buildDate };
  const lead = cited ? { value: r.citations, label: L.lead.citations, from: source } : { value: r.peerReviewed, label: L.lead.publications, from: ledger };
  const tiles = [
    cited ? { key: "publications", label: L.publications, value: r.counted, from: ledger } : { key: "citations", label: d.site.labels.archive.dossier.citations, value: r.citations, from: source },
    { key: "h-index", label: L.hIndex, value: r.hIndex, from: source },
    { key: "i10", label: L.i10, value: r.i10, from: source },
    { key: "first-author", label: L.firstAuthor, value: r.firstAuthor, from: ledger },
    { key: "venues", label: L.venues, value: r.venues, from: ledger },
  ];
  const profiles = d.profile.scholarProfiles;
  return (
    <section className="archive-metrics" aria-label={L.label}>
      <figure className="archive-metrics__lead">
        <Text as="p" variant="led" step="mega" className="archive-metrics__figure">
          <Counter value={lead.value} />
        </Text>
        <figcaption className="archive-metrics__caption">
          <span className="t-micro">{lead.label}</span>
          <span className="archive-metrics__from t-micro">
            <Provenance {...lead.from} label={L.asOf} />
          </span>
        </figcaption>
      </figure>
      <dl className="archive-metrics__tiles">
        {tiles.map((t) => (
          <div key={t.key} className="archive-metrics__tile">
            <dt className="t-micro">{t.label}</dt>
            <dd className="archive-metrics__value numeral">
              <Counter value={t.value} />
            </dd>
            <dd className="archive-metrics__from t-micro">
              <Provenance {...t.from} label={L.asOf} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="archive-metrics__note t-small">
        {L.computed}
        {profiles.length > 0 && (
          <>
            {" "}
            <span className="t-micro">{L.profiles}</span>{" "}
            {profiles.map((p, k) => (
              <span key={p.platform}>
                {k > 0 && " · "}
                <a href={p.url} target="_blank" rel="noreferrer" className="archive-metrics__profile">
                  {`${L.platforms[p.platform]} ↗`}
                </a>
              </span>
            ))}
          </>
        )}
      </p>
    </section>
  );
}
