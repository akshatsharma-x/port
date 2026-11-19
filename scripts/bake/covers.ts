/**
 * covers (DESIGN.md §8.2, §4.3 A4) → public/media/projects/<slug>/{cover.avif, cover-1024.avif,
 * cover-768.avif, cover-640.avif} + content/covers.json. (A project's share card is its own since
 * Part 15, public/og/work/<slug>.png from the og step, not a crop.)
 *
 * Every project gets one 3:2 picture at four sizes (lib/covers.ts): the master for the DOM, and the
 * stage's three tier files, each an AVIF of at most 120 KB (the build fails past it). The picture
 * is the screenshot in content/covers/<slug>.(avif|webp|png|jpg|jpeg) when there is one, cropped to
 * 3:2 by attention. Until then it's a title card: the project's own category, title, subtitle and
 * stack, set in the site's faces in the installed Chrome over a neutral light — type on
 * a ground, plainly not a screenshot (the alt text says so too). Dropping a screenshot in changes
 * no code: same paths, same sizes.
 *
 * It redraws only when its input hash changes (the words, the faces' files, the card's constants,
 * a screenshot's bytes); tests/work.test.ts recomputes it.
 *
 *   npx tsx scripts/bake/covers.ts [--force]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp, { type Sharp } from "sharp";
import { derived } from "../../content/derive";
import { COVER, TITLE_CARD, coverSrc, coverTierSrc } from "../../lib/covers";
import { BakeError, formatJson, ROOT, writeIfChanged } from "./lib";

export const COVERS_JSON = "content/covers.json";
const FACES = { display: "app/fonts/HubotSans-Variable.woff2", body: "app/fonts/MonaSans-Variable.woff2", mono: "app/fonts/JetBrainsMono-Variable.woff2" } as const;
/** bump when the card's layout changes */
const CARD_VERSION = 2;

export interface CoverSpec {
  slug: string;
  index: number;
  title: string;
  subtitle: string;
  category: string;
  stack: readonly string[];
  /** a screenshot's path (repo-relative), when there is one */
  screenshot: string | null;
}

export interface CoversManifest {
  version: 1;
  covers: Record<string, { source: "title-card" | "screenshot"; inputHash: string; bytes: Record<"master" | "1024" | "768" | "640", number> }>;
}

const fnv = (input: string): string => {
  let h = 0x811c9dc5;
  for (const ch of input) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

const fileHash = (path: string): string => createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex").slice(0, 16);

/** Every project's cover, in content order. */
export function coverSpecs(): CoverSpec[] {
  return derived.projects.map((p, index) => {
    const shot = COVER.sources.map((ext) => `content/covers/${p.slug}.${ext}`).find((f) => existsSync(join(ROOT, f))) ?? null;
    return { slug: p.slug, index, title: p.title, subtitle: p.subtitle, category: p.category, stack: p.stack, screenshot: shot };
  });
}

/** FNV-1a over everything one cover depends on. */
export function coverInputHash(spec: CoverSpec, faceHashes: Record<keyof typeof FACES, string>): string {
  return fnv(
    JSON.stringify({
      card: CARD_VERSION,
      cover: COVER,
      look: TITLE_CARD,
      words: [spec.index, spec.title, spec.subtitle, spec.category, spec.stack],
      faces: faceHashes,
      screenshot: spec.screenshot ? fileHash(spec.screenshot) : null,
    }),
  );
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The title card's page: 2400 × 1600, the site's faces inlined. */
function cardHtml(spec: CoverSpec, faces: Record<keyof typeof FACES, string>): string {
  const { width, height } = COVER.master;
  const hue = 0; // moot at chroma 0: the card is achromatic (lib/covers.ts TITLE_CARD)
  const L = TITLE_CARD.lightness;
  const C = TITLE_CARD.chroma;
  const light = (l: number, c: number, h: number, a: number) => `oklch(${l} ${c} ${h} / ${a})`;
  return `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:Display;src:url(data:font/woff2;base64,${faces.display}) format("woff2");font-weight:500 900;font-stretch:75% 125%}
@font-face{font-family:Body;src:url(data:font/woff2;base64,${faces.body}) format("woff2");font-weight:300 700}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${faces.mono}) format("woff2");font-weight:400 800}
html,body{margin:0;background:${TITLE_CARD.ground}}
.card{position:relative;box-sizing:border-box;width:${width}px;height:${height}px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:150px 160px 140px;background:${TITLE_CARD.ground};color:${TITLE_CARD.ink}}
.card>*{position:relative}
.light{position:absolute!important;inset:0;background:radial-gradient(95% 85% at 84% 12%,${light(L, C, hue, 0.92)},${light(L * 0.62, C * 0.8, hue, 0.36)} 46%,${light(0.2, 0.04, hue, 0)} 74%),radial-gradient(70% 60% at 0% 104%,${light(L * 0.7, C * 0.9, (hue + 48) % 360, 0.5)},transparent 70%)}
.grid{position:absolute!important;inset:0;background-image:linear-gradient(to right,rgb(255 255 255/.055) 2px,transparent 2px),linear-gradient(to bottom,rgb(255 255 255/.055) 2px,transparent 2px);background-size:100px 100px;background-position:-2px -2px}
.scan{position:absolute!important;inset:0;background:repeating-linear-gradient(to bottom,rgb(0 0 0/.16) 0 3px,transparent 3px 8px)}
.cat{font:600 46px/1 Mono;letter-spacing:.16em;text-transform:uppercase;color:${light(Math.min(0.92, L + 0.14), C, hue, 1)}}
.cat::before{content:"";display:inline-block;width:30px;height:30px;margin-right:30px;vertical-align:-2px;background:currentColor}
.title{margin:0 0 44px;font:800 196px/.94 Display;font-stretch:110%;letter-spacing:-.012em;text-wrap:balance;max-width:2000px}
.sub{margin:0 0 70px;font:400 62px/1.22 Body;color:rgb(238 243 239/.8);max-width:1700px;text-wrap:pretty}
.stack{margin:0;font:500 38px/1.6 Mono;letter-spacing:.08em;text-transform:uppercase;color:rgb(238 243 239/.6);max-width:2080px}
</style><div class=card><div class=light></div><div class=grid></div><div class=scan></div>
<div class=cat>${escape(spec.category)}</div>
<div><h1 class=title>${escape(spec.title)}</h1><p class=sub>${escape(spec.subtitle)}</p><p class=stack>${spec.stack.map(escape).join("\u00a0· ")}</p></div></div>`;
}

async function renderCards(specs: CoverSpec[]): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  if (!specs.length) return out;
  const faces = Object.fromEntries(Object.entries(FACES).map(([k, f]) => [k, readFileSync(join(ROOT, f)).toString("base64")])) as Record<keyof typeof FACES, string>;
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: COVER.master.width, height: COVER.master.height }, deviceScaleFactor: 1 });
    for (const spec of specs) {
      await page.setContent(cardHtml(spec, faces));
      await page.evaluate(() => Promise.all(['800 196px "Display"', '400 62px "Body"', '600 46px "Mono"'].map((f) => document.fonts.load(f))));
      await page.evaluate(() => document.fonts.ready);
      // every face must be the site's own: a fallback would bake a different card on another machine
      const missing = await page.evaluate(() => ["Display", "Body", "Mono"].filter((f) => !document.fonts.check(`16px "${f}"`)));
      if (missing.length) throw new BakeError(`covers: ${spec.slug}'s card couldn't load ${missing.join(", ")}`);
      out.set(spec.slug, await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: COVER.master.width, height: COVER.master.height } }));
    }
  } finally {
    await browser.close();
  }
  return out;
}

/** An AVIF at most `max` bytes: the best quality from a short ladder that fits. */
async function avifWithin(input: Sharp, max: number, where: string): Promise<Buffer> {
  for (const quality of [64, 56, 48, 40, 32]) {
    const buf = await input.clone().avif({ quality, effort: 6, chromaSubsampling: "4:4:4" }).toBuffer();
    if (buf.length <= max) return buf;
  }
  throw new BakeError(`covers: ${where} won't fit ${max / 1000} KB as AVIF even at quality 32 (DESIGN.md §4.3 A4)`);
}

export async function coversStep(force = false): Promise<string> {
  const specs = coverSpecs();
  const faceHashes = Object.fromEntries(Object.entries(FACES).map(([k, f]) => [k, fileHash(f)])) as Record<keyof typeof FACES, string>;
  const prev = existsSync(join(ROOT, COVERS_JSON)) ? (JSON.parse(readFileSync(join(ROOT, COVERS_JSON), "utf8")) as CoversManifest) : null;
  const files = (slug: string) => [coverSrc(slug), ...COVER.tiers.map((t) => coverTierSrc(slug, t.width))].map((f) => join(ROOT, "public", f));
  const hashes = new Map(specs.map((s) => [s.slug, coverInputHash(s, faceHashes)]));
  const stale = specs.filter((s) => force || prev?.covers[s.slug]?.inputHash !== hashes.get(s.slug) || !files(s.slug).every((f) => existsSync(f)));
  const cards = await renderCards(stale.filter((s) => !s.screenshot));

  const manifest: CoversManifest = { version: 1, covers: {} };
  let written = 0;
  for (const spec of specs) {
    const hash = hashes.get(spec.slug) as string;
    const kept = prev?.covers[spec.slug];
    if (!stale.includes(spec) && kept) {
      manifest.covers[spec.slug] = kept;
      continue;
    }
    const source = spec.screenshot ? readFileSync(join(ROOT, spec.screenshot)) : cards.get(spec.slug);
    if (!source) throw new BakeError(`covers: nothing to draw ${spec.slug} from`);
    const master = sharp(source).resize(COVER.master.width, COVER.master.height, { fit: "cover", position: sharp.strategy.attention }).removeAlpha();
    const flat = await master.clone().png().toBuffer();
    const outs: [string, Buffer][] = [[coverSrc(spec.slug), await avifWithin(sharp(flat), COVER.maxMasterBytes, `${spec.slug}'s master`)]];
    for (const t of COVER.tiers) outs.push([coverTierSrc(spec.slug, t.width), await avifWithin(sharp(flat).resize(t.width, t.height, { fit: "fill", kernel: "lanczos3" }), COVER.maxBytes, `${spec.slug} at ${t.width}`)]);
    for (const [path, buf] of outs) if (await writeIfChanged(join(ROOT, "public", path), buf)) written++;
    const bytes = Object.fromEntries(outs.map(([, buf], k) => [(["master", "1024", "768", "640"] as const)[k] as string, buf.length])) as CoversManifest["covers"][string]["bytes"];
    manifest.covers[spec.slug] = { source: spec.screenshot ? "screenshot" : "title-card", inputHash: hash, bytes };
  }
  await writeIfChanged(join(ROOT, COVERS_JSON), formatJson(manifest));
  const all = Object.values(manifest.covers);
  const tierBytes = all.flatMap((c) => [c.bytes["1024"], c.bytes["768"], c.bytes["640"]]);
  const cardsN = all.filter((c) => c.source === "title-card").length;
  const range = tierBytes.length ? `${(Math.min(...tierBytes) / 1000).toFixed(1)}–${(Math.max(...tierBytes) / 1000).toFixed(1)} KB` : "—";
  return `${all.length} covers · ${cardsN} title cards, ${all.length - cardsN} screenshots · tier files ${range} (≤ ${COVER.maxBytes / 1000})${stale.length ? ` · ${stale.length} drawn, ${written} files written` : " · unchanged"}`;
}

if (process.argv[1]?.endsWith("covers.ts")) void coversStep(process.argv.includes("--force")).then((s) => console.log(`covers: ${s}`));
