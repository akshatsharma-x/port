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

/** React's own escaping (escapeTextForBrowser), for text and attribute values alike: the markup is byte for byte what JSX wrote. */
const esc = (s: string): string => s.replace(/[&<>"']/g, (ch) => ESCAPES[ch] as string);
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };

type Attrs = Record<string, string | boolean | undefined>;
/** Attributes in the order given; undefined and false are left out, as React leaves them. */
const attrs = (a: Attrs): string =>
  Object.entries(a)
    .map(([k, v]) => (v === undefined || v === false ? "" : ` ${k}="${esc(v === true ? "true" : v)}"`))
    .join("");
const el = (tag: string, a: Attrs, ...children: string[]): string => `<${tag}${attrs(a)}>${children.join("")}</${tag}>`;

/**
 * A credential as an ISO/IEC 7810 ID-1 card (DESIGN.md §4.4 B1), server HTML. The front, bottom to
 * top: the stock; the guilloche, placed by this card's seed; the issuer seal, embossed along the
 * lamp; the foil — the seal and a stripe only, never under text; the type (issuer, title, serial,
 * level, issue date) in the left column; the perforated edge; the stamp. The back: the credential
 * ID and dates, the skills, what it proves, VERIFY ↗ and the machine-readable zone. The button over
 * the card turns it (the behaviour arrives on idle); without JavaScript the back sits under the front.
 * A credential listed without an ID or a date (v2.8) leaves it off the front and reads "Not listed"
 * on the back; its engraving and microprint take the slug's seed instead.
 *
 * Written as a string, not JSX (v2.8): React carries a server component's whole tree a second time in
 * the page's RSC payload, and fifteen cards made that a third of home's HTML. The wall takes the cards
 * as one string (Credentials.tsx), carried once in the payload and never hydrated: CredentialsBehavior
 * works on the DOM. The markup is the JSX's own, byte for byte (tests/credentials.test.ts).
 */
export function idCardHtml(c: Cert, L: Labels): string {
  const stamp = stampOf(c);
  const logo = logoOf(c);
  const [mrz1, mrz2] = mrzLines(c);
  const title = `cred-${c.slug}`;
  const seed = c.credentialId ?? c.slug;
  const box = `0 0 ${CARD_UNITS.width} ${CARD_UNITS.height}`;
  const engraving = guillocheFor(seed)
    .map((u) => el("use", { href: u.href, transform: u.transform }))
    .join("");
  const foil = el("span", { class: "foil" }, "<i></i>");
  const front = el(
    "div",
    { class: "cred-face cred-front" },
    el("svg", { class: "cred-guilloche", viewBox: box, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" }, engraving),
    el(
      "span",
      { class: "cred-seal", "aria-hidden": "true" },
      foil,
      el("svg", { class: "cred-seal__emboss", viewBox: "-44 -44 88 88", focusable: "false" }, el("use", { href: "#cred-seal", class: "cred-seal__hi" }), el("use", { href: "#cred-seal", class: "cred-seal__lo" })),
      // a decorative mark in the seal, its own file
      logo ? `<img${attrs({ class: "cred-seal__logo", src: logo, alt: "", width: "64", height: "64" })}/>` : el("span", { class: "cred-seal__mark" }, esc(initials(c.issuer))),
    ),
    el("span", { class: "cred-stripe", "aria-hidden": "true" }, foil),
    el(
      "div",
      { class: "cred-front__type" },
      el("p", { class: "cred-issuer" }, esc(c.issuer)),
      el("h3", { class: "cred-title", id: title }, esc(c.title)),
      el(
        "p",
        { class: "cred-meta" },
        c.credentialId ? el("span", { class: "cred-serial" }, esc(`${L.front.serial} ${c.credentialId}`)) : "",
        el("span", { class: "cred-level" }, esc(L.levels[c.level])),
        c.issueDate ? el("span", {}, esc(`${L.front.issued} `), el("time", { dateTime: c.issueDate }, esc(c.issueDate))) : "",
      ),
    ),
    el("span", { class: "cred-stamp", "data-stamp": stamp }, esc(L.stamps[stamp])),
  );
  // the back is a security document too (Part 16): the card's own guilloche, mirrored, as an
  // underprint; a microprint rule of its ID; the MRZ in its zone
  const back = el(
    "div",
    { class: "cred-face cred-back" },
    el("svg", { class: "cred-guilloche cred-guilloche--back", viewBox: box, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" }, engraving),
    el(
      "dl",
      { class: "cred-facts" },
      el("div", {}, el("dt", {}, esc(L.back.id)), el("dd", { class: "cred-facts__id" }, esc(c.credentialId ?? L.back.notListed))),
      el("div", {}, el("dt", {}, esc(L.back.issued)), el("dd", {}, c.issueDate ? el("time", { dateTime: c.issueDate }, esc(c.issueDate)) : esc(L.back.notListed))),
      el("div", {}, el("dt", {}, esc(L.back.expires)), el("dd", {}, c.expiryDate ? el("time", { dateTime: c.expiryDate }, esc(c.expiryDate)) : esc(L.back.noExpiry))),
    ),
    el("p", { class: "sr-only" }, esc(L.back.skills)),
    el("ul", { class: "cred-skills" }, ...c.skillsCovered.map((s) => el("li", {}, esc(s)))),
    el("p", { class: "cred-proves" }, el("span", { class: "sr-only" }, esc(`${L.back.proves}: `)), esc(c.proves)),
    c.verifyUrl ? el("a", { class: "cred-verify", href: c.verifyUrl, target: "_blank", rel: "noopener noreferrer", "data-track": "cert_verify", "data-track-id": c.slug }, esc(`${L.back.verify} ↗`)) : "",
    el("p", { class: "cred-micro", "aria-hidden": "true" }, esc(Array.from({ length: 8 }, () => c.credentialId ?? c.slug.toUpperCase()).join(" · "))),
    el("p", { class: "cred-mrz", "aria-hidden": "true" }, el("span", {}, esc(mrz1)), el("span", {}, esc(mrz2))),
  );
  return el(
    "li",
    { class: "cred", "data-slug": c.slug, "data-issuer": c.issuer, "data-domain": c.domain, "data-level": c.level, "data-stamp": stamp, "data-expired": c.expired || undefined },
    el("span", { class: "cred-shadow", "aria-hidden": "true" }),
    el("article", { class: "cred-card", "aria-labelledby": title }, el("div", { class: "cred-turn" }, front, back), el("button", { type: "button", class: "cred-flip", "aria-pressed": "false" }, el("span", { class: "sr-only" }, esc(`${L.turn.over}: ${c.title}`)))),
  );
}
