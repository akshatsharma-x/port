import type { ReactNode } from "react";
import { About } from "@/components/sections/about/About";
import { Archive } from "@/components/sections/archive/Archive";
import { Capabilities } from "@/components/sections/capabilities/Capabilities";
import { Credentials } from "@/components/sections/credentials/Credentials";
import { Log } from "@/components/sections/log/Log";
import { Work } from "@/components/sections/work/Work";
import { Hero } from "@/components/sections/hero/Hero";
import { TrackedSection } from "@/components/scroll/TrackedSection";
import { Grid } from "@/components/ui/Grid";
import { Marquee } from "@/components/ui/Marquee";
import { Text } from "@/components/ui/Text";
import { derived } from "@/content/derive";
import type { SectionId } from "@/content/schema";

/**
 * The home route, PROMPTS.md Part 4 §7: all ten sections stubbed at their real heights — stage
 * slots with posters where the Tier-A stages will live, the three pins (§3.8), and between every
 * two stages ≥ 100 svh of DOM-only document (the interlock, DESIGN.md §4.2). The copy is real
 * content (content/derive.ts); each section's own part replaces its stub (Parts 5–13).
 *
 * 00 POST is the boot overlay (Part 5): it paints over the hero and has no height of its own.
 */
const d = derived;
const n = new Intl.NumberFormat("en-US");
const pad = (v: number) => String(v).padStart(2, "0");

function section(id: SectionId) {
  const s = d.site.sections.find((x) => x.id === id);
  if (!s) throw new Error(`site.sections is missing "${id}"`);
  return s;
}

/** CREDENTIALS' strip: the wall's readout when there are certificates, and the records — never a zero. */
function credentialCounts(): string[] {
  const L = d.site.labels;
  const c = d.credentials;
  const n = (v: number, w: { one: string; many: string }) => `${v} ${v === 1 ? w.one : w.many}`;
  return [
    ...(c.total ? [n(c.total, { one: L.credentials.readout.credential, many: L.credentials.readout.credentials }), n(c.issuers, { one: L.credentials.readout.issuer, many: L.credentials.readout.issuers }), `${c.active} ${L.credentials.readout.active}`] : []),
    ...(d.achievements.length ? [n(d.achievements.length, L.records.count)] : []),
  ];
}

function Stub({ id, counts, strip, children }: { id: SectionId; counts?: string[]; strip?: boolean; children: ReactNode }) {
  const s = section(id);
  return (
    <TrackedSection id={s.id} index={s.index} code={s.code} title={s.title} counts={counts} strip={strip}>
      {children}
    </TrackedSection>
  );
}

export default function Home() {
  const { profile, research, labels } = { profile: d.profile, research: d.research, labels: d.site.labels };
  return (
    <main>
      {/* 01 · SYSTEM — the hero: the A1 morph behind the typography layer (components/sections/hero) */}
      <Stub id="system" strip={false}>
        <Hero />
      </Stub>

      {/* 02 · IDENTITY — quiet: interlock SYSTEM → LOG */}
      <Stub id="identity">
        <About />
      </Stub>

      {/* 03 · LOG — pinned 200 svh: one step per role; then the printout (interlock LOG → ARCHIVE) */}
      <Stub id="log">
        <Log />
      </Stub>

      {/* 04 · ARCHIVE — pinned 150 svh: the constellation under the query bar; then the metrics, the unit chart and the ledger (interlock ARCHIVE → WORK) */}
      <Stub
        id="archive"
        counts={[
          `${research.counted} ${labels.heroStrip.papers}`,
          `${n.format(research.citations)} ${labels.heroStrip.citations}`,
          // one year reads as itself, not "2026–2026"
          ...(research.years ? [research.years.from === research.years.to ? String(research.years.from) : `${research.years.from}–${research.years.to}`] : []),
        ]}
      >
        <Archive />
      </Stub>

      {/* 05 · WORK — a 100 svh band, not pinned; then the index (with CAPABILITIES' head: interlock) */}
      <Stub id="work" counts={[`${d.projects.length} ${labels.heroStrip.shipped}`]}>
        <Work />
      </Stub>

      {/* 06 · CAPABILITIES — header + primary stack (interlock), an 80 svh band, then the panel */}
      <Stub id="capabilities">
        <Capabilities />
      </Stub>

      {/* 07 · CREDENTIALS — Tier B (no canvas): the wall (when there are certificates), then the records */}
      <Stub id="credentials" counts={credentialCounts()}>
        <Credentials d={d} />
      </Stub>

      {/* 08 · CONNECT — quiet, plus one loud beat */}
      <Stub id="connect">
        <Grid className="min-h-[100svh] content-center gap-y-8 py-section-y">
          <Text as="p" step="display" className="col-span-12 break-words">
            <a href={`mailto:${profile.email}`} className="hover:text-accent">
              {profile.email}
            </a>
          </Text>
          <Text as="p" step="lead" tone="fg-2" className="col-span-12 max-w-[52ch]">
            {profile.availability.note}
          </Text>
          <ul className="col-span-12 flex flex-wrap gap-x-6 gap-y-2">
            {profile.socials.map((s) => (
              <li key={s.platform}>
                <a href={s.url} target="_blank" rel="noreferrer" className="t-micro inline-flex min-h-6 items-center text-fg-2 hover:text-fg-1">
                  {`${s.platform} ↗`}
                </a>
              </li>
            ))}
          </ul>
        </Grid>
      </Stub>

      {/* 09 · HALT — the footer: marquee, site index (the power-off on the last pixel is Part 13).
          Its links, like CONNECT's, are 24 px targets (min-h-6, WCAG 2.5.8): wrapped on a phone,
          the micro-type rows sat closer than 24 px (Lighthouse target-size, Part 7) */}
      <Stub id="halt">
        <Marquee label={`${profile.name} — ${profile.role}`} className="py-8">
          <Text as="span" step="display" className="pr-16">
            {`${profile.name} — ${profile.role}`}
          </Text>
        </Marquee>
        <Grid className="min-h-[40svh] content-start gap-y-2 py-section-y">
          <nav className="col-span-12 flex flex-wrap gap-x-6 gap-y-2">
            {d.site.sections
              .filter((s) => s.id !== "post" && s.id !== "shell")
              .map((s) => (
                <a key={s.id} href={`#${s.id}`} className="t-micro inline-flex min-h-6 items-center text-fg-2 hover:text-fg-1">
                  {`${pad(s.index)} ${s.code}`}
                </a>
              ))}
          </nav>
        </Grid>
      </Stub>
    </main>
  );
}
