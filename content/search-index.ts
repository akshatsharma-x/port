import { encode, packColumns } from "@/lib/hollerith";
import { cardText } from "@/lib/log";
import { routes } from "@/lib/routes";
import { SHELL } from "@/lib/shell/config";
import type { SectionId } from "./schema";
import type { Derived } from "./selectors";

/**
 * public/search-index.json — the terminal's view of everything (PROMPTS.md Part 13), built from
 * the same derive() as the page, so the shell can never disagree with the sections. Fetched on the
 * terminal's first open; ≤ 60 KB gz (DESIGN.md §8.3, enforced by the bake and tests/bake.test.ts).
 *
 * Every record is a doc: `title` + `meta` + `text` are what `grep` ranks; the typed fields are what
 * `cat`, `cite`, `verify`, `scholar` and `neofetch` print. Since v2 it also carries the terminal's
 * own words (labels), each LOG card's holes for `decode`, and what only the build knows (the
 * version and stack, recent commits for `rain`, the portrait as text for `neofetch`).
 */
export const SEARCH_INDEX_VERSION = SHELL.indexVersion;
export const SEARCH_INDEX_BUDGET_GZ = 60 * 1024;

interface DocBase<K extends string> {
  id: `${K}:${string}`;
  kind: K;
  slug: string;
  section: SectionId;
  href: string;
  title: string;
  /** one mono line, e.g. "CHI '25 · 2025 · conference" */
  meta: string;
  /** the long text grep searches beyond title and meta */
  text: string;
}

export type SearchDoc =
  | (DocBase<"paper"> & {
      year: number;
      venueShort: string;
      venueType: string;
      status: string;
      citations: number;
      citationsAsOf: string;
      citationSource: string;
      tldr: string;
      authors: { name: string; isMe: boolean }[];
      bibtex: string;
      venue: string;
      abstract: string | null;
      keywords: string[];
      links: { doi: string | null; arxiv: string | null; pdf: string | null; code: string | null; dataset: string | null };
    })
  | (DocBase<"project"> & {
      year: number | null;
      subtitle: string;
      category: string;
      role: string | null;
      summary: string;
      problem: string;
      approach: string;
      outcome: string;
      metrics: { label: string; value: number; unit: string | null }[];
      stack: string[];
      links: { live: string | null; repo: string | null; paper: string | null };
    })
  | (DocBase<"role"> & { company: string; role: string; type: string; location: string; start: string; end: string; blurb: string; highlights: string[]; stack: string[] })
  | (DocBase<"education"> & { institution: string; degree: string; field: string; location: string; start: string; end: string; honors: string | null })
  | (DocBase<"skill"> & {
      category: string;
      level: number;
      rubric: string;
      years: number;
      primary: boolean;
      evidence: { projects: number; papers: number; roles: number };
    })
  | (DocBase<"cert"> & {
      issuer: string;
      level: string;
      proves: string;
      credentialId: string;
      issueDate: string;
      expiryDate: string | null;
      verifyUrl: string | null;
      verification: string;
    })
  | (DocBase<"award"> & { achievementKind: string; issuer: string; date: string; description: string; proofUrl: string | null })
  | (DocBase<"quote"> & { name: string; role: string; company: string });

/** What only the build knows: the bake reads it (package.json, git, the portrait) and passes it in. */
export interface IndexExtras {
  build: { version: string | null; sha: string | null; stack: { name: string; version: string | null }[] };
  /** recent commits' short hashes, newest first (a shallow clone has fewer) */
  commits: string[];
  /** the About portrait as rows of text, light as dense glyphs */
  portrait: string[];
}

export interface SearchIndex extends IndexExtras {
  version: typeof SEARCH_INDEX_VERSION;
  isPlaceholder: boolean;
  /** derived numbers (years of experience, active credentials) are true as of this date */
  builtOn: string;
  sections: { id: SectionId; index: number; code: string; title: string }[];
  profile: {
    name: string;
    initials: string;
    role: string;
    tagline: string;
    bio: string;
    location: string;
    /** the zone is named as the owner's country writes it in English (the HUD's rule, §7.3): IST, not GMT+5:30 */
    countryCode: string;
    timezone: string;
    workingHours: { start: string; end: string };
    availability: { status: string; note: string };
    email: string;
    resumeUrl: string | null;
    socials: { platform: string; url: string; handle: string }[];
    scholarProfiles: { platform: string; url: string; id: string }[];
    currentFocus: { kind: string; title: string; detail: string | null; url: string | null }[];
  };
  metrics: {
    research: Pick<Derived["research"], "total" | "counted" | "citations" | "hIndex" | "i10" | "firstAuthor" | "venues" | "years" | "provenance">;
    credentials: Pick<Derived["credentials"], "total" | "issuers" | "active" | "expired" | "verified">;
    projects: number;
    experienceYears: number;
    primaryStack: string[];
  };
  docs: SearchDoc[];
  /** the terminal's own words, and the site's labels it shares (so one change reaches both) */
  labels: {
    shell: Derived["site"]["labels"]["shell"];
    os: string;
    status: Derived["site"]["labels"]["archive"]["status"];
    metrics: Derived["site"]["labels"]["archive"]["metrics"];
    stamps: Derived["site"]["labels"]["credentials"]["stamps"];
    card: Derived["site"]["labels"]["credentials"]["back"];
    levels: Derived["site"]["labels"]["credentials"]["levels"];
    currently: Derived["site"]["labels"]["identity"]["currently"];
    availability: Derived["site"]["labels"]["hero"]["availability"];
    channels: Derived["site"]["labels"]["connect"]["channels"];
    paperLinks: Derived["site"]["labels"]["archive"]["dossier"]["actions"];
    projectLinks: Derived["site"]["labels"]["work"]["study"]["link"];
  };
  /** LOG's punch cards (§4.3 A2): each column's punched rows (lib/hollerith packColumns), as LOG's deck punches them — `decode` reads them back */
  cards: { slug: string; title: string; holes: string }[];
}

const NO_EXTRAS: IndexExtras = { build: { version: null, sha: null, stack: [] }, commits: [], portrait: [] };

const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");
const lines = (...parts: (string | null | undefined | readonly string[])[]) => parts.flat().filter(Boolean).join("\n");
const range = (start: string, end: string) => `${start} – ${end}`;

export function buildSearchIndex(d: Derived, extras: IndexExtras = NO_EXTRAS): SearchIndex {
  const p = d.profile;
  const L = d.site.labels;
  const docs: SearchDoc[] = [
    ...d.publications.map(
      (x): SearchDoc => ({
        id: `paper:${x.slug}`,
        kind: "paper",
        slug: x.slug,
        section: "archive",
        href: routes.paper(x.slug),
        title: x.title,
        meta: join(x.venueShort, String(x.year), x.venueType, x.status),
        text: lines(x.tldr, x.abstract, x.keywords.join(", "), x.authors.map((a) => a.name).join(", "), x.venue, x.clusterName),
        year: x.year,
        venueShort: x.venueShort,
        venueType: x.venueType,
        status: x.status,
        citations: x.citations,
        citationsAsOf: x.citationsAsOf,
        citationSource: x.citationSource,
        tldr: x.tldr,
        authors: x.authors.map((a) => ({ name: a.name, isMe: a.isMe })),
        bibtex: x.bibtex,
        venue: x.venue,
        abstract: x.abstract ?? null,
        keywords: x.keywords,
        links: x.links,
      }),
    ),
    ...d.projects.map(
      (x): SearchDoc => ({
        id: `project:${x.slug}`,
        kind: "project",
        slug: x.slug,
        section: "work",
        href: routes.project(x.slug),
        title: x.title,
        meta: join(x.subtitle, x.year === null ? null : String(x.year), x.category),
        text: lines(x.summary, x.problem, x.approach, x.outcome, x.role, x.stack.join(", "), x.metrics.map((m) => `${m.label} ${m.value}${m.unit ?? ""}`)),
        year: x.year,
        subtitle: x.subtitle,
        category: x.category,
        role: x.role ?? null,
        summary: x.summary,
        problem: x.problem,
        approach: x.approach,
        outcome: x.outcome,
        metrics: x.metrics.map((m) => ({ label: m.label, value: m.value, unit: m.unit ?? null })),
        stack: x.stack,
        links: { live: x.links.live ?? null, repo: x.links.repo ?? null, paper: x.links.paper ?? null },
      }),
    ),
    ...d.experience.map(
      (x): SearchDoc => ({
        id: `role:${x.slug}`,
        kind: "role",
        slug: x.slug,
        section: "log",
        href: routes.section("log"),
        title: `${x.role}, ${x.company}`,
        meta: join(range(x.start, x.end), x.type, x.location),
        text: lines(x.blurb, x.highlights, x.stack.join(", ")),
        company: x.company,
        role: x.role,
        type: x.type,
        location: x.location,
        start: x.start,
        end: x.end,
        blurb: x.blurb,
        highlights: x.highlights,
        stack: x.stack,
      }),
    ),
    ...d.education.map(
      (x): SearchDoc => ({
        id: `education:${x.slug}`,
        kind: "education",
        slug: x.slug,
        section: "log",
        href: routes.section("log"),
        title: `${x.degree}, ${x.institution}`,
        meta: join(range(x.start, x.end), x.location),
        text: lines(x.field, x.thesis, x.honors),
        institution: x.institution,
        degree: x.degree,
        field: x.field,
        location: x.location,
        start: x.start,
        end: x.end,
        honors: x.honors ?? null,
      }),
    ),
    ...d.skills.all.map(
      (x): SearchDoc => ({
        id: `skill:${x.slug}`,
        kind: "skill",
        slug: x.slug,
        section: "capabilities",
        href: routes.section("capabilities"),
        title: x.name,
        meta: join(x.category, `L${x.level} ${x.rubric}`, `${x.years} yr`),
        text: lines(x.aliases?.join(", ")),
        category: x.category,
        level: x.level,
        rubric: x.rubric,
        years: x.years,
        primary: x.primary,
        evidence: { projects: x.evidence.projects.length, papers: x.evidence.papers.length, roles: x.evidence.roles.length },
      }),
    ),
    ...d.certificates.map(
      (x): SearchDoc => ({
        id: `cert:${x.slug}`,
        kind: "cert",
        slug: x.slug,
        section: "credentials",
        href: routes.section("credentials"),
        title: x.title,
        meta: join(x.issuer, x.level, x.issueDate),
        text: lines(x.proves, x.domain, x.skillsCovered.join(", ")),
        issuer: x.issuer,
        level: x.level,
        proves: x.proves,
        credentialId: x.credentialId,
        issueDate: x.issueDate,
        expiryDate: x.expiryDate,
        verifyUrl: x.verifyUrl,
        verification: x.verification,
      }),
    ),
    ...d.achievements.map(
      (x): SearchDoc => ({
        id: `award:${x.slug}`,
        kind: "award",
        slug: x.slug,
        section: "credentials",
        href: routes.section("credentials"),
        title: x.title,
        meta: join(x.issuer, x.kind, x.date),
        text: lines(x.description, x.metric ? `${x.metric.label} ${x.metric.value}${x.metric.unit ?? ""}` : null),
        achievementKind: x.kind,
        issuer: x.issuer,
        date: x.date,
        description: x.description,
        proofUrl: x.proofUrl ?? null,
      }),
    ),
    ...d.testimonials.map(
      (x): SearchDoc => ({
        id: `quote:${x.slug}`,
        kind: "quote",
        slug: x.slug,
        section: "credentials",
        href: routes.section("credentials"),
        title: x.name,
        meta: join(x.role, x.company),
        text: lines(x.quote, x.relationship),
        name: x.name,
        role: x.role,
        company: x.company,
      }),
    ),
  ];

  return {
    version: SEARCH_INDEX_VERSION,
    isPlaceholder: d.isPlaceholder,
    builtOn: d.buildDate,
    sections: d.site.sections.map((s) => ({ id: s.id, index: s.index, code: s.code, title: s.title })),
    profile: {
      name: p.name,
      initials: p.initials,
      role: p.role,
      tagline: p.tagline,
      bio: p.bio.short,
      location: `${p.location.city}, ${p.location.country}`,
      countryCode: p.location.countryCode,
      timezone: p.timezone,
      workingHours: p.workingHours,
      availability: p.availability,
      email: p.email,
      resumeUrl: p.resumeUrl,
      socials: p.socials,
      scholarProfiles: p.scholarProfiles,
      currentFocus: d.currentFocus.map((f) => ({ kind: f.kind, title: f.title, detail: f.detail ?? null, url: f.url ?? null })),
    },
    metrics: {
      research: {
        total: d.research.total,
        counted: d.research.counted,
        citations: d.research.citations,
        hIndex: d.research.hIndex,
        i10: d.research.i10,
        firstAuthor: d.research.firstAuthor,
        venues: d.research.venues,
        years: d.research.years,
        provenance: d.research.provenance,
      },
      credentials: {
        total: d.credentials.total,
        issuers: d.credentials.issuers,
        active: d.credentials.active,
        expired: d.credentials.expired,
        verified: d.credentials.verified,
      },
      projects: d.projects.length,
      experienceYears: d.experienceYears,
      primaryStack: d.skills.primary.map((s) => s.name),
    },
    docs,
    labels: {
      shell: L.shell,
      os: L.chrome.os,
      status: L.archive.status,
      metrics: L.archive.metrics,
      stamps: L.credentials.stamps,
      card: L.credentials.back,
      levels: L.credentials.levels,
      currently: L.identity.currently,
      availability: L.hero.availability,
      channels: L.connect.channels,
      paperLinks: L.archive.dossier.actions,
      projectLinks: L.work.study.link,
    },
    cards: d.experience.map((e) => ({ slug: e.slug, title: e.company, holes: packColumns(encode(cardText(e, L.log.present))) })),
    ...extras,
  };
}
