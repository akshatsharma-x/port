import type { ReactNode } from "react";
import { DossierDialog } from "@/components/research/DossierDialog";
import { derived } from "@/content/derive";

/**
 * /research/[slug] reached by a soft navigation, intercepted into the @modal slot: the dossier as a
 * <dialog> over the page you're on — over the sky from home, over a record's own page from its
 * prev / next (the intercept sits at the root, so it catches every soft navigation to a record).
 * The layout holds the dialog, so prev / next swap the record inside it (the page's SLIDE
 * ADVANCE) instead of closing and reopening it.
 */
export default function InterceptedResearchLayout({ children }: { children: ReactNode }) {
  const d = derived;
  const graph = Object.fromEntries(d.graph.nodes.map((n, i) => [n.id, i]));
  return (
    <DossierDialog graph={graph} close={d.site.labels.archive.dossier.close}>
      {children}
    </DossierDialog>
  );
}
