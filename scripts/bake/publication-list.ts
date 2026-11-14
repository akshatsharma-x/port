/**
 * publication-list (DESIGN.md §7.4 CONNECT: DOWNLOAD PUBLICATION LIST (PDF)) →
 * public/media/publications.pdf + content/publication-list.json.
 *
 * The papers as the content holds them — authors, title, venue, year, status, and the DOI or PDF
 * where there is one — set in the site's own faces (Hubot Sans, Mona Sans, JetBrains Mono) on A4 and
 * printed by the installed Chrome. A PDF carries its creation date, so the bytes change every print:
 * it reprints only when its input hash changes (the papers, the faces, the layout), which
 * content/publication-list.json records.
 *
 *   npx tsx scripts/bake/publication-list.ts [--force]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { derived } from "../../content/derive";
import type { Derived } from "../../content/selectors";
import { PUBLICATION_LIST } from "../../lib/publication-list";
import { formatJson, ROOT, writeIfChanged } from "./lib";

export const PUBLICATION_LIST_JSON = "content/publication-list.json";
const FONTS = { display: "app/fonts/HubotSans-Variable.woff2", body: "app/fonts/MonaSans-Variable.woff2", mono: "app/fonts/JetBrainsMono-Variable.woff2" } as const;
/** bump when the page's layout changes */
const LAYOUT_VERSION = 1;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

/** One paper as a citation line's parts. */
export function citation(p: Derived["publications"][number], status: Record<string, string>): { authors: string; title: string; venue: string; status: string; link: string | null } {
  const doi = p.links.doi;
  const pdf = p.links.pdf;
  return {
    authors: p.authors.map((a) => a.name).join(", "),
    title: p.title,
    venue: `${p.venue}, ${p.year}`,
    status: status[p.status] ?? p.status,
    link: doi ?? pdf,
  };
}

export function publicationListHtml(d: Derived, fonts: Record<keyof typeof FONTS, string>): string {
  const L = d.site.labels;
  const status = L.archive.status as unknown as Record<string, string>;
  const items = [...d.publications].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(`${d.profile.name} — ${L.halt.publications}`)}</title>
<style>
@font-face{font-family:Display;src:url(data:font/woff2;base64,${fonts.display}) format("woff2");font-weight:100 900}
@font-face{font-family:Body;src:url(data:font/woff2;base64,${fonts.body}) format("woff2");font-weight:100 900}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${fonts.mono}) format("woff2");font-weight:100 800}
@page{size:A4;margin:22mm 20mm}
body{margin:0;font:400 10.5pt/1.45 Body,sans-serif;color:#111}
header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.6pt solid #111;padding-bottom:4mm;margin-bottom:8mm}
h1{margin:0;font:650 20pt/1.1 Display,sans-serif;letter-spacing:-.01em}
.meta{font:500 7.5pt/1.3 Mono,monospace;letter-spacing:.08em;text-transform:uppercase;color:#555;text-align:right}
h2{margin:0 0 5mm;font:500 8pt/1.2 Mono,monospace;letter-spacing:.12em;text-transform:uppercase}
ol{margin:0;padding:0;list-style:none;counter-reset:n}
li{counter-increment:n;display:grid;grid-template-columns:9mm 1fr;margin-bottom:5mm;break-inside:avoid}
li::before{content:"[" counter(n) "]";font:500 9pt/1.45 Mono,monospace;color:#555}
.title{font-weight:600}
.status{font:500 7.5pt/1.3 Mono,monospace;letter-spacing:.08em;text-transform:uppercase;color:#555}
a{color:#111}
</style></head><body>
<header><h1>${esc(d.profile.name)}</h1><div class="meta">${esc(L.archive.metrics.asOf)} ${esc(d.buildDate)}<br>${esc(d.profile.email)}</div></header>
<h2>${esc(L.halt.publications)} · ${items.length}</h2>
<ol>${items
    .map((p) => {
      const c = citation(p, status);
      return `<li><div>${esc(c.authors)}. <span class="title">${esc(c.title)}</span>. ${esc(c.venue)}. <span class="status">${esc(c.status)}</span>${c.link ? `<br><a href="${esc(c.link)}">${esc(c.link)}</a>` : ""}</div></li>`;
    })
    .join("")}</ol>
</body></html>`;
}

const fnv = (input: string): string => {
  let h = 0x811c9dc5;
  for (const ch of input) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

export function publicationListHash(d: Derived, fontHash: string): string {
  return fnv(JSON.stringify({ layout: LAYOUT_VERSION, fontHash, name: d.profile.name, email: d.profile.email, papers: d.publications.map((p) => [p.title, p.authors.map((a) => a.name), p.venue, p.year, p.status, p.links]) }));
}

export async function publicationListStep(force = false): Promise<string> {
  const d = derived;
  const file = join(ROOT, PUBLICATION_LIST.file);
  if (!d.publications.length) return "no papers · skipped";
  const raw = Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, readFileSync(join(ROOT, f))])) as Record<keyof typeof FONTS, Buffer>;
  const fontHash = createHash("sha256").update(Buffer.concat(Object.values(raw))).digest("hex").slice(0, 16);
  const hash = publicationListHash(d, fontHash);
  if (!force && existsSync(file) && existsSync(join(ROOT, PUBLICATION_LIST_JSON))) {
    const prev = JSON.parse(readFileSync(join(ROOT, PUBLICATION_LIST_JSON), "utf8")) as { inputHash?: string };
    if (prev.inputHash === hash) return `${d.publications.length} papers · fresh (${hash}) · unchanged`;
  }
  const fonts = Object.fromEntries(Object.entries(raw).map(([k, b]) => [k, b.toString("base64")])) as Record<keyof typeof FONTS, string>;
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(publicationListHtml(d, fonts), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    mkdirSync(dirname(file), { recursive: true });
    await writeIfChanged(file, pdf);
    await writeIfChanged(join(ROOT, PUBLICATION_LIST_JSON), formatJson({ version: 1, inputHash: hash, fontHash, papers: d.publications.length, bytes: pdf.length }));
    return `${d.publications.length} papers · A4 PDF ${(pdf.length / 1000).toFixed(1)} KB`;
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.endsWith("publication-list.ts")) void publicationListStep(process.argv.includes("--force")).then((s) => console.log(`publication-list: ${s}`));
