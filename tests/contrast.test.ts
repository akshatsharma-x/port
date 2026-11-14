import { describe, expect, it } from "vitest";
import { contrast, contrastOf, formatOklch, hexToOklch, inP3, parseOklch } from "@/lib/color";
import { mediaRule, readCss, themeBlock } from "./helpers/css";
import { ratioCell, table } from "./helpers/design";

/**
 * DESIGN.md §2.3, re-derived from styles/tokens.css: every token's hex and OKLCH, every
 * contrast ratio in the tables, the AA floors on every surface, and the Display-P3 upgrades.
 */
const css = readCss("styles/tokens.css");
const SURFACES = ["--bg", "--bg-raised", "--bg-sunken", "--bg-band"] as const;
const TEXT = ["--fg-1", "--fg-2", "--fg-3", "--accent", "--hot", "--warn"] as const;
const GRAPHIC = ["--line-2", "--accent-fill"] as const;
const THEMES = [
  { id: "phosphor", heading: /^#### PHOSPHOR\b/ },
  { id: "amber", heading: /^#### AMBER\b/ },
  { id: "paper", heading: /^#### PAPER\b/ },
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;
const worstOn = (tokens: Record<string, string>, token: string) =>
  Math.min(...SURFACES.map((s) => contrast(tokens[token] ?? "", tokens[s] ?? "")));

for (const theme of THEMES) {
  describe(`${theme.id} — DESIGN.md §2.3`, () => {
    const tokens = themeBlock(css, theme.id);
    const rows = table(theme.heading);

    it("defines every DESIGN.md color token with the exact hex", () => {
      expect(rows.length).toBe(15);
      for (const [name, hex] of rows) {
        expect(tokens[name ?? ""]?.toUpperCase(), name).toBe(hex?.toUpperCase());
      }
    });

    it("documents the true OKLCH of every hex", () => {
      for (const [name, hex, oklch] of rows) {
        const want = parseOklch(oklch ?? "");
        const got = hexToOklch(hex ?? "");
        expect(want, name).not.toBeNull();
        expect(Math.abs(got.L - (want?.L ?? 0)), `${name} L`).toBeLessThan(0.0006);
        expect(Math.abs(got.C - (want?.C ?? 0)), `${name} C`).toBeLessThan(0.0006);
        if ((want?.C ?? 0) > 0) expect(formatOklch(hex ?? ""), name).toBe(oklch);
      }
    });

    it("reproduces every contrast ratio in the table (vs --bg and worst surface)", () => {
      for (const [name, , , vsBg, worst] of rows) {
        const token = name ?? "";
        const docVsBg = ratioCell(vsBg);
        const docWorst = ratioCell(worst);
        if (docVsBg !== null) expect(r2(contrast(tokens[token] ?? "", tokens["--bg"] ?? "")), `${token} vs --bg`).toBe(docVsBg);
        if (docWorst === null) continue;
        if (token === "--on-accent") expect(r2(contrast(tokens[token] ?? "", tokens["--accent"] ?? "")), `${token} on --accent`).toBe(docWorst);
        else expect(r2(worstOn(tokens, token)), `${token} worst surface`).toBe(docWorst);
      }
    });

    it("keeps every text token ≥ 4.5:1 on every surface", () => {
      for (const t of TEXT) expect(worstOn(tokens, t), t).toBeGreaterThanOrEqual(4.5);
    });

    it("keeps control boundaries and graphical fills ≥ 3:1 on every surface", () => {
      for (const t of GRAPHIC) expect(worstOn(tokens, t), t).toBeGreaterThanOrEqual(3);
    });

    it("keeps the pairings the primitives use ≥ 4.5:1", () => {
      expect(contrast(tokens["--on-accent"] ?? "", tokens["--accent"] ?? ""), "primary button").toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--accent"] ?? "", tokens["--accent-wash"] ?? ""), "pressed chip").toBeGreaterThanOrEqual(4.5);
      expect(tokens["--focus"]).toBe("var(--accent)");
    });
  });
}

describe("Display-P3 upgrades — DESIGN.md §2.3", () => {
  const rows = table(/^#### Wide gamut/);

  it("ships each documented upgrade, in gamut, at the documented contrast", () => {
    expect(rows.length).toBe(3);
    for (const [themeName, token, srgb, p3, vsBg] of rows) {
      const id = (themeName ?? "").toLowerCase();
      const value = mediaRule(css, "color-gamut: p3", `[data-theme="${id}"]`)[token ?? ""] ?? "";
      const got = parseOklch(value);
      const want = parseOklch(p3 ?? "");
      expect(got, `${id} ${token}`).not.toBeNull();
      expect(got?.L).toBeCloseTo(want?.L ?? 0, 6);
      expect(got?.C).toBeCloseTo(want?.C ?? 0, 6);
      expect(got?.H).toBeCloseTo(want?.H ?? 0, 6);
      expect(inP3(got ?? { L: 0, C: 0, H: 0 }), `${id} ${token} in P3`).toBe(true);
      expect(themeBlock(css, id)[token ?? ""]?.toUpperCase()).toBe(srgb?.toUpperCase());
      expect(r2(contrastOf(value, themeBlock(css, id)["--bg"] ?? "")), `${id} ${token} vs --bg`).toBe(ratioCell(vsBg));
    }
  });
});
