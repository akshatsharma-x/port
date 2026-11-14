import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "@/lib/cx";

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  ref?: Ref<HTMLElement>;
  /** DOM id and data-section key for the scroll engine (Part 4) */
  id: string;
  /** section number in page order: 0 POST … 9 HALT */
  index: number;
  /** codename, e.g. ARCHIVE */
  code: string;
  /** the section's name, e.g. RESEARCH & PUBLICATIONS (the section heading) */
  title: string;
  /** live counts from content/derive.ts, e.g. ["23 RECORDS", "1,284 CITATIONS", "2016–2026"] */
  counts?: readonly string[];
  /** false: no header strip (the hero is the full-screen beat); the title still names the region */
  strip?: boolean;
  children?: ReactNode;
}

/**
 * Full-bleed section with the DESIGN.md §2.9 header strip:
 * [04] ARCHIVE ───────── RESEARCH & PUBLICATIONS ───────── 23 RECORDS · 1,284 CITATIONS
 */
export function Section({ id, index, code, title, counts = [], strip = true, className, children, ...rest }: SectionProps) {
  const headingId = `${id}-title`;
  const label = strip ? { "aria-labelledby": headingId } : { "aria-label": title };
  return (
    <section id={id} data-section={id} {...label} className={cx("section", className)} {...rest}>
      {strip && (
        <header className="section-strip">
          <span className="section-strip__index t-micro text-accent">
            [{String(index).padStart(2, "0")}] {code}
          </span>
          <span aria-hidden="true" className="section-strip__rule" />
          <h2 id={headingId} className="section-strip__title t-micro text-fg-1">
            {title}
          </h2>
          {counts.length > 0 && (
            <>
              <span aria-hidden="true" className="section-strip__rule" />
              <p className="section-strip__counts t-micro text-fg-3">{counts.join(" · ")}</p>
            </>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
