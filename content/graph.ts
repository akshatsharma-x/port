import { EDGE_KINDS, type CitedVenueType, type CitedWork, type EdgeKind, type NodeKind, type Publication, type PublicationStatus } from "./schema";

/**
 * The publication graph's structure (DESIGN.md §4.3 A3) — pure, deterministic, shared by the
 * layout bake (scripts/bake/layout-graph.ts) and content/selectors.ts.
 *
 * Edges, merged per pair:
 *   author  — the two papers share co-authors (weight = number shared)
 *   related — one lists the other in relatedPublicationSlugs (weight 2)
 *   topic   — consecutive papers in the same topicCluster, in date order (weight 1). A chronological
 *             thread, not an all-pairs clique: edges grow linearly with papers, not quadratically.
 *   cites   — a paper and a work in its reference list (weight ½, v1.9): the faint stars around it
 *
 * Nodes: my publications ("record") first, then the works they cite ("cited"), each group in id
 * order — so the first records.length indices are always mine.
 */
export interface GraphNodeModel {
  id: string;
  kind: NodeKind;
  /** a record's topic cluster; a cited work takes the clusters of the papers that cite it */
  cluster: string;
  /** cited works: the papers that cite it (sorted); records: none */
  citedBy: string[];
  year: number;
  month: number | null;
  venueType: CitedVenueType;
  status: PublicationStatus;
}

export interface GraphEdgeModel {
  source: string;
  target: string;
  kinds: EdgeKind[];
  weight: number;
}

export interface GraphModel {
  nodes: GraphNodeModel[];
  edges: GraphEdgeModel[];
}

/** Every baked layout fits a sphere of this radius (scene units), so one camera frames all three. */
export const LAYOUT_RADIUS = 10;

const RELATED_WEIGHT = 2;
const TOPIC_WEIGHT = 1;
const CITES_WEIGHT = 0.5;

// Plain code-unit comparison: deterministic everywhere (localeCompare depends on ICU/locale).
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function buildGraphModel(publications: readonly Publication[], citedWorks: readonly CitedWork[] = []): GraphModel {
  const records: GraphNodeModel[] = publications
    .map((p) => ({ id: p.slug, kind: "record" as const, cluster: p.topicCluster, citedBy: [], year: p.year, month: p.month ?? null, venueType: p.venueType, status: p.status }))
    .sort((a, b) => byString(a.id, b.id));
  const clusterOf = new Map(publications.map((p) => [p.slug, p.topicCluster]));
  const cited: GraphNodeModel[] = citedWorks
    .map((w) => {
      const by = [...w.citedBy].sort(byString);
      return { id: w.id, kind: "cited" as const, cluster: clusterOf.get(by[0] ?? "") ?? "", citedBy: by, year: w.year, month: null, venueType: w.venueType, status: "published" as const };
    })
    .sort((a, b) => byString(a.id, b.id));
  const nodes = [...records, ...cited];

  const ids = new Set(nodes.map((n) => n.id));
  const pairs = new Map<string, { source: string; target: string; kinds: Set<EdgeKind>; weight: number }>();
  const add = (a: string, b: string, kind: EdgeKind, weight: number) => {
    if (a === b || !ids.has(a) || !ids.has(b)) return; // the schema rejects dangling slugs; subsets can still have them
    const [source, target] = a < b ? [a, b] : [b, a];
    const key = `${source}|${target}`;
    const edge = pairs.get(key) ?? { source, target, kinds: new Set<EdgeKind>(), weight: 0 };
    if (kind !== "author" && edge.kinds.has(kind)) return; // A→B and B→A count once
    edge.kinds.add(kind);
    edge.weight += weight;
    pairs.set(key, edge);
  };

  const list = [...publications].sort((a, b) => byString(a.slug, b.slug));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (!a || !b) continue;
      const shared = a.coAuthorIds.filter((id) => b.coAuthorIds.includes(id)).length;
      if (shared > 0) add(a.slug, b.slug, "author", shared);
    }
  }

  for (const p of list) for (const r of p.relatedPublicationSlugs) add(p.slug, r, "related", RELATED_WEIGHT);
  for (const w of cited) for (const by of w.citedBy) add(by, w.id, "cites", CITES_WEIGHT);

  const clusters = new Map<string, Publication[]>();
  for (const p of list) clusters.set(p.topicCluster, [...(clusters.get(p.topicCluster) ?? []), p]);
  for (const members of clusters.values()) {
    const ordered = [...members].sort((a, b) => a.year - b.year || (a.month ?? 13) - (b.month ?? 13) || byString(a.slug, b.slug));
    for (let k = 1; k < ordered.length; k++) {
      const prev = ordered[k - 1];
      const next = ordered[k];
      if (prev && next) add(prev.slug, next.slug, "topic", TOPIC_WEIGHT);
    }
  }

  const edges = [...pairs.values()]
    .map((e) => ({ source: e.source, target: e.target, kinds: EDGE_KINDS.filter((k) => e.kinds.has(k)), weight: e.weight }))
    .sort((a, b) => byString(`${a.source}|${a.target}`, `${b.source}|${b.target}`));

  return { nodes, edges };
}

/** FNV-1a (32-bit, hex) of the model: graph.json records it so a stale layout is detectable. */
export function graphInputHash(model: GraphModel): string {
  const s = JSON.stringify(model);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
