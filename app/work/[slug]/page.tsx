import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CasePush } from "@/components/work/CasePush";
import { CaseStudy } from "@/components/work/CaseStudy";
import { derived } from "@/content/derive";
import { HudPage } from "@/components/chrome/HudPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { projectGraph } from "@/lib/jsonld";
import { ogPath, projectAlt } from "@/lib/og-meta";
import { pageMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return derived.projects.map((p) => ({ slug: p.slug }));
}

/** Per project: its canonical, its words, and its card (public/og/work/<slug>.png, the bake's). */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = derived.projects.find((x) => x.slug === slug);
  return p ? pageMeta({ title: p.title, description: p.summary, path: `/work/${p.slug}`, image: { path: ogPath({ work: p.slug }), alt: projectAlt(derived, p) } }) : {};
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = derived.projects.find((x) => x.slug === slug);
  if (!p) notFound();
  // the structured data outside the view transition, which names its one child
  return (
    <>
      <JsonLd graph={projectGraph(p)} />
      <HudPage section="work" />
      <CasePush>
        <CaseStudy slug={slug} />
      </CasePush>
    </>
  );
}
