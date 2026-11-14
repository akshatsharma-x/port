import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { content } from "@/content/index";
import nameFitJson from "@/content/name-fit.json";
import { nameFitCss, NameFitFileSchema, nameFitInputHash, nameLines, solveWdth } from "@/content/name-fit";
import { STAGE_FX } from "@/lib/fx-stage";
import { HERO, type LatticeSpec, type StageData } from "@/lib/hero";
import { apportion, constellationTarget, GLOBE_RADIUS, globeTarget, INT16, initialsTarget, isLand, latticeTarget } from "@/lib/hero-gen";
import { earthVector, facing, subsolarPoint } from "@/lib/sun";
import { TIERS } from "@/lib/tier";
import { landFraction, LANDMASK } from "../scripts/bake/landmask";
import { voidAndCluster } from "../scripts/bake/bluenoise";
import { section } from "./helpers/design";

/** A1 · HERO (DESIGN.md §4.3, §7.4): the morph targets, the sun, the name's fit, the stage FX. */
const ROOT = resolve(__dirname, "..");
const point = (t: Int16Array, i: number) => [0, 1, 2].map((k) => (t[i * 3 + k] ?? 0) / INT16) as [number, number, number];
const land = new Uint8Array(readFileSync(resolve(ROOT, LANDMASK.file)));

describe("morph targets", () => {
  it("apportion splits exactly n, in proportion", () => {
    const c = apportion(250_000, [0.72, 0.08, 0.16, 0.04]);
    expect(c.reduce((a, b) => a + b, 0)).toBe(250_000);
    expect(c).toEqual([180_000, 20_000, 40_000, 10_000]);
  });

  it("INITIALS: inside the glyphs, normalized to their box, deterministic", () => {
    // a 100 × 50 bar at (20, 10) in a 160 × 80 raster: aspect 2, every point within ±1 × ±0.5
    const W = 160;
    const H = 80;
    const alpha = new Uint8Array(W * H);
    for (let y = 10; y < 60; y++) for (let x = 20; x < 120; x++) alpha[y * W + x] = 255;
    const n = 20_000;
    const a = initialsTarget(n, { width: W, height: H, alpha }, 7);
    const b = initialsTarget(n, { width: W, height: H, alpha }, 7);
    expect(a.aspect).toBeCloseTo(2, 5);
    expect(Buffer.from(a.out.buffer).equals(Buffer.from(b.out.buffer))).toBe(true);
    let onEdge = 0;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = point(a.out, i);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(0.5 + 1e-3);
      expect(Math.abs(z)).toBeLessThanOrEqual(HERO.initials.depth + 1e-3);
      if (Math.abs(Math.abs(x) - 1) < 0.02 || Math.abs(Math.abs(y) - 0.5) < 0.02) onEdge++;
    }
    // the outline share, plus the interior points that happen to fall within 2% of it
    expect(onEdge / n).toBeGreaterThan(HERO.initials.edgeShare * 0.9);
  });

  it("CONSTELLATION: blobs on the papers, dots along the edges, a faint sky", () => {
    const graph: StageData["graph"] = {
      nodes: [
        { topic: [-5, 0, 0], year: [0, 0, 0], venue: [0, 0, 0], kind: 0, shape: 0, dashed: false, pubYear: 2024, citations: 100, featured: true },
        { topic: [5, 0, 0], year: [0, 0, 0], venue: [0, 0, 0], kind: 0, shape: 1, dashed: false, pubYear: 2025, citations: 0, featured: false },
      ],
      edges: [[0, 1, 1, 4]],
      labels: { topic: [], year: [], venue: [] },
    };
    const n = 30_000;
    const t = constellationTarget(n, graph, 3);
    let nearNodes = 0;
    let onEdge = 0;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = point(t, i);
      const r = HERO.constellation.radius;
      if (Math.min(Math.hypot(x + r, y, z), Math.hypot(x - r, y, z)) < 0.12) nearNodes++;
      else if (Math.abs(y) < 0.03 && Math.abs(z) < 0.03 && Math.abs(x) < r) onEdge++;
    }
    expect(nearNodes / n).toBeGreaterThan(HERO.constellation.nodes * 0.9);
    expect(onEdge / n).toBeGreaterThan(HERO.constellation.edges * 0.8);
  });

  it("GLOBE: on the sphere, land-weighted from the real mask, the city lit — and a prefix samples it fairly", () => {
    const n = 250_000;
    const city = { lat: 52.37, lon: 4.9 };
    const t = globeTarget(n, land, city, 11);
    const landShare = (count: number) => {
      let onLand = 0;
      for (let i = 0; i < count; i++) {
        const [x, y, z] = point(t, i);
        const r = Math.hypot(x, y, z);
        const lat = (Math.asin(y / r) * 180) / Math.PI;
        const lon = (Math.atan2(x, z) * 180) / Math.PI;
        if (isLand(land, lat, lon)) onLand++;
      }
      return onLand / count;
    };
    for (let i = 0; i < 5000; i++) {
      const [x, y, z] = point(t, i);
      expect(Math.hypot(x, y, z)).toBeGreaterThan(GLOBE_RADIUS * 0.985);
      expect(Math.hypot(x, y, z)).toBeLessThan(GLOBE_RADIUS * 1.06);
    }
    const all = landShare(n);
    // land + the graticule's and the city's share that falls on land; well above the 29% a uniform sphere would show
    expect(all).toBeGreaterThan(HERO.globe.land);
    // the LOW tier draws the first 35k: the same picture
    expect(Math.abs(landShare(TIERS.LOW.heroParticles) - all)).toBeLessThan(0.015);
  });

  it("the land mask is the real Earth: 4 KB, 29% land by area, Amsterdam on land, mid-Atlantic not", () => {
    expect(land.byteLength).toBe(4096);
    expect(landFraction(land)).toBeGreaterThan(0.27);
    expect(landFraction(land)).toBeLessThan(0.31);
    expect(isLand(land, 52.37, 4.9)).toBe(true);
    expect(isLand(land, 30, -40)).toBe(false);
  });

  it("GRID LATTICE: the page's own columns, in NDC, the About layout flagged", () => {
    const spec: LatticeSpec = {
      width: 1440,
      height: 900,
      columns: Array.from({ length: 12 }, (_, i) => [80 + i * 110, 80 + i * 110 + 86] as [number, number]),
      baseline: 8,
      blocks: [{ x: 80, y: 200, w: 526, h: 600 }],
      lines: [{ x: 740, y: 230, w: 600 }],
    };
    const n = 40_000;
    const t = latticeTarget(n, spec, 5);
    const edges = new Set(spec.columns.flat());
    let onRule = 0;
    let flagged = 0;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = point(t, i);
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
      const px = Math.round(((x + 1) / 2) * spec.width);
      if ([...edges].some((e) => Math.abs(e - px) <= 1)) onRule++;
      if (z > 0.5) flagged++;
    }
    expect(onRule / n).toBeGreaterThan(HERO.lattice.rules * 0.9);
    expect(flagged / n).toBeCloseTo(HERO.lattice.blocks, 1);
  });
});

describe("the sun (NOAA's general solar position)", () => {
  it("stands over the tropics at the solstices and the equator at the equinox", () => {
    expect(subsolarPoint(new Date("2026-06-21T12:00:00Z")).lat).toBeCloseTo(23.44, 0);
    expect(subsolarPoint(new Date("2026-12-21T12:00:00Z")).lat).toBeCloseTo(-23.43, 0);
    // the 2026 March equinox; NOAA's general equations are good to about ±0.5° (measured: 0.42°)
    expect(Math.abs(subsolarPoint(new Date("2026-03-20T14:46:00Z")).lat)).toBeLessThan(0.5);
  });
  it("is over Greenwich near noon UTC (± the equation of time) and 15°/h west after", () => {
    const noon = subsolarPoint(new Date("2026-04-15T12:00:00Z")).lon;
    expect(Math.abs(noon)).toBeLessThan(5);
    const later = subsolarPoint(new Date("2026-04-15T14:00:00Z")).lon;
    expect(noon - later).toBeCloseTo(30, 0);
  });
  it("faces the city to the viewer, above center, north up", () => {
    const R = facing(52.37, 4.9, 18);
    const c = earthVector(52.37, 4.9);
    const v = [0, 1, 2].map((r) => (R[r * 3] ?? 0) * c[0] + (R[r * 3 + 1] ?? 0) * c[1] + (R[r * 3 + 2] ?? 0) * c[2]);
    expect(v[0]).toBeCloseTo(0, 6);
    expect(v[1]).toBeCloseTo(Math.sin((18 * Math.PI) / 180), 6);
    expect(v[2]).toBeCloseTo(Math.cos((18 * Math.PI) / 180), 6);
  });
});

describe("the hero name's fit (content/name-fit.json)", () => {
  const fit = NameFitFileSchema.parse(nameFitJson);
  it("was measured for the current name, face, weight, tracking, size and margins", () => {
    expect(fit.text).toBe(content.profile.name.toUpperCase());
    expect(fit.lines).toEqual(nameLines(fit.text).filter(Boolean));
    const tokens = readFileSync(resolve(ROOT, "styles/tokens.css"), "utf8");
    const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim() ?? "";
    const fontHash = createHash("sha256").update(readFileSync(resolve(ROOT, "app/fonts/HubotSans-Variable.woff2"))).digest("hex").slice(0, 16);
    const inputs = { text: fit.text, fontHash, weight: Number(token("wght-mega")), trackingEm: Number.parseFloat(token("tr-5")), step5: token("step-5"), margin: token("margin") };
    expect(fit.weight).toBe(inputs.weight);
    expect(fit.trackingEm).toBe(inputs.trackingEm);
    // stale → npx tsx scripts/fonts/name-fit.ts
    expect(fit.inputHash).toBe(nameFitInputHash(inputs));
  });
  it("solves wdth so the name fills the measure, clamped to the axis", () => {
    for (const [container, font] of [
      [1295, 124.2],
      [347, 42.16],
      [800, 80],
    ] as const) {
      const w = solveWdth(fit.oneLine, container, font);
      expect(w).toBeGreaterThanOrEqual(75);
      expect(w).toBeLessThanOrEqual(125);
      // linear between samples: the width at the solved wdth is the container
      const i = fit.oneLine.findIndex(([x]) => x >= w);
      const [w1, e1] = fit.oneLine[Math.max(1, i)] as [number, number];
      const [w0, e0] = fit.oneLine[Math.max(1, i) - 1] as [number, number];
      const em = e0 + ((w - w0) / (w1 - w0)) * (e1 - e0);
      if (w > 75 && w < 125) expect(Math.abs(em * font - container) / container).toBeLessThan(0.005);
    }
    expect(solveWdth(fit.oneLine, 10, 100)).toBe(75);
    expect(solveWdth(fit.oneLine, 1e6, 100)).toBe(125);
  });
  it("splits at the space nearest the middle", () => {
    expect(nameLines("NOOR HALVORSEN")).toEqual(["NOOR", "HALVORSEN"]);
    expect(nameLines("ADA LOVELACE KING")).toEqual(["ADA LOVELACE", "KING"]);
    expect(nameLines("PRINCE")).toEqual(["PRINCE"]);
  });
  it("paints the first frame from bands: rising wdth, the line break only below its viewport", () => {
    const css = nameFitCss(fit);
    expect(css.startsWith(".hero-name{--fit-wdth:")).toBe(true);
    const widths = [...css.matchAll(/--fit-wdth:([\d.]+)%/g)].map((m) => Number(m[1])).slice(1);
    expect(widths.every((w) => w >= 75 && w <= 125)).toBe(true);
    expect(css).toContain(`max-width:${fit.oneLineMinViewport - 0.02}px`);
  });
  it("carries the one-line width at wdth 125, which the name grows by once the axis is spent", () => {
    expect(nameFitCss(fit)).toContain(`--fit-em-max:${fit.oneLine.at(-1)?.[1]};`);
    expect(fit.oneLine.at(-1)?.[0]).toBe(125);
  });
});

describe("stage FX — DESIGN.md §5.2 = lib/fx-stage.ts", () => {
  const table = section(/^### 5\.2 /);
  const row = (name: string) => table.split("\n").find((l) => l.startsWith(`| ${name} |`)) ?? "";
  it("bloom: threshold, smoothing, intensity per theme, radius, mips per tier", () => {
    const r = row("Bloom");
    expect(r).toContain(`threshold ${STAGE_FX.bloom.threshold.toFixed(1)}`);
    expect(r).toContain(`smoothing ${STAGE_FX.bloom.smoothing}`);
    expect(r).toContain(`intensity ${STAGE_FX.bloom.intensity.phosphor}`);
    expect(r).toContain(`intensity ${STAGE_FX.bloom.intensity.amber}`);
    expect(r).toContain(`radius ${STAGE_FX.bloom.radius}`);
    expect(r).toContain(`${TIERS.HIGH.bloomMips} / ${TIERS.MID.bloomMips} / ${TIERS.LOW.bloomMips} mip levels`);
  });
  it("persistence, aberration, vignette", () => {
    expect(row("Phosphor persistence")).toContain(`decay ${STAGE_FX.persistence.phosphor} per 1/60 s`);
    expect(row("Phosphor persistence")).toContain(`${STAGE_FX.persistence.amber} — a longer trail`);
    expect(row("Chromatic aberration")).toContain(`${TIERS.HIGH.restChromaticAberrationPx} px at corners`);
    expect(row("Chromatic aberration")).toContain(`≤ ${STAGE_FX.aberration.flingPx} px on fling`);
    expect(row("Vignette")).toContain(`offset ${STAGE_FX.vignette.offset}, darkness ${STAGE_FX.vignette.darkness}`);
    expect(row("Vignette")).toContain(`multiply ${STAGE_FX.vignette.paper}`);
  });
  it("the blue-noise tile is a permutation: every threshold once", () => {
    const rank = voidAndCluster(16, 1.5, 1, 0.1);
    expect(new Set(rank).size).toBe(256);
    expect(Math.max(...rank)).toBe(255);
  });
});
