/**
 * atlases (DESIGN.md §8.2, §4.3 A2) → public/textures/log-cards.webp + content/log-atlas.json:
 * the LOG deck's card faces, 2048 × 1024, one card per 512 × 256 cell — lossless WebP, ≤ 300 KB.
 *
 * Drawn in the installed Chrome with the site's own mono face, then encoded exactly by sharp.
 * Theme-agnostic, colorized in the shader:
 *   A — card stock (0 at the holes and the corner cut)
 *   R — printed ink: the 0–9 row digits, the form line
 *   G — the interpreted text along the top edge: the card's own words, printed brighter
 * The holes are a real IBM 029 encoding of each card's top-edge text (lib/hollerith.ts). The last
 * cell is the blank leader card: printed, never punched.
 *
 * Its input hash covers the texts, the face's file and the layout; tests/log.test.ts recomputes it,
 * and reads every card's holes back out of the pixels.
 *
 *   npx tsx scripts/bake/atlases.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { derived } from "../../content/derive";
import { stageData } from "../../content/stage-data";
import { CARD, encode, holes } from "../../lib/hollerith";
import { ATLAS_DPI, LOG, MAX_ROLE_CARDS } from "../../lib/log";
import { formatJson, ROOT, writeIfChanged } from "./lib";

export const ATLAS_OUT = "public/textures/log-cards.webp";
export const ATLAS_JSON = "content/log-atlas.json";
const FONT = "app/fonts/JetBrainsMono-Variable.woff2";

export interface AtlasCardSpec {
  slug: string;
  text: string;
  /** the form line printed bottom right ("RETROGRADE/OS LOG · CARD 01/04") */
  form: string;
  cell: number;
  holes: [number, number][];
}

/** FNV-1a over everything the atlas depends on. */
export function atlasInputHash(cards: readonly { text: string; form: string }[], fontHash: string): string {
  let h = 0x811c9dc5;
  const input = JSON.stringify({ format: "A stock · R print · G top-edge text", cards: cards.map((c) => [c.text, c.form]), fontHash, card: CARD, atlas: LOG.atlas });
  for (const ch of input) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The deck the content asks for: one card per role, in deck order, plus the leader blank. */
export function atlasCards(): AtlasCardSpec[] {
  const d = derived;
  const os = d.site.labels.chrome.os;
  const L = d.site.labels.log;
  const roles = stageData(d).log.cards;
  if (roles.length > MAX_ROLE_CARDS) throw new Error(`atlases: ${roles.length} roles, but the LOG deck holds ${MAX_ROLE_CARDS} (DESIGN.md §4.3 A2)`);
  const n = String(roles.length).padStart(2, "0");
  const cards = roles.map((c, k) => ({ slug: c.slug, text: c.text, form: `${os} ${d.site.sections.find((s) => s.id === "log")?.code ?? ""} · ${L.card} ${String(k + 1).padStart(2, "0")}/${n}`.toUpperCase(), cell: k, holes: holes(encode(c.text)) }));
  cards.push({ slug: "leader", text: "", form: `${os} ${d.site.sections.find((s) => s.id === "log")?.code ?? ""}`.toUpperCase(), cell: LOG.atlas.blankCell, holes: [] });
  return cards;
}

async function render(cards: AtlasCardSpec[]): Promise<Buffer> {
  const font = readFileSync(join(ROOT, FONT)).toString("base64");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>@font-face{font-family:Mono;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 800}</style><canvas id=c></canvas>`);
    // tsx's esbuild names functions with a __name() helper the serialized callback carries along
    await page.evaluate("window.__name = (f) => f");
    await page.evaluate(() => document.fonts.load('500 20px "Mono"'));
    const png = await page.evaluate(
      ({ cards, A, C, dpi }) => {
        const canvas = document.getElementById("c") as HTMLCanvasElement;
        canvas.width = A.width;
        canvas.height = A.height;
        const g = canvas.getContext("2d");
        if (!g) throw new Error("no 2d");
        const cellW = A.width / A.cols;
        const cellH = A.height / A.rows;
        const px = (inches: number) => inches * dpi;
        for (const card of cards) {
          const ox = (card.cell % A.cols) * cellW + Math.round((cellW - A.card.width) / 2);
          const oy = Math.floor(card.cell / A.cols) * cellH + Math.round((cellH - A.card.height) / 2);
          g.save();
          g.translate(ox, oy);
          // the stock: opaque, ink-free
          g.globalCompositeOperation = "source-over";
          g.fillStyle = "#000";
          g.fillRect(0, 0, A.card.width, A.card.height);
          // cut away: the corner, then every hole
          g.globalCompositeOperation = "destination-out";
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(px(C.cornerCut.top), 0);
          g.lineTo(0, px(C.cornerCut.side));
          g.closePath();
          g.fill();
          const punched = new Set(card.holes.map(([c, r]) => `${c}:${r}`));
          for (const [c, r] of card.holes) {
            const cx = px(C.firstColumn + c * C.columnPitch);
            const cy = px(C.firstRow + r * C.rowPitch);
            g.fillRect(cx - px(C.hole.width) / 2, cy - px(C.hole.height) / 2, px(C.hole.width), px(C.hole.height));
          }
          // the print, on the stock only
          g.globalCompositeOperation = "source-atop";
          g.fillStyle = "#f00";
          g.textAlign = "center";
          g.textBaseline = "middle";
          // the interpreted text above each column, in its own channel
          g.fillStyle = "#0f0";
          g.font = `600 ${px(0.1)}px Mono`;
          [...card.text].forEach((ch, c) => {
            if (ch !== " ") g.fillText(ch, px(C.firstColumn + c * C.columnPitch), px(0.115));
          });
          // the row digits 0–9 in every column, where the column isn't punched
          g.fillStyle = "#f00";
          g.font = `500 ${px(0.072)}px Mono`;
          for (let c = 0; c < C.columns; c++) {
            for (let r = 2; r < C.rows; r++) {
              if (!punched.has(`${c}:${r}`)) g.fillText(String(r - 2), px(C.firstColumn + c * C.columnPitch), px(C.firstRow + r * C.rowPitch));
            }
          }
          // the form line, bottom right (where IBM printed "5081")
          g.textAlign = "right";
          g.font = `500 ${px(0.075)}px Mono`;
          g.fillText(card.form, A.card.width - px(0.2), A.card.height - px(0.095));
          g.restore();
        }
        return canvas.toDataURL("image/png");
      },
      { cards, A: LOG.atlas, C: CARD, dpi: ATLAS_DPI },
    );
    return Buffer.from(png.slice(png.indexOf(",") + 1), "base64");
  } finally {
    await browser.close();
  }
}

/** Draws the atlas when its inputs changed (or `force`); a fresh one is left alone, so no browser starts. */
export async function atlasStep(force = false): Promise<string> {
  const cards = atlasCards();
  const fontHash = createHash("sha256").update(readFileSync(join(ROOT, FONT))).digest("hex").slice(0, 16);
  const inputHash = atlasInputHash(cards, fontHash);
  if (!force && existsSync(join(ROOT, ATLAS_OUT)) && existsSync(join(ROOT, ATLAS_JSON))) {
    const prev = JSON.parse(readFileSync(join(ROOT, ATLAS_JSON), "utf8")) as { inputHash?: string };
    if (prev.inputHash === inputHash) return `${cards.length - 1} role cards + leader · fresh (${inputHash}) · unchanged`;
  }
  const png = await render(cards);
  const webp = await sharp(png).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  const changed = await writeIfChanged(join(ROOT, ATLAS_OUT), webp);
  await writeIfChanged(join(ROOT, ATLAS_JSON), formatJson({ version: 1, inputHash, fontHash, cards: cards.map(({ slug, text, form, cell }) => ({ slug, text, form, cell })) }));
  return `${cards.length - 1} role cards + leader · ${LOG.atlas.width}×${LOG.atlas.height} lossless WebP · ${(webp.length / 1000).toFixed(1)} KB${changed ? "" : " · unchanged"}`;
}

if (process.argv[1]?.endsWith("atlases.ts")) void atlasStep(process.argv.includes("--force")).then((s) => console.log(`atlases: ${s}`));
