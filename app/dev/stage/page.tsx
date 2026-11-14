import type { Metadata } from "next";
import { Fragment } from "react";
import { StageSlot } from "@/components/stage/StageSlot";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { Section } from "@/components/ui/Section";
import { Text } from "@/components/ui/Text";
import { derived } from "@/content/derive";
import { stageDev } from "@/content/dev-stage";
import { SCENE_IDS, type SceneId } from "@/lib/tier";
import { StageControls } from "./StageControls";

export const metadata: Metadata = { title: stageDev.title };

/** Slot heights exercise all three docking cases: equal to, taller than and shorter than the viewport. */
const SLOT_HEIGHT: Record<SceneId, string> = {
  system: "h-[100svh]",
  log: "h-[160svh]",
  archive: "h-[100svh]",
  work: "h-[70svh]",
  capabilities: "h-[100svh]",
};

/**
 * /dev/stage — PROMPTS.md Part 3 §10: five placeholder scenes in five real slots, separated by
 * ≥ 100 svh of DOM-only content (the interlock). Section names come from content/data.ts.
 */
export default function StageHarness() {
  const sections = derived.site.sections;
  return (
    <main>
      <Grid as="header" className="gap-y-6 pt-16 pb-12">
        <div className="col-span-12 grid gap-4 lg:col-span-9">
          <Text variant="label" tone="accent">
            {stageDev.code}
          </Text>
          <Text as="h1" step="display">
            {stageDev.title}
          </Text>
          <Text as="p" step="lead" tone="fg-2" className="max-w-[60ch]">
            {stageDev.intro}
          </Text>
        </div>
        <nav aria-label={stageDev.nav} className="col-span-12 flex flex-wrap gap-x-4 gap-y-2">
          {SCENE_IDS.map((id) => {
            const s = sections.find((x) => x.id === id);
            return (
              <a key={id} href={`#${id}`} className="t-micro text-fg-2 hover:text-fg-1">
                {`→ ${s?.code ?? id}`}
              </a>
            );
          })}
        </nav>
        <div className="col-span-12">
          <StageControls />
        </div>
      </Grid>

      {SCENE_IDS.map((id, i) => {
        const s = sections.find((x) => x.id === id);
        return (
          <Fragment key={id}>
            {i > 0 && (
              <Grid data-spacer={i - 1} className="min-h-[120svh] content-center gap-y-6 py-section-y data-[short]:min-h-[40svh]">
                <Text as="p" variant="label" tone="fg-3" className="col-span-12">
                  {stageDev.spacer.label}
                </Text>
                {stageDev.spacer.lines.map((line) => (
                  <Text key={line} as="p" step="lead" tone="fg-2" className="col-span-12 max-w-[52ch] md:col-span-8">
                    {line}
                  </Text>
                ))}
              </Grid>
            )}
            <Section id={id} index={s?.index ?? i} code={s?.code ?? id} title={s?.title ?? id}>
              <Grid className="gap-y-3 py-6">
                <Text as="p" step="small" sans tone="fg-3" className="col-span-12 md:col-span-8">
                  {stageDev.slots[id]}
                </Text>
                <div className="col-span-12 md:col-span-4 md:justify-self-end">
                  <Button href={`/dev/stage/${id}`} variant="tertiary" icon="→">
                    {stageDev.route}
                  </Button>
                </div>
              </Grid>
              <StageSlot id={id} className={SLOT_HEIGHT[id]} />
            </Section>
          </Fragment>
        );
      })}
      <div className="h-[40svh]" />
    </main>
  );
}
