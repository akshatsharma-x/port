import type { ReactNode } from "react";
import type { CitedVenueType, LayoutName, PublicationStatus } from "@/content/schema";
import { shapePath } from "@/lib/archive-shapes";

/**
 * A static drawing of one baked layout (content/graph.json) — the audit's check that TOPIC
 * clusters, YEAR runs left → right and VENUE stands in columns. Monochrome by law: shape = venue
 * type (the A3 legend), size = citations, dashed = not yet published (DESIGN.md §2.4, §7.4).
 * Server-rendered SVG; each mark carries a <title> tooltip; the raw tables are its table view.
 * The views are for proofreading only — the stage (Part 8) flies its own camera.
 */
type Vec3 = readonly [number, number, number];

export interface PreviewNode {
  id: string;
  title: string;
  venueType: CitedVenueType;
  status: PublicationStatus;
  citations: number;
  venueShort: string;
  year: number;
  layouts: Record<LayoutName, Vec3> | null;
}

export interface PreviewProps {
  id: string;
  title: string;
  layout: LayoutName;
  nodes: readonly PreviewNode[];
  edges: readonly { source: string; target: string }[];
  labels: readonly { id: string; text: string; position: Vec3 }[];
  citationsUnit: string;
}

const W = 360;
const H = 280;
// Room around the fitted marks; VENUE's slanted labels hang down-left of their anchors.
const PAD: Record<LayoutName, { top: number; right: number; bottom: number; left: number }> = {
  topic: { top: 22, right: 22, bottom: 22, left: 22 },
  year: { top: 22, right: 22, bottom: 22, left: 22 },
  venue: { top: 22, right: 22, bottom: 52, left: 62 },
};
const R_MIN = 4.5; // px — markers stay ≥ 8 px across (dataviz floor)
const R_MAX = 9;

/**
 * One view per layout, each the one that reads: TOPIC is a cloud (dimetric), YEAR a lattice
 * (cabinet oblique: years left → right, lanes receding up-right, stacks straight up), VENUE a
 * wall of columns (front). Returns screen x, screen y (down) and depth (larger = nearer).
 */
const YAW = -0.6;
const PITCH = 0.35;
const CABINET = { depth: 0.5, angle: 0.6 };
const PROJECT: Record<LayoutName, (p: Vec3) => { x: number; y: number; depth: number }> = {
  topic: ([x, y, z]) => {
    const x1 = x * Math.cos(YAW) + z * Math.sin(YAW);
    const z1 = -x * Math.sin(YAW) + z * Math.cos(YAW);
    return { x: x1, y: -(y * Math.cos(PITCH) - z1 * Math.sin(PITCH)), depth: y * Math.sin(PITCH) + z1 * Math.cos(PITCH) };
  },
  year: ([x, y, z]) => ({
    x: x - z * CABINET.depth * Math.cos(CABINET.angle),
    y: -(y - z * CABINET.depth * Math.sin(CABINET.angle)),
    depth: z,
  }),
  venue: ([x, y, z]) => ({ x, y: -y, depth: z }),
};

export function Mark({ type, s, published, children }: { type: CitedVenueType; s: number; published: boolean; children?: ReactNode }) {
  const d = shapePath(type, s);
  return published ? (
    <path d={d} fill="var(--fg-1)" stroke="var(--bg)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
      {children}
    </path>
  ) : (
    <g>
      {children}
      <path d={d} fill="var(--bg)" stroke="var(--bg)" strokeWidth={4} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--fg-2)" strokeWidth={1.25} strokeDasharray="2.2 1.8" strokeLinejoin="round" />
    </g>
  );
}

export function LayoutPreview({ id, title, layout, nodes, edges, labels, citationsUnit }: PreviewProps) {
  const project = PROJECT[layout];
  const placed = nodes.filter((n) => n.layouts).map((n) => ({ n, p: project((n.layouts as Record<LayoutName, Vec3>)[layout]) }));
  const marks = labels.map((l) => ({ l, p: project(l.position) }));
  const all = [...placed.map((x) => x.p), ...marks.map((x) => x.p)];
  const [minX, maxX] = [Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.x))];
  const [minY, maxY] = [Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y))];
  const pad = PAD[layout];
  const k = Math.min((W - pad.left - pad.right) / (maxX - minX || 1), (H - pad.top - pad.bottom) / (maxY - minY || 1));
  const ox = pad.left + (W - pad.left - pad.right) / 2 - ((minX + maxX) / 2) * k;
  const oy = pad.top + (H - pad.top - pad.bottom) / 2 - ((minY + maxY) / 2) * k;
  const at = (p: { x: number; y: number }) => ({ x: ox + p.x * k, y: oy + p.y * k });
  const pos = new Map(placed.map(({ n, p }) => [n.id, at(p)]));
  const maxCites = Math.max(1, ...nodes.map((n) => n.citations));
  const titleId = `${id}-title`;

  return (
    <figure className="grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby={titleId} className="h-auto w-full max-w-full rounded-1 bg-bg-sunken">
        <title id={titleId}>{title}</title>
        <g stroke="var(--line-2)" strokeWidth={1}>
          {edges.map((e) => {
            const a = pos.get(e.source);
            const b = pos.get(e.target);
            return a && b ? <line key={`${e.source}|${e.target}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} /> : null;
          })}
        </g>
        {[...placed]
          .sort((a, b) => a.p.depth - b.p.depth)
          .map(({ n }) => {
            const p = pos.get(n.id) ?? { x: 0, y: 0 };
            const s = R_MIN + (R_MAX - R_MIN) * Math.sqrt(n.citations / maxCites);
            return (
              <g key={n.id} transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}>
                <Mark type={n.venueType} s={s} published={n.status === "published" || n.status === "accepted"}>
                  <title>{`${n.title} · ${n.venueShort} · ${n.year} · ${n.citations} ${citationsUnit}`}</title>
                </Mark>
              </g>
            );
          })}
        {/* labels wear a surface halo so they stay legible across edges; VENUE's sit at the
            foot of narrow columns, so they slant like a categorical axis */}
        <g fill="var(--fg-3)" stroke="var(--bg-sunken)" strokeWidth={3} paintOrder="stroke" fontFamily="var(--ff-mono)" fontSize={10}>
          {marks.map(({ l, p }) => {
            const q = at(p);
            return layout === "venue" ? (
              <text key={l.id} x={q.x} y={q.y - 6} textAnchor="end" dominantBaseline="middle" transform={`rotate(-35 ${q.x.toFixed(2)} ${(q.y - 6).toFixed(2)})`}>
                {l.text}
              </text>
            ) : (
              <text key={l.id} x={q.x} y={q.y} textAnchor="middle" dominantBaseline="middle">
                {l.text}
              </text>
            );
          })}
        </g>
      </svg>
      <figcaption className="t-micro text-fg-3">{title}</figcaption>
    </figure>
  );
}
