import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Derived } from "@/content/selectors";
import { CARD_UNITS, guillocheFor } from "@/lib/guilloche";
import { mrzLines, mrzText } from "@/lib/mrz";

type Cert = Derived["certificates"][number];
type Labels = Derived["site"]["labels"]["credentials"];

/** VERIFIED only when the build reached the verify URL; an expired card says so first (§4.4 B1). */
export const stampOf = (c: Cert): "verified" | "onFile" | "expired" => (c.expired ? "expired" : c.verification === "verified" ? "verified" : "onFile");

/** The seal's letters: the issuer's initials, at most four (AWS, GC, CNCF, DA). */
const initials = (issuer: string): string =>
  mrzText(issuer)
    .split("<")
    .filter((w) => w && !["OF", "THE", "AND", "FOR"].includes(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 4);

/** An issuer's logo, when its file is there; otherwise the seal carries the issuer's letters. */
const logoOf = (c: Cert): string | null => (c.issuerLogo && existsSync(join(process.cwd(), "public", c.issuerLogo)) ? c.issuerLogo : null);

/**
 * A credential as an ISO/IEC 7810 ID-1 card (DESIGN.md §4.4 B1), server HTML. The front, bottom to
 * top: the stock; the guilloche, placed by this card's seed; the issuer seal, embossed along the
 * lamp; the foil — the seal and a stripe only, never under text; the type (issuer, title, serial,
 * level, issue date) in the left column; the perforated edge; the stamp. The back: the credential
 * ID and dates, the skills, what it proves, VERIFY ↗ and the machine-readable zone. The button over
 * the card turns it (the behaviour arrives on idle); without JavaScript the back sits under the front.
 */
export function IdCard({ c, L }: { c: Cert; L: Labels }) {
  const stamp = stampOf(c);
  const logo = logoOf(c);
  const [mrz1, mrz2] = mrzLines(c);
  const title = `cred-${c.slug}`;
  return (
    <li className="cred" data-slug={c.slug} data-issuer={c.issuer} data-domain={c.domain} data-level={c.level} data-stamp={stamp} data-expired={c.expired || undefined}>
      <span className="cred-shadow" aria-hidden="true" />
      <article className="cred-card" aria-labelledby={title}>
        <div className="cred-turn">
          <div className="cred-face cred-front">
            <svg className="cred-guilloche" viewBox={`0 0 ${CARD_UNITS.width} ${CARD_UNITS.height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              {guillocheFor(c.credentialId).map((u) => (
                <use key={u.href + u.transform} href={u.href} transform={u.transform} />
              ))}
            </svg>
            <span className="cred-seal" aria-hidden="true">
              <span className="foil">
                <i />
              </span>
              <svg className="cred-seal__emboss" viewBox="-44 -44 88 88" focusable="false">
                <use href="#cred-seal" className="cred-seal__hi" />
                <use href="#cred-seal" className="cred-seal__lo" />
              </svg>
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- a decorative mark in the seal, its own file (next/image would ship a component)
                <img className="cred-seal__logo" src={logo} alt="" width="64" height="64" />
              ) : (
                <span className="cred-seal__mark">{initials(c.issuer)}</span>
              )}
            </span>
            <span className="cred-stripe" aria-hidden="true">
              <span className="foil">
                <i />
              </span>
            </span>
            <div className="cred-front__type">
              <p className="cred-issuer">{c.issuer}</p>
              <h3 className="cred-title" id={title}>
                {c.title}
              </h3>
              <p className="cred-meta">
                <span className="cred-serial">{`${L.front.serial} ${c.credentialId}`}</span>
                <span className="cred-level">{L.levels[c.level]}</span>
                <span>
                  {`${L.front.issued} `}
                  <time dateTime={c.issueDate}>{c.issueDate}</time>
                </span>
              </p>
            </div>
            <span className="cred-stamp" data-stamp={stamp}>
              {L.stamps[stamp]}
            </span>
          </div>
          <div className="cred-face cred-back">
            <dl className="cred-facts">
              <div>
                <dt>{L.back.id}</dt>
                <dd className="cred-facts__id">{c.credentialId}</dd>
              </div>
              <div>
                <dt>{L.back.issued}</dt>
                <dd>
                  <time dateTime={c.issueDate}>{c.issueDate}</time>
                </dd>
              </div>
              <div>
                <dt>{L.back.expires}</dt>
                <dd>{c.expiryDate ? <time dateTime={c.expiryDate}>{c.expiryDate}</time> : L.back.noExpiry}</dd>
              </div>
            </dl>
            <p className="sr-only">{L.back.skills}</p>
            <ul className="cred-skills">
              {c.skillsCovered.map((s, i) => (
                <li key={`${i}-${s}`}>{s}</li>
              ))}
            </ul>
            <p className="cred-proves">
              <span className="sr-only">{`${L.back.proves}: `}</span>
              {c.proves}
            </p>
            {c.verifyUrl && (
              <a className="cred-verify" href={c.verifyUrl} target="_blank" rel="noopener noreferrer">
                {`${L.back.verify} ↗`}
              </a>
            )}
            <p className="cred-mrz" aria-hidden="true">
              <span>{mrz1}</span>
              <span>{mrz2}</span>
            </p>
          </div>
        </div>
        <button type="button" className="cred-flip" aria-pressed="false">
          <span className="sr-only">{`${L.turn.over}: ${c.title}`}</span>
        </button>
      </article>
    </li>
  );
}
