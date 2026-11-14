import type { Metadata } from "next";
import { gzipSync } from "node:zlib";
import type { ReactNode } from "react";
import { DataList, DataRow } from "@/components/ui/DataRow";
import { Grid } from "@/components/ui/Grid";
import { Section } from "@/components/ui/Section";
import { Table } from "@/components/ui/Table";
import { Text } from "@/components/ui/Text";
import { contentWarnings } from "@/content/checks";
import { content, derived } from "@/content/derive";
import { audit } from "@/content/dev";
import { LAYOUTS, VENUE_TYPES } from "@/content/schema";
import { buildSearchIndex, SEARCH_INDEX_BUDGET_GZ } from "@/content/search-index";
import { LayoutPreview, Mark } from "./LayoutPreview";
import { UnitChart } from "./UnitChart";
import { rawColumns, Value } from "./Value";

export const metadata: Metadata = { title: audit.title };

/**
 * /dev/content — the proofreading screen (PROMPTS.md Part 2 §7). Server-rendered from
 * content/derive.ts, so it shows exactly what the sections will read; no client JS of its own.
 */
const d = derived;

function Block({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-12 grid content-start gap-3" : "col-span-12 grid content-start gap-3 md:col-span-6 xl:col-span-4"}>
      <Text as="h3" variant="label" tone="fg-2">
        {title}
      </Text>
      {children}
    </div>
  );
}

/** A DataList of an object's own fields: raw keys as labels, raw values. */
function Fields({ of }: { of: object }) {
  return (
    <DataList>
      {Object.entries(of).map(([k, v]) => (
        <DataRow key={k} label={k}>
          <Value v={v} />
        </DataRow>
      ))}
    </DataList>
  );
}

function Raw<T extends object>({ id, caption, rows, rowKey }: { id: string; caption: string; rows: readonly T[]; rowKey: (r: T, i: number) => string }) {
  return <Table id={id} caption={`${caption} · ${rows.length}`} columns={rawColumns(rows)} rows={rows} rowKey={rowKey} rowHeader />;
}

export default function ContentAuditPage() {
  const warnings = contentWarnings(content);
  const index = buildSearchIndex(d);
  const indexText = JSON.stringify(index);
  const indexStats = {
    docs: index.docs.length,
    bytes: Buffer.byteLength(indexText),
    gzBytes: gzipSync(indexText, { level: 9 }).byteLength,
    budgetGzBytes: SEARCH_INDEX_BUDGET_GZ,
    byKind: Object.fromEntries([...new Set(index.docs.map((x) => x.kind))].map((k) => [k, index.docs.filter((x) => x.kind === k).length])),
  };
  const s = audit.sections;
  const nodes = d.graph.nodes.map((n) => ({ ...n, citations: n.citations ?? 0 }));
  const labelText = {
    topic: (id: string) => content.site.topicClusters[id] ?? id,
    year: (id: string) => id,
    venue: (id: string) => id,
  };
  const { provenance, byYear, byVenueType, coAuthors, ...researchFigures } = d.research;

  return (
    <main className="pb-section-y">
      <Grid as="header" className="gap-y-4 pt-16 pb-12">
        <div className="col-span-12 grid gap-4 lg:col-span-8">
          <Text variant="label" tone="accent">
            {audit.code}
          </Text>
          <Text as="h1" step="display">
            {audit.title}
          </Text>
          <Text as="p" step="lead" tone="fg-2" className="max-w-[60ch]">
            {audit.intro}
          </Text>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <DataList>
            <DataRow label={d.isPlaceholder ? audit.status.placeholder : audit.status.real}>
              <Text variant="numeral" step="small" tone={d.isPlaceholder ? "warn" : "accent"}>
                {String(d.isPlaceholder)}
              </Text>
            </DataRow>
            <DataRow label={audit.status.builtOn}>{d.buildDate}</DataRow>
            <DataRow label="graph.inputHash">{d.graph.inputHash}</DataRow>
            <DataRow label="content/graph.json">
              <Text step="small" tone={d.graph.stale ? "hot" : "fg-1"} data-graph-stale={d.graph.stale}>
                {d.graph.stale ? audit.status.graphStale : audit.status.graphFresh}
              </Text>
            </DataRow>
            <DataRow label="citations.mode">{d.bake.citations.mode}</DataRow>
            <DataRow label="verify.mode">{d.bake.verify.mode}</DataRow>
          </DataList>
        </div>
        <nav aria-label={audit.nav} className="col-span-12 flex flex-wrap gap-x-4 gap-y-2">
          {Object.values(s).map((x) => (
            <a key={x.id} href={`#${x.id}`} className="t-micro text-fg-2 hover:text-fg-1">
              {`→ ${x.title}`}
            </a>
          ))}
        </nav>
      </Grid>

      {/* ── 01 · derived metrics ─────────────────────────────────────────────────────── */}
      <Section id={s.metrics.id} index={1} code={s.metrics.code} title={s.metrics.title}>
        <Grid className="gap-y-12 py-12">
          <Block title={audit.metrics.heroStrip} wide>
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {d.heroStrip.map((h) => (
                <div key={h.key} className="grid gap-1">
                  <Text as="dt" variant="label" tone="fg-3">
                    {h.label}
                  </Text>
                  <Text as="dd" step="title" variant="numeral" className="m-0">
                    {h.value}
                  </Text>
                </div>
              ))}
            </dl>
          </Block>
          <Block title={audit.metrics.research}>
            <Fields of={researchFigures} />
          </Block>
          <Block title={audit.metrics.provenance}>
            <Fields of={provenance} />
          </Block>
          <Block title={audit.metrics.career}>
            <Fields of={{ careerStart: d.careerStart, experienceYears: d.experienceYears, roles: d.experience.length, education: d.education.length }} />
          </Block>
          <Block title={audit.metrics.byYear}>
            <UnitChart title={audit.metrics.byYear} years={byYear} />
            <Text as="p" step="small" sans tone="fg-3">
              {audit.metrics.byYearNote}
            </Text>
          </Block>
          <Block title={audit.metrics.byVenueType}>
            <Table
              id="venue-types"
              caption={audit.metrics.byVenueType}
              columns={[
                { key: "venueType", header: "venueType", cell: (r) => r.venueType },
                { key: "count", header: "count", numeric: true, cell: (r) => r.slugs.length },
              ]}
              rows={byVenueType}
              rowKey={(r) => r.venueType}
              rowHeader
            />
          </Block>
          <Block title={audit.metrics.coAuthors}>
            <Table
              id="co-authors"
              caption={audit.metrics.coAuthors}
              columns={[
                { key: "name", header: "name", cell: (r) => r.name },
                { key: "id", header: "id", cell: (r) => r.id },
                { key: "count", header: "count", numeric: true, cell: (r) => r.count },
              ]}
              rows={coAuthors}
              rowKey={(r) => r.id}
              rowHeader
            />
          </Block>
          <Block title={audit.metrics.credentials}>
            <Fields of={{ total: d.credentials.total, issuers: d.credentials.issuers, active: d.credentials.active, expired: d.credentials.expired, verified: d.credentials.verified }} />
          </Block>
          <Block title={audit.metrics.byIssuer}>
            <Table
              id="by-issuer"
              caption={audit.metrics.byIssuer}
              columns={[
                { key: "issuer", header: "issuer", cell: (r) => r.value },
                { key: "count", header: "count", numeric: true, cell: (r) => r.slugs.length },
              ]}
              rows={d.credentials.byIssuer}
              rowKey={(r) => r.value}
              rowHeader
            />
          </Block>
          <Block title={audit.metrics.byDomain}>
            <Table
              id="by-domain"
              caption={audit.metrics.byDomain}
              columns={[
                { key: "domain", header: "domain", cell: (r) => r.value },
                { key: "count", header: "count", numeric: true, cell: (r) => r.slugs.length },
              ]}
              rows={d.credentials.byDomain}
              rowKey={(r) => r.value}
              rowHeader
            />
          </Block>
          <Block title={audit.metrics.records}>
            <Fields of={d.records} />
          </Block>
          <Block title={audit.metrics.skills} wide>
            <Table
              id="skills-evidence"
              caption={audit.metrics.skills}
              columns={[
                { key: "name", header: "name", cell: (r) => r.name },
                { key: "category", header: "category", cell: (r) => r.category },
                { key: "level", header: "level", numeric: true, cell: (r) => r.level },
                { key: "rubric", header: "rubric", cell: (r) => r.rubric },
                { key: "years", header: "years", numeric: true, cell: (r) => r.years },
                { key: "primary", header: "primary", cell: (r) => String(r.primary) },
                { key: "projects", header: "evidence.projects", numeric: true, cell: (r) => r.evidence.projects.length },
                { key: "papers", header: "evidence.papers", numeric: true, cell: (r) => r.evidence.papers.length },
                { key: "roles", header: "evidence.roles", numeric: true, cell: (r) => r.evidence.roles.length },
                { key: "which", header: "evidence", wide: true, cell: (r) => <Value v={[...r.evidence.projects, ...r.evidence.papers]} /> },
              ]}
              rows={d.skills.all}
              rowKey={(r) => r.slug}
              rowHeader
            />
          </Block>
        </Grid>
      </Section>

      {/* ── 02 · bake outputs ────────────────────────────────────────────────────────── */}
      <Section id={s.bake.id} index={2} code={s.bake.code} title={s.bake.title}>
        <Grid className="gap-y-12 py-12">
          <Block title={audit.bake.graph}>
            <Fields of={{ nodes: d.graph.nodes.length, edges: d.graph.edges.length, ...d.graph.edgeCounts, inputHash: d.graph.inputHash, stale: d.graph.stale }} />
          </Block>
          <Block title={audit.bake.citations}>
            <Fields of={d.bake.citations} />
          </Block>
          <Block title={audit.bake.searchIndex}>
            <Fields of={indexStats} />
          </Block>
          <div className="col-span-12 grid gap-6 md:grid-cols-3">
            {LAYOUTS.map((layout) => (
              <LayoutPreview
                key={layout}
                id={`layout-${layout}`}
                title={audit.bake.layouts[layout]}
                layout={layout}
                nodes={nodes}
                edges={d.graph.edges}
                labels={d.graph.labels[layout].map((l) => ({ id: l.id, text: labelText[layout](l.id), position: l.position }))}
                citationsUnit={audit.bake.citationsUnit}
              />
            ))}
          </div>
          <div className="col-span-12 grid gap-3">
            <Text as="p" step="small" sans tone="fg-3" className="max-w-[72ch]">
              {audit.bake.layoutNote}
            </Text>
            <ul aria-label={audit.bake.legend} className="flex flex-wrap gap-x-6 gap-y-2">
              {VENUE_TYPES.map((t) => (
                <li key={t} className="t-micro flex items-center gap-2 text-fg-2">
                  <svg viewBox="-8 -8 16 16" width={16} height={16} aria-hidden="true">
                    <Mark type={t} s={6} published />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Block title={audit.bake.edgesByKind} wide>
            <Raw id="graph-edges" caption="graph.edges" rows={d.graph.edges} rowKey={(r) => `${r.source}|${r.target}`} />
          </Block>
          <Block title={audit.bake.verify} wide>
            <Fields of={d.bake.verify.byStatus} />
            <Raw id="verify-results" caption="verify.results" rows={d.bake.verify.results} rowKey={(r) => r.key} />
          </Block>
        </Grid>
      </Section>

      {/* ── 03 · warnings ────────────────────────────────────────────────────────────── */}
      <Section id={s.warnings.id} index={3} code={s.warnings.code} title={s.warnings.title} counts={[`${warnings.length} ${audit.warnings.count}`]}>
        <Grid className="py-12">
          <div className="col-span-12">
            {warnings.length === 0 ? (
              <Text as="p" tone="fg-2">
                {audit.warnings.none}
              </Text>
            ) : (
              <Raw id="warnings-table" caption={s.warnings.title} rows={warnings} rowKey={(r, i) => `${i}`} />
            )}
          </div>
        </Grid>
      </Section>

      {/* ── 04 · raw data ────────────────────────────────────────────────────────────── */}
      <Section id={s.raw.id} index={4} code={s.raw.code} title={s.raw.title}>
        <Grid className="gap-y-12 py-12">
          <Block title="site">
            <Fields of={{ title: content.site.title, description: content.site.description, labels: content.site.labels }} />
          </Block>
          <Block title="site.sections">
            <Raw id="raw-sections" caption="site.sections" rows={content.site.sections} rowKey={(r) => r.id} />
          </Block>
          <Block title="site.topicClusters">
            <Fields of={content.site.topicClusters} />
          </Block>
          <Block title="profile" wide>
            <Fields of={content.profile} />
          </Block>
          <Block title="experience" wide>
            <Raw id="raw-experience" caption="experience" rows={d.experience} rowKey={(r) => r.slug} />
          </Block>
          <Block title="education" wide>
            <Raw id="raw-education" caption="education" rows={d.education} rowKey={(r) => r.slug} />
          </Block>
          <Block title="publications" wide>
            <Raw id="raw-publications" caption="publications" rows={content.publications} rowKey={(r) => r.slug} />
          </Block>
          <Block title="projects" wide>
            <Raw id="raw-projects" caption="projects" rows={content.projects} rowKey={(r) => r.slug} />
          </Block>
          <Block title="skills" wide>
            <Raw id="raw-skills" caption="skills" rows={content.skills} rowKey={(r) => r.name} />
          </Block>
          <Block title="certificates" wide>
            <Raw
              id="raw-certificates"
              caption="certificates"
              rows={d.certificates.map(({ check, ...rest }) => ({ ...rest, checkStatus: check?.status ?? null }))}
              rowKey={(r) => r.slug}
            />
          </Block>
          <Block title="achievements" wide>
            <Raw id="raw-achievements" caption="achievements" rows={d.achievements} rowKey={(r) => r.slug} />
          </Block>
          <Block title="testimonials" wide>
            <Raw id="raw-testimonials" caption="testimonials" rows={content.testimonials} rowKey={(r) => r.name} />
          </Block>
          <Block title="currentFocus" wide>
            <Raw id="raw-focus" caption="currentFocus" rows={content.currentFocus} rowKey={(r) => r.kind} />
          </Block>
        </Grid>
      </Section>
    </main>
  );
}
