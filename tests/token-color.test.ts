import { describe, expect, it } from "vitest";
import { cssToLinear, labToLinear, luminanceOf, oklchToLinear, parseLab, parseOklch } from "@/lib/color";
import { mediaRule, readCss } from "./helpers/css";

/**
 * What a P3 screen's computed style returns for §2.3's upgrades, and that the GL colors read it
 * (lib/token-color.ts). Next's CSS minifier (Lightning CSS, Next 16.4.6) writes each authored oklch()
 * as a hex fallback plus lab() under `@supports (color: lab(0% 0 0))`. These are its strings, copied
 * from the production build's CSS (Part 15). Until then only oklch() was read, and lab() fell through
 * to white: on every P3 screen the scenes drew the accent white.
 */
const BUILT = [
  { theme: "phosphor", token: "--accent", lab: "lab(88.1362% -82.5776 39.2435)" },
  { theme: "phosphor", token: "--hot", lab: "lab(57.1852% 92.9888 5.00742)" },
  { theme: "amber", token: "--accent", lab: "lab(77.9702% 25.5613 99.183)" },
] as const;
const css = readCss("styles/tokens.css");

describe("the P3 upgrades as the build writes them (lab())", () => {
  for (const { theme, token, lab } of BUILT) {
    it(`${theme} ${token}: ${lab} is the authored oklch(), to 1e-5 in linear light`, () => {
      // the authored value, so a changed token flags this fixture as stale
      const authored = mediaRule(css, "color-gamut: p3", `[data-theme="${theme}"]`)[token] ?? "";
      const ok = parseOklch(authored);
      expect(ok, `${theme} ${token} is authored as oklch()`).not.toBeNull();
      const want = oklchToLinear(ok ?? { L: 0, C: 0, H: 0 });
      const got = cssToLinear(lab);
      expect(got).not.toBeNull();
      got?.forEach((v, i) => expect(Math.abs(v - (want[i] ?? 0)), `channel ${i}`).toBeLessThan(1e-5));
      expect(luminanceOf(lab)).toBeCloseTo(luminanceOf(authored), 5);
    });
  }

  it("parses the minifier's numbers: a percent lightness, signs, no leading zero", () => {
    expect(parseLab("lab(23.3593% -.739083 -7.32878)")).toEqual([23.3593, -0.739083, -7.32878]);
    expect(parseLab("  lab(50 10 -20)  ")).toEqual([50, 10, -20]);
    expect(parseLab("oklab(0.5 0.1 0.1)")).toBeNull();
  });

  it("Lab's white and black are sRGB's (D50 → D65)", () => {
    labToLinear([100, 0, 0]).forEach((v) => expect(v).toBeCloseTo(1, 4));
    labToLinear([0, 0, 0]).forEach((v) => expect(v).toBeCloseTo(0, 6));
  });

  it("reads hex and oklch() as before, and nothing else", () => {
    expect(cssToLinear("#ffffff")).toEqual([1, 1, 1]);
    expect(cssToLinear("oklch(100% 0 0)")?.every((v) => Math.abs(v - 1) < 1e-6)).toBe(true);
    expect(cssToLinear("color(display-p3 0 1 0)")).toBeNull();
  });
});
