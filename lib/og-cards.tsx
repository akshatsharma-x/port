import { sectionLabel } from "@/components/chrome/types";
import type { Derived } from "@/content/selectors";
import { eyebrow, OG, OgFrame, title } from "@/lib/og";
import { homeAlt, paperAlt, projectAlt } from "@/lib/og-meta";

export { ogPath } from "@/lib/og-meta";

/**
 * The three share cards (PROMPTS.md Part 15), each from the record's own words; scripts/bake/og.ts
 * renders them to public/og/ and lib/seo.ts points each page at its own.
 */

const readout = (d: Derived, id: string, ...more: string[]) => {
  const s = d.site.sections.find((x) => x.id === id);
  return [d.site.labels.chrome.os, s ? sectionLabel(s) : null, ...more].filter(Boolean).join(" · ");
};

/** Home: the name on the screen, the role, the tagline, the hero's own strip. */
export function homeCard(d: Derived) {
  return {
    alt: homeAlt(d),
    node: (
      <OgFrame readout={readout(d, "system")} facts={d.heroStrip.map((s) => `${s.label} ${s.value}`).join(" · ")} path="/">
        {eyebrow(d.profile.role)}
        {title(d.profile.name, true)}
        <span style={{ marginTop: 32, maxWidth: 980, fontSize: 30, lineHeight: 1.45, color: OG.fg2 }}>{d.profile.tagline}</span>
      </OgFrame>
    ),
  };
}

/** A project: its index and category, its title and subtitle, its stack. */
export function projectCard(d: Derived, p: Derived["projects"][number]) {
  const index = `${String(p.index).padStart(2, "0")}/${String(d.projects.length).padStart(2, "0")}`;
  return {
    alt: projectAlt(d, p),
    node: (
      <OgFrame readout={readout(d, "work", index)} status={p.year === null ? undefined : String(p.year)} facts={p.stack.slice(0, 5).join(" · ")} path={`/work/${p.slug}`}>
        {eyebrow(p.category)}
        {title(p.title)}
        <span style={{ marginTop: 28, maxWidth: 1000, fontSize: 34, lineHeight: 1.35, color: OG.fg2 }}>{p.subtitle}</span>
      </OgFrame>
    ),
  };
}

/**
 * A paper: it reads as a published artifact — venue type, venue and year over the title, the
 * authors and the full venue under it, the status it truly has, and its citation count with the
 * date and source it was counted from.
 */
export function paperCard(d: Derived, p: Derived["publications"][number]) {
  const L = d.site.labels.archive;
  const status = [L.status[p.status], p.isPeerReviewed ? L.dossier.badges.peerReviewed : null].filter(Boolean).join(" · ");
  const citations = `${L.dossier.citations} ${p.citations} · ${L.metrics.asOf} ${p.citationsAsOf} · ${p.citationSource}`;
  return {
    alt: paperAlt(d, p),
    node: (
      <OgFrame readout={readout(d, "archive")} status={status} facts={citations} path={`/research/${p.slug}`}>
        {eyebrow([L.venueTypes[p.venueType], p.venueShort, String(p.year)].join(" · "))}
        {title(p.title)}
        <span style={{ marginTop: 26, fontSize: 28, color: OG.fg1 }}>{p.authors.map((a) => a.name).join(", ")}</span>
        <span style={{ marginTop: 10, maxWidth: 1040, fontSize: 24, lineHeight: 1.4, color: OG.fg3 }}>{[p.venue, p.doi ? `doi:${p.doi}` : null].filter(Boolean).join(" · ")}</span>
      </OgFrame>
    ),
  };
}
