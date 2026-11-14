import type { StageData } from "@/lib/hero";

/**
 * The mounts' print (DESIGN.md §4.3 A4: "each mount, drawn in-shader: mono index, title, year,
 * category"): two rows a slide on one canvas — the top band its number and category, the bottom
 * its title, and its year once the content has one — in the page's own mono face. The shader
 * prints its coverage in the theme's ink. Drawn once when the scene primes.
 */
/**
 * A row spans the window's width at this aspect (its height over its width), so the print never
 * stretches; the text is `size` of the row. The atlas is as wide as the tier's covers, one channel.
 */
export const PRINT = { row: 96 / 1024, size: 44 / 1024, tracking: 0.12 } as const;

type Slide = StageData["work"]["slides"][number];

/** The print's coverage, one byte a pixel, rows top to bottom (R8: a sixteenth of an RGBA canvas). */
export interface PrintAtlas {
  data: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
}

export async function drawPrint(slides: readonly Slide[], width: number): Promise<PrintAtlas> {
  const rowPx = Math.round(width * PRINT.row);
  const sizePx = Math.round(width * PRINT.size);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = rowPx * 2 * Math.max(1, slides.length);
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const empty = { data: new Uint8Array(new ArrayBuffer(canvas.width * canvas.height)), width: canvas.width, height: canvas.height };
  if (!g) return empty;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--ff-mono").trim() || "monospace";
  const font = `500 ${sizePx}px ${family}`;
  try {
    await document.fonts.load(font);
  } catch {
    /* the fallback mono prints instead */
  }
  g.font = font;
  g.fillStyle = "#fff";
  g.textBaseline = "middle";
  if ("letterSpacing" in g) g.letterSpacing = `${sizePx * PRINT.tracking}px`;
  const fit = (text: string, max: number) => {
    if (g.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  };
  slides.forEach((s, k) => {
    const y0 = k * 2 * rowPx + rowPx / 2;
    const y1 = y0 + rowPx;
    g.textAlign = "left";
    g.fillText(s.number, 0, y0);
    g.textAlign = "right";
    g.fillText(fit(s.category.toUpperCase(), width * 0.62), width, y0);
    const year = s.year === null ? "" : String(s.year);
    g.textAlign = "left";
    g.fillText(fit(s.title.toUpperCase(), width - (year ? g.measureText(year).width + sizePx * 2 : 0)), 0, y1);
    if (year) {
      g.textAlign = "right";
      g.fillText(year, width, y1);
    }
  });
  // the coverage only: the shader prints it in the theme's ink
  const rgba = g.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < empty.data.length; i++) empty.data[i] = rgba[i * 4 + 3] ?? 0;
  return empty;
}
