import type { ReactNode } from "react";
import { About } from "@/components/sections/about/About";
import { Archive } from "@/components/sections/archive/Archive";
import { Capabilities } from "@/components/sections/capabilities/Capabilities";
import { Connect } from "@/components/sections/connect/Connect";
import { Credentials } from "@/components/sections/credentials/Credentials";
import { Halt } from "@/components/sections/halt/Halt";
import { Log } from "@/components/sections/log/Log";
import { Work } from "@/components/sections/work/Work";
import { Hero } from "@/components/sections/hero/Hero";
import { TrackedSection } from "@/components/scroll/TrackedSection";
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
  const { research, labels } = { research: d.research, labels: d.site.labels };
  return (
    <>
    <main id="main" tabIndex={-1}>
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
        <Connect d={d} />
      </Stub>

    </main>
    {/* 09 · HALT — the footer (contentinfo): the marquee, the index, the build line; the power-off on the last pixel */}
    <footer>
      <Stub id="halt">
        <Halt d={d} />
      </Stub>
    </footer>
    </>
  );
}
