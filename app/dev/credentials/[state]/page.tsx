import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Credentials } from "@/components/sections/credentials/Credentials";
import { buildDate, overlays } from "@/content/derive";
import { parseContent, type ContentInput, type VerifyFile } from "@/content/schema";
import { derive } from "@/content/selectors";
import { data } from "@/tests/fixtures/placeholder-content";

/**
 * Dev only (RETROGRADE_DEV_ROUTES=1): CREDENTIALS on the fixture persona's certificates (the real
 * content had none until v2.8) in every state the section must hold (DESIGN.md §7.4): the fixture's
 * twelve (one with a logo), one, forty, very long titles with missing logos and no expiry, and
 * nothing at all. The verify results are the fixture's own: some reached, some not, some unchecked.
 * scripts/credentials-gate.mjs reads these pages.
 */
const STATES = ["full", "one", "forty", "long", "empty"] as const;
type State = (typeof STATES)[number];

export const dynamicParams = false;
export function generateStaticParams() {
  return STATES.map((state) => ({ state }));
}
export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  return { title: `Credentials · ${(await params).state}` };
}

type Cert = NonNullable<ContentInput["certificates"]>[number];
type Ach = NonNullable<ContentInput["achievements"]>[number];
const certs = data.certificates as Cert[];
const records = data.achievements as Ach[];

function input(state: State): ContentInput {
  const base = { ...data } as ContentInput;
  switch (state) {
    case "full":
      return { ...base, certificates: certs.map((c, i) => (i === 0 ? { ...c, issuerLogo: "/textures/bluenoise-64.png" } : c)) };
    case "one":
      return { ...base, certificates: certs.slice(0, 1), achievements: records.slice(0, 1), testimonials: [] };
    case "forty":
      return {
        ...base,
        certificates: Array.from({ length: 40 }, (_, i) => {
          const c = certs[i % certs.length] as Cert;
          return { ...c, slug: `${c.slug}-${i}`, credentialId: `${c.credentialId}-${String(i).padStart(2, "0")}`, featured: false };
        }),
      };
    case "long":
      return {
        ...base,
        certificates: certs.slice(0, 6).map((c, i) => ({
          ...c,
          title: `${c.title} — with a title long enough to run past three lines of the card at every width it is shown`.slice(0, 120),
          issuer: i % 2 ? `${c.issuer} Professional Certification and Training Programme` : c.issuer,
          issuerLogo: "/media/issuers/missing.svg",
          expiryDate: i < 3 ? null : c.expiryDate,
          skillsCovered: [...new Set([...c.skillsCovered, "Observability", "Incident response", "Cost control"])].slice(0, 8),
        })),
        achievements: records.map((a) => ({ ...a, title: `${a.title}, recognised at length for work that ran across several years and venues`.slice(0, 120) })),
        testimonials: [],
      };
    case "empty":
      return { ...base, certificates: [], achievements: [], testimonials: [] };
  }
}

/** The fixture's verify results: most reached, one dead, the rest never checked (so ON FILE). */
function verify(c: ContentInput): VerifyFile {
  const results: VerifyFile["results"] = {};
  (c.certificates ?? []).forEach((cert, i) => {
    if (!cert.verifyUrl || i % 5 === 4) return;
    results[`verifyUrl:${cert.slug}`] = { kind: "verifyUrl", owner: cert.slug, target: cert.verifyUrl, status: i % 7 === 3 ? "dead" : "ok", httpStatus: i % 7 === 3 ? 404 : 200, checkedAt: "2026-11-13" };
  });
  return { version: 1, mode: "live", results };
}

export default async function CredentialsFixture({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  if (!STATES.includes(state as State)) notFound();
  const c = input(state as State);
  const d = derive(parseContent(c), { ...overlays, verify: verify(c) }, buildDate);
  return (
    <main className="dev-fixture" data-fixture={state}>
      {/* a screen of header first, so the wall starts below the fold and its deal can be seen */}
      <header className="grid min-h-[100svh] content-center px-[var(--margin)]">
        <p className="t-micro text-fg-3">{`/dev/credentials/${state}`}</p>
      </header>
      <section id="credentials" className="section">
        <Credentials d={d} />
      </section>
    </main>
  );
}
