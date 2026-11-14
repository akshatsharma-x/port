import { CaseStudy } from "@/components/work/CaseStudy";
import { derived } from "@/content/derive";

/**
 * Dev only (RETROGRADE_DEV_ROUTES=1): a case study that lists both papers — the real content lists
 * none yet — so scripts/work-gate.mjs can open a mini-dossier over it and close back to it.
 */
export default function WorkFixture() {
  const first = derived.projects[0];
  if (!first) return null;
  return (
    <main className="case-page">
      <CaseStudy slug={first.slug} papers={derived.publications.map((p) => p.slug)} />
    </main>
  );
}
