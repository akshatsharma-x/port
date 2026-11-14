import { StickyStack } from "@/components/scroll/StickyStack";
import { StageSlot } from "@/components/stage/StageSlot";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Grid } from "@/components/ui/Grid";
import { Scramble } from "@/components/ui/Scramble";
import { Text } from "@/components/ui/Text";
import { derived, nameFit } from "@/content/derive";
import { nameFitCss } from "@/content/name-fit";
import { HeroAdvance } from "./HeroAdvance";
import { HeroHints } from "./HeroHints";
import { HeroMicro } from "./HeroMicro";
import { HeroName } from "./HeroName";

/**
 * 01 · SYSTEM — the hero (DESIGN.md §7.4; PROMPTS.md Part 6). The typography layer is true HTML —
 * selectable, crawlable, server-rendered and painted under the boot (it's the LCP) — over the
 * stage slot, where the A1 phosphor morph runs (components/stage/scenes/system.tsx). Pinned for
 * 100 svh: scroll owns the morph through its four checkpoints, and a click moves to the next one.
 */
export function Hero() {
  const d = derived;
  const p = d.profile;
  const L = d.site.labels.hero;
  return (
    <HeroAdvance next="#identity">
      <StickyStack id="system" steps={4} className="sticky-stack--overlay" backdrop={<StageSlot id="system" className="h-[100svh]" />}>
        <style>{nameFitCss(nameFit)}</style>
        <Grid className="hero">
          <HeroName text={p.name} fit={{ oneLine: nameFit.oneLine, twoLine: nameFit.twoLine, oneLineMinViewport: nameFit.oneLineMinViewport }} />
          <div className="hero__lede col-span-12 md:col-span-7">
            <Text as="p" variant="label" tone="accent">
              <Scramble text={p.role} />
            </Text>
            <Text as="p" step="small" tone="fg-2" className="hero__tagline">
              {p.tagline}
            </Text>
            <dl className="hero-strip" aria-label={L.strip}>
              {d.heroStrip.map((s) => (
                <div key={s.key} className="hero-strip__item">
                  <dt className="t-micro">{s.label}</dt>
                  <dd className="t-small">
                    <Counter value={s.value} trigger="boot" />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="hero-ctas">
              <Button href="#work" variant="primary" icon="→">
                {L.cta.work}
              </Button>
              <Button href="#archive" variant="secondary" icon="→">
                {L.cta.research}
              </Button>
              {p.resumeUrl && (
                <Button href={p.resumeUrl} variant="tertiary" icon="↗" target="_blank" rel="noopener" data-track="resume_download" data-track-id="hero">
                  {L.cta.resume}
                </Button>
              )}
            </div>
          </div>
          <div className="hero__aside col-span-12 md:col-span-4 md:col-start-9">
            <HeroMicro
              labels={L.micro}
              location={`${p.location.city}, ${p.location.countryCode}`}
              timeZone={p.timezone}
              countryCode={p.location.countryCode}
              status={p.availability.status}
              statusLabel={L.availability[p.availability.status]}
              note={p.availability.note}
            />
          </div>
          <HeroHints scroll={L.scrollHint} idle={L.idleHint} />
          <p className="sr-only">{L.stage}</p>
        </Grid>
      </StickyStack>
    </HeroAdvance>
  );
}
