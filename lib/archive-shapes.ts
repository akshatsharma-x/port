import type { CitedVenueType, VenueType } from "@/content/schema";

/**
 * A3's shape vocabulary (DESIGN.md §2.4, §2.10, §4.3): shape = venue type, the only identity a
 * monochrome sky has. One geometry for every place a shape is drawn — the WebGL glyphs (the SDF in
 * shaders/archive.ts takes these vertices as a uniform), the HTML legend, the build-time SVG
 * constellation and its poster — so the legend is the glyph, not a likeness of it.
 *
 * Unit size: the shape spans [-1, 1] at radius 1, y down (SVG's way; the shader flips y). The
 * circle is the one curve; every other shape is a polygon, its vertices in drawing order.
 */
export const SHAPE_ORDER = ["journal", "conference", "workshop", "preprint", "patent", "thesis", "chapter"] as const satisfies readonly VenueType[];

type Vec2 = readonly [number, number];

const ring = (n: number, r: number, rot = -Math.PI / 2): Vec2[] => Array.from({ length: n }, (_, i) => [r * Math.cos(rot + (i * 2 * Math.PI) / n), r * Math.sin(rot + (i * 2 * Math.PI) / n)] as const);
const CROSS_ARM = 0.34;
const STAR_INNER = ring(6, 0.38, -Math.PI / 2 + Math.PI / 6);

/** The circle's radius at unit size (it reads as large as the polygons at 0.92). */
export const CIRCLE_RADIUS = 0.92;

/** Every polygon's vertices at unit size; the circle (conference) and the point (other) have none. */
export const SHAPE_VERTICES: Record<Exclude<VenueType, "conference">, readonly Vec2[]> = {
  journal: [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ],
  workshop: [
    [0, -1],
    [0.95, 0.72],
    [-0.95, 0.72],
  ],
  // ✱: a six-pointed star, outer and inner rings interleaved
  preprint: ring(6, 1).flatMap((p, i) => [p, STAR_INNER[i] ?? p]),
  patent: [
    [-0.8, -0.8],
    [0.8, -0.8],
    [0.8, 0.8],
    [-0.8, 0.8],
  ],
  thesis: ring(6, 1),
  chapter: [
    [-CROSS_ARM, -1],
    [CROSS_ARM, -1],
    [CROSS_ARM, -CROSS_ARM],
    [1, -CROSS_ARM],
    [1, CROSS_ARM],
    [CROSS_ARM, CROSS_ARM],
    [CROSS_ARM, 1],
    [-CROSS_ARM, 1],
    [-CROSS_ARM, CROSS_ARM],
    [-1, CROSS_ARM],
    [-1, -CROSS_ARM],
    [-CROSS_ARM, -CROSS_ARM],
  ],
};

/** The most vertices any shape has (the shader's loop bound). */
export const MAX_SHAPE_VERTICES = Math.max(...Object.values(SHAPE_VERTICES).map((v) => v.length));

/** A cited work that fits no venue type (a report, a standard, a dataset, a page): a plain point. */
export const POINT_RADIUS = 0.42;

/** The index the shader reads per glyph: SHAPE_ORDER's, and 7 for a plain point. */
export function shapeIndex(type: CitedVenueType): number {
  const i = (SHAPE_ORDER as readonly string[]).indexOf(type);
  return i === -1 ? SHAPE_ORDER.length : i;
}

/** An SVG path for a shape centered on 0,0 at radius s. */
export function shapePath(type: CitedVenueType, s: number): string {
  const f = (v: number) => v.toFixed(2);
  const circle = (r: number) => `M${f(-r)},0a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0Z`;
  if (type === "conference") return circle(s * CIRCLE_RADIUS);
  if (type === "other") return circle(s * POINT_RADIUS);
  const pts = SHAPE_VERTICES[type];
  return `M${pts.map(([x, y]) => `${(x * s).toFixed(2)},${(y * s).toFixed(2)}`).join("L")}Z`;
}
