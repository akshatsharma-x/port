import { ViewTransition, type ReactNode } from "react";

/**
 * SLIDE ADVANCE between case studies (DESIGN.md §3.6: a push plus a resolve): prev / next push
 * the project out and the next one in as a typed view transition, like the dossiers' (§10 #34);
 * the incoming hero resolves as it arrives. Untyped navigations — a PROJECTION, Back — don't slide.
 * styles/work.css draws it.
 */
const PUSH = { "work-next": "work-next", "work-prev": "work-prev", default: "none" } as const;

export function CasePush({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={PUSH} exit={PUSH} default="none">
      {children}
    </ViewTransition>
  );
}
