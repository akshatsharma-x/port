import { shapeIndex } from "@/lib/archive-shapes";
import type { StageData } from "@/lib/hero";
import { cardText } from "@/lib/log";
import { coverSizes } from "@/lib/covers";
import { KEYS } from "@/lib/capabilities";
import { slideNumber, WORK } from "@/lib/work";
import { EDGE_KINDS } from "./schema";
import type { Derived } from "./selectors";

/**
 * /data/stage.json (app/data/stage.json/route.ts): what the stage's scenes download — the hero's
 * initials, city and time zone, and the paper graph with its baked layouts (DESIGN.md §4.3:
 * "graph.json (shared)"). Built from derive.ts at build time; content never ships as JavaScript.
 */
export function stageData(d: Derived): StageData {
  const index = new Map(d.graph.nodes.map((n, i) => [n.id, i]));
  const featured = d.projects.filter((p) => p.featured).slice(0, WORK.maxSlides);
  const cats = d.skills.categories.map((c) => c.category);
  return {
    v: 1,
    hero: { initials: d.profile.initials, city: { lat: d.profile.coordinates.lat, lon: d.profile.coordinates.lon }, timezone: d.profile.timezone },
    graph: {
      nodes: d.graph.nodes.map((n) => {
        if (!n.layouts) throw new Error(`content/graph.json has no layout for "${n.id}" — run \`npm run bake\``);
        return {
          topic: n.layouts.topic,
          year: n.layouts.year,
          venue: n.layouts.venue,
          kind: n.kind === "record" ? 0 : 1,
          shape: shapeIndex(n.venueType),
          dashed: n.status === "underReview" || n.status === "inPrep",
          pubYear: n.year,
          citations: n.citations ?? 0,
          featured: n.featured,
        };
      }),
      edges: d.graph.edges.flatMap((e) => {
        const s = index.get(e.source);
        const t = index.get(e.target);
        const kinds = e.kinds.reduce((m, k) => m | (1 << EDGE_KINDS.indexOf(k)), 0);
        return s === undefined || t === undefined ? [] : [[s, t, e.weight, kinds] as [number, number, number, number]];
      }),
      labels: {
        topic: d.graph.labels.topic.map((l) => ({ id: l.id, at: l.position })),
        year: d.graph.labels.year.map((l) => ({ id: l.id, at: l.position })),
        venue: d.graph.labels.venue.map((l) => ({ id: l.id, at: l.position })),
      },
    },
    log: { cards: d.experience.map((e) => ({ slug: e.slug, text: cardText(e, d.site.labels.log.present) })) },
    work: {
      slides: featured.map((p, i) => ({ slug: p.slug, number: slideNumber(i, featured.length), title: p.title, category: p.category, year: p.year, covers: coverSizes(p.slug) })),
    },
    keys: {
      keys: d.skills.all.slice(0, KEYS.maxKeys).map((s, cell) => ({ slug: s.slug, category: Math.max(0, cats.indexOf(s.category)), primary: s.primary, cell })),
      categories: cats.length,
      legends: "/textures/keycaps-legends.webp",
      matcaps: { phosphor: "/textures/matcap-phosphor.webp", amber: "/textures/matcap-amber.webp", paper: "/textures/matcap-paper.webp" },
    },
  };
}
