import { Grid } from "@/components/ui/Grid";
import { Marquee } from "@/components/ui/Marquee";
import { Text } from "@/components/ui/Text";
import type { Derived } from "@/content/selectors";
import { buildInfo } from "@/lib/build-info";
import { HaltEnhance } from "./HaltEnhance";

const pad = (v: number) => String(v).padStart(2, "0");

/**
 * 09 · HALT — the footer (DESIGN.md §7.4), server HTML:
 *   - the name and role as a huge marquee, its letters lit through an LED dot mask, faster with the
 *     scroll (components/ui/Marquee)
 *   - the index: every section, project and publication
 *   - the build line: version · commit · DEPLOYED date · NEXT · THREE, all read at build
 *   - back to top (an anchor; Lenis on `transit` in 900 ms once the behaviour is in)
 * The power-off on the last pixel arrives on idle (HaltEnhance).
 */
export function Halt({ d }: { d: Derived }) {
  const L = d.site.labels.halt;
  const p = d.profile;
  const b = buildInfo();
  // the build date is UTC's (content/selectors.ts isoDay): it says so, beside a clock in the owner's zone
  const line = [`v${b.version}`, b.sha, `${L.build.deployed} ${d.buildDate} UTC`, `${L.build.built} NEXT ${b.next} · THREE ${b.three}`].filter(Boolean).join(" · ");
  const sections = d.site.sections.filter((s) => s.id !== "post" && s.id !== "shell");
  return (
    <>
      <Marquee label={`${p.name} — ${p.role}`} className="halt-marquee">
        <Text as="span" step="mega" className="halt-marquee__text">
          {`${p.name} — ${p.role}`}
        </Text>
      </Marquee>
      <Grid className="halt-grid">
        <nav className="halt-index col-span-12" aria-label={L.index}>
          <div className="halt-index__group">
            <p className="t-micro halt-index__label">{L.sections}</p>
            <ul>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="t-micro">
                    {`${pad(s.index)} ${s.code}`}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {d.projects.length > 0 && (
            <div className="halt-index__group">
              <p className="t-micro halt-index__label">{L.projects}</p>
              <ul>
                {d.projects.map((pr) => (
                  <li key={pr.slug}>
                    {/* titles are the human's: sentence case (§2.5), not the machine's uppercase labels */}
                    <a href={`/work/${pr.slug}`} className="t-small">
                      {pr.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.publications.length > 0 && (
            <div className="halt-index__group">
              <p className="t-micro halt-index__label">{L.publications}</p>
              <ul>
                {d.publications.map((pub) => (
                  <li key={pub.slug}>
                    <a href={`/research/${pub.slug}`} className="t-small">
                      {pub.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>
        <p className="halt-build t-micro col-span-12 md:col-span-9">{line}</p>
        <a href="#system" className="halt-top t-micro col-span-12 md:col-span-3" data-halt-top="" data-transition="none">
          {`${L.top} ↑`}
        </a>
      </Grid>
      <HaltEnhance halted={L.halted} />
    </>
  );
}
