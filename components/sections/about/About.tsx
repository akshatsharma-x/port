import { DataList, DataRow } from "@/components/ui/DataRow";
import { Grid } from "@/components/ui/Grid";
import { Reveal } from "@/components/ui/Reveal";
import { derived } from "@/content/derive";
import { localClock } from "@/lib/hud";
import { Currently } from "./Currently";
import { Portrait } from "./Portrait";

/**
 * 02 · IDENTITY — About (DESIGN.md §7.4): the quiet beat between the hero's stage and LOG's, and
 * the interlock between them. A 5/7 grid: the dot-matrix portrait in columns 1–5, the bio, spec
 * sheet and CURRENTLY in 7–12. The portrait's box and the bio's lines are the hero lattice's
 * landing (data-lattice, §4.3 A1). Every word and number comes from content.
 */
export function About() {
  const d = derived;
  const p = d.profile;
  const L = d.site.labels.identity;
  const U = L.units;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const roles = d.experience.length;
  const allInternships = d.experience.every((e) => e.type === "internship");
  const experience = `${plural(d.experienceYears, U.year, U.years)} · ${allInternships ? plural(roles, U.internship, U.internships) : plural(roles, U.role, U.roles)}`;
  const zone = localClock(p.timezone, p.location.countryCode)
    .formatToParts(new Date(`${d.buildDate}T12:00:00Z`))
    .find((x) => x.type === "timeZoneName")?.value;
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: p.timezone, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${d.buildDate}T12:00:00Z`))
    .find((x) => x.type === "timeZoneName")
    ?.value.replace(/^GMT/, "UTC");
  const asOf = d.research.provenance.asOf;
  // ISO, as every date the site prints (§2.10); the record's own date, already YYYY-MM-DD
  const asOfText = asOf ? ` · ${U.asOf} ${asOf}` : "";
  const edu = d.education[0];
  const spec = [
    { key: "role", label: L.spec.role, value: p.role },
    { key: "experience", label: L.spec.experience, value: experience },
    { key: "location", label: L.spec.location, value: `${p.location.city}, ${p.location.country}` },
    { key: "timezone", label: L.spec.timezone, value: [zone, offset].filter(Boolean).join(" · ") },
    { key: "stack", label: L.spec.stack, value: d.skills.primary.map((s) => s.name).join(" · ") },
    // an h-index joins the record once there is one: a zero here was a figure in reverse (Part 16)
    ...(d.research.hIndex > 0 ? [{ key: "hIndex", label: L.spec.hIndex, value: `${d.research.hIndex}${asOfText}` }] : []),
    ...(edu ? [{ key: "education", label: L.spec.education, value: [`${edu.degree} ${edu.field}`, edu.institution, edu.end.slice(0, 4), edu.honors].filter(Boolean).join(" · ") }] : []),
    { key: "availability", label: L.spec.availability, value: `${d.site.labels.hero.availability[p.availability.status]} — ${p.availability.note}` },
  ];
  const currently = d.currentFocus.map((f) => ({ kind: f.kind, label: L.currently[f.kind], title: f.title, ...(f.detail ? { detail: f.detail } : {}) }));

  return (
    <Grid className="identity">
      {/* data-lattice: the hero's last state lands as this layout (DESIGN.md §4.3 A1) */}
      <div className="identity__portrait col-span-12 md:col-span-5" data-lattice="block">
        <Portrait src={p.avatar.src} alt={p.avatar.alt} hint={L.lamp} />
      </div>
      <div className="identity__body col-span-12 md:col-span-6 md:col-start-7">
        {p.bio.long.map((para, i) => (
          <Reveal key={para} as="p" mode="lines" className={`identity__bio ${i === 0 ? "t-lead" : "t-body"} text-fg-2`} data-lattice="lines">
            {accented(para, p.bio.accents?.[i] ?? [])}
          </Reveal>
        ))}
        <DataList className="identity__spec" aria-label={L.spec.label}>
          {spec.map((s) => (
            <DataRow key={s.key} label={s.label}>
              {s.value}
            </DataRow>
          ))}
        </DataList>
        <Currently label={L.currently.label} items={currently} />
      </div>
    </Grid>
  );
}

/** A paragraph with its accent phrases (≤ 3, validated in content/schema.ts), set a step brighter in ink. */
function accented(text: string, phrases: readonly string[]) {
  const marks = phrases
    .map((ph) => ({ ph, at: text.indexOf(ph) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out: (string | React.JSX.Element)[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.at < cursor) continue;
    out.push(text.slice(cursor, m.at));
    out.push(
      <span key={m.at} className="identity__accent">
        {m.ph}
      </span>,
    );
    cursor = m.at + m.ph.length;
  }
  out.push(text.slice(cursor));
  return out;
}
