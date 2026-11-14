import "server-only";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { derived } from "@/content/derive";
import type { Publication } from "@/content/schema";
import { COVER } from "@/lib/covers";
import { indexable, SITE_URL } from "@/lib/site";

/**
 * A page's head (PROMPTS.md Part 15): its canonical URL, Open Graph and Twitter card, all from the
 * same words. Next replaces a parent's openGraph wholesale, so every page gets the site's name and
 * locale again here. Each card is the bake's (public/og/, scripts/bake/og.ts), its URL versioned by
 * its bytes, so a share cache sees a changed card as a new one.
 */
const d = derived;

/** A card's URL with ?v= its content hash (none if the bake hasn't drawn it: dev before a bake). */
export function versioned(path: string): string {
  const file = join(process.cwd(), "public", path);
  return existsSync(file) ? `${path}?v=${createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12)}` : path;
}

export function pageMeta({ title, description, path, type = "website", article, image }: { title: string; description: string; path: string; type?: "website" | "article"; article?: { published: string; authors: string[] }; image: { path: string; alt: string } }): Metadata {
  const card = { url: versioned(image.path), width: COVER.og.width, height: COVER.og.height, alt: image.alt, type: "image/png" };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: d.site.meta.appName,
      locale: d.site.meta.locale,
      url: path,
      title,
      description,
      images: [card],
      ...(type === "article" && article ? { publishedTime: article.published, authors: article.authors } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: [{ url: card.url, alt: card.alt }] },
  };
}

/** The root's: the title template, the site's description, who made it, and whether to index it. */
export const rootMeta: Metadata = {
  metadataBase: SITE_URL,
  title: { default: d.site.title, template: d.site.meta.titleTemplate },
  description: d.site.description,
  applicationName: d.site.meta.appName,
  authors: [{ name: d.profile.name, url: SITE_URL.toString() }],
  creator: d.profile.name,
  robots: indexable() ? { index: true, follow: true } : { index: false, follow: false },
  // the HUD's years and the ledger's numbers are not phone numbers to tap
  formatDetection: { telephone: false, address: false, email: false },
};

/** A paper's date as Google Scholar and Open Graph read it: YYYY/MM (or YYYY), and ISO YYYY-MM. */
export const scholarDate = (p: Publication): string => (p.month ? `${p.year}/${String(p.month).padStart(2, "0")}` : String(p.year));
export const isoDate = (p: Publication): string => (p.month ? `${p.year}-${String(p.month).padStart(2, "0")}` : String(p.year));

/**
 * Google Scholar's inclusion tags (Highwire Press citation_*): how a paper on a personal site is
 * read as a paper. Only what the record has: no DOI or PDF is invented.
 */
export function scholarTags(p: Publication): Record<string, string | string[]> {
  const venue: Record<string, string> = p.venueType === "journal" ? { citation_journal_title: p.venue } : p.venueType === "conference" || p.venueType === "workshop" ? { citation_conference_title: p.venue } : {};
  return {
    citation_title: p.title,
    citation_author: p.authors.map((a) => a.name),
    citation_publication_date: scholarDate(p),
    ...venue,
    ...(p.doi ? { citation_doi: p.doi } : {}),
    ...(p.pdfUrl ? { citation_pdf_url: new URL(p.pdfUrl, SITE_URL).toString() } : {}),
    citation_abstract_html_url: new URL(`/research/${p.slug}`, SITE_URL).toString(),
  };
}
