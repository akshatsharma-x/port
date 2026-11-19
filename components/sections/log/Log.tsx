import type { CSSProperties } from "react";
import { StickyStack } from "@/components/scroll/StickyStack";
import { StageSlot } from "@/components/stage/StageSlot";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Grid } from "@/components/ui/Grid";
import { derived } from "@/content/derive";
import { stageData } from "@/content/stage-data";
import { CARD } from "@/lib/hollerith";
import { atlasCell, LOG } from "@/lib/log";
import { YearScale, type ScaleRole } from "./YearScale";

/**
 * 03 · LOG — Experience (DESIGN.md §7.4, §4.3 A2). Pinned ≤ 200 svh: the punch-card rail on the
 * stage, the active card mirrored on the right as crisp HTML (company, role, dates, blurb, three
 * highlights, stack chips), and a year scale on the left that scrubs with the camera and flies it
 * to a role on click. Phones get the phone edition in the stage's place: the same cards in CSS,
 * rising through the pin. Then the interlock's document, the PRINTOUT. Words from content.
 */
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const month = (ym: string) => MONTH.format(new Date(`${ym}-01T00:00:00Z`));
const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

export function Log() {
  const d = derived;
  const L = d.site.labels.log;
  const roles = d.experience;
  const cards = stageData(d).log.cards;
  const now = d.buildDate.slice(0, 7);
  // the panel prints its dates as the printout does, ISO (§2.10); the scale's spoken label keeps the
  // month's name, which a screen reader says better than "2026-06"
  const dates = (start: string, end: string) => `${start} – ${end === "present" ? L.present : end}`;
  const spoken = (start: string, end: string) => `${month(start)} – ${end === "present" ? L.present : month(end)}`;

  // the scale: newest at the top, a month per step, each role's span and the playhead's stop on it
  const top = Math.max(...roles.map((r) => monthIndex(r.end === "present" ? now : r.end)));
  const bottom = Math.min(...roles.map((r) => monthIndex(r.start)));
  const span = Math.max(1, top - bottom + 1);
  const at = (m: number) => (top - m + 0.5) / span;
  const scaleRoles: ScaleRole[] = roles.map((r) => {
    const end = monthIndex(r.end === "present" ? now : r.end);
    const start = monthIndex(r.start);
    return { slug: r.slug, label: `${r.company}, ${spoken(r.start, r.end)}`, from: at(end) - 0.5 / span, to: at(start) + 0.5 / span, stop: at((start + end) / 2) };
  });
  const years = [...new Set(roles.flatMap((r) => [Number(r.start.slice(0, 4)), Number((r.end === "present" ? now : r.end).slice(0, 4))]))].sort((a, b) => b - a);
  const yearMarks = years.map((y) => ({
    year: y,
    at: at(Math.min(top, y * 12 + 11)),
    // the newest role in the deck that ran during that year
    role: Math.max(0, roles.findIndex((r) => Number(r.start.slice(0, 4)) <= y && Number((r.end === "present" ? now : r.end).slice(0, 4)) >= y)),
  }));
  const ticks = Array.from({ length: span }, (_, k) => at(top - k));

  const A = LOG.atlas;
  const cellW = A.width / A.cols;
  const cellH = A.height / A.rows;
  const deckVars = {
    "--atlas": `url(${A.url})`,
    "--atlas-w": A.width,
    "--atlas-h": A.height,
    "--card-px": A.card.width,
    "--card-aspect": `${CARD.width} / ${CARD.height}`,
    "--cards": roles.length,
  } as CSSProperties;

  return (
    <>
      <StickyStack
        id="log"
        steps={roles.length}
        className="log-pin"
        backdrop={
          <div className="log-backdrop">
            <StageSlot id="log" className="h-[100svh]" />
            {/* the phone edition: the same faces, in CSS (styles/log.css shows it under the phone policy) */}
            <div className="phone-deck" aria-hidden="true" style={deckVars}>
              <div className="phone-deck__badge t-micro">
                {roles.map((r, i) => (
                  <span key={r.slug} style={{ "--i": i } as CSSProperties}>
                    {r.start.slice(0, 4)}
                  </span>
                ))}
              </div>
              {cards.map((c, i) => {
                const [cx, cy] = atlasCell(i);
                return (
                  <div
                    key={c.slug}
                    className="phone-card"
                    style={{ "--i": i, "--x0": cx * cellW + Math.round((cellW - A.card.width) / 2), "--y0": cy * cellH + Math.round((cellH - A.card.height) / 2) } as CSSProperties}
                  >
                    <div className="phone-card__face" />
                    <div className="phone-card__print" />
                  </div>
                );
              })}
            </div>
          </div>
        }
        frames={roles.map((r) => (
          <Grid key={r.slug} className="log-frame">
            <article className="log-panel col-span-12 md:col-span-5 md:col-start-8">
              <p className="log-panel__dates t-micro">{dates(r.start, r.end)}</p>
              <h3 className="t-heading">{r.role}</h3>
              <p className="log-panel__where t-small">{[r.company, r.location].join(" · ")}</p>
              <p className="log-panel__blurb t-body">{r.blurb}</p>
              <h4 className="log-panel__label t-micro">{L.highlights}</h4>
              <ul className="log-panel__highlights">
                {r.highlights.map((h) => (
                  <li key={h} className="t-small">
                    {h}
                  </li>
                ))}
              </ul>
              <h4 className="sr-only">{L.stack}</h4>
              <ul className="log-panel__stack">
                {r.stack.map((s) => (
                  <li key={s}>
                    <Chip>{s}</Chip>
                  </li>
                ))}
              </ul>
            </article>
          </Grid>
        ))}
      >
        <YearScale label={L.scale} roles={scaleRoles} years={yearMarks} ticks={ticks} />
        <p className="sr-only">{L.stage}</p>
      </StickyStack>
      <Printout />
    </>
  );
}

/** PRINTOUT (§7.4): continuous-feed tractor paper — the condensed log and the education, dot-matrix printed. */
function Printout() {
  const d = derived;
  const L = d.site.labels.log;
  const P = L.printout;
  const dates = (start: string, end: string) => `${start} – ${end === "present" ? L.present.toUpperCase() : end}`;
  return (
    <Grid className="printout-wrap">
      <div className="printout col-span-12 md:col-span-8 md:col-start-3">
        <div className="printout__sheet">
          <div className="printout__text">
            <p className="printout__head">{`${d.site.labels.chrome.os} · ${P.title} · ${P.page} 1`.toUpperCase()}</p>
            <p className="printout__h">{P.roles.toUpperCase()}</p>
            <ol className="printout__rows">
              {d.experience.map((e) => (
                <li key={e.slug}>
                  <span className="printout__when">{dates(e.start, e.end)}</span>
                  <span className="printout__what">{`${e.role} · ${e.company}`.toUpperCase()}</span>
                </li>
              ))}
            </ol>
            <p className="printout__h">{P.education.toUpperCase()}</p>
            <ol className="printout__rows">
              {d.education.map((e) => (
                <li key={e.slug}>
                  <span className="printout__when">{dates(e.start, e.end)}</span>
                  <span className="printout__what">{[`${e.degree} ${e.field}`, e.institution, e.honors].filter(Boolean).join(" · ").toUpperCase()}</span>
                </li>
              ))}
            </ol>
            <p className="printout__end">{`*** ${P.end} ***`.toUpperCase()}</p>
          </div>
        </div>
        {d.profile.resumeUrl && (
          <Button href={d.profile.resumeUrl} variant="secondary" icon="↗" target="_blank" rel="noopener" data-track="resume_download" data-track-id="log" className="printout__resume">
            {d.site.labels.hero.cta.resume}
          </Button>
        )}
      </div>
    </Grid>
  );
}
