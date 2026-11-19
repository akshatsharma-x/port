import { derived } from "@/content/derive";
import { sectionLabel } from "./types";

/**
 * A page with no tracked sections names the section it belongs to for the HUD's readout
 * (HudReadout reads `data-hud-page` when no section holds the screen): a case study reads
 * "05 WORK", a paper "04 ARCHIVE", where it read a dash (Part 16). Server HTML, no script.
 */
export function HudPage({ section, label }: { section?: string; label?: string }) {
  const s = section ? derived.site.sections.find((x) => x.id === section) : undefined;
  const text = label ?? (s ? sectionLabel(s) : null);
  return text ? <span hidden data-hud-page={text} /> : null;
}
