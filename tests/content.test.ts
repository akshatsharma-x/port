import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import citationsJson from "@/content/citations.json";
import { buildGraphModel } from "@/content/graph";
import { layoutGraph } from "../scripts/bake/layout-graph";
import { data } from "./fixtures/placeholder-content";
import { CitationsFileSchema, ContentError, ContentSchema, GraphFileSchema, parseContent, VerifyFileSchema, type ContentInput } from "@/content/schema";
import { derive, hIndex, i10Index, mentions, monthsSince, slugify, venueKey, type Overlays } from "@/content/selectors";
import verifyJson from "@/content/verify.json";

/**
 * The content layer (PROMPTS.md Part 2): the schema rejects what it should, the placeholder set has
 * the shape the brief asked for, and derive() computes the true numbers. Dates are pinned.
 */
const ROOT = resolve(__dirname, "..");
const NOW = new Date("2026-11-10T00:00:00Z");
const content = parseContent(data);
const overlays: Overlays = {
  citations: CitationsFileSchema.parse(citationsJson),
  verify: VerifyFileSchema.parse(verifyJson),
  // the fixture's own layout, fresh (the committed graph.json is the real content's)
  graph: GraphFileSchema.parse(layoutGraph(buildGraphModel(parseContent(data).publications))),
};
const d = derive(content, overlays, NOW);

const clone = (): ContentInput => structuredClone(data) as ContentInput;
/** Every issue as "path: message", so a test can assert both where and why. */
function issues(input: unknown): string[] {
  const r = ContentSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}
const first = <T>(xs: T[]): T => {
  const x = xs[0];
  if (x === undefined) throw new Error("fixture is empty");
  return x;
};

describe("placeholder dataset — the shape the brief asks for", () => {
  it("parses strictly and is marked placeholder", () => {
    expect(() => parseContent(data)).not.toThrow();
    expect(content.isPlaceholder).toBe(true);
  });

  it("has 8 projects, 5 roles, 10 papers (1 under review, 1 in prep), 25 skills in 5 categories", () => {
    expect(content.projects).toHaveLength(8);
    expect(content.experience).toHaveLength(5);
    expect(content.publications).toHaveLength(10);
    expect(content.publications.filter((p) => p.status === "underReview")).toHaveLength(1);
    expect(content.publications.filter((p) => p.status === "inPrep")).toHaveLength(1);
    expect(content.skills).toHaveLength(25);
    expect(new Set(content.skills.map((s) => s.category)).size).toBe(5);
  });

  it("has 12 certificates from 5 issuers — one expired, one without a verify URL", () => {
    expect(content.certificates).toHaveLength(12);
    expect(new Set(content.certificates.map((c) => c.issuer)).size).toBe(5);
    expect(content.certificates.filter((c) => c.expiryDate !== null && c.expiryDate < "2026-11-10")).toHaveLength(1);
    expect(content.certificates.filter((c) => c.verifyUrl === null)).toHaveLength(1);
  });

  it("has 10 achievements, 3 consented testimonials, and every venue type", () => {
    expect(content.achievements).toHaveLength(10);
    expect(content.testimonials).toHaveLength(3);
    expect(new Set(content.publications.map((p) => p.venueType)).size).toBe(7);
  });

  it("uses only identifiers that can never resolve to someone else's work", () => {
    for (const p of content.publications) {
      if (p.doi && !p.doi.startsWith("10.48550/")) expect(p.doi, p.slug).toMatch(/^10\.5555\//); // Crossref's test prefix
      if (p.arxivId) expect(Number(p.arxivId.split(".")[1]), p.slug).toBeGreaterThanOrEqual(90000);
    }
    for (const c of content.certificates) expect(c.credentialId).toMatch(/PLACEHOLDER/);
    expect(content.profile.email).toMatch(/\.example$/);
  });

  it("only uses characters every baked font carries (no system-font fallback)", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "app/fonts/manifest.json"), "utf8")) as { fonts: { id: string; codepoints: number[] }[] };
    const chars = new Set<string>();
    const walk = (v: unknown): void => {
      if (typeof v === "string") for (const ch of v) chars.add(ch);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(data);
    chars.delete("\n");
    for (const font of manifest.fonts) {
      const cps = new Set(font.codepoints);
      const missing = [...chars].filter((ch) => !cps.has(ch.codePointAt(0) ?? 0));
      expect(missing, `${font.id} lacks ${missing.map((ch) => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase()}`).join(" ")}`).toEqual([]);
    }
  });
});

describe("schema — fails loudly, at the right path", () => {
  it("throws a ContentError that names the path", () => {
    const c = clone();
    first(c.publications).slug = "Not A Slug";
    expect(() => parseContent(c)).toThrow(ContentError);
    expect(() => parseContent(c)).toThrow(/publications\[0\]\.slug|publications\.0\.slug/);
  });

  const cases: [string, (c: ContentInput) => void, RegExp][] = [
    ["unknown fields (strict objects)", (c) => Object.assign(c.profile, { accentColor: "#ff0000" }), /Unrecognized key.*accentColor/],
    ["a 7th primary skill", (c) => c.skills.forEach((s) => (s.primary = true)), /at most 6 primary skills/],
    ["an unknown related paper", (c) => first(c.publications).relatedPublicationSlugs.push("no-such-paper"), /unknown related publication "no-such-paper"/],
    ["a related paper from a project", (c) => first(c.projects).relatedPublicationSlugs.push("ghost"), /projects\.0\.relatedPublicationSlugs\.\d+: unknown related publication/],
    ["a two-sentence TLDR", (c) => (first(c.publications).tldr = "It is fast. It is also correct."), /tldr: exactly one sentence/],
    ["a TLDR with no period", (c) => (first(c.publications).tldr = "It is fast"), /tldr: exactly one sentence/],
    ["zero authors marked isMe", (c) => first(c.publications).authors.forEach((a) => (a.isMe = false)), /exactly one author must be you/],
    ["co-author ids out of step", (c) => first(c.publications).coAuthorIds.pop(), /coAuthorIds needs one id per co-author/],
    ["a BibTeX year that disagrees", (c) => (first(c.publications).year = 2019), /BibTeX year must be 2019/],
    ["an untagged testimonial", (c) => Object.assign(first(c.testimonials), { consented: false }), /consent/],
    ["an expiry before issue", (c) => (first(c.certificates).expiryDate = "2001-01-01"), /expiryDate must be after issueDate/],
    ["an unnamed topic cluster", (c) => (first(c.publications).topicCluster = "unnamed-cluster"), /has no name in site\.topicClusters/],
    ["a duplicate paper slug", (c) => (c.publications[1] = { ...first(c.publications) }), /duplicate publication slug/],
    ["reordered sections", (c) => c.site.sections.reverse(), /site\.sections must be, in order/],
    ["an http:// link", (c) => (first(c.profile.socials).url = "http://example.com"), /https:\/\/ URL/],
    ["a made-up time zone", (c) => (c.profile.timezone = "Mars/Olympus_Mons"), /IANA time zone/],
    ["working hours that end before they start", (c) => (c.profile.workingHours = { start: "18:00", end: "09:00" }), /start must be before end/],
    ["a DOI pasted as a URL", (c) => (first(c.publications).doi = "https://doi.org/10.5555/123"), /bare DOI/],
    ["a skill level of 6", (c) => (first(c.skills).level = 6), /skills\.0\.level/],
    ["two 'building' focus items", (c) => c.currentFocus.push({ ...first(c.currentFocus), kind: "building" }), /exactly one "building"/],
  ];
  it.each(cases)("rejects %s", (_, mutate, expected) => {
    const c = clone();
    mutate(c);
    const found = issues(c);
    expect(found.join("\n")).toMatch(expected);
  });

  it("only lets peer-reviewable venues claim peer review", () => {
    const c = clone();
    const preprint = c.publications.find((p) => p.venueType === "preprint");
    if (!preprint) throw new Error("fixture needs a preprint");
    preprint.isPeerReviewed = true;
    expect(issues(c).join("\n")).toMatch(/a preprint that is \w+ cannot be marked peer reviewed/);
  });

  it("only lets journals carry an impact factor", () => {
    const c = clone();
    const conf = c.publications.find((p) => p.venueType === "conference");
    if (!conf) throw new Error("fixture needs a conference paper");
    conf.impactFactor = 3.1;
    expect(issues(c).length).toBeGreaterThan(0);
  });
});

describe("selectors — small, exact", () => {
  it("h-index and i10", () => {
    expect(hIndex([])).toBe(0);
    expect(hIndex([0])).toBe(0);
    expect(hIndex([1])).toBe(1);
    expect(hIndex([10, 8, 5, 4, 3])).toBe(4);
    expect(hIndex([25, 8, 5, 3, 3])).toBe(3);
    expect(hIndex([100, 100, 100])).toBe(3);
    expect(i10Index([9, 10, 11, 0])).toBe(2);
  });

  it("venue keys merge years; months count whole months", () => {
    expect(venueKey("CHI '25")).toBe("CHI");
    expect(venueKey("CHI ’21")).toBe("CHI");
    expect(venueKey("IEEE TVCG")).toBe("IEEE TVCG");
    expect(monthsSince("2016-09", NOW)).toBe(122);
  });

  it("mentions() matches whole terms, including punctuation-heavy ones", () => {
    expect(mentions("built with three.js and R3F", ["three.js"])).toBe(true);
    expect(mentions("written in C++ mostly", ["C++"])).toBe(true);
    expect(mentions("React and Preact", ["act"])).toBe(false);
    expect(mentions("research on reading", ["R"])).toBe(false);
    expect(mentions("analysis in R and Python", ["R"])).toBe(true);
  });

  it("slugify()", () => {
    expect(slugify("three.js")).toBe("three-js");
    expect(slugify("C++")).toBe("cpp");
    expect(slugify("C#")).toBe("csharp");
    expect(slugify("Júlia Varga")).toBe("julia-varga");
    expect(slugify("  Research & Design  ")).toBe("research-and-design");
  });
});

describe("derive() — every number is true (as of 2026-11-10)", () => {
  it("research metrics", () => {
    expect(d.research).toMatchObject({ total: 10, counted: 8, underReview: 1, inPrep: 1, citations: 246, hIndex: 6, i10: 4, firstAuthor: 6, venues: 7 });
    expect(d.research.provenance.sources).toEqual(["Placeholder"]);
    expect(d.research.years).toEqual({ from: 2021, to: 2025 });
  });

  it("publications by year keep empty years, by venue type list all seven", () => {
    const years = d.research.byYear.map((y) => y.year);
    expect(years).toEqual(Array.from({ length: years.length }, (_, i) => (years[0] ?? 0) + i));
    expect(d.research.byYear.reduce((n, y) => n + y.papers.length, 0)).toBe(10);
    expect(d.research.byVenueType.map((v) => v.venueType)).toEqual(["journal", "conference", "workshop", "preprint", "patent", "thesis", "chapter"]);
    expect(d.research.coAuthors[0]?.count).toBe(3);
  });

  it("the hero strip: years · shipped · papers · citations", () => {
    expect(d.heroStrip.map((h) => [h.key, h.value])).toEqual([
      ["years", 10],
      ["shipped", 8],
      ["papers", 8],
      ["citations", 246],
    ]);
  });

  it("credentials: 12 / 5 issuers / 11 active, and nothing VERIFIED on a dry bake", () => {
    expect(d.credentials).toMatchObject({ total: 12, issuers: 5, active: 11, expired: 1, verified: 0 });
    const noUrl = d.certificates.find((c) => c.verifyUrl === null);
    expect(noUrl?.verification).toBe("onFile");
    expect(d.certificates.filter((c) => c.verifyUrl).every((c) => c.verification === "unchecked")).toBe(true);
  });

  it("expiry is judged against the build date", () => {
    const later = derive(content, overlays, new Date("2031-01-01T00:00:00Z"));
    expect(later.credentials.active).toBeLessThan(d.credentials.active);
  });

  it("skills: grouped by category, each with project evidence", () => {
    expect(d.skills.categories).toHaveLength(5);
    expect(d.skills.primary.length).toBeLessThanOrEqual(6);
    for (const s of d.skills.all) expect(s.evidence.projects.length + s.evidence.roles.length, s.name).toBeGreaterThan(0);
    expect(d.skills.all.find((s) => s.name === "TypeScript")?.evidence.projects).toHaveLength(8);
  });

  it("records", () => {
    expect(d.records).toMatchObject({ talks: 2, grants: 1, patents: 1, press: 1 });
    expect(d.records.ossStars).toBe(3200);
  });

  it("the graph comes from content; positions from a fresh graph.json", () => {
    expect(d.graph.stale).toBe(false);
    expect(d.graph.nodes).toHaveLength(10);
    expect(d.graph.nodes.every((n) => n.layouts !== null)).toBe(true);
  });

  it("a cited work's count comes only from a live overlay for its own DOI; otherwise it's unknown, never 0", () => {
    const by = first(content.publications).slug;
    const withCited = { ...content, citedWorks: [{ id: "ref-a", title: "A cited work", authors: "A. B.", year: 2001, venue: "A journal", venueType: "journal" as const, doi: "10.1000/ref-a", citedBy: [by] }] };
    const live: Overlays = { ...overlays, citations: { version: 1, mode: "live", source: "OpenAlex", asOf: "2026-11-09", counts: {}, cited: { "ref-a": { doi: "10.1000/ref-a", citations: 1234, openalexId: "W9", asOf: "2026-11-09" } } } };
    expect(derive(withCited, live, NOW).citedWorks[0]).toMatchObject({ citations: 1234, citationsAsOf: "2026-11-09" });
    expect(derive(withCited, overlays, NOW).citedWorks[0]?.citations).toBeNull();
    const moved = { ...withCited, citedWorks: withCited.citedWorks.map((w) => ({ ...w, doi: "10.1000/moved" })) };
    expect(derive(moved, live, NOW).citedWorks[0]?.citations).toBeNull();
  });

  it("a live citation overlay wins, with its own source and date", () => {
    const paper = first(content.publications.filter((p) => p.doi));
    const live: Overlays = {
      ...overlays,
      citations: { version: 1, mode: "live", source: "OpenAlex", asOf: "2026-11-09", counts: { [paper.slug]: { doi: paper.doi ?? "", citations: 999, openalexId: "W1", asOf: "2026-11-09" } }, cited: {} },
    };
    const x = derive(content, live, NOW).publications.find((p) => p.slug === paper.slug);
    expect(x).toMatchObject({ citations: 999, citationSource: "OpenAlex", citationsAsOf: "2026-11-09" });
    // …but only for the DOI it was read for
    const moved = derive({ ...content, publications: content.publications.map((p) => (p.slug === paper.slug ? { ...p, doi: "10.5555/moved" } : p)) }, live, NOW);
    expect(moved.publications.find((p) => p.slug === paper.slug)?.citations).toBe(paper.citations);
  });

  it("VERIFIED only when the build resolved the URL; dead → ON FILE", () => {
    const cert = first(content.certificates.filter((c) => c.verifyUrl));
    const at = (status: "ok" | "dead" | "blocked") =>
      derive(content, { ...overlays, verify: { version: 1, mode: "live", results: { [`verifyUrl:${cert.slug}`]: { kind: "verifyUrl", owner: cert.slug, target: cert.verifyUrl ?? "", status, httpStatus: 200, checkedAt: "2026-11-10" } } } }, NOW).certificates.find(
        (c) => c.slug === cert.slug,
      )?.verification;
    expect(at("ok")).toBe("verified");
    expect(at("dead")).toBe("onFile");
    expect(at("blocked")).toBe("onFile");
  });
});
