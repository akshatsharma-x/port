import Link from "next/link";
import type { ReactNode } from "react";
import { derived } from "@/content/derive";

/**
 * /research/[slug] visited directly (a shared link, a reload): the dossier as a full page. Prev /
 * next push the next record in (the page's SLIDE ADVANCE view transition).
 */
export default function ResearchLayout({ children }: { children: ReactNode }) {
  const d = derived;
  return (
    <main className="dossier-page">
      <p className="dossier-page__back">
        <Link href="/#archive" className="t-micro">{`← ${d.site.labels.archive.dossier.back}`}</Link>
      </p>
      {children}
    </main>
  );
}
