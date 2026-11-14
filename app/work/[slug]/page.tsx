import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CasePush } from "@/components/work/CasePush";
import { CaseStudy } from "@/components/work/CaseStudy";
import { derived } from "@/content/derive";
import { COVER, ogSrc } from "@/lib/covers";

export const dynamicParams = false;

export function generateStaticParams() {
  return derived.projects.map((p) => ({ slug: p.slug }));
}

/** Per project; the OG image is the cover's provisional crop until Part 15's og bake (and the site's URL). */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = derived.projects.find((x) => x.slug === slug);
  if (!p) return {};
  // the image only once the site has its address: a relative OG URL resolves against nothing
  const image = process.env.NEXT_PUBLIC_SITE_URL ? [{ url: ogSrc(p.slug), width: COVER.og.width, height: COVER.og.height, alt: p.media[0]?.alt ?? p.title }] : undefined;
  return { title: p.title, description: p.summary, openGraph: { title: p.title, description: p.summary, ...(image ? { images: image } : {}) } };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!derived.projects.some((p) => p.slug === slug)) notFound();
  return (
    <CasePush>
      <CaseStudy slug={slug} />
    </CasePush>
  );
}
