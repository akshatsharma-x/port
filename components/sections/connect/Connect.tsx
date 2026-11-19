import { existsSync } from "node:fs";
import type { CSSProperties, ReactNode } from "react";
import { join } from "node:path";
import { CheckGlyph } from "@/components/research/CheckGlyph";
import { Button } from "@/components/ui/Button";
import { Grid } from "@/components/ui/Grid";
import { Reveal } from "@/components/ui/Reveal";
import type { Derived } from "@/content/selectors";
import { CONTACT } from "@/lib/contact";
import { PUBLICATION_LIST } from "@/lib/publication-list";
import { ConnectEnhance } from "./ConnectEnhance";

/** A file under public/, if it's there (the CTA pair shows only what exists). */
const published = (path: string | null): string | null => (path && path.startsWith("/") && existsSync(join(process.cwd(), "public", path)) ? path : path && /^https:/.test(path) ? path : null);

/**
 * 08 · CONNECT (DESIGN.md §7.4) — quiet, plus one loud beat. Server HTML throughout, whole without
 * JavaScript (the form then posts to the visitor's own mail app):
 *   - SEND A SIGNAL at --step-5, the only per-character reveal after the hero
 *   - the email as a giant mailto: link, and COPY (its behaviour, and the form's, on idle or focus)
 *   - the teletype form: NAME> EMAIL> INTENT> MESSAGE>, inline errors, a honeypot, the log, the
 *     received screen and the mailto fallback (lib/contact.ts, POST /api/contact)
 *   - availability: the status, my time, and the overlap with the visitor's working day
 *   - the channels that exist (no dead links), and the downloads that do
 */
export function Connect({ d }: { d: Derived }) {
  const L = d.site.labels.connect;
  const p = d.profile;
  const social = (k: string) => p.socials.find((s) => s.platform === k);
  const scholar = (k: string) => p.scholarProfiles.find((s) => s.platform === k);
  // engineering and research side by side: EMAIL · LINKEDIN · GITHUB · SCHOLAR · ORCID · X
  const channels = [
    { key: "email", label: L.channels.email, href: `mailto:${p.email}` },
    ...(social("linkedin") ? [{ key: "linkedin", label: L.channels.linkedin, href: social("linkedin")?.url as string }] : []),
    ...(social("github") ? [{ key: "github", label: L.channels.github, href: social("github")?.url as string }] : []),
    ...(scholar("googleScholar") ? [{ key: "scholar", label: L.channels.scholar, href: scholar("googleScholar")?.url as string }] : []),
    ...(scholar("orcid") ? [{ key: "orcid", label: L.channels.orcid, href: scholar("orcid")?.url as string }] : []),
    ...(social("x") ? [{ key: "x", label: L.channels.x, href: social("x")?.url as string }] : []),
  ];
  const ctas = [
    { key: "resume", label: L.cta.resume, href: published(p.resumeUrl) },
    { key: "publications", label: L.cta.publications, href: published(PUBLICATION_LIST.href) },
  ].filter((c): c is { key: string; label: string; href: string } => !!c.href);
  const status = p.availability.status;
  const hours = `${p.workingHours.start}–${p.workingHours.end}`;
  return (
    <Grid className="connect">
      <Reveal as="p" mode="chars" className="connect-invite t-mega col-span-12">
        {L.invitation}
      </Reveal>
      <div className="connect-email col-span-12">
        <a className="connect-email__link" href={`mailto:${p.email}`} style={{ "--chars": p.email.length } as CSSProperties}>
          {p.email}
        </a>
        {/* pending until its behaviour is in: its place kept, so its arrival moves nothing (CLS); gone without JS */}
        <button type="button" className="chip chip--toggle t-micro connect-email__copy" data-connect-copy={p.email} data-pending="">
          {L.copy}
        </button>
        <span className="connect-email__toast t-micro" role="status" data-connect-toast="">
          <span hidden data-connect-copied="">
            {L.copied} <CheckGlyph />
          </span>
        </span>
      </div>

      <form className="teletype col-span-12 lg:col-span-7" data-connect-form="" action={`mailto:${p.email}`} method="post" encType="text/plain">
        <Line id="name" prompt={L.prompts.name} label={L.fields.name}>
          <input id="cx-name" name="name" className="teletype__input" autoComplete="name" required maxLength={CONTACT.limits.name} placeholder=" " aria-describedby="cx-name-err" />
        </Line>
        <Line id="email" prompt={L.prompts.email} label={L.fields.email}>
          <input id="cx-email" name="email" type="email" className="teletype__input" autoComplete="email" required maxLength={CONTACT.limits.email} placeholder=" " aria-describedby="cx-email-err" />
        </Line>
        <Line id="intent" prompt={L.prompts.intent} label={L.fields.intent}>
          <select id="cx-intent" name="intent" className="teletype__input teletype__select" required defaultValue="" aria-describedby="cx-intent-err">
            <option value="" disabled>
              —
            </option>
            {CONTACT.intents.map((i) => (
              <option key={i} value={i}>
                {L.intents[i]}
              </option>
            ))}
          </select>
        </Line>
        <Line id="message" prompt={L.prompts.message} label={L.fields.message}>
          <textarea id="cx-message" name="message" className="teletype__input teletype__area" rows={5} required minLength={CONTACT.limits.minMessage} maxLength={CONTACT.limits.message} placeholder=" " aria-describedby="cx-message-err" />
        </Line>
        {/* the honeypot: off screen, out of the tab order and hidden from screen readers; a person leaves it empty */}
        <div className="teletype__trap" aria-hidden="true">
          <label>
            {L.trap}
            <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
        <div className="teletype__actions">
          <Button type="submit" variant="primary" icon="→" magnetic={false}>
            {L.send}
          </Button>
          <p className="teletype__note t-micro" role="alert" data-connect-note="" />
        </div>
        <ol className="teletype__log t-small" aria-label={L.log.label} aria-live="polite" data-connect-log="" hidden />
        <div className="teletype__received" data-connect-received="" hidden tabIndex={-1}>
          <p className="teletype__received-title">{L.received.title}</p>
          <p className="t-small">{L.received.note}</p>
          <button type="button" className="chip chip--toggle t-micro" data-connect-again="">
            {L.received.again}
          </button>
        </div>
        <p className="teletype__fallback t-small" data-connect-fallback="" hidden>
          {L.fallback.note}{" "}
          <a href={`mailto:${p.email}`} data-connect-mailto="">
            {`${L.fallback.link} ↗`}
          </a>
        </p>
      </form>

      <aside className="connect-side col-span-12 lg:col-span-4 lg:col-start-9">
        <section className="availability" aria-label={L.availability.label}>
          <p className="availability__status t-micro">
            <span className="availability__dot" data-status={status} aria-hidden="true" />
            {d.site.labels.hero.availability[status]}
          </p>
          <p className="t-micro">
            {`${L.availability.local} `}
            <time className="availability__clock numeral" data-connect-clock="" data-zone={p.timezone} data-country={p.location.countryCode}>
              —
            </time>
          </p>
          <p className="t-micro availability__overlap" data-connect-overlap="" data-zone={p.timezone} data-start={p.workingHours.start} data-end={p.workingHours.end}>
            {`${L.availability.hours} ${hours} · ${p.timezone}`}
          </p>
        </section>
        <nav className="channels" aria-label={L.channels.label}>
          <ul>
            {channels.map((c) => (
              <li key={c.key}>
                <Button href={c.href} variant="tertiary" icon={c.key === "email" ? "→" : "↗"} {...(c.key === "email" ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
                  {c.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
        {ctas.length > 0 && (
          <div className="connect-ctas">
            {/* a file of ours downloads, as its label says; one hosted elsewhere opens there (a
                cross-origin download attribute is ignored) */}
            {ctas.map((c) =>
              c.href.startsWith("/") ? (
                <Button key={c.key} href={c.href} variant="secondary" icon="↓" download="" {...(c.key === "resume" ? { "data-track": "resume_download", "data-track-id": "connect" } : {})}>
                  {c.label}
                </Button>
              ) : (
                <Button key={c.key} href={c.href} variant="secondary" icon="↗" target="_blank" rel="noopener noreferrer" {...(c.key === "resume" ? { "data-track": "resume_download", "data-track-id": "connect" } : {})}>
                  {c.label}
                </Button>
              ),
            )}
          </div>
        )}
      </aside>
      <ConnectEnhance labels={{ errors: L.errors, log: L.log, availability: L.availability, intents: L.intents, fallback: L.fallback }} owner={{ email: p.email }} />
    </Grid>
  );
}

/** A teletype line: the prompt (its words for screen readers), the field, the block caret, the error. */
function Line({ id, prompt, label, children }: { id: string; prompt: string; label: string; children: ReactNode }) {
  return (
    <div className="teletype__line" data-field={id}>
      <label htmlFor={`cx-${id}`} className="teletype__prompt">
        <span aria-hidden="true">{prompt}</span>
        <span className="sr-only">{label}</span>
      </label>
      <span className="teletype__field">
        {children}
        <span className="teletype__caret" aria-hidden="true" />
      </span>
      <p id={`cx-${id}-err`} className="teletype__error t-micro" data-error-for={id} aria-live="polite" />
    </div>
  );
}
