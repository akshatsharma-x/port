import Link from "next/link";
import { ViewTransition, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { DitherImage } from "@/components/ui/DitherImage";
import { Text } from "@/components/ui/Text";
import { derived } from "@/content/derive";
import { COVER } from "@/lib/covers";
import { routes } from "@/lib/routes";
import { InViewVideo } from "./InViewVideo";

/**
 * A case study (DESIGN.md §7.4 WORK): its cover as a full-viewport hero — where the PROJECTION
 * lands and lets go, and the DOM FLIP's other end (the shared view-transition name) — then a
 * structure that sells: Context · Problem · My role · Approach · Outcome (one LED figure and its
 * tiles, when the project has numbers) · Stack · Links, the media, PUBLISHED RESEARCH (each paper a
 * mini-dossier that opens over this page and closes back to it), and prev / next (SLIDE ADVANCE).
 * Whatever isn't in yet (a role, links, numbers) is left out, never filled with a placeholder.
 */
export function CaseStudy({ slug, papers: listed }: { slug: string; /** dev fixture only: the papers to list in place of the project's own */ papers?: readonly string[] }) {
  const d = derived;
  const L = d.site.labels.work;
  const S = L.study;
  const all = d.projects;
  const at = all.findIndex((x) => x.slug === slug);
  const p = all[at];
  if (!p) return null;
  const prev = all[at - 1];
  const next = all[at + 1];
  const [cover, ...media] = p.media;
  const meta = [`${String(p.index).padStart(2, "0")}/${String(all.length).padStart(2, "0")}`, p.category, p.year === null ? null : String(p.year)].filter(Boolean).join(" · ");
  const [lead, ...tiles] = p.metrics;
  const decimals = (v: number) => (Number.isInteger(v) ? 0 : Math.min(2, String(v).split(".")[1]?.length ?? 0));
  const links = (["live", "repo", "case", "paper"] as const).flatMap((k) => (p.links[k] ? [{ key: k, href: p.links[k] as string, label: S.link[k] }] : []));
  const ids = new Map(d.catalogue.map((c) => [c.slug, c.id]));
  const papers = (listed ?? p.relatedPublications.map((r) => r.slug)).flatMap((s) => d.publications.filter((x) => x.slug === s));
  const h = (key: string) => `case-${slug}-${key}`;

  return (
    <article className="case" aria-labelledby={h("title")}>
      <div className="case__hero" data-projection-hero="">
        {cover?.type === "image" && (
          <ViewTransition name={`cover-${slug}`}>
            <DitherImage src={cover.src} alt={cover.alt} width={cover.width ?? COVER.master.width} height={cover.height ?? COVER.master.height} sizes="100vw" preload fit="cover" className="case__hero-img" />
          </ViewTransition>
        )}
      </div>

      <div className="case__body layout-grid">
        <p className="case__back col-span-12">
          <Link href={routes.section("work")} className="t-micro">{`← ${S.back}`}</Link>
        </p>
        <header className="case__head col-span-12 lg:col-span-10">
          <p className="case__meta t-micro">{meta}</p>
          <h1 id={h("title")} className="case__title">
            {p.title}
          </h1>
          <p className="case__subtitle">{p.subtitle}</p>
        </header>


        <section className="case__section col-span-12 lg:col-span-7" aria-labelledby={h("context")}>
          <h2 id={h("context")} className="case__label t-micro">
            {S.context}
          </h2>
          <p className="case__lede">{p.summary}</p>
        </section>
        <section className="case__section col-span-12 lg:col-span-7" aria-labelledby={h("problem")}>
          <h2 id={h("problem")} className="case__label t-micro">
            {S.problem}
          </h2>
          <p>{p.problem}</p>
        </section>
        {p.role && (
          <section className="case__section col-span-12 lg:col-span-7" aria-labelledby={h("role")}>
            <h2 id={h("role")} className="case__label t-micro">
              {S.role}
            </h2>
            <p>{p.role}</p>
          </section>
        )}
        <section className="case__section col-span-12 lg:col-span-7" aria-labelledby={h("approach")}>
          <h2 id={h("approach")} className="case__label t-micro">
            {S.approach}
          </h2>
          <p>{p.approach}</p>
        </section>
        <section className="case__section case__outcome col-span-12" aria-labelledby={h("outcome")}>
          <h2 id={h("outcome")} className="case__label t-micro">
            {S.outcome}
          </h2>
          {lead && (
            <figure className="case__lead">
              <Text as="p" variant="led" step="mega" className="case__figure">
                <Counter value={lead.value} decimals={decimals(lead.value)} suffix={lead.unit ?? ""} />
              </Text>
              <figcaption className="t-micro">{lead.label}</figcaption>
            </figure>
          )}
          {tiles.length > 0 && (
            <dl className="case__tiles">
              {tiles.map((m) => (
                <div key={m.label} className="case__tile">
                  <dt className="t-micro">{m.label}</dt>
                  <dd className="case__tile-value numeral">
                    <Counter value={m.value} decimals={decimals(m.value)} suffix={m.unit ?? ""} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="case__outcome-text lg:max-w-[60ch]">{p.outcome}</p>
        </section>

        {/* the facts rail (Part 16): what the project is built of, and where it lives. Read where the
            stack always was, after the outcome; on a wide screen placed beside the story (row 3 on,
            sticky) — the story's column had five empty ones beside it */}
        <aside className="case__facts col-span-12 lg:col-span-4 lg:col-start-9" style={{ "--facts-rows": p.role ? 4 : 3 } as CSSProperties}>
          <section className="case__section" aria-labelledby={h("stack")}>
            <h2 id={h("stack")} className="case__label t-micro">
              {S.stack}
            </h2>
            <ul className="case__stack">
              {p.stack.map((t) => (
                <li key={t} className="chip t-micro">
                  {t}
                </li>
              ))}
            </ul>
          </section>
          {links.length > 0 && (
            <section className="case__section" aria-labelledby={h("links")}>
              <h2 id={h("links")} className="case__label t-micro">
                {S.links}
              </h2>
              <div className="case__links">
                {links.map((l) => (
                  <Button key={l.key} href={l.href} variant="secondary" target="_blank" rel="noreferrer">
                    {l.label}
                  </Button>
                ))}
              </div>
            </section>
          )}
        </aside>
        {media.length > 0 && (
          <div className="case__media col-span-12">
            {media.map((m) =>
              m.type === "image" ? (
                <DitherImage key={m.src} src={m.src} alt={m.alt} width={m.width ?? COVER.master.width} height={m.height ?? COVER.master.height} sizes="(min-width: 64rem) 66vw, 100vw" skew />
              ) : (
                <InViewVideo key={m.src} src={m.src} poster={m.poster} label={m.alt} width={m.width ?? COVER.master.width} height={m.height ?? COVER.master.height} />
              ),
            )}
          </div>
        )}
        {papers.length > 0 && (
          <section className="case__section case__research col-span-12" aria-labelledby={h("research")}>
            <h2 id={h("research")} className="case__label t-micro">
              {S.research}
            </h2>
            <ul className="case__papers">
              {papers.map((r) => (
                <li key={r.slug}>
                  {/* the dossier opens over this page (the root intercept) and closes back to it: no tear */}
                  <Link href={routes.paper(r.slug)} scroll={false} data-transition="dossier" className="mini-dossier">
                    <span className="mini-dossier__strip t-micro">{[ids.get(r.slug), String(r.year), r.venueShort].filter(Boolean).join(" · ")}</span>
                    <span className="mini-dossier__title">{r.title}</span>
                    <span className="mini-dossier__tldr t-small">{r.tldr}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <nav className="case__pager col-span-12" aria-label={S.back}>
          {prev && (
            <Link href={routes.project(prev.slug)} transitionTypes={["work-prev"]} data-transition="continuity" className="case__step case__step--prev">
              <span className="t-micro">{`← ${S.prev}`}</span>
              <span>{prev.title}</span>
            </Link>
          )}
          {next && (
            <Link href={routes.project(next.slug)} transitionTypes={["work-next"]} data-transition="continuity" className="case__step case__step--next">
              <span className="t-micro">{`${S.next} →`}</span>
              <span>{next.title}</span>
            </Link>
          )}
        </nav>
      </div>
    </article>
  );
}
