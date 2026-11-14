import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import citationsJson from "@/content/citations.json";
import { derived } from "@/content/derive";
import { buildGraphModel } from "@/content/graph";
import { CitationsFileSchema, ContentSchema, GraphFileSchema, parseContent, VerifyFileSchema, type ContentInput } from "@/content/schema";
import { derive } from "@/content/selectors";
import { stageData } from "@/content/stage-data";
import verifyJson from "@/content/verify.json";
import { COVER, coverSrc, coverTierSrc } from "@/lib/covers";
import { duration, MAX_TIMED_MS, signature } from "@/lib/motion";
import { TIERS } from "@/lib/tier";
import { arcPitch, arcPose, coverNdc, flingAmount, gateDistance, landing, rubber, slideNumber, unrubber, WORK } from "@/lib/work";
import { COVERS_JSON, coverInputHash, coverSpecs, type CoversManifest } from "../scripts/bake/covers";
import { layoutGraph } from "../scripts/bake/layout-graph";
import { data } from "./fixtures/placeholder-content";

/** A4 · WORK (DESIGN.md §4.3 A4, §4.4 B4, §7.4): the rail's geometry and physics, the covers, the stage data, the cross-links. */
const ROOT = resolve(__dirname, "..");
const DEG = Math.PI / 180;

describe("the rail: a gently concave arc, the gate at its middle", () => {
  it("stands the gate slide square to the camera and its neighbours closer, turned toward it, symmetrically", () => {
    const gate = gateDistance(1.6, 35);
    const p = arcPitch(1.6);
    const g = arcPose(2, 2, gate, p);
    expect(g).toEqual({ x: 0, z: -gate, yaw: -0 });
    const left = arcPose(1, 2, gate, p);
    const right = arcPose(3, 2, gate, p);
    expect(right.x).toBeCloseTo(-left.x, 9);
    expect(right.z).toBeCloseTo(left.z, 9);
    expect(right.z).toBeGreaterThan(g.z); // concave: the edges come toward the viewer
    expect(right.yaw).toBeLessThan(0); // facing the arc's centre, behind the camera
    expect(Math.abs(right.yaw)).toBeLessThan(20 * DEG); // gently
  });

  it("frames the gate mount at its share of the slot: the tighter of width and height", () => {
    const tan = Math.tan(17.5 * DEG);
    for (const aspect of [1.6, 1.78, 2.4, 0.46]) {
      const d = gateDistance(aspect, 35);
      const heightShare = 1 / (2 * d * tan);
      const widthShare = 1 / (2 * d * tan * aspect);
      const f = WORK.arc.fill;
      const wantW = aspect < WORK.arc.portrait ? f.phoneWidth : f.width;
      expect(heightShare).toBeLessThanOrEqual(f.height + 1e-9);
      expect(widthShare).toBeLessThanOrEqual(wantW + 1e-9);
      expect(Math.max(heightShare / f.height, widthShare / wantW)).toBeCloseTo(1, 9);
    }
  });

  it("lands a release on the slide nearest where it would coast, never past the ends", () => {
    expect(landing(1.2, 0, 5)).toBe(1);
    expect(landing(1.2, 4, 5)).toBe(Math.round(1.2 + 4 * WORK.input.coastS));
    expect(landing(3.9, 40, 5)).toBe(4);
    expect(landing(0.4, -40, 5)).toBe(0);
  });

  it("gives way past either end like a rubber band, and undoes it exactly", () => {
    expect(rubber(2.5, 5)).toBe(2.5);
    expect(rubber(-1, 5)).toBeCloseTo(-WORK.input.rubber, 9);
    expect(rubber(5, 5)).toBeCloseTo(4 + WORK.input.rubber, 9);
    for (const x of [-2, -0.3, 0, 1.7, 4, 4.6, 7]) expect(unrubber(rubber(x, 5), 5)).toBeCloseTo(x, 9);
  });

  it("reads one fling amount for the smear, the whir and the aberration: 0 at rest, 1 at full speed and past it", () => {
    expect(flingAmount(0)).toBe(0);
    expect(flingAmount(WORK.fling.full / 2)).toBeCloseTo(0.5, 9);
    expect(flingAmount(-WORK.fling.full * 3)).toBe(1);
  });

  it("projects into object-fit: cover — exact on the fitting axis, overflowing the other, at any aspect", () => {
    for (const aspect of [0.46, 1, 1.5, 1.6, 2.4]) {
      const c = coverNdc(aspect);
      expect(Math.min(c.w, c.h)).toBeCloseTo(2, 9);
      expect(c.w / c.h).toBeCloseTo(WORK.aspect / aspect, 9); // the 3:2 picture, in NDC units
    }
  });

  it("numbers the slides like the index: 01/05", () => {
    expect(slideNumber(0, 5)).toBe("01/05");
    expect(slideNumber(7, 8)).toBe("08/08");
  });
});

describe("DESIGN.md §4.3 A4 = lib/work.ts, lib/covers.ts, lib/tier.ts", () => {
  it("the budget: ≤ 8 slides; covers 1024×683 / 768×512 / 640×427 by tier, DOM-only on OFF; ≤ 120 KB each", () => {
    expect(WORK.maxSlides).toBe(8);
    expect(TIERS.HIGH.covers).toEqual({ width: 1024, height: 683 });
    expect(TIERS.MID.covers).toEqual({ width: 768, height: 512 });
    expect(TIERS.LOW.covers).toEqual({ width: 640, height: 427 });
    expect(TIERS.OFF.covers).toBe("dom");
    expect(COVER.tiers).toEqual([TIERS.HIGH.covers, TIERS.MID.covers, TIERS.LOW.covers]);
    expect(COVER.maxBytes).toBe(120_000);
    // eight covers with their mip chains: ≤ 30 / 17 / 12 MB of VRAM (§4.3 A4)
    const mb = (c: { width: number; height: number }) => (c.width * c.height * 4 * 8 * 4) / 3 / 1e6;
    expect(mb(TIERS.HIGH.covers as { width: number; height: number })).toBeLessThanOrEqual(30);
    expect(mb(TIERS.MID.covers as { width: number; height: number })).toBeLessThanOrEqual(17);
    expect(mb(TIERS.LOW.covers as { width: number; height: number })).toBeLessThanOrEqual(12);
  });

  it("times nothing past 900 ms: the flight, the gate's resolve (scene tier), the let-go (element tier)", () => {
    expect(WORK.projection.flyMs).toBeLessThanOrEqual(MAX_TIMED_MS);
    expect(signature.resolve.scene).toMatchObject({ ms: 900, steps: 32 });
    expect(signature.resolve.element).toMatchObject({ ms: 400, steps: 16 });
    expect(duration.element.in).toBeLessThanOrEqual(MAX_TIMED_MS);
  });

  it("B4: the preview follows at λ 9 and turns by clamp(vx × 0.02, ±4°)", () => {
    expect(WORK.preview).toMatchObject({ lambda: 9, gain: 0.02, maxDeg: 4 });
  });
});

describe("the covers (scripts/bake/covers.ts)", () => {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, COVERS_JSON), "utf8")) as CoversManifest;
  const specs = coverSpecs();

  it("gives every project a cover at four sizes, each tier file an AVIF of at most 120 KB at its exact size", async () => {
    expect(Object.keys(manifest.covers).sort()).toEqual(derived.projects.map((p) => p.slug).sort());
    for (const p of derived.projects) {
      const master = await sharp(resolve(ROOT, "public", coverSrc(p.slug).slice(1))).metadata();
      expect([master.width, master.height]).toEqual([COVER.master.width, COVER.master.height]);
      for (const t of COVER.tiers) {
        const file = resolve(ROOT, "public", coverTierSrc(p.slug, t.width).slice(1));
        expect(statSync(file).size).toBeLessThanOrEqual(COVER.maxBytes);
        const m = await sharp(file).metadata();
        expect([m.width, m.height]).toEqual([t.width, t.height]);
      }
    }
  });

  it("redraws only when its inputs change: each cover's hash recomputes from the words, the faces and the card", () => {
    const faces = { display: "app/fonts/HubotSans-Variable.woff2", body: "app/fonts/MonaSans-Variable.woff2", mono: "app/fonts/JetBrainsMono-Variable.woff2" };
    const hashes = Object.fromEntries(Object.entries(faces).map(([k, f]) => [k, createHash("sha256").update(readFileSync(resolve(ROOT, f))).digest("hex").slice(0, 16)])) as Record<keyof typeof faces, string>;
    for (const s of specs) expect(manifest.covers[s.slug]?.inputHash).toBe(coverInputHash(s, hashes));
  });

  it("says what each cover is: a title card's alt says so, until a screenshot replaces it", () => {
    for (const p of derived.projects) {
      const alt = p.media.find((m) => m.type === "image")?.alt ?? "";
      const source = manifest.covers[p.slug]?.source;
      if (source === "title-card") expect(alt).toMatch(/title card/i);
      else expect(alt).not.toMatch(/title card/i);
      expect(p.media[0]?.src).toBe(coverSrc(p.slug)); // the cover is the first picture, at the bake's path
    }
  });
});

describe("the stage data's slides", () => {
  it("are the featured projects in content order: each mount's print and its cover at every tier's size", () => {
    const slides = stageData(derived).work.slides;
    const featured = derived.projects.filter((p) => p.featured).slice(0, WORK.maxSlides);
    expect(slides.map((s) => s.slug)).toEqual(featured.map((p) => p.slug));
    slides.forEach((s, i) => {
      expect(s.number).toBe(slideNumber(i, slides.length));
      for (const t of COVER.tiers) expect(s.covers[String(t.width) as "1024"]).toBe(coverTierSrc(s.slug, t.width));
    });
  });
});

describe("a year or a role not yet in (v2.0, the owner's call)", () => {
  it("is null in the schema, shown as pending, never guessed", () => {
    const input = structuredClone(data) as ContentInput;
    const p = input.projects[0] as { year: number | null; role: string | null };
    p.year = null;
    p.role = null;
    expect(ContentSchema.safeParse(input).success).toBe(true);
  });
});

describe("research ↔ work: the cross-link (on the fixture: the real content lists none yet)", () => {
  const content = parseContent(data);
  const d = derive(content, {
    citations: CitationsFileSchema.parse(citationsJson),
    verify: VerifyFileSchema.parse(verifyJson),
    graph: GraphFileSchema.parse(layoutGraph(buildGraphModel(content.publications))),
  }, new Date("2026-11-12T00:00:00Z"));
  it("a project's PUBLISHED RESEARCH names each paper it lists, and each paper's BUILT FROM THIS names it back", () => {
    const withPapers = d.projects.filter((p) => p.relatedPublicationSlugs.length > 0);
    expect(withPapers.length).toBeGreaterThan(0);
    for (const p of withPapers) {
      expect(p.relatedPublications.map((r) => r.slug)).toEqual(p.relatedPublicationSlugs);
      for (const r of p.relatedPublications) {
        const paper = d.publications.find((x) => x.slug === r.slug);
        expect(paper?.relatedProjectSlugs).toContain(p.slug);
        expect(r.title).toBe(paper?.title);
      }
    }
  });
  it("the real content lists none yet, so both sections stay hidden", () => {
    expect(derived.projects.every((p) => p.relatedPublications.length === 0)).toBe(true);
    expect(derived.publications.every((p) => p.relatedProjectSlugs.length === 0)).toBe(true);
  });
});
