import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cssEase, duration, EASE_NAMES, ease } from "@/lib/motion";
import { THEME_BG, THEMES } from "@/lib/tokens";
import { block, mediaRule, readCss, themeBlock } from "./helpers/css";
import { table } from "./helpers/design";

/** Everything in styles/tokens.css that isn't a color, checked against DESIGN.md and lib/. */
const css = readCss("styles/tokens.css");
const root = block(css, ":root");
const norm = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

describe("type scale — DESIGN.md §2.6", () => {
  const rows = table(/^### 2\.6 /);
  it("has 8 steps with the documented clamp() and line height", () => {
    expect(rows.length).toBe(8);
    for (const [step, , clamp, , , , lh] of rows) {
      const n = (step ?? "").replace("--step-", "");
      expect(norm(root[step ?? ""]), step).toBe(norm(clamp));
      expect(root[`--lh-${n}`], `${step} line height`).toBe(lh);
    }
  });
});

describe("fluid layout tokens — DESIGN.md §2.7", () => {
  const rows = table(/^### 2\.7 /);
  it("matches every documented clamp()", () => {
    expect(rows.length).toBe(5);
    for (const [token, , clamp] of rows) expect(norm(root[token ?? ""]), token).toBe(norm(clamp));
  });
});

describe("radii — DESIGN.md §2.8", () => {
  const rows = table(/^### 2\.8 /);
  it("matches every documented radius", () => {
    for (const [token, value] of rows) expect(root[token ?? ""], token).toBe(value);
  });
});

describe("easing — DESIGN.md §3.2 = lib/motion.ts = tokens.css", () => {
  const rows = table(/^### 3\.2 /).filter((r) => (r[1] ?? "").startsWith("("));
  it("documents the same five curves lib/motion.ts exports", () => {
    expect(rows.map((r) => r[0])).toEqual(EASE_NAMES);
    for (const [name, curve] of rows) {
      const nums = (curve ?? "").replace(/[()]/g, "").split(",").map(Number);
      expect(nums, name).toEqual([...ease[name as keyof typeof ease]]);
    }
  });
  it("mirrors each curve as a --ease-* custom property", () => {
    for (const name of EASE_NAMES) expect(norm(root[`--ease-${name}`]), name).toBe(cssEase(name));
  });
});

describe("duration tiers — DESIGN.md §3.4 = lib/motion.ts = tokens.css", () => {
  const rows = table(/^### 3\.4 /);
  it("matches in and out for every tier", () => {
    expect(rows.length).toBe(3);
    for (const [tier, inMs, outMs] of rows) {
      const t = duration[tier as keyof typeof duration];
      expect(t.in, `${tier} in`).toBe(Number.parseInt(inMs ?? "", 10));
      expect(t.out, `${tier} out`).toBe(Number.parseInt(outMs ?? "", 10));
      expect(root[`--dur-${tier}`]).toBe(`${t.in}ms`);
      expect(root[`--dur-${tier}-out`]).toBe(`${t.out}ms`);
    }
  });
});

describe("theme plumbing", () => {
  it("prints as Paper: the print block repeats the Paper colors exactly", () => {
    const paper = themeBlock(css, "paper");
    const print = mediaRule(css, "print", "[data-theme][data-theme]");
    for (const [k, v] of Object.entries(paper)) {
      if (k.startsWith("--") && v.startsWith("#")) expect(print[k], `print ${k}`).toBe(v);
    }
  });

  it("keeps lib/tokens.ts THEME_BG equal to each theme's --bg", () => {
    for (const t of THEMES) expect(themeBlock(css, t)["--bg"]).toBe(THEME_BG[t]);
  });

  it("maps every semantic color to a Tailwind utility", () => {
    const theme = readFileSync(resolve(__dirname, "../styles/theme.css"), "utf8");
    for (const k of Object.keys(themeBlock(css, "phosphor")).filter((n) => n.startsWith("--") && !n.startsWith("--wght") && n !== "--glow")) {
      expect(theme, k).toContain(`--color-${k.slice(2)}: var(${k});`);
    }
  });

  it("never upgrades :root to P3 (it would leak the Phosphor accent into Paper)", () => {
    expect(css.some((r) => r.media?.includes("color-gamut") && r.selector.includes(":root"))).toBe(false);
  });
});
