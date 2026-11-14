import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dossier } from "@/components/research/Dossier";
import { DossierPush } from "@/components/research/DossierPush";
import { derived } from "@/content/derive";

export const dynamicParams = false;

export function generateStaticParams() {
  return derived.publications.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = derived.publications.find((x) => x.slug === slug);
  return p ? { title: p.title, description: p.tldr } : {};
}

export default async function DossierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!derived.publications.some((p) => p.slug === slug)) notFound();
  return (
    <DossierPush>
      <Dossier slug={slug} mode="page" />
    </DossierPush>
  );
}
