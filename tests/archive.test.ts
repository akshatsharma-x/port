import { describe, expect, it } from "vitest";
import { stressSky } from "@/components/stage/archive/stress";
import { buildGraphModel } from "@/content/graph";
import { parseContent, type ContentInput, type Publication } from "@/content/schema";
import { ARCHIVE, citationMs, CUE_MS, glyphRadius, loopPose, PENTATONIC_HZ, retrogradeSpan, SKY_LIMITS, yearNote } from "@/lib/archive";
import { CIRCLE_RADIUS, MAX_SHAPE_VERTICES, POINT_RADIUS, SHAPE_ORDER, SHAPE_VERTICES, shapeIndex, shapePath } from "@/lib/archive-shapes";
import { drawSky } from "@/lib/archive-svg";
import { dampingRatio, relayout } from "@/lib/motion";
import { NODE_FRAG } from "@/shaders/archive";
import { layoutGraph } from "../scripts/bake/layout-graph";
import { data } from "../content/data";
import { section } from "./helpers/design";

/** A3 · ARCHIVE (DESIGN.md §4.3 A3, §7.4): the sky's geometry, graph, camera, cue — and the bible's numbers. */

describe("the shape vocabulary: one geometry for the legend and the glyph", () => {
  it("seven shapes in the legend's order, and a plain point for what fits none", () => {
    expect([...SHAPE_ORDER]).toEqual(["journal", "conference", "workshop", "preprint", "patent", "thesis", "chapter"]);
    expect(SHAPE_ORDER.map(shapeIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(shapeIndex("other")).toBe(7);
  });
  it("the shader's loop bound and shape count are the shared geometry's", () => {
    expect(MAX_SHAPE_VERTICES).toBe(Math.max(...Object.values(SHAPE_VERTICES).map((v) => v.length)));
    expect(NODE_FRAG).toContain(`#define MAX_V ${MAX_SHAPE_VERTICES}`);
    expect(NODE_FRAG).toContain(`#define SHAPES ${SHAPE_ORDER.length}`);
  });
  it("every polygon stays inside the glyph's quad (its corners reach 1.19 radii, the quad 1.9); the round ones", () => {
    const reach = Math.max(...Object.values(SHAPE_VERTICES).flatMap((pts) => pts.map(([x, y]) => Math.hypot(x, y))));
    expect(reach).toBeCloseTo(Math.hypot(0.95, 0.72), 9); // the workshop triangle's base corners
    expect(reach).toBeLessThan(ARCHIVE.node.margin);
    expect(CIRCLE_RADIUS).toBeLessThan(1);
    expect(POINT_RADIUS).toBeLessThan(CIRCLE_RADIUS);
    expect(shapePath("conference", 10)).toBe("M-9.20,0a9.20,9.20 0 1,0 18.40,0a9.20,9.20 0 1,0 -18.40,0Z");
    expect(shapePath("journal", 10)).toBe("M0.00,-10.00L10.00,0.00L0.00,10.00L-10.00,0.00Z");
  });
});

describe("the sky's graph: my records, then the works they cite (v1.9)", () => {
  const content = parseContent(data);
  const paper = (slug: string, cluster: string): Publication => ({ ...(content.publications[0] as Publication), slug, topicCluster: cluster, relatedPublicationSlugs: [] });
  const records = [paper("a-paper", "one"), paper("b-paper", "one"), paper("c-paper", "two")];
  const cited = [
    { id: "shared-ref", title: "A reference both cite", authors: "X. Y.", year: 2001, venue: "J", venueType: "journal" as const, citedBy: ["b-paper", "a-paper"] },
    { id: "lone-ref", title: "A reference one cites", authors: "Z.", year: 1998, venue: "C", venueType: "conference" as const, citedBy: ["c-paper"] },
  ];
  const model = buildGraphModel(records, cited);

  it("puts my records first, each group in id order; a cited work takes its citers' cluster", () => {
    expect(model.nodes.map((n) => [n.id, n.kind])).toEqual([
      ["a-paper", "record"],
      ["b-paper", "record"],
      ["c-paper", "record"],
      ["lone-ref", "cited"],
      ["shared-ref", "cited"],
    ]);
    expect(model.nodes.find((n) => n.id === "shared-ref")?.citedBy).toEqual(["a-paper", "b-paper"]);
    expect(model.nodes.find((n) => n.id === "lone-ref")?.cluster).toBe("two");
  });
  it("joins each paper to each work it cites, once", () => {
    const cites = model.edges.filter((e) => e.kinds.includes("cites")).map((e) => `${e.source}|${e.target}`);
    expect(cites.sort()).toEqual(["a-paper|shared-ref", "b-paper|shared-ref", "c-paper|lone-ref"]);
  });
  it("bakes deterministically, and a shared reference settles between the papers that cite it", () => {
    const g = layoutGraph(model);
    expect(JSON.stringify(layoutGraph(model))).toBe(JSON.stringify(g));
    const at = (id: string) => g.nodes.find((n) => n.id === id)?.layouts.topic ?? [0, 0, 0];
    const d = (p: readonly number[], q: readonly number[]) => Math.hypot((p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0), (p[2] ?? 0) - (q[2] ?? 0));
    const shared = at("shared-ref");
    // nearer its two citers than the paper that doesn't cite it
    expect(Math.max(d(shared, at("a-paper")), d(shared, at("b-paper")))).toBeLessThan(d(shared, at("c-paper")));
    expect(g.nodes.map((n) => n.kind)).toEqual(["record", "record", "record", "cited", "cited"]);
  });
  it("the content schema holds the sky to A3's budget", () => {
    const tooMany = { ...data, citedWorks: Array.from({ length: SKY_LIMITS.nodes }, (_, k) => ({ id: `ref-${k}`, title: "A reference", authors: "A.", year: 2000, venue: "V", venueType: "journal", citedBy: [content.publications[0]?.slug ?? ""] })) } as unknown as ContentInput;
    expect(() => parseContent(tooMany)).toThrow(/sky holds 200 stars/);
    const unknown = { ...data, citedWorks: [{ id: "ref", title: "A reference", authors: "A.", year: 2000, venue: "V", venueType: "journal", citedBy: ["no-such-paper"] }] } as unknown as ContentInput;
    expect(() => parseContent(unknown)).toThrow(/cited by unknown publication/);
  });
});

describe("the camera's retrograde loop (§4.3)", () => {
  it("runs prograde, back, then prograde again, the loop in the middle of the pin", () => {
    const [a, b] = retrogradeSpan();
    expect(a).toBeGreaterThan(0.2);
    expect(b).toBeLessThan(0.8);
    const az = (p: number) => loopPose(p).azimuth;
    expect(az(a * 0.5 + 0.0001)).toBeLessThan(az(a)); // forward before the loop
    expect(az(0.5 + 0.01)).toBeLessThan(az(0.5)); // backward through the middle
    expect(az(1)).toBeGreaterThan(az(b)); // forward after it
    expect(az(1) - az(0)).toBeCloseTo((ARCHIVE.camera.sweepDeg * Math.PI) / 180, 6);
  });
  it("passes the densest cluster's bearing on the arcs and again from the loop: two angles", () => {
    // the azimuth is measured from the cluster's bearing: find every pin position that faces it
    const crossings: number[] = [];
    for (let p = 0; p < 1; p += 0.0005) {
      const a = loopPose(p).azimuth;
      const b = loopPose(p + 0.0005).azimuth;
      if (a === 0 || Math.sign(a) !== Math.sign(b)) crossings.push(p);
    }
    expect(crossings.length).toBe(3); // the prograde arc, the loop back, the prograde arc again
    const [arc, loop] = crossings.map((p) => loopPose(p).elevation);
    expect(loop).toBeGreaterThan((arc ?? 0) + 0.1); // the loop sees it from above
    expect(crossings[1]).toBeCloseTo(0.5, 2);
  });
  it("rides higher and closer through the loop than on the arcs", () => {
    expect(loopPose(0.5).elevation).toBeGreaterThan(loopPose(0).elevation);
    expect(loopPose(0.5).distance).toBeLessThan(loopPose(0).distance);
    expect(loopPose(0).distance).toBe(1);
  });
});

describe("the ARCHIVE cue (§6.4): the year on A-minor pentatonic, the citations as the length", () => {
  it("A C D E G over two octaves, 220–880 Hz", () => {
    expect(PENTATONIC_HZ[0]).toBeCloseTo(220, 6);
    expect(PENTATONIC_HZ.at(-1)).toBeCloseTo(880, 6);
    expect(PENTATONIC_HZ.map((f) => Math.round(f))).toEqual([220, 262, 294, 330, 392, 440, 523, 587, 659, 784, 880]);
  });
  it("older years play lower; the newest the highest", () => {
    expect(yearNote(1998, 1998, 2026)).toBeCloseTo(220, 6);
    expect(yearNote(2026, 1998, 2026)).toBeCloseTo(880, 6);
    expect(yearNote(2010, 1998, 2026)).toBeLessThan(yearNote(2020, 1998, 2026));
  });
  it("40 ms uncited, 120 ms for the most cited", () => {
    expect(citationMs(0, 500)).toBe(CUE_MS.min);
    expect(citationMs(500, 500)).toBe(CUE_MS.max);
    expect(section(/^### 6\.4 /).length).toBeGreaterThan(0);
  });
});

describe("glyphs and the re-plot spring", () => {
  it("size = citations within its class, and every cited work smaller than any record of mine", () => {
    expect(glyphRadius(1, 1e6, 1e6)).toBeLessThan(glyphRadius(0, 0, 100));
    expect(glyphRadius(0, 100, 100)).toBe(ARCHIVE.node.record.max);
    expect(glyphRadius(0, 0, 100)).toBe(ARCHIVE.node.record.min);
  });
  it("mass = 1 + normalized citations, damping = 14·√m: heavier papers slower, never bouncier", () => {
    const light = relayout(0);
    const heavy = relayout(1);
    expect(heavy.mass).toBe(2);
    expect(heavy.damping).toBeCloseTo(14 * Math.SQRT2, 9);
    expect(dampingRatio(heavy)).toBeCloseTo(dampingRatio(light), 9);
    expect(Math.sqrt(heavy.stiffness / heavy.mass)).toBeLessThan(Math.sqrt(light.stiffness / light.mass));
  });
});

describe("DESIGN.md §4.3 A3 = lib/archive.ts", () => {
  const a3 = section(/^#### A3/);
  it("the budget: ≤ 200 glyph quads, ≤ 2,000 edges, two geometry draws, no textures, ≤ 3 ms GPU", () => {
    expect(a3).toContain(`≤ ${SKY_LIMITS.nodes} glyph quads`);
    expect(a3).toContain(`≤ ${SKY_LIMITS.edges.toLocaleString("en-US")} edges`);
    expect(a3).toContain("2 geometry draws");
    expect(a3).toContain("No textures");
    expect(a3).toContain("GPU ≤ 3 ms");
  });
  it("the stress sky (Gate C) sits at exactly the caps", () => {
    const s = stressSky();
    expect(s.nodes.length).toBe(SKY_LIMITS.nodes);
    expect(s.edges.length).toBe(SKY_LIMITS.edges);
    expect(new Set(s.edges.map(([a, b]) => `${a}|${b}`)).size).toBe(SKY_LIMITS.edges);
  });
  it("the drawn constellation keeps every star and edge of the stage's sky", () => {
    const s = stressSky();
    const drawing = drawSky(s, 640, 360);
    expect(drawing.nodes.length).toBe(s.nodes.length);
    expect(drawing.edges.length).toBe(s.edges.length);
    expect(Math.max(...drawing.edges.map((e) => e.delay))).toBeLessThanOrEqual(ARCHIVE.edges.staggerMs);
    expect(ARCHIVE.edges.drawMs + ARCHIVE.edges.staggerMs).toBeLessThanOrEqual(900); // law 7
  });
  it("both drawings, wide and tall, fit every star and every cluster label's anchor inside the pad", () => {
    const s = stressSky();
    for (const { width, height } of [ARCHIVE.drawing.wide, ARCHIVE.drawing.tall]) {
      const drawing = drawSky(s, width, height);
      expect(drawing.labels.map((l) => l.k)).toEqual(s.labels.topic.map((_, k) => k));
      const [px, py] = [ARCHIVE.drawing.pad / width, ARCHIVE.drawing.pad / height];
      for (const l of drawing.labels) {
        expect(l.x).toBeGreaterThanOrEqual(px - 1e-6);
        expect(l.x).toBeLessThanOrEqual(1 - px + 1e-6);
        expect(l.y).toBeGreaterThanOrEqual(py - 1e-6);
        expect(l.y).toBeLessThanOrEqual(1 - py + 1e-6);
      }
      // every glyph's path stays on the drawing (its centre inside the pad, its radius ≤ the pad)
      const coords = drawing.nodes.flatMap((n) => [...n.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const));
      expect(Math.min(...coords.map(([x]) => x))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...coords.map(([x]) => x))).toBeLessThanOrEqual(width);
      expect(Math.min(...coords.map(([, y]) => y))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...coords.map(([, y]) => y))).toBeLessThanOrEqual(height);
    }
  });
});
