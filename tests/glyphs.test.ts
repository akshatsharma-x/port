import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DESIGN.md §2.10: UI marks are set in mono and must exist in the baked JetBrains Mono — a mark
 * the font doesn't carry would silently fall back to a system font and look different on every
 * OS. Marks the fonts lack (✓ ○ ⏎ ✱ ⬢ ✚ ⌜⌝⌞⌟ …) are drawn with the pixel-grid SVG glyph set.
 */
const ROOT = resolve(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "app/fonts/manifest.json"), "utf8")) as {
  fonts: { id: string; codepoints: number[] }[];
};
const mono = new Set(manifest.fonts.find((f) => f.id === "jetbrains-mono")?.codepoints ?? []);

// Arrows, math operators, misc technical, box drawing, blocks, geometric shapes, misc symbols,
// dingbats, misc symbols & arrows.
const SYMBOL = /[←-⏿─-➿⬀-⯿]/gu;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(tsx?|mts)$/.test(name) ? [p] : [];
  });
}

const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("UI glyph coverage — DESIGN.md §2.10", () => {
  it("knows the baked mono font's coverage", () => {
    expect(mono.size).toBeGreaterThan(300);
    expect(mono.has(0x2192)).toBe(true); // →
  });

  it("uses only symbols that the baked JetBrains Mono can render", () => {
    const missing: string[] = [];
    for (const file of ["app", "components", "content"].flatMap((d) => sources(join(ROOT, d)))) {
      for (const ch of stripComments(readFileSync(file, "utf8")).match(SYMBOL) ?? []) {
        if (!mono.has(ch.codePointAt(0) ?? 0)) missing.push(`${ch} (U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase()}) in ${file.slice(ROOT.length + 1)}`);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
