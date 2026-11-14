/**
 * og (PROMPTS.md Part 15) → public/og/: the share cards, 1200 × 630 PNGs, rendered by next/og's
 * ImageResponse from lib/og-cards.tsx — home, every project, every paper. Before it draws:
 *   - their faces: JetBrains Mono's static 400 and 700 (app/fonts/og, made by scripts/fonts/og.py:
 *     next/og reads no WOFF2 and no variable axes);
 *   - every record's title on its card: at the size lib/og-size.ts gives its length, in the mono's
 *     advance, it must sit on ≤ 4 lines of the card's measure, or the build stops here.
 * After: each PNG is read back — a PNG, 1200 × 630 — or the build stops. Deterministic: the same
 * record, the same bytes (lib/seo.ts versions each card's URL by them).
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Content } from "../../content/schema";
import type { Derived } from "../../content/selectors";
import { OG_SIZE, renderPng } from "../../lib/og";
import { homeCard, ogPath, paperCard, projectCard } from "../../lib/og-cards";
import { titleSize } from "../../lib/og-size";
import { SHELL } from "../../lib/shell/config";
import { BakeError, ROOT, writeIfChanged } from "./lib";

const FACES = [400, 700].map((w) => `app/fonts/og/JetBrainsMono-${w}.ttf`);
/** the card's measure: 1200 less the frame's 72 px a side (lib/og.tsx PAD_X) */
const MEASURE = 1200 - 2 * 72;
const MAX_LINES = 4;

/** Lines a title wraps to at its card size: whole words over the mono's advance (SHELL.advanceEm). */
export function titleLines(text: string): number {
  const perLine = Math.floor(MEASURE / (titleSize(text) * SHELL.advanceEm));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/)) {
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (need <= perLine) used = need;
    else {
      lines++;
      used = word.length;
    }
  }
  return lines;
}

/** A PNG's own size, from its IHDR. */
export function pngSize(png: Buffer): { width: number; height: number } | null {
  if (png.length < 24 || png.toString("latin1", 1, 4) !== "PNG") return null;
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export async function ogStep(content: Content, d: Derived): Promise<string> {
  const missing = FACES.filter((f) => !existsSync(join(ROOT, f)));
  if (missing.length) throw new BakeError(`og: the cards' faces are missing (${missing.join(", ")}): run sh scripts/fonts/run.sh`);
  const titles = [content.profile.name, ...content.projects.map((p) => p.title), ...content.publications.map((p) => p.title)];
  const over = titles.filter((t) => titleLines(t) > MAX_LINES);
  if (over.length) throw new BakeError(`og: ${over.length} title(s) won't fit a card in ${MAX_LINES} lines: ${over.map((t) => `"${t.slice(0, 40)}…" (${titleLines(t)})`).join(", ")}`);
  const cards: [string, ReturnType<typeof homeCard>][] = [
    [ogPath("home"), homeCard(d)],
    ...d.projects.map((p): [string, ReturnType<typeof homeCard>] => [ogPath({ work: p.slug }), projectCard(d, p)]),
    ...d.publications.map((p): [string, ReturnType<typeof homeCard>] => [ogPath({ research: p.slug }), paperCard(d, p)]),
  ];
  let bytes = 0;
  let written = 0;
  for (const [path, card] of cards) {
    const png = await renderPng(card.node);
    const size = pngSize(png);
    if (!size || size.width !== OG_SIZE.width || size.height !== OG_SIZE.height) throw new BakeError(`og: ${path} came out ${size ? `${size.width} × ${size.height}` : "not a PNG"}, not ${OG_SIZE.width} × ${OG_SIZE.height}`);
    bytes += png.length;
    if (await writeIfChanged(join(ROOT, "public", path), png)) written++;
  }
  const most = Math.max(...titles.map(titleLines));
  return `${cards.length} cards (home, ${d.projects.length} projects, ${d.publications.length} papers) · ${OG_SIZE.width} × ${OG_SIZE.height} · ${(bytes / 1024).toFixed(1)} KB · every title ≤ ${most} of ${MAX_LINES} lines${written ? "" : " · unchanged"}`;
}
