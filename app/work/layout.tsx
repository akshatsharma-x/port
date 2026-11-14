import type { ReactNode } from "react";

/** /work/[slug]: a case study (DESIGN.md §7.4), its own page. */
export default function WorkLayout({ children }: { children: ReactNode }) {
  return <main className="case-page">{children}</main>;
}
