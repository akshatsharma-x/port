import { notFound } from "next/navigation";
import { Dossier } from "@/components/research/Dossier";
import { DossierPush } from "@/components/research/DossierPush";
import { derived } from "@/content/derive";

export const dynamicParams = false;

export function generateStaticParams() {
  return derived.publications.map((p) => ({ slug: p.slug }));
}

export default async function InterceptedDossier({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!derived.publications.some((p) => p.slug === slug)) notFound();
  return (
    <DossierPush>
      <Dossier slug={slug} mode="dialog" />
    </DossierPush>
  );
}
