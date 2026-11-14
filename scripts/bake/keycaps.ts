/**
 * keycaps (DESIGN.md §8.2, §4.3 A5) → public/textures/keycaps-legends.webp, public/textures/
 * matcap-{phosphor,amber,paper}.webp + content/keycaps-atlas.json.
 *
 * The legend atlas: 1024² lossless WebP (≤ 90 KB), a square cell per skill in content order. Each
 * legend is the technology's mark from the CC0 Simple Icons set (the content names its slug) over
 * its label in the site's mono face — or, without a mark, the label alone as a monogram. White on
 * clear: the shader prints its coverage as a backlit legend on the tubes, a dye-sublimated one on
 * Paper. Drawn in the installed Chrome, encoded exactly by sharp.
 *
 * The matcaps: one 256² per theme (≤ 12 KB), computed here — a lit sphere of neutral plastic under
 * that theme's light: a cool key and a phosphor rim, a warm one, or daylight for Paper. The cap's
 * colour multiplies in the shader.
 *
 * It redraws only when its input hash changes (the legends, the marks, the face, the light);
 * tests/capabilities.test.ts recomputes it.
 *
 *   npx tsx scripts/bake/keycaps.ts [--force]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import * as simpleIcons from "simple-icons";
import { derived } from "../../content/derive";
import { KEYS } from "../../lib/capabilities";
import { BakeError, formatJson, ROOT, writeIfChanged } from "./lib";

export const KEYCAPS_JSON = "content/keycaps-atlas.json";
export const LEGENDS_OUT = "public/textures/keycaps-legends.webp";
export const MATCAP_THEMES = ["phosphor", "amber", "paper"] as const;
export const matcapOut = (theme: (typeof MATCAP_THEMES)[number]) => `public/textures/matcap-${theme}.webp`;
const FONT = "app/fonts/JetBrainsMono-Variable.woff2";
/** bump when a cell's layout or a matcap's light changes */
const LOOK_VERSION = 1;

export interface LegendSpec {
  slug: string;
  label: string;
  /** the mark's SVG path (Simple Icons' 24 × 24 box), or null: a monogram */
  path: string | null;
  icon: string | null;
  cell: number;
}

type Icon = { slug: string; path: string; title: string };
const ICONS = new Map((Object.values(simpleIcons) as unknown[]).filter((x): x is Icon => !!x && typeof x === "object" && "slug" in x && "path" in x).map((i) => [i.slug, i]));

/** Every skill's legend, in content order; a slug Simple Icons doesn't carry fails the build. */
export function legendSpecs(): LegendSpec[] {
  const cap = KEYS.atlas.cols * KEYS.atlas.cols;
  if (derived.skills.all.length > Math.min(KEYS.maxKeys, cap)) throw new BakeError(`keycaps: ${derived.skills.all.length} skills, but the pile holds ${Math.min(KEYS.maxKeys, cap)} (DESIGN.md §4.3 A5)`);
  return derived.skills.all.map((s, cell) => {
    const icon = s.legend.icon ?? null;
    const mark = icon ? ICONS.get(icon) : undefined;
    if (icon && !mark) throw new BakeError(`keycaps: Simple Icons has no "${icon}" (skill ${s.name})`);
    return { slug: s.slug, label: s.legend.label, path: mark?.path ?? null, icon, cell };
  });
}

const fnv = (input: string): string => {
  let h = 0x811c9dc5;
  for (const ch of input) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

export function keycapsInputHash(specs: readonly LegendSpec[], fontHash: string): string {
  return fnv(JSON.stringify({ look: LOOK_VERSION, atlas: KEYS.atlas, matcap: KEYS.matcap, legends: specs.map((s) => [s.label, s.path]), fontHash }));
}

async function drawLegends(specs: LegendSpec[]): Promise<Buffer> {
  const font = readFileSync(join(ROOT, FONT)).toString("base64");
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>@font-face{font-family:Mono;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 800}</style><canvas id=c></canvas>`);
    await page.evaluate("window.__name = (f) => f");
    await page.evaluate(() => document.fonts.load('600 40px "Mono"'));
    return Buffer.from(
      (await page.evaluate(
        ({ specs, size, cols }) => {
          const canvas = document.getElementById("c") as HTMLCanvasElement;
          canvas.width = size;
          canvas.height = size;
          const g = canvas.getContext("2d") as CanvasRenderingContext2D;
          g.clearRect(0, 0, size, size);
          g.fillStyle = "#fff";
          g.textAlign = "center";
          g.textBaseline = "middle";
          const cell = size / cols;
          for (const s of specs) {
            const x0 = (s.cell % cols) * cell;
            const y0 = Math.floor(s.cell / cols) * cell;
            const label = s.label.toUpperCase();
            if (s.path) {
              // the mark above, the label below it
              const m = cell * 0.4;
              g.save();
              g.translate(x0 + (cell - m) / 2, y0 + cell * 0.16);
              g.scale(m / 24, m / 24);
              g.fill(new Path2D(s.path));
              g.restore();
              const px = Math.round(cell * (label.length > 4 ? 0.13 : 0.155));
              g.font = `600 ${px}px "Mono"`;
              if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px * 0.06}px`;
              g.fillText(label, x0 + cell / 2, y0 + cell * 0.78, cell * 0.86);
            } else {
              // a monogram: the label alone, large
              const px = Math.round(cell * (label.length <= 3 ? 0.3 : label.length <= 4 ? 0.24 : 0.19));
              g.font = `700 ${px}px "Mono"`;
              if ("letterSpacing" in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px * 0.04}px`;
              g.fillText(label, x0 + cell / 2, y0 + cell * 0.52, cell * 0.86);
            }
          }
          return canvas.toDataURL("image/png").split(",")[1] as string;
        },
        { specs, size: KEYS.atlas.size, cols: KEYS.atlas.cols },
      )) as string,
      "base64",
    );
  } finally {
    await browser.close();
  }
}

/**
 * A lit sphere of neutral plastic, 256², sRGB: a key light, a soft fill, a specular lobe and a rim,
 * per theme. The rim carries the tube's tint (phosphor green, amber); daylight has none.
 */
export function matcapPixels(theme: (typeof MATCAP_THEMES)[number], size: number = KEYS.matcap.size): Buffer {
  const L = theme === "paper" ? { key: [-0.35, 0.55, 0.76], ambient: 0.62, diffuse: 0.42, spec: 0.18, shine: 18, rim: 0.08, tint: [1, 1, 1] } : { key: [-0.45, 0.62, 0.64], ambient: 0.16, diffuse: 0.72, spec: 0.55, shine: 42, rim: 0.42, tint: theme === "amber" ? [1, 0.72, 0.36] : [0.55, 1, 0.75] };
  const [kx, ky, kz] = L.key as [number, number, number];
  const kl = Math.hypot(kx, ky, kz);
  const out = Buffer.alloc(size * size * 3);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 - 1;
      const y = 1 - ((j + 0.5) / size) * 2;
      const r2 = x * x + y * y;
      const z = r2 < 1 ? Math.sqrt(1 - r2) : 0;
      const nd = Math.max(0, (x * kx + y * ky + z * kz) / kl);
      // Blinn half vector between the key light and the viewer (0, 0, 1)
      const hx = kx / kl;
      const hy = ky / kl;
      const hz = kz / kl + 1;
      const hl = Math.hypot(hx, hy, hz);
      const spec = Math.max(0, (x * hx + y * hy + z * hz) / hl) ** L.shine;
      const rim = (1 - z) ** 3;
      const base = L.ambient + L.diffuse * nd;
      const o = (j * size + i) * 3;
      for (let c = 0; c < 3; c++) {
        const v = base + L.spec * spec + L.rim * rim * (L.tint[c] ?? 1);
        // to sRGB-ish 8 bits (the shader treats the matcap as sRGB)
        out[o + c] = Math.round(255 * Math.min(1, Math.max(0, v)) ** (1 / 2.2));
      }
    }
  }
  return out;
}

export async function keycapsStep(force = false): Promise<string> {
  const specs = legendSpecs();
  const fontHash = createHash("sha256").update(readFileSync(join(ROOT, FONT))).digest("hex").slice(0, 16);
  const inputHash = keycapsInputHash(specs, fontHash);
  const files = [LEGENDS_OUT, ...MATCAP_THEMES.map(matcapOut), KEYCAPS_JSON];
  if (!force && files.every((f) => existsSync(join(ROOT, f)))) {
    const prev = JSON.parse(readFileSync(join(ROOT, KEYCAPS_JSON), "utf8")) as { inputHash?: string };
    if (prev.inputHash === inputHash) return `${specs.length} legends (${specs.filter((s) => s.path).length} marks) · ${MATCAP_THEMES.length} matcaps · fresh (${inputHash}) · unchanged`;
  }
  const png = await drawLegends(specs);
  const webp = await sharp(png).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  if (webp.length > KEYS.atlas.maxBytes) throw new BakeError(`keycaps: the legend atlas is ${(webp.length / 1000).toFixed(1)} KB, over A5's ${KEYS.atlas.maxBytes / 1000} (DESIGN.md §4.3 A5)`);
  await writeIfChanged(join(ROOT, LEGENDS_OUT), webp);
  const sizes: Record<string, number> = {};
  for (const theme of MATCAP_THEMES) {
    const m = await sharp(matcapPixels(theme), { raw: { width: KEYS.matcap.size, height: KEYS.matcap.size, channels: 3 } }).webp({ quality: 82, effort: 6 }).toBuffer();
    if (m.length > KEYS.matcap.maxBytes) throw new BakeError(`keycaps: the ${theme} matcap is ${(m.length / 1000).toFixed(1)} KB, over A5's ${KEYS.matcap.maxBytes / 1000}`);
    await writeIfChanged(join(ROOT, matcapOut(theme)), m);
    sizes[theme] = m.length;
  }
  await writeIfChanged(join(ROOT, KEYCAPS_JSON), formatJson({ version: 1, inputHash, fontHash, cols: KEYS.atlas.cols, legends: specs.map(({ slug, label, icon, cell }) => ({ slug, label, icon, cell })), bytes: { legends: webp.length, ...sizes } }));
  return `${specs.length} legends (${specs.filter((s) => s.path).length} marks, ${specs.filter((s) => !s.path).length} monograms) · ${KEYS.atlas.size}² lossless WebP ${(webp.length / 1000).toFixed(1)} KB (≤ ${KEYS.atlas.maxBytes / 1000}) · matcaps ${MATCAP_THEMES.map((t) => `${((sizes[t] ?? 0) / 1000).toFixed(1)}`).join(" / ")} KB`;
}

if (process.argv[1]?.endsWith("keycaps.ts")) void keycapsStep(process.argv.includes("--force")).then((s) => console.log(`keycaps: ${s}`));
