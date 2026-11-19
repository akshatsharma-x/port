import type { CitedVenueType } from "@/content/schema";
import { ARCHIVE, citationNorm } from "./archive";
import { SHAPE_ORDER, shapePath } from "./archive-shapes";
import type { StageData } from "./hero";

/**
 * ARCHIVE without a stage (DESIGN.md §4.3 A3, "cost to cut"; §7.4 phone edition): the
 * constellation as a build-time drawing, straight from the baked graph — the phone and
 * reduced-motion editions' section header, and the stage slot's poster (scripts/posters.ts) —
 * one drawing, so the poster is the header. A fixed dimetric view of the TOPIC layout; each edge
 * carries its plot-in delay by depth (nearest first), each glyph its shape and size from the same
 * rules as the stage's.
 */
export interface SkyDrawing {
  width: number;
  height: number;
  edges: { d: string; cited: boolean; delay: number }[];
  nodes: { d: string; kind: 0 | 1; dashed: boolean; type: CitedVenueType }[];
  /** each record's place (the graph index, and x, y as shares of the drawing): a sparse sky's tags */
  records: { i: number; x: number; y: number; r: number }[];
  /** the TOPIC clusters' label anchors, as shares of the drawing (the header sets their text in HTML) */
  labels: { k: number; x: number; y: number }[];
}

const VIEW = { yaw: -0.6, pitch: 0.35 } as const;
/** glyph radii in px at the drawing's scale: mine, then the works they cite (the stage's ratio) */
const PX = { record: { min: 6, max: 11 }, cited: { min: 2.2, max: 4.4 } } as const;

export function drawSky(graph: StageData["graph"], width: number, height: number, pad: number = ARCHIVE.drawing.pad): SkyDrawing {
  const project = ([x, y, z]: readonly [number, number, number]) => {
    const x1 = x * Math.cos(VIEW.yaw) + z * Math.sin(VIEW.yaw);
    const z1 = -x * Math.sin(VIEW.yaw) + z * Math.cos(VIEW.yaw);
    return { x: x1, y: -(y * Math.cos(VIEW.pitch) - z1 * Math.sin(VIEW.pitch)), depth: y * Math.sin(VIEW.pitch) + z1 * Math.cos(VIEW.pitch) };
  };
  const pts = graph.nodes.map((n) => project(n.topic));
  const marks = graph.labels.topic.map((l) => project(l.at));
  // the labels' anchors are fitted too, so a cluster's label never lands outside the drawing
  const xs = [...pts, ...marks].map((p) => p.x);
  const ys = [...pts, ...marks].map((p) => p.y);
  const [minX, maxX] = [Math.min(...xs, 0), Math.max(...xs, 0)];
  const [minY, maxY] = [Math.min(...ys, 0), Math.max(...ys, 0)];
  const k = Math.min((width - 2 * pad) / (maxX - minX || 1), (height - 2 * pad) / (maxY - minY || 1));
  const ox = width / 2 - ((minX + maxX) / 2) * k;
  const oy = height / 2 - ((minY + maxY) / 2) * k;
  const at = pts.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k, depth: p.depth }));
  const max = (kind: 0 | 1) => Math.max(0, ...graph.nodes.filter((n) => n.kind === kind).map((n) => n.citations));
  const maxBy = { 0: max(0), 1: max(1) } as const;
  const [dLo, dHi] = [Math.min(...at.map((p) => p.depth)), Math.max(...at.map((p) => p.depth))];
  const stagger = ARCHIVE.edges.staggerMs;
  const f = (v: number) => v.toFixed(1);

  const edges = graph.edges.flatMap(([s, t, , kinds]) => {
    const a = at[s];
    const b = at[t];
    if (!a || !b) return [];
    const depth = (a.depth + b.depth) / 2;
    // the nearest edges plot first (larger depth is nearer the viewer in this view)
    const delay = dHi > dLo ? Math.round(((dHi - depth) / (dHi - dLo)) * stagger) : 0;
    return [{ d: `M${f(a.x)},${f(a.y)}L${f(b.x)},${f(b.y)}`, cited: (kinds & 8) !== 0, delay }];
  });
  // far to near, so a near glyph lies over a far one
  const order = graph.nodes.map((_, i) => i).sort((i, j) => (at[i]?.depth ?? 0) - (at[j]?.depth ?? 0));
  const nodes = order.map((i) => {
    const n = graph.nodes[i] as StageData["graph"]["nodes"][number];
    const p = at[i] as { x: number; y: number };
    const range = n.kind === 0 ? PX.record : PX.cited;
    const r = range.min + (range.max - range.min) * citationNorm(n.citations, maxBy[n.kind]);
    const type: CitedVenueType = SHAPE_ORDER[n.shape] ?? "other";
    return { d: translate(shapePath(type, r), p.x, p.y), kind: n.kind, dashed: n.dashed, type };
  });
  const labels = marks.map((m, j) => ({ k: j, x: (ox + m.x * k) / width, y: (oy + m.y * k) / height }));
  const records = graph.nodes.flatMap((n, i) => {
    const p = at[i];
    if (n.kind !== 0 || !p) return [];
    return [{ i, x: p.x / width, y: p.y / height, r: PX.record.min + (PX.record.max - PX.record.min) * citationNorm(n.citations, maxBy[0]) }];
  });
  return { width, height, edges, nodes, labels, records };
}

/** Moves an absolute M/L/a path drawn about the origin to (x, y). */
function translate(d: string, x: number, y: number): string {
  // shapePath draws polygons with absolute M/L, and the circle as an absolute M plus relative arcs
  return d.replace(/([ML])(-?[\d.]+),(-?[\d.]+)/g, (_, cmd: string, a: string, b: string) => `${cmd}${(Number(a) + x).toFixed(1)},${(Number(b) + y).toFixed(1)}`);
}

/** The drawing as a standalone SVG document (the poster's source), in the given ink and ground. */
export function skySvgDocument(sky: SkyDrawing, ink: { ground: string; record: string; cited: string; edge: string; citedEdge: string }): string {
  const edges = sky.edges.map((e) => `<path d="${e.d}" stroke="${e.cited ? ink.citedEdge : ink.edge}" stroke-width="1" fill="none"/>`).join("");
  const nodes = sky.nodes
    .map((n) => (n.dashed ? `<path d="${n.d}" fill="none" stroke="${ink.record}" stroke-width="1.2" stroke-dasharray="2.2 1.8"/>` : `<path d="${n.d}" fill="${n.kind === 0 ? ink.record : ink.cited}"/>`))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sky.width}" height="${sky.height}" viewBox="0 0 ${sky.width} ${sky.height}"><rect width="100%" height="100%" fill="${ink.ground}"/>${edges}${nodes}</svg>`;
}
