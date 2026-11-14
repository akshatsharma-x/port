import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { derived } from "@/content/derive";
import { CARD, decode, PUNCH_ROWS } from "@/lib/hollerith";
import { ATLAS_DPI, atlasCell, cardText, LOG, MAX_ROLE_CARDS, MAX_SLOTS } from "@/lib/log";
import { SHAFT_VERT } from "@/shaders/log";
import { ATLAS_JSON, ATLAS_OUT, atlasCards, atlasInputHash } from "../scripts/bake/atlases";
import { section } from "./helpers/design";

/** A2 · LOG (DESIGN.md §4.3 A2, §7.4): the deck's cards, its atlas, and the numbers in the bible. */
const ROOT = resolve(__dirname, "..");

describe("the LOG deck", () => {
  it("prints each role's company and years, as a keypunch writes them", () => {
    expect(cardText({ company: "United Airlines", start: "2026-06", end: "present" }, "Present")).toBe("UNITED AIRLINES 2026-PRESENT");
    expect(cardText({ company: "WalkingTree Technologies", start: "2025-07", end: "2025-08" }, "Present")).toBe("WALKINGTREE TECHNOLOGIES 2025");
    expect(cardText({ company: "Truechip Solutions", start: "2025-12", end: "2026-01" }, "Present")).toBe("TRUECHIP SOLUTIONS 2025-2026");
  });

  it("holds DESIGN.md's ≤ 12 cards: every role a slot between the leaders, an atlas cell each", () => {
    expect(MAX_ROLE_CARDS).toBe(12);
    expect(section(/^#### A2/)).toContain(`≤ ${MAX_ROLE_CARDS} cards`);
    expect(MAX_ROLE_CARDS + 2 * LOG.leaders).toBeLessThanOrEqual(MAX_SLOTS);
    expect(MAX_ROLE_CARDS).toBeLessThan(LOG.atlas.cols * LOG.atlas.rows); // the blank keeps its cell
    expect(SHAFT_VERT).toContain(`#define MAX_CARDS ${MAX_SLOTS}`);
    expect(derived.experience.length).toBeLessThanOrEqual(MAX_ROLE_CARDS);
  });

  it("deals the roles newest first: a role still running leads", () => {
    expect(derived.experience[0]?.end).toBe("present");
    expect(atlasCards().filter((c) => c.slug !== "leader").map((c) => c.slug)).toEqual(derived.experience.map((e) => e.slug));
  });
});

describe("the card atlas (public/textures/log-cards.webp)", () => {
  const meta = JSON.parse(readFileSync(resolve(ROOT, ATLAS_JSON), "utf8")) as { inputHash: string; cards: { slug: string; text: string; cell: number }[] };

  it("is fresh for the content, the face and the layout (npx tsx scripts/bake/atlases.ts if not)", () => {
    const fontHash = createHash("sha256").update(readFileSync(resolve(ROOT, "app/fonts/JetBrainsMono-Variable.woff2"))).digest("hex").slice(0, 16);
    expect(meta.inputHash).toBe(atlasInputHash(atlasCards(), fontHash));
  });

  it("is 2048 × 1024 lossless WebP within 300 KB (§4.3 A2)", async () => {
    const m = await sharp(resolve(ROOT, ATLAS_OUT)).metadata();
    expect([m.format, m.width, m.height, m.hasAlpha]).toEqual(["webp", LOG.atlas.width, LOG.atlas.height, true]);
    expect(statSync(resolve(ROOT, ATLAS_OUT)).size).toBeLessThanOrEqual(300_000);
  });

  it("punches real Hollerith: every card's holes, read back out of the pixels, decode to its printed text", async () => {
    const { data, info } = await sharp(resolve(ROOT, ATLAS_OUT)).raw().toBuffer({ resolveWithObject: true });
    const cellW = LOG.atlas.width / LOG.atlas.cols;
    const cellH = LOG.atlas.height / LOG.atlas.rows;
    for (const card of meta.cards) {
      const [cx, cy] = atlasCell(card.cell);
      const ox = cx * cellW + Math.round((cellW - LOG.atlas.card.width) / 2);
      const oy = cy * cellH + Math.round((cellH - LOG.atlas.card.height) / 2);
      const columns = Array.from({ length: CARD.columns }, (_, c) => {
        let m = 0;
        PUNCH_ROWS.forEach((_, r) => {
          const x = Math.round(ox + (CARD.firstColumn + c * CARD.columnPitch) * ATLAS_DPI);
          const y = Math.round(oy + (CARD.firstRow + r * CARD.rowPitch) * ATLAS_DPI);
          const alpha = data[(y * info.width + x) * 4 + 3] ?? 255;
          if (alpha < 32) m |= 1 << r;
        });
        return m;
      });
      expect(decode(columns)).toBe(card.text);
    }
  });
});

describe("DESIGN.md §4.3 A2 = lib/log.ts", () => {
  const a2 = section(/^#### A2 /);
  it("the card's proportions, the bank, the cell count and the atlas", () => {
    expect(a2).toContain("7⅜ × 3¼ in = 2.27:1");
    expect((CARD.width / CARD.height).toFixed(2)).toBe("2.27");
    expect(a2).toContain(`banks ±${LOG.camera.bankDeg}°`);
    expect(a2).toContain(`(${LOG.atlas.width}×${LOG.atlas.height})`);
    expect(a2).toContain("≤ 12 cards");
  });
});
