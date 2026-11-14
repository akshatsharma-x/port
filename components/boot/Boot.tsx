import fontManifest from "@/app/fonts/manifest.json";
import { derived } from "@/content/derive";
import { boot, signature } from "@/lib/motion";
import { BootSequence, type BootFont } from "./BootSequence";
import type { CSSProperties } from "react";

/** next/font binds each baked family to one of these (app/typefaces.ts). */
const FONT_VAR: Record<string, string> = { "hubot-sans": "--ff-display", "mona-sans": "--ff-body", "jetbrains-mono": "--ff-mono" };

/**
 * The boot overlay and the POWER ON-fast shutters (DESIGN.md §7.4), server-rendered into every
 * page; the head script shows the one that applies (html[data-boot]). Content and the font
 * manifest stay on the server — the client controller gets only the strings it prints.
 */
export function Boot() {
  const d = derived;
  const L = d.site.labels.boot;
  const fonts: BootFont[] = fontManifest.fonts.map((f) => ({ family: f.family, cssVar: FONT_VAR[f.id] ?? "", bytes: f.bytes }));
  const p = signature.power;
  const k = p.onFastMs / p.onMs;
  // the CSS ON-fast reads the POWER timeline's numbers (lib/motion.ts), never its own
  const timing = {
    "--boot-cap": `${boot.capMs - boot.capLeadMs}ms`, // presented by capMs (lib/motion.ts)
    "--on-fast": `${p.onFastMs}ms`,
    "--on-stretch": `${Math.round(p.onStretchMs * k)}ms`,
    "--on-open": `${Math.round((p.onOpenMs - p.onStretchMs) * k)}ms`,
    "--scan-fast": `${Math.round(signature.scan.ms * k)}ms`,
    "--reduced": `${p.reducedMs}ms`,
  } as CSSProperties;
  return (
    <div className="boot-root" style={timing}>
      <BootSequence
        head={`${d.site.labels.chrome.os} ${L.version} · ${L.build} ${d.buildDate}`}
        banner={`${d.profile.name} — ${d.profile.role}`}
        labels={L}
        counts={{ papers: d.publications.length, projects: d.projects.length, credentials: d.credentials.total }}
        fonts={fonts}
      />
    </div>
  );
}
