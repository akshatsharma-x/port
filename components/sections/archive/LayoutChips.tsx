"use client";

import { useStage } from "@/components/stage/useStage";
import type { LayoutName } from "@/content/schema";
import { useArchive } from "@/lib/archive";
import { liveAllowed } from "@/lib/tier";

/**
 * The query bar's LAYOUT chips (DESIGN.md §7.4): TOPIC · YEAR · VENUE. One choice, so real radio
 * inputs (arrow keys move within the group, the browser's own semantics) dressed as chips; the
 * state shows as ■ / □ as well as color. Choosing one re-plots the sky (lib/archive.ts's store).
 * Without a stage there's nothing to re-plot (the drawing and the poster are TOPIC's), so the chips
 * step aside: CSS hides them on phones, under reduced motion and without JS from the first paint;
 * a tier that can't run ARCHIVE (LOW, OFF) hides them here once it's final.
 */
export function LayoutChips({ legend, options }: { legend: string; options: readonly { value: LayoutName; label: string }[] }) {
  const layout = useArchive((s) => s.layout);
  const setLayout = useArchive((s) => s.setLayout);
  const inert = useStage((s) => s.tierFinal && !liveAllowed(s.tier, "archive"));
  return (
    <fieldset className="layout-chips" hidden={inert}>
      <legend className="t-micro">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="chip chip--toggle layout-chips__chip">
          <input type="radio" name="archive-layout" value={o.value} checked={layout === o.value} onChange={() => setLayout(o.value)} className="sr-only" />
          <span aria-hidden="true">{layout === o.value ? "■" : "□"}</span>
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
