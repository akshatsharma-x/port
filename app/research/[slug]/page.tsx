import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dossier } from "@/components/research/Dossier";
import { DossierPush } from "@/components/research/DossierPush";
import { derived } from "@/content/derive";
import { JsonLd } from "@/components/seo/JsonLd";
import { paperGraph } from "@/lib/jsonld";
import { ogPath, paperAlt } from "@/lib/og-meta";
import { isoDate, pageMeta, scholarTags } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return derived.publications.map((p) => ({ slug: p.slug }));
}

/** Per paper: its canonical, an article's card, and Google Scholar's citation_* tags. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = derived.publications.find((x) => x.slug === slug);
  if (!p) return {};
  const meta = pageMeta({ title: p.title, description: p.tldr, path: `/research/${p.slug}`, type: "article", article: { published: isoDate(p), authors: p.authors.map((a) => a.name) }, image: { path: ogPath({ research: p.slug }), alt: paperAlt(derived, p) } });
  return { ...meta, other: scholarTags(p) };
}

export default async function DossierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = derived.publications.find((x) => x.slug === slug);
  if (!p) notFound();
  // the structured data outside the view transition, which names its one child
  return (
    <>
      <JsonLd graph={paperGraph(p)} />
      <DossierPush>
        <Dossier slug={slug} mode="page" />
      </DossierPush>
    </>
  );
}
