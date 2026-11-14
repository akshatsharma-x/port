import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { derived } from "@/content/derive";
import { credential, homeGraph, paperGraph, person, projectGraph, serialize } from "@/lib/jsonld";
import { titleSize } from "@/lib/og-size";
import { scholarTags } from "@/lib/seo";
import { indexable, siteUrl } from "@/lib/site";
import { ico } from "../scripts/bake/icons";
import { renderPng } from "@/lib/og";
import { paperCard } from "@/lib/og-cards";
import { pngSize, titleLines } from "../scripts/bake/og";
import { certificates as fixtureCerts } from "./fixtures/placeholder-content";

/**
 * PROMPTS.md Part 15: the head, the structured data, robots and the sitemap — true to the content
 * (nothing a record lacks is invented) and valid by schema.org's and Google's rules.
 */
const d = derived;
type Node = Record<string, unknown>;
const nodes = (g: { "@graph"?: unknown }) => (g["@graph"] ?? []) as Node[];
const ofType = (g: { "@graph"?: unknown }, t: string) => nodes(g).find((n) => n["@type"] === t) as Node;
/** every {"@id"} reference in a graph names a node that's in it */
function dangling(g: { "@graph"?: unknown }): string[] {
  const ids = new Set(nodes(g).map((n) => n["@id"]).filter(Boolean));
  const refs: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Node;
      if (Object.keys(o).length === 1 && typeof o["@id"] === "string") refs.push(o["@id"]);
      else Object.values(o).forEach(walk);
    }
  };
  nodes(g).forEach((n) => Object.values(n).forEach(walk));
  return refs.filter((r) => !ids.has(r));
}

describe("the site's address — lib/site.ts", () => {
  it("is its own domain once set, else Vercel's production URL, else the local server", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://akshat.dev" }).href).toBe("https://akshat.dev/");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "port.vercel.app" }).href).toBe("https://port.vercel.app/");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://akshat.dev", VERCEL_PROJECT_PRODUCTION_URL: "port.vercel.app" }).host).toBe("akshat.dev");
    expect(siteUrl({ PORT: "3200" }).href).toBe("http://localhost:3200/");
  });

  it("is indexed in production and locally, never on a preview", () => {
    expect(indexable({})).toBe(true);
    expect(indexable({ VERCEL_ENV: "production" })).toBe(true);
    expect(indexable({ VERCEL_ENV: "preview" })).toBe(false);
  });
});

describe("robots.txt and the sitemap", () => {
  it("robots opens the site but its review pages and its endpoint, and names the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules?.allow).toBe("/");
    expect(rules?.disallow).toEqual(["/dev/", "/api/"]);
    expect(String(r.sitemap)).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/);
  });

  it("the sitemap is home, every paper and every project — absolute, and nothing else", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname);
    expect(urls).toEqual(["/", ...d.publications.map((p) => `/research/${p.slug}`), ...d.projects.map((p) => `/work/${p.slug}`)]);
    expect(sitemap().every((e) => /^https?:\/\//.test(e.url) && e.lastModified)).toBe(true);
  });
});

describe("Google Scholar's citation_* tags — lib/seo.ts", () => {
  it("say what the record says: title, authors, the date, the proceedings — no DOI it lacks", () => {
    for (const p of d.publications) {
      const t = scholarTags(p);
      expect(t.citation_title).toBe(p.title);
      expect(t.citation_author).toEqual(p.authors.map((a) => a.name));
      expect(t.citation_publication_date).toMatch(p.month ? /^\d{4}\/\d{2}$/ : /^\d{4}$/);
      if (p.venueType === "conference") expect(t.citation_conference_title).toBe(p.venue);
      expect("citation_doi" in t).toBe(!!p.doi);
      expect("citation_pdf_url" in t).toBe(!!p.pdfUrl);
    }
  });
});

describe("structured data — lib/jsonld.ts", () => {
  it("home is a WebSite, a ProfilePage and the Person it's about, every @id resolved", () => {
    const g = homeGraph();
    expect(nodes(g).map((n) => n["@type"])).toEqual(["WebSite", "ProfilePage", "Person"]);
    expect((ofType(g, "ProfilePage").mainEntity as Node)["@id"]).toBe(ofType(g, "Person")["@id"]);
    expect(dangling(g)).toEqual([]);
  });

  it("the Person: name, role, where they study and work, what they know, every profile — and no photo until there's a real one", () => {
    const p = person() as unknown as Node;
    expect(p.name).toBe(d.profile.name);
    expect(p.jobTitle).toBe(d.profile.role);
    expect((p.alumniOf as Node[]).map((a) => a.name)).toEqual(d.education.map((e) => e.institution));
    expect((p.worksFor as Node[]).map((a) => a.name)).toEqual(d.experience.filter((e) => e.end === "present").map((e) => e.company));
    expect((p.knowsAbout as string[]).length).toBe(new Set(d.skills.all.map((s) => s.name)).size);
    expect(p.sameAs).toEqual([...d.profile.socials.map((s) => s.url), ...d.profile.scholarProfiles.map((s) => s.url)]);
    expect(p.image).toBeUndefined();
    expect(p.hasCredential === undefined).toBe(d.certificates.length === 0);
  });

  // the headline is the paper's own title, whole: Google may truncate a long one in display (the
  // food-waste paper's is 115 characters), but a cut title would misstate the record
  it("a paper is a ScholarlyArticle: its title as the headline, its authors, an ISO date, the proceedings it's in", () => {
    for (const pub of d.publications) {
      const g = paperGraph(pub);
      const a = ofType(g, "ScholarlyArticle");
      expect([a.headline, a.name]).toEqual([pub.title, pub.title]);
      expect((a.author as Node[]).length).toBe(pub.authors.length);
      expect(a.datePublished).toMatch(/^\d{4}(-\d{2})?$/);
      expect((a.isPartOf as Node).name).toBe(pub.venue);
      expect(String(a.image)).toMatch(/^https?:\/\/[^/]+\/og\/research\/[a-z0-9-]+\.png$/);
      expect("identifier" in a).toBe(!!pub.doi);
      expect(dangling(g)).toEqual([]);
    }
  });

  it("a project is a CreativeWork by the person, its stack as keywords, its card as its image", () => {
    for (const pr of d.projects) {
      const g = projectGraph(pr);
      const w = ofType(g, "CreativeWork");
      expect([w.name, w.description, w.keywords]).toEqual([pr.title, pr.summary, pr.stack.join(", ")]);
      expect("dateCreated" in w).toBe(pr.year !== null);
      expect(dangling(g)).toEqual([]);
    }
  });

  it("a certificate is an EducationalOccupationalCredential: its issuer, dates, ID and where to verify it", () => {
    const c = fixtureCerts.find((x) => x.verifyUrl) ?? fixtureCerts[0];
    if (!c) throw new Error("no fixture certificate");
    const x = credential(c as Parameters<typeof credential>[0]) as unknown as Node;
    expect(x["@type"]).toBe("EducationalOccupationalCredential");
    expect((x.recognizedBy as Node).name).toBe(c.issuer);
    expect([x.name, x.dateCreated, x.identifier]).toEqual([c.title, c.issueDate, c.credentialId]);
    expect(x.url).toBe(c.verifyUrl ?? undefined);
  });

  it("serializes with < escaped: no string in the data can close the <script>", () => {
    const g = { "@context": "https://schema.org", "@graph": [{ "@type": "Thing", name: "</script><b>" }] } as const;
    expect(serialize(g as never)).not.toContain("</script>");
    expect(JSON.parse(serialize(g as never))["@graph"][0].name).toBe("</script><b>");
  });
});

describe("the share cards and the icons — the bake's checks", () => {
  it("every record's title sits on ≤ 4 lines of its card", () => {
    for (const t of [d.profile.name, ...d.projects.map((p) => p.title), ...d.publications.map((p) => p.title)]) {
      expect(titleLines(t), t).toBeLessThanOrEqual(4);
      expect(titleSize(t)).toBeGreaterThanOrEqual(46);
    }
  });

  it("a paper's card renders: a PNG, 1200 × 630, through next/og with the static faces", async () => {
    const p = d.publications[0];
    if (!p) throw new Error("no publication");
    const png = await renderPng(paperCard(d, p).node);
    expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
    expect(png.length).toBeGreaterThan(20_000);
  });

  it("favicon.ico is a real ICO of PNG images", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const f = ico([16, 32].map((size) => ({ size, data: png })));
    expect([f.readUInt16LE(0), f.readUInt16LE(2), f.readUInt16LE(4)]).toEqual([0, 1, 2]);
    expect([f.readUInt8(6), f.readUInt8(22)]).toEqual([16, 32]);
    expect(f.readUInt32LE(6 + 12)).toBe(6 + 32);
    expect(f.subarray(6 + 32, 6 + 40).equals(png)).toBe(true);
  });
});
