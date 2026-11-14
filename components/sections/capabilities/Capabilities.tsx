import type { CSSProperties } from "react";
import { StageSlot } from "@/components/stage/StageSlot";
import { DataList, DataRow } from "@/components/ui/DataRow";
import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import { derived } from "@/content/derive";
import { evidenceLine, KEYS, levelLabel, yearsLabel } from "@/lib/capabilities";
import { StageBand } from "../StageBand";
import { PanelEnhance } from "./PanelEnhance";

/**
 * 06 · CAPABILITIES — Skills (DESIGN.md §7.4, §4.3 A5):
 *   - before the stage (the interlock): the header and PRIMARY STACK, six technologies at --step-4
 *   - the band (80 svh): the A5 keycap pile, its HTML layer (the keys' focus, type-to-press, the
 *     tooltip, the category chips; loaded with the scene), and the stage-less edition — a CSS
 *     keycap grid for LOW, phones, tier OFF, reduced motion and no JS — in the same box
 *   - the panel, canonical and always there: categories as columns, every skill a DataRow with its
 *     years, a 5-segment meter labelled by the rubric (never a percentage) and its evidence
 */
export function Capabilities() {
  const d = derived;
  const L = d.site.labels.capabilities;
  const all = d.skills.all.slice(0, KEYS.maxKeys);
  const cats = d.skills.categories.map((c) => c.category);
  const years = (n: number) => yearsLabel(n, L.years);
  const cols = KEYS.atlas.cols;
  return (
    <>
      <Grid className="keys-head">
        <div className="col-span-12 grid gap-3">
          <Text as="p" variant="label" tone="fg-3">
            {L.primary}
          </Text>
          <ul className="keys-primary">
            {d.skills.primary.map((s) => (
              <li key={s.slug}>{s.name}</li>
            ))}
          </ul>
        </div>
      </Grid>

      <StageBand
        className="keys-band"
        layer={{
          id: "capabilities",
          props: {
            keys: all.map((s) => ({ slug: s.slug, name: s.name, terms: [s.name, s.legend.label, ...(s.aliases ?? [])], years: years(s.years), level: levelLabel(L.level, s.level, s.rubric) })),
            categories: cats,
            labels: { keys: L.keys, cluster: L.cluster, all: L.all },
          },
        }}
      >
        <StageSlot id="capabilities" className="h-[80svh]" />
        {/* the stage-less edition: the same keys, pressed by a tap; the panel below is canonical */}
        <ul className="keygrid" aria-hidden="true">
          {all.map((s, i) => (
            <li key={s.slug} className="keycap" data-key={i} data-primary={s.primary || undefined} style={{ "--cx": i % cols, "--cy": Math.floor(i / cols) } as CSSProperties}>
              <span className="keycap__legend" />
            </li>
          ))}
        </ul>
        <p className="sr-only">{L.stage}</p>
      </StageBand>

      <Grid className="keys-panel" aria-label={L.panel}>
        {d.skills.categories.map((c) => (
          <section key={c.category} className="col-span-12 grid content-start gap-2 md:col-span-6 lg:col-span-3" aria-labelledby={`keys-${c.category}`}>
            <Text as="h3" variant="label" tone="fg-3" id={`keys-${c.category}`}>
              {c.category}
            </Text>
            <DataList>
              {c.skills.map((s) => (
                <DataRow
                  key={s.slug}
                  label={s.name}
                  className="skill-row"
                  data-skill={s.slug}
                  after={
                    <>
                      <dd className="skill__level">
                        <span className="meter" aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((k) => (
                            <span key={k} className="meter__seg" data-on={k <= s.level || undefined} />
                          ))}
                        </span>
                        <span className="t-micro">{levelLabel(L.level, s.level, s.rubric)}</span>
                      </dd>
                      <dd className="skill__evidence t-micro">{evidenceLine(s.evidence, L.evidence)}</dd>
                    </>
                  }
                >
                  <span className="skill__years numeral">{years(s.years)}</span>
                </DataRow>
              ))}
            </DataList>
          </section>
        ))}
        <PanelEnhance slugs={all.map((s) => s.slug)} />
      </Grid>
    </>
  );
}
