import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Content } from "./schema";

/**
 * Non-fatal checks the schema can't express: files on disk, and nudges toward strong entries
 * (CONTENT_INTAKE.md). Errors live in the schema; these only warn. Used by the bake and by
 * /dev/content.
 */
export interface ContentWarning {
  area: "media" | "quality" | "trust";
  message: string;
}

export function contentWarnings(c: Content, root: string = process.cwd()): ContentWarning[] {
  const out: ContentWarning[] = [];
  const asset = (path: string | null | undefined, owner: string) => {
    if (path?.startsWith("/") && !existsSync(join(root, "public", path))) out.push({ area: "media", message: `${owner}: missing public${path}` });
  };

  asset(c.profile.avatar.src, "profile avatar");
  asset(c.profile.resumeUrl, "profile resume");
  for (const e of c.experience) asset(e.logo, `${e.company} logo`);
  for (const p of c.projects) {
    for (const m of p.media) {
      asset(m.src, `project ${p.slug}`);
      if (m.type === "video") asset(m.poster, `project ${p.slug} poster`);
    }
  }
  for (const p of c.publications) asset(p.pdfUrl, `paper ${p.slug} PDF`);
  for (const cert of c.certificates) asset(cert.issuerLogo, `credential ${cert.slug} issuer logo`);

  for (const e of c.experience) {
    for (const h of e.highlights) {
      if (!/\d/.test(h)) out.push({ area: "quality", message: `${e.company}: quantify this highlight — "${h.slice(0, 60)}…"` });
    }
    if (e.highlights.length < 3) out.push({ area: "quality", message: `${e.company}: the role card shows three highlights; this one has ${e.highlights.length}` });
  }
  for (const p of c.publications) {
    if ((p.status === "published" || p.status === "accepted") && p.isPeerReviewed && !p.doi) {
      out.push({ area: "trust", message: `paper ${p.slug}: peer-reviewed work without a DOI cannot be verified` });
    }
  }
  for (const cert of c.certificates) {
    if (!cert.verifyUrl) out.push({ area: "trust", message: `credential ${cert.slug}: no verify URL — it will show ON FILE, never VERIFIED` });
  }
  for (const a of c.achievements) {
    if (!a.proofUrl) out.push({ area: "trust", message: `achievement "${a.title}": no proof link` });
  }
  return out;
}
