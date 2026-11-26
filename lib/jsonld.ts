import "server-only";
import type { CreativeWork, EducationalOccupationalCredential, Graph, Person, ProfilePage, ScholarlyArticle, WebSite } from "schema-dts";
import { derived } from "@/content/derive";
import type { Certificate, Project, Publication } from "@/content/schema";
import { ogPath } from "@/lib/og-meta";
import { isoDate } from "@/lib/seo";
import { absolute } from "@/lib/site";

/**
 * Structured data (PROMPTS.md Part 15): how the research surfaces in search. schema.org, typed
 * with schema-dts so a property that doesn't exist on a type is a compile error; one graph per
 * page, the person at a stable @id every page points to. Only what the content says: no DOI,
 * Scholar or ORCID profile, co-author or date is invented — an absent fact is an absent field.
 */
const d = derived;
const PERSON = absolute("/#person");
const SITE = absolute("/#website");
const ref = (id: string) => ({ "@id": id });

/** The owner: name, role, the city, where they study and work, what they know, every profile. */
export function person(): Person {
  const now = d.experience.filter((e) => e.end === "present");
  const profiles = [...d.profile.socials.map((s) => s.url), ...d.profile.scholarProfiles.map((s) => s.url)];
  const credentials = d.certificates.map(credential);
  return {
    "@type": "Person",
    "@id": PERSON,
    name: d.profile.name,
    url: absolute("/"),
    jobTitle: d.profile.role,
    description: d.profile.bio.short,
    email: `mailto:${d.profile.email}`,
    address: { "@type": "PostalAddress", addressLocality: d.profile.location.city, addressCountry: d.profile.location.countryCode },
    alumniOf: d.education.map((e) => ({ "@type": "CollegeOrUniversity", name: e.institution, ...(e.url ? { url: e.url } : {}) })),
    ...(now.length ? { worksFor: now.map((e) => ({ "@type": "Organization", name: e.company, ...(e.url ? { url: e.url } : {}) })) } : {}),
    knowsAbout: [...new Set(d.skills.all.map((s) => s.name))],
    ...(profiles.length ? { sameAs: profiles } : {}),
    ...(credentials.length ? { hasCredential: credentials } : {}),
  };
}

/** A certificate, as the credential it is: who recognizes it, when, its ID and where to verify it. */
export function credential(c: Certificate): EducationalOccupationalCredential {
  return {
    "@type": "EducationalOccupationalCredential",
    name: c.title,
    credentialCategory: "certificate",
    educationalLevel: c.level,
    recognizedBy: { "@type": "Organization", name: c.issuer },
    // a month-only date is ISO 8601 too (2026-07); what isn't listed is left out, never null (v2.8)
    ...(c.issueDate ? { dateCreated: c.issueDate } : {}),
    ...(c.expiryDate ? { expires: c.expiryDate } : {}),
    ...(c.credentialId ? { identifier: c.credentialId } : {}),
    ...(c.verifyUrl ? { url: c.verifyUrl } : {}),
    competencyRequired: c.skillsCovered,
  };
}

/** Home: the site, the profile page and the person it's about. */
export function homeGraph(): Graph {
  const site: WebSite = { "@type": "WebSite", "@id": SITE, url: absolute("/"), name: d.site.meta.appName, description: d.site.description, inLanguage: "en", author: ref(PERSON) };
  const page: ProfilePage = { "@type": "ProfilePage", "@id": absolute("/#profile"), url: absolute("/"), name: d.site.title, isPartOf: ref(SITE), mainEntity: ref(PERSON), dateModified: d.buildDate };
  return { "@context": "https://schema.org", "@graph": [site, page, person()] };
}

/** A project: a creative work by the person, with its stack as keywords and its card as its image. */
export function projectGraph(p: Project): Graph {
  const url = absolute(`/work/${p.slug}`);
  const links = [p.links.live, p.links.repo].filter((x): x is string => !!x);
  const work: CreativeWork = {
    "@type": "CreativeWork",
    "@id": `${url}#work`,
    url,
    name: p.title,
    alternativeHeadline: p.subtitle,
    description: p.summary,
    genre: p.category,
    keywords: p.stack.join(", "),
    image: absolute(ogPath({ work: p.slug })),
    creator: ref(PERSON),
    author: ref(PERSON),
    inLanguage: "en",
    ...(p.year !== null ? { dateCreated: String(p.year) } : {}),
    ...(links.length ? { sameAs: links } : {}),
  };
  return { "@context": "https://schema.org", "@graph": [work, person()] };
}

/**
 * A paper: a ScholarlyArticle with its author list (the owner by @id, co-authors by name and
 * affiliation), its date, the proceedings or journal it's part of, its DOI when it has one, and
 * the works it cites when the content lists them.
 */
export function paperGraph(p: Publication): Graph {
  const url = absolute(`/research/${p.slug}`);
  const cites = d.citedWorks.filter((c) => c.citedBy.includes(p.slug));
  const article: ScholarlyArticle = {
    "@type": "ScholarlyArticle",
    "@id": `${url}#article`,
    url,
    mainEntityOfPage: url,
    headline: p.title,
    name: p.title,
    description: p.tldr,
    ...(p.abstract ? { abstract: p.abstract } : {}),
    author: p.authors.map((a) => (a.isMe ? ref(PERSON) : { "@type": "Person", name: a.name, ...(a.affiliation ? { affiliation: { "@type": "Organization", name: a.affiliation } } : {}) })),
    datePublished: isoDate(p),
    isPartOf: { "@type": p.venueType === "journal" ? "Periodical" : "Book", name: p.venue },
    keywords: p.keywords.join(", "),
    inLanguage: "en",
    isAccessibleForFree: p.isOpenAccess,
    image: absolute(ogPath({ research: p.slug })),
    ...(p.doi ? { identifier: { "@type": "PropertyValue", propertyID: "DOI", value: p.doi }, sameAs: `https://doi.org/${p.doi}` } : {}),
    ...(cites.length
      ? { citation: cites.map((c): CreativeWork => ({ "@type": "CreativeWork", name: c.title, author: c.authors, datePublished: String(c.year), ...(c.doi ? { sameAs: `https://doi.org/${c.doi}` } : c.url ? { url: c.url } : {}) })) }
      : {}),
  };
  return { "@context": "https://schema.org", "@graph": [article, person()] };
}

/** JSON for a <script>: "<" escaped, so no string in the data can close the tag (Next's JSON-LD guide). */
export const serialize = (graph: Graph): string => JSON.stringify(graph).replace(/</g, "\\u003c");
