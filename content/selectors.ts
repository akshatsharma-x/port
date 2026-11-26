import { buildGraphModel, graphInputHash } from "./graph";
import {
  ACHIEVEMENT_KINDS,
  SKILL_RUBRIC,
  VENUE_TYPES,
  type CitationsFile,
  type Content,
  type GraphFile,
  type SkillLevel,
  type VerifyFile,
  type VerifyStatus,
} from "./schema";

/**
 * Pure selectors: derive(content, overlays, now) → everything the sections read. No I/O and no
 * module-level state, so the bake scripts can call it with freshly written files and the tests
 * with fixtures. content/derive.ts calls it once for the app.
 */
export interface Overlays {
  citations: CitationsFile;
  verify: VerifyFile;
  graph: GraphFile;
}

export type CredentialVerification = "verified" | "onFile" | "unchecked";

const COUNTED: ReadonlySet<string> = new Set(["published", "accepted"]);

/** Largest h such that h papers have at least h citations each. */
export function hIndex(citations: readonly number[]): number {
  const sorted = [...citations].sort((a, b) => b - a);
  let h = 0;
  while (h < sorted.length && (sorted[h] ?? 0) >= h + 1) h++;
  return h;
}

/** Papers with at least 10 citations. */
export const i10Index = (citations: readonly number[]): number => citations.filter((c) => c >= 10).length;

/** "CHI '25" → "CHI": a venue across years counts once. */
export const venueKey = (short: string): string => short.replace(/\s*['’]\d{2}$/, "").trim();

export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/** Whole months from a YYYY-MM start to `now` (UTC). */
export function monthsSince(yearMonth: string, now: Date): number {
  const [y = 0, m = 1] = yearMonth.split("-").map(Number);
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-term, case-insensitive match that also works for terms like "three.js" or "C++". */
export function mentions(haystack: string, terms: readonly string[]): boolean {
  return terms.some((t) => new RegExp(`(?<![\\w])${escapeRe(t)}(?![\\w])`, "i").test(haystack));
}

/** "three.js" → "three-js", "C++" → "cpp", "Gödel" → "godel". */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\+/g, "p")
    .replace(/#/g, "sharp")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Shortens a slug to ≤ max characters on a word boundary. */
const clipSlug = (slug: string, max = 48): string => (slug.length <= max ? slug : slug.slice(0, max + 1).replace(/-[^-]*$/, ""));

/** Gives records without an authored slug a stable one (for `cat <slug>`); repeats get -2, -3… */
function withSlugs<T>(items: readonly T[], base: (item: T) => string): (T & { slug: string })[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const b = base(item) || "record";
    const n = (seen.get(b) ?? 0) + 1;
    seen.set(b, n);
    return { ...item, slug: n === 1 ? b : `${b}-${n}` };
  });
}

const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function derive(c: Content, o: Overlays, now: Date) {
  const today = isoDay(now);
  const live = o.citations.mode === "live" ? o.citations : null;

  // ── publications ─────────────────────────────────────────────────────────────────────────
  const projectsByPaper = new Map<string, string[]>();
  for (const pr of c.projects) {
    for (const s of pr.relatedPublicationSlugs) projectsByPaper.set(s, [...(projectsByPaper.get(s) ?? []), pr.slug]);
  }
  const check = (key: string | null): VerifyStatus | null => (key ? (o.verify.results[key]?.status ?? "skipped") : null);

  const publications = c.publications
    .map((p) => {
      // an overlay only applies to the DOI it was read for (a changed DOI waits for the next refresh)
      const entry = live?.counts[p.slug];
      const counted = entry && entry.doi === p.doi ? entry : undefined;
      return {
        ...p,
        citations: counted?.citations ?? p.citations,
        citationsAsOf: counted?.asOf ?? p.citationsAsOf,
        citationSource: counted ? ("OpenAlex" as const) : p.citationSource,
        counted: COUNTED.has(p.status),
        isFirstAuthor: p.authors[0]?.isMe === true,
        venueKey: venueKey(p.venueShort),
        clusterName: c.site.topicClusters[p.topicCluster] ?? p.topicCluster,
        coAuthors: p.authors.filter((a) => !a.isMe).map((a, i) => ({ id: p.coAuthorIds[i] ?? "", name: a.name, affiliation: a.affiliation ?? null })),
        relatedProjectSlugs: projectsByPaper.get(p.slug) ?? [],
        links: {
          doi: p.doi ? `https://doi.org/${p.doi}` : null,
          arxiv: p.arxivId ? `https://arxiv.org/abs/${p.arxivId}` : null,
          pdf: p.pdfUrl ?? null,
          code: p.codeUrl ?? null,
          dataset: p.datasetUrl ?? null,
        },
        checks: { doi: check(p.doi ? `doi:${p.doi}` : null), arxiv: check(p.arxivId ? `arxiv:${p.arxivId}` : null) },
      };
    })
    .sort((a, b) => b.year - a.year || (b.month ?? 13) - (a.month ?? 13) || (a.slug < b.slug ? -1 : 1));
  type DerivedPublication = (typeof publications)[number];
  const bySlug = new Map(publications.map((p) => [p.slug, p]));
  // the archive's own catalogue: AR-0001 is the oldest record; the dossiers step through in that order
  const catalogue = [...publications].reverse().map((p, k) => ({ slug: p.slug, id: `AR-${String(k + 1).padStart(4, "0")}` }));

  const counted = publications.filter((p) => p.counted);
  const counts = counted.map((p) => p.citations);
  const years = counted.map((p) => p.year);
  const allYears = publications.map((p) => p.year);
  const yearSpan = allYears.length ? { from: Math.min(...allYears), to: Math.max(...allYears) } : null;

  const coAuthorMap = new Map<string, { id: string; name: string; slugs: string[] }>();
  for (const p of publications) {
    for (const a of p.coAuthors) {
      const entry = coAuthorMap.get(a.id) ?? { id: a.id, name: a.name, slugs: [] };
      entry.slugs.push(p.slug);
      coAuthorMap.set(a.id, entry);
    }
  }

  const research = {
    total: publications.length,
    counted: counted.length,
    underReview: publications.filter((p) => p.status === "underReview").length,
    inPrep: publications.filter((p) => p.status === "inPrep").length,
    peerReviewed: counted.filter((p) => p.isPeerReviewed).length,
    citations: sum(counts),
    hIndex: hIndex(counts),
    i10: i10Index(counts),
    firstAuthor: counted.filter((p) => p.isFirstAuthor).length,
    venues: unique(counted.map((p) => p.venueKey)).length,
    years: years.length ? { from: Math.min(...years), to: Math.max(...years) } : null,
    /** h-index and i10 are computed here from per-paper counts; this says where the counts came from */
    provenance: {
      method: "computed from per-paper citation counts" as const,
      sources: unique(counted.map((p) => p.citationSource)),
      asOf: counted.map((p) => p.citationsAsOf).sort().at(-1) ?? null,
    },
    /** every year in range, gaps included (a truthful timeline axis), with every paper as a cell */
    byYear: yearSpan
      ? Array.from({ length: yearSpan.to - yearSpan.from + 1 }, (_, i) => {
          const y = yearSpan.from + i;
          return { year: y, papers: publications.filter((p) => p.year === y).map((p) => ({ slug: p.slug, title: p.title, status: p.status, counted: p.counted })) };
        })
      : [],
    byVenueType: VENUE_TYPES.map((t) => ({ venueType: t, slugs: publications.filter((p) => p.venueType === t).map((p) => p.slug) })),
    coAuthors: [...coAuthorMap.values()]
      .map((a) => ({ ...a, count: a.slugs.length }))
      .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1)),
  };

  // ── experience, projects ─────────────────────────────────────────────────────────────────
  const experience = withSlugs(
    // newest first: the latest start, then the latest end — a role still running is the latest of all
    [...c.experience].sort((a, b) => b.start.localeCompare(a.start) || (b.end === "present" ? "9999" : b.end).localeCompare(a.end === "present" ? "9999" : a.end)),
    (e) => `${slugify(e.company)}-${e.start.slice(0, 4)}`,
  );
  const careerStart = c.experience.map((e) => e.start).sort()[0] ?? null;
  const experienceYears = careerStart ? Math.floor(monthsSince(careerStart, now) / 12) : 0;
  const education = withSlugs(
    [...c.education].sort((a, b) => (a.start < b.start ? 1 : -1)),
    (e) => `${slugify(e.institution)}-${slugify(e.degree)}`,
  );

  const projects = c.projects.map((pr, i) => ({
    ...pr,
    index: i + 1,
    relatedPublications: pr.relatedPublicationSlugs
      .map((s) => bySlug.get(s))
      .filter((p): p is DerivedPublication => p !== undefined)
      .map((p) => ({ slug: p.slug, title: p.title, venueShort: p.venueShort, year: p.year, status: p.status })),
  }));

  // ── skills with evidence (DESIGN.md §7.4: evidence, not self-ratings) ─────────────────────
  const paperText = new Map(c.publications.map((p) => [p.slug, [p.title, p.abstract ?? "", ...p.keywords].join("\n")]));
  const skills = withSlugs(c.skills, (s) => slugify(s.name)).map((s) => {
    const terms = [s.name, ...(s.aliases ?? [])];
    const lower = terms.map((t) => t.toLowerCase());
    return {
      ...s,
      rubric: SKILL_RUBRIC[s.level as SkillLevel],
      evidence: {
        projects: c.projects.filter((pr) => pr.stack.some((st) => lower.includes(st.toLowerCase()))).map((pr) => pr.slug),
        papers: c.publications.filter((p) => mentions(paperText.get(p.slug) ?? "", terms)).map((p) => p.slug),
        roles: c.experience.filter((e) => e.stack.some((st) => lower.includes(st.toLowerCase()))).map((e) => `${e.role}, ${e.company}`),
      },
    };
  });
  const skillCategories = unique(skills.map((s) => s.category)).map((category) => ({ category, skills: skills.filter((s) => s.category === category) }));

  // ── credentials ──────────────────────────────────────────────────────────────────────────
  const certificates = c.certificates
    .map((cert) => {
      const expired = cert.expiryDate !== null && cert.expiryDate < today;
      const result = cert.verifyUrl ? o.verify.results[`verifyUrl:${cert.slug}`] : undefined;
      // VERIFIED only when the build actually resolved the URL (law 2); never on a dry run.
      const verification: CredentialVerification = !cert.verifyUrl ? "onFile" : result?.status === "ok" ? "verified" : !result || result.status === "skipped" ? "unchecked" : "onFile";
      return { ...cert, expired, verification, check: result ?? null };
    })
    // newest first (a month-only date sorts as that month's start), undated last, ties in content order
    .sort((a, b) => {
      const x = a.issueDate ?? "";
      const y = b.issueDate ?? "";
      return x === y ? 0 : x < y ? 1 : -1;
    });
  const groupBy = (key: "issuer" | "domain") =>
    unique(certificates.map((x) => x[key])).map((value) => ({ value, slugs: certificates.filter((x) => x[key] === value).map((x) => x.slug) }));
  const credentials = {
    total: certificates.length,
    issuers: unique(certificates.map((x) => x.issuer)).length,
    active: certificates.filter((x) => !x.expired).length,
    expired: certificates.filter((x) => x.expired).length,
    verified: certificates.filter((x) => x.verification === "verified").length,
    byIssuer: groupBy("issuer"),
    byDomain: groupBy("domain"),
  };

  // ── records ──────────────────────────────────────────────────────────────────────────────
  const achievements = withSlugs(
    [...c.achievements].sort((a, b) => (a.date < b.date ? 1 : -1)),
    (a) => clipSlug(slugify(a.title)),
  );
  const records = {
    awards: achievements.filter((a) => a.kind === "award" || a.kind === "honor").length,
    talks: achievements.filter((a) => a.kind === "speaking").length,
    ossStars: sum(achievements.filter((a) => a.kind === "oss" && a.metric && /star/i.test(a.metric.label)).map((a) => a.metric?.value ?? 0)),
    grants: achievements.filter((a) => a.kind === "grant").length,
    grantFunding: sum(achievements.filter((a) => a.kind === "grant").map((a) => a.metric?.value ?? 0)),
    press: achievements.filter((a) => a.kind === "press").length,
    patents: achievements.filter((a) => a.kind === "patent").length,
  };
  // RECORDS' figures (§7.4: one LED figure, then three tiles): every record, then the records' own
  // metrics, then the kinds with any, by count — never a zero, never a kind that only repeats the lead
  const byKind = ACHIEVEMENT_KINDS.map((kind) => ({ kind, count: achievements.filter((a) => a.kind === kind).length })).filter((k) => k.count > 0 && k.count < achievements.length);
  const recordFigures = {
    lead: achievements.length,
    tiles: [
      ...achievements.flatMap((a) => (a.metric ? [{ key: `metric:${a.slug}`, value: a.metric.value, unit: a.metric.unit ?? null, label: a.metric.label, from: a.issuer, kind: null }] : [])),
      ...byKind.sort((p, q) => q.count - p.count).map((k) => ({ key: `kind:${k.kind}`, value: k.count, unit: null, label: null, from: null, kind: k.kind })),
    ].slice(0, 3),
  };

  // ── hero spec strip ──────────────────────────────────────────────────────────────────────
  const labels = c.site.labels.heroStrip;
  // citations join the strip once there are some, as ARCHIVE's LED figure waits for them (Part 16):
  // a zero on the first screen is a figure in reverse, and on a phone it wrapped to a line alone
  const heroStrip: readonly { key: "years" | "shipped" | "papers" | "citations"; label: string; value: number }[] = [
    { key: "years", label: labels.years, value: experienceYears },
    { key: "shipped", label: labels.shipped, value: c.projects.length },
    { key: "papers", label: labels.papers, value: research.counted },
    ...(research.citations > 0 ? [{ key: "citations" as const, label: labels.citations, value: research.citations }] : []),
  ];

  // ── the works my papers cite (ARCHIVE's faint stars, v1.9) ───────────────────────────────
  const citedWorks = c.citedWorks
    .map((w) => {
      // an overlay only applies to the DOI it was read for, as for my papers
      const entry = live?.cited[w.id];
      const counted = entry && w.doi && entry.doi === w.doi ? entry : undefined;
      return {
      ...w,
      /** unknown until the bake reads it from OpenAlex by DOI: a gap, never a false 0 */
      citations: counted ? counted.citations : (null as number | null),
      citationsAsOf: counted?.asOf ?? null,
      link: w.doi ? `https://doi.org/${w.doi}` : (w.url ?? null),
      citedByTitles: w.citedBy.map((s) => bySlug.get(s)?.title ?? s),
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const citedById = new Map(citedWorks.map((w) => [w.id, w]));

  // ── graph: structure from content, positions from the baked graph.json ───────────────────
  const model = buildGraphModel(c.publications, c.citedWorks);
  const inputHash = graphInputHash(model);
  const layouts = new Map(o.graph.nodes.map((n) => [n.id, n.layouts]));
  const graph = {
    nodes: model.nodes.map((n) => {
      const p = bySlug.get(n.id);
      const w = citedById.get(n.id);
      return {
        ...n,
        title: p?.title ?? w?.title ?? n.id,
        venueShort: p?.venueShort ?? w?.venue ?? n.id,
        citations: p ? p.citations : (w?.citations ?? null),
        featured: p?.featured ?? false,
        layouts: layouts.get(n.id) ?? null,
      };
    }),
    edges: model.edges,
    labels: o.graph.labels,
    inputHash,
    stale: o.graph.inputHash !== inputHash,
    edgeCounts: {
      author: model.edges.filter((e) => e.kinds.includes("author")).length,
      related: model.edges.filter((e) => e.kinds.includes("related")).length,
      topic: model.edges.filter((e) => e.kinds.includes("topic")).length,
      cites: model.edges.filter((e) => e.kinds.includes("cites")).length,
    },
  };

  // ── bake provenance (for /dev/content) ───────────────────────────────────────────────────
  const verifyResults = Object.entries(o.verify.results).map(([key, r]) => ({ key, ...r }));
  const bake = {
    citations: { mode: o.citations.mode, source: o.citations.source, asOf: o.citations.asOf, refreshed: Object.keys(o.citations.counts).length },
    verify: {
      mode: o.verify.mode,
      results: verifyResults,
      byStatus: Object.fromEntries(["ok", "dead", "blocked", "unreachable", "skipped"].map((s) => [s, verifyResults.filter((r) => r.status === s).length])),
    },
  };

  return {
    isPlaceholder: c.isPlaceholder,
    buildDate: today,
    site: c.site,
    profile: c.profile,
    experience,
    careerStart,
    experienceYears,
    education,
    publications,
    citedWorks,
    catalogue,
    research,
    projects,
    skills: { all: skills, categories: skillCategories, primary: skills.filter((s) => s.primary) },
    certificates,
    credentials,
    achievements,
    records,
    recordFigures,
    testimonials: withSlugs(c.testimonials, (t) => slugify(t.name)),
    currentFocus: c.currentFocus,
    heroStrip,
    graph,
    bake,
  };
}

export type Derived = ReturnType<typeof derive>;
export type DerivedPublication = Derived["publications"][number];
export type DerivedProject = Derived["projects"][number];
export type DerivedSkill = Derived["skills"]["all"][number];
export type DerivedCertificate = Derived["certificates"][number];
