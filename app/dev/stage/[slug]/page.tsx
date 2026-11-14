import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StageSlot } from "@/components/stage/StageSlot";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import { derived } from "@/content/derive";
import { stageDev } from "@/content/dev-stage";
import { isSceneId, SCENE_IDS } from "@/lib/tier";

/**
 * /dev/stage/[slug] — one scene on its own route. Navigating here from /dev/stage keeps the same
 * canvas and the same scene instance (the stage lives in the root layout): the mesh keeps
 * animating across the route change, which the future PROJECTION transition depends on.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return SCENE_IDS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${stageDev.title} · ${slug}` };
}

export default async function SingleStage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSceneId(slug)) notFound();
  const section = derived.site.sections.find((s) => s.id === slug);
  return (
    <main>
      <Grid as="header" className="gap-y-4 pt-16 pb-8">
        <Text variant="label" tone="accent" className="col-span-12">
          {`${stageDev.code} · ${section?.code ?? slug}`}
        </Text>
        <Text as="h1" step="title" className="col-span-12">
          {section?.title ?? slug}
        </Text>
        <Text as="p" step="lead" tone="fg-2" className="col-span-12 max-w-[52ch]">
          {stageDev.single.note}
        </Text>
        <div className="col-span-12">
          <Button href="/dev/stage" variant="secondary" icon="←">
            {stageDev.single.back}
          </Button>
        </div>
      </Grid>
      <StageSlot id={slug} className="h-[100svh]" />
    </main>
  );
}
