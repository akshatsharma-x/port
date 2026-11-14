import { ViewTransition, type ReactNode } from "react";

/**
 * SLIDE ADVANCE for the dossiers (DESIGN.md §3.7): prev / next push the record out and the next
 * one in, as a view transition (React's <ViewTransition>, which Next.js 16 runs for every
 * navigation). Typed by the prev / next links (transitionTypes): a navigation without a type —
 * opening, closing, the browser's own back and forward — doesn't slide. In each page, not the
 * layout: a layout persists, so its enter and exit never fire. styles/dossier.css draws it.
 */
const PUSH = { "dossier-next": "dossier-next", "dossier-prev": "dossier-prev", default: "none" } as const;

export function DossierPush({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={PUSH} exit={PUSH} default="none">
      {children}
    </ViewTransition>
  );
}
