import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, forceZ, type SimulationNode } from "d3-force-3d";
import { buildGraphModel, graphInputHash, LAYOUT_RADIUS, type GraphModel, type GraphNodeModel } from "../../content/graph";
import { CITED_VENUE_TYPES, GraphFileSchema, type Content, type GraphFile } from "../../content/schema";
import { hashSeed, rng } from "../../lib/motion";
import { formatJson, OUT, writeIfChanged } from "./lib";

/**
 * layout-graph (DESIGN.md §8.2, §4.3 A3) → content/graph.json: three coordinate sets per paper,
 * solved here so the browser never runs a force simulation (law 7).
 *
 *   TOPIC — seeded d3-force-3d: clusters pulled to anchors on a Fibonacci sphere, edges as springs;
 *           a cited work is pulled to the mean of its citing papers' anchors, so a shared reference
 *           settles between them (v1.9)
 *   YEAR  — a timeline lattice: x = year (gaps kept), z = topic lane, y = stack within the cell;
 *           cited works half a lane behind their cluster's
 *   VENUE — labelled columns in CITED_VENUE_TYPES order, each stacked oldest → newest; my records
 *           stand in front of the column, the works they cite behind it
 *
 * Deterministic: the only randomness is mulberry32 seeded from SEED and each node's id, the
 * simulation runs a fixed number of ticks with its timer stopped, and coordinates are rounded to
 * 1/1000. Same content → byte-identical graph.json (tests/bake.test.ts).
 */
export const SEED = hashSeed("retrograde:constellation");

export { LAYOUT_RADIUS };

// TOPIC — simulation units follow d3's own defaults (links ≈ 30), normalized afterwards.
const TOPIC = {
  anchorRadius: 70,
  anchorFlatten: 0.6, // the sky is wider than it is tall
  jitter: 12,
  linkDistance: 30,
  charge: -45,
  chargeDistanceMax: 160,
  anchorStrength: 0.08,
  collideRadius: 9,
  /** a cited work is a smaller star */
  collideRadiusCited: 5,
  alphaMin: 0.001,
  alphaDecay: 1 - Math.pow(0.001, 1 / 300),
} as const;

// Lattice steps, in pre-normalization units.
const YEAR_STEP = { x: 1, y: 0.7, z: 1.1 } as const;
const VENUE_STEP = { x: 1.4, y: 0.7, z: 0.35 } as const;

type Vec3 = [number, number, number];
interface SimNode extends SimulationNode {
  id: string;
  cited: boolean;
  anchor: Vec3;
}
interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  weight: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const round = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const centroid = (pts: readonly Vec3[]): Vec3 => {
  const s = pts.reduce<Vec3>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
  return [s[0] / pts.length, s[1] / pts.length, s[2] / pts.length];
};
const byDate = (a: GraphNodeModel, b: GraphNodeModel) => a.year - b.year || (a.month ?? 13) - (b.month ?? 13) || byString(a.id, b.id);

function anchors(clusters: readonly string[]): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const k = clusters.length;
  clusters.forEach((c, i) => {
    if (k === 1) return out.set(c, [0, 0, 0]);
    const y = 1 - (2 * (i + 0.5)) / k;
    const r = Math.sqrt(1 - y * y);
    const theta = i * GOLDEN_ANGLE;
    out.set(c, [Math.cos(theta) * r * TOPIC.anchorRadius, y * TOPIC.anchorRadius * TOPIC.anchorFlatten, Math.sin(theta) * r * TOPIC.anchorRadius]);
  });
  return out;
}

function solveTopic(model: GraphModel, clusters: readonly string[], seed: number): Map<string, Vec3> {
  const anchor = anchors(clusters);
  const clusterOf = new Map(model.nodes.filter((n) => n.kind === "record").map((n) => [n.id, n.cluster]));
  const anchorOf = (n: GraphNodeModel): Vec3 => {
    if (n.kind === "record") return anchor.get(n.cluster) ?? [0, 0, 0];
    const pts = n.citedBy.map((s) => anchor.get(clusterOf.get(s) ?? "") ?? ([0, 0, 0] as Vec3));
    return pts.length ? centroid(pts) : (anchor.get(n.cluster) ?? [0, 0, 0]);
  };
  const nodes: SimNode[] = model.nodes.map((n) => {
    const random = rng(hashSeed(`${seed}:${n.id}`));
    const a = anchorOf(n);
    const j = () => (2 * random() - 1) * TOPIC.jitter;
    return { id: n.id, cited: n.kind === "cited", anchor: a, x: a[0] + j(), y: a[1] + j(), z: a[2] + j() };
  });
  const links: SimLink[] = model.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight }));
  const at = (n: SimNode, axis: 0 | 1 | 2) => n.anchor[axis];

  const sim = forceSimulation(nodes, 3)
    .stop() // the constructor starts a d3-timer; we tick by hand
    .randomSource(rng(seed))
    .alphaMin(TOPIC.alphaMin)
    .alphaDecay(TOPIC.alphaDecay)
    .force("link", forceLink<SimNode, SimLink>(links).id((n) => n.id).distance((l) => TOPIC.linkDistance / Math.sqrt(l.weight)))
    .force("charge", forceManyBody<SimNode>().strength(TOPIC.charge).distanceMax(TOPIC.chargeDistanceMax))
    .force("x", forceX<SimNode>((n) => at(n, 0)).strength(TOPIC.anchorStrength))
    .force("y", forceY<SimNode>((n) => at(n, 1)).strength(TOPIC.anchorStrength))
    .force("z", forceZ<SimNode>((n) => at(n, 2)).strength(TOPIC.anchorStrength))
    .force("collide", forceCollide<SimNode>((n) => (n.cited ? TOPIC.collideRadiusCited : TOPIC.collideRadius)));

  const ticks = Math.ceil(Math.log(TOPIC.alphaMin) / Math.log(1 - TOPIC.alphaDecay));
  sim.tick(ticks);
  return new Map(nodes.map((n) => [n.id, [n.x ?? 0, n.y ?? 0, n.z ?? 0]]));
}

function solveYear(model: GraphModel, clusters: readonly string[]): { positions: Map<string, Vec3>; labels: { id: string; position: Vec3 }[] } {
  const years = model.nodes.map((n) => n.year);
  const from = Math.min(...years);
  const to = Math.max(...years);
  const mid = (from + to) / 2;
  const lane = new Map(clusters.map((c, i) => [c, i - (clusters.length - 1) / 2]));
  const cells = new Map<string, GraphNodeModel[]>();
  for (const n of [...model.nodes].sort(byDate)) {
    const key = `${n.year}|${n.cluster}|${n.kind}`;
    cells.set(key, [...(cells.get(key) ?? []), n]);
  }
  const tallest = Math.max(...[...cells.values()].map((c) => c.length));
  const base = (-(tallest - 1) * YEAR_STEP.y) / 2;
  const positions = new Map<string, Vec3>();
  for (const members of cells.values()) {
    members.forEach((n, i) => {
      const z = ((lane.get(n.cluster) ?? 0) - (n.kind === "cited" ? 0.5 : 0)) * YEAR_STEP.z;
      positions.set(n.id, [(n.year - mid) * YEAR_STEP.x, base + i * YEAR_STEP.y, z]);
    });
  }
  // Every year in range gets a tick, gaps included (a truthful axis), along the lattice's front
  // edge: +z faces the default camera.
  const front = ((clusters.length - 1) / 2) * YEAR_STEP.z;
  const labels = Array.from({ length: to - from + 1 }, (_, i) => ({ id: String(from + i), position: [(from + i - mid) * YEAR_STEP.x, base - YEAR_STEP.y, front] as Vec3 }));
  return { positions, labels };
}

function solveVenue(model: GraphModel): { positions: Map<string, Vec3>; labels: { id: string; position: Vec3 }[] } {
  const present = CITED_VENUE_TYPES.filter((t) => model.nodes.some((n) => n.venueType === t));
  // within a column: my records in front, the works they cite behind, each stacked oldest → newest
  const columns = present.map((t) => ["record", "cited"].map((kind) => model.nodes.filter((n) => n.venueType === t && n.kind === kind).sort(byDate)));
  const tallest = Math.max(...columns.flat().map((c) => c.length));
  const base = (-(tallest - 1) * VENUE_STEP.y) / 2;
  const x = (col: number) => (col - (present.length - 1) / 2) * VENUE_STEP.x;
  const positions = new Map<string, Vec3>();
  columns.forEach((rows, col) =>
    rows.forEach((members, row) => members.forEach((n, i) => positions.set(n.id, [x(col), base + i * VENUE_STEP.y, row === 0 ? VENUE_STEP.z : -VENUE_STEP.z]))),
  );
  const labels = present.map((t, col) => ({ id: t, position: [x(col), base - VENUE_STEP.y, 0] as Vec3 }));
  return { positions, labels };
}

/** Centers on the node centroid and scales uniformly to LAYOUT_RADIUS; labels share the transform. */
function normalize(positions: Map<string, Vec3>, labels: { id: string; position: Vec3 }[], center = true) {
  const pts = [...positions.values()];
  const c: Vec3 = center && pts.length ? centroid(pts) : [0, 0, 0];
  const reach = Math.max(0, ...pts.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])));
  const k = reach > 0 ? LAYOUT_RADIUS / reach : 1;
  const map = (p: Vec3): Vec3 => [round((p[0] - c[0]) * k), round((p[1] - c[1]) * k), round((p[2] - c[2]) * k)];
  return {
    positions: new Map([...positions].map(([id, p]) => [id, map(p)])),
    labels: labels.map((l) => ({ id: l.id, position: map(l.position) })),
  };
}

export function layoutGraph(model: GraphModel, seed: number = SEED): GraphFile {
  const clusters = [...new Set(model.nodes.filter((n) => n.kind === "record").map((n) => n.cluster))].sort(byString);
  if (model.nodes.length === 0) {
    return { version: 1, inputHash: graphInputHash(model), seed, nodes: [], edges: [], labels: { topic: [], year: [], venue: [] } };
  }

  const topicRaw = solveTopic(model, clusters, seed);
  const topic = normalize(topicRaw, []);
  // Cluster labels sit just above each cluster's papers (mine, not the works they cite), at their centroid.
  const topicLabels = clusters.map((cluster) => {
    const pts = model.nodes.filter((n) => n.kind === "record" && n.cluster === cluster).map((n) => topic.positions.get(n.id) ?? ([0, 0, 0] as Vec3));
    const mean = centroid(pts);
    const top = Math.max(...pts.map((p) => p[1]));
    return { id: cluster, position: [round(mean[0]), round(top + 1), round(mean[2])] as Vec3 };
  });
  // Lattices are centered by construction (their axes stay put); they're only scaled to fit.
  const yearRaw = solveYear(model, clusters);
  const year = normalize(yearRaw.positions, yearRaw.labels, false);
  const venueRaw = solveVenue(model);
  const venue = normalize(venueRaw.positions, venueRaw.labels, false);

  const at = (m: Map<string, Vec3>, id: string): Vec3 => m.get(id) ?? [0, 0, 0];
  return {
    version: 1,
    inputHash: graphInputHash(model),
    seed,
    nodes: model.nodes.map((n) => ({ id: n.id, kind: n.kind, layouts: { topic: at(topic.positions, n.id), year: at(year.positions, n.id), venue: at(venue.positions, n.id) } })),
    edges: model.edges.map((e) => ({ source: e.source, target: e.target, kinds: [...e.kinds], weight: e.weight })),
    labels: { topic: topicLabels, year: year.labels, venue: venue.labels },
  };
}

export async function layoutGraphStep(content: Content): Promise<string> {
  const model = buildGraphModel(content.publications, content.citedWorks);
  const file = GraphFileSchema.parse(layoutGraph(model));
  const changed = await writeIfChanged(OUT.graph, formatJson(file));
  const kinds = (k: string) => file.edges.filter((e) => e.kinds.some((x) => x === k)).length;
  const cited = file.nodes.filter((n) => n.kind === "cited").length;
  return `${file.nodes.length} nodes (${file.nodes.length - cited} records · ${cited} cited) · ${file.edges.length} edges (author ${kinds("author")} · related ${kinds("related")} · topic ${kinds("topic")} · cites ${kinds("cites")}) · hash ${file.inputHash}${changed ? "" : " · unchanged"}`;
}
