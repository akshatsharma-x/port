import Link from "next/link";
import { ShapeGlyph } from "@/components/sections/archive/ShapeGlyph";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Provenance } from "@/components/ui/Provenance";
import { derived } from "@/content/derive";
import { cx } from "@/lib/cx";
import { Abstract } from "./Abstract";
import { CopyBibtex } from "./CopyBibtex";
import { KeywordChips } from "./KeywordChips";

/**
 * A record's DOSSIER (DESIGN.md §7.4), the same in the dialog over home and on its own page:
 *   - a microfiche frame (rotateX 8° → 0 and a scan bar, styles/dossier.css) under a reversed-type
 *     strip: ARCHIVE ID · YEAR · VENUE · TITLE…
 *   - the title (--step-3, sentence case), and right under it the TLDR as a quoted callout
 *     (--step-2): the second read, and what non-specialists actually read
 *   - the authors (me in --accent at 600, co-authors in --fg-2 mono); venue, year and badges
 *   - the abstract (per-line reveal, collapsed after 4 lines), the keyword chips (they light the
 *     sky), a metrics row, the actions (DOI ↗ PDF ↗ ARXIV ↗ CODE ↗ DATASET ↗, COPY BIBTEX),
 *     BUILT FROM THIS (the projects that cite it), prev / next — inside the dialog they push the
 *     next record in (SLIDE ADVANCE); from a record's own page they open it over that page
 * A record not yet published wears dashed brackets and a STATUS stamp in --warn.
 */
export function Dossier({ slug, mode }: { slug: string; mode: "dialog" | "page" }) {
  const d = derived;
  const L = d.site.labels.archive;
  const D = L.dossier;
  const p = d.publications.find((x) => x.slug === slug);
  if (!p) return null;
  const k = d.catalogue.findIndex((c) => c.slug === slug);
  const id = d.catalogue[k]?.id ?? slug;
  const prev = d.catalogue[k - 1];
  const next = d.catalogue[k + 1];
  const index = new Map(d.graph.nodes.map((n, i) => [n.id, i]));
  const keywords = p.keywords.map((word) => ({
    word,
    matches: d.publications.filter((q) => q.keywords.some((w) => w.toLowerCase() === word.toLowerCase())).flatMap((q) => (index.has(q.slug) ? [index.get(q.slug) as number] : [])),
  }));
  const actions = [
    { key: "doi", label: D.actions.doi, href: p.links.doi },
    { key: "pdf", label: D.actions.pdf, href: p.links.pdf },
    { key: "arxiv", label: D.actions.arxiv, href: p.links.arxiv },
    { key: "code", label: D.actions.code, href: p.links.code },
    { key: "dataset", label: D.actions.dataset, href: p.links.dataset },
  ].filter((a): a is { key: string; label: string; href: string } => !!a.href);
  const projects = p.relatedProjectSlugs.flatMap((s) => d.projects.filter((x) => x.slug === s));
  const pending = !p.counted;
  // the page's outline: h1 → h2 on its own page; inside the dialog over another page, h2 → h3
  const Title = mode === "page" ? "h1" : "h2";
  const Sub = mode === "page" ? "h2" : "h3";
  const titleOf = (s: string) => d.publications.find((x) => x.slug === s)?.title ?? s;

  return (
    <article className={cx("dossier", pending && "dossier--pending")} data-mode={mode}>
      <div className="dossier__fiche">
        <p className="dossier__strip t-micro" aria-hidden="true">
          <span>{id}</span>
          <span>{String(p.year)}</span>
          <span>{p.venueShort}</span>
          <span className="dossier__strip-title">{p.title}</span>
        </p>
        <p className="sr-only">{`${D.id} ${id}`}</p>
        {pending && <p className="dossier__stamp t-micro">{`${L.status.stamp}: ${L.status[p.status]}`}</p>}

        <Title id={`dossier-title-${slug}`} className="dossier__title">
          {p.title}
        </Title>
        <figure className="dossier__tldr">
          <blockquote>
            <p>{p.tldr}</p>
          </blockquote>
          <figcaption className="t-micro">{D.tldr}</figcaption>
        </figure>

        <p className="dossier__authors">
          <span className="sr-only">{`${D.authors}: `}</span>
          {p.authors.map((a, i) => (
            <span key={`${a.name}-${i}`} className={a.isMe ? "author-me" : "author-co"}>
              {a.name}
              {i < p.authors.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
        <ul className="dossier__badges">
          <li className="dossier__badge t-micro">
            <ShapeGlyph type={p.venueType} dashed={pending} />
            {L.venueTypes[p.venueType]}
          </li>
          {/* the year held to the venue's last word, so a wrapped venue never opens a line on "· 2026" */}
          <li className="dossier__badge dossier__badge--venue t-micro">{`${p.venue}\u00a0·\u00a0${p.year}`}</li>
          {p.isPeerReviewed && <li className="dossier__badge t-micro">{D.badges.peerReviewed}</li>}
          {p.isOpenAccess && <li className="dossier__badge t-micro">{D.badges.openAccess}</li>}
        </ul>

        <section className="dossier__section" aria-labelledby={`dossier-abstract-${slug}`}>
          <Sub id={`dossier-abstract-${slug}`} className="dossier__label t-micro">
            {D.abstract}
          </Sub>
          {p.abstract ? <Abstract text={p.abstract} more={D.more} less={D.less} /> : <p className="dossier__pending t-small">{D.pending}</p>}
        </section>

        <section className="dossier__section" aria-labelledby={`dossier-keywords-${slug}`}>
          <Sub id={`dossier-keywords-${slug}`} className="dossier__label t-micro">
            {D.keywords}
          </Sub>
          <KeywordChips keywords={keywords} hint={D.filter} mode={mode} />
        </section>

        <dl className="dossier__metrics" aria-label={D.metrics}>
          <div>
            <dt className="t-micro">{D.citations}</dt>
            {/* a count, once there is one; until then a fact, not a zero at display size (Part 16) */}
            {p.citations > 0 ? (
              <dd className="dossier__figure numeral">
                <Counter value={p.citations} />
              </dd>
            ) : (
              <dd className="dossier__none">{D.notCited}</dd>
            )}
            <dd className="dossier__from t-micro">
              <Provenance source={p.citationSource} asOf={p.citationsAsOf} label={L.metrics.asOf} />
            </dd>
          </div>
          {p.impactFactor !== undefined && (
            <div>
              <dt className="t-micro">{D.impactFactor}</dt>
              <dd className="dossier__figure numeral">
                <Counter value={p.impactFactor} decimals={1} />
              </dd>
            </div>
          )}
          <div>
            <dt className="t-micro">{D.year}</dt>
            <dd className="dossier__figure numeral">{String(p.year)}</dd>
          </div>
        </dl>

        <section className="dossier__actions" aria-label={D.actions.label}>
          {actions.map((a) => (
            <Button key={a.key} href={a.href} variant="secondary" target="_blank" rel="noreferrer">
              {a.label}
            </Button>
          ))}
          <CopyBibtex bibtex={p.bibtex} label={D.actions.bibtex} copied={D.actions.copied} />
        </section>

        {projects.length > 0 && (
          <section className="dossier__section" aria-labelledby={`dossier-built-${slug}`}>
            <Sub id={`dossier-built-${slug}`} className="dossier__label t-micro">
              {D.builtFrom}
            </Sub>
            <ul className="dossier__built">
              {projects.map((pr) => (
                <li key={pr.slug}>
                  <Link href={`/work/${pr.slug}`} className="dossier__project">
                    <span>{pr.title}</span>
                    {/* a year or role still to come is left out, never printed as a placeholder */}
                    <span className="t-micro">{`${[pr.year === null ? null : String(pr.year), pr.role ?? pr.category].filter(Boolean).join(" · ")} →`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav className="dossier__pager" aria-label={`${D.prev} / ${D.next}`}>
          {prev ? (
            <Link href={`/research/${prev.slug}`} replace={mode === "dialog"} scroll={false} transitionTypes={mode === "dialog" ? ["dossier-prev"] : undefined} data-transition="dossier" className="dossier__step dossier__step--prev">
              <span className="t-micro">{`← ${D.prev}`}</span>
              <span>{titleOf(prev.slug)}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/research/${next.slug}`} replace={mode === "dialog"} scroll={false} transitionTypes={mode === "dialog" ? ["dossier-next"] : undefined} data-transition="dossier" className="dossier__step dossier__step--next">
              <span className="t-micro">{`${D.next} →`}</span>
              <span>{titleOf(next.slug)}</span>
            </Link>
          )}
        </nav>
      </div>
    </article>
  );
}
