import { SKY_LIMITS } from "@/lib/archive";
import type { StageData } from "@/lib/hero";
import { rng } from "@/lib/motion";

/**
 * DEV ONLY — ?debug=1&sky=stress: a synthetic sky at A3's budget (DESIGN.md §4.3: 200 glyphs,
 * 2,000 edges), for scripts/archive-gate.mjs to measure the cost the budget allows and for tuning
 * the look at scale. Not content: no titles, no people; it never ships in the stage data.
 *
 * Shaped like a real reference sky: a few records in topic clusters, the works they cite in halos
 * around them, a long tail of years behind, and the seven venue types in columns.
 */
export function stressSky(seed = 0x5eed, nodes: number = SKY_LIMITS.nodes, edges: number = SKY_LIMITS.edges): StageData["graph"] {
  const random = rng(seed);
  const gauss = () => (random() + random() + random() - 1.5) * 1.15;
  const records = Math.round(nodes * 0.12);
  const clusters = 5;
  const anchors = Array.from({ length: clusters }, (_, c) => {
    const a = (c / clusters) * Math.PI * 2;
    return [Math.cos(a) * 6, Math.sin(a * 1.7) * 2.4, Math.sin(a) * 6] as const;
  });
  const out: StageData["graph"] = { nodes: [], edges: [], labels: { topic: [], year: [], venue: [] } };
  const cluster: number[] = [];
  const columns = new Map<number, number>();
  for (let i = 0; i < nodes; i++) {
    const kind: 0 | 1 = i < records ? 0 : 1;
    const c = kind === 0 ? i % clusters : Math.floor(random() * clusters);
    cluster.push(c);
    const [ax, ay, az] = anchors[c] ?? [0, 0, 0];
    const spread = kind === 0 ? 1.1 : 2.6;
    const pubYear = kind === 0 ? 2019 + Math.floor(random() * 8) : 1990 + Math.floor(random() ** 0.5 * 35);
    const shape = kind === 0 ? Math.floor(random() * 7) : random() < 0.12 ? 7 : Math.floor(random() * 7);
    const row = columns.get(shape) ?? 0;
    columns.set(shape, row + 1);
    out.nodes.push({
      topic: [ax + gauss() * spread, ay + gauss() * spread * 0.6, az + gauss() * spread],
      year: [(pubYear - 2008) * 0.52, (random() - 0.5) * 6, (c - 2) * 1.1 - kind * 0.55],
      venue: [(shape - 3.5) * 2.4, -8 + row * 0.42, kind === 0 ? 0.35 : -0.35],
      kind,
      shape,
      dashed: kind === 0 && random() < 0.15,
      pubYear,
      citations: Math.floor(random() ** 3 * (kind === 0 ? 400 : 12000)),
      featured: kind === 0 && random() < 0.3,
    });
  }
  const seen = new Set<string>();
  while (out.edges.length < edges) {
    // mostly citations (a record and a work it cites), some links between records
    const s = Math.floor(random() * records);
    const t = random() < 0.85 ? records + Math.floor(random() * (nodes - records)) : Math.floor(random() * records);
    const key = s < t ? `${s}|${t}` : `${t}|${s}`;
    if (s === t || seen.has(key)) continue;
    seen.add(key);
    out.edges.push([s, t, 1, t >= records ? 8 : 4]);
  }
  out.labels.topic = anchors.map((a, c) => ({ id: `cluster-${c}`, at: [a[0], a[1] + 3.2, a[2]] }));
  out.labels.year = [1990, 2000, 2010, 2020, 2026].map((y) => ({ id: String(y), at: [(y - 2008) * 0.52, -4, 2.4] }));
  out.labels.venue = Array.from({ length: 8 }, (_, s) => ({ id: `venue-${s}`, at: [(s - 3.5) * 2.4, -9, 0] }));
  return out;
}
