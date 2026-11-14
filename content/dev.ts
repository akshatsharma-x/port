/**
 * DEV FIXTURE — chrome copy for /dev/content only, so the audit page hardcodes no text. The data it
 * shows comes from content/derive.ts; raw tables use the schema's own field names as headers.
 */
export const audit = {
  title: "Content audit",
  code: "RETROGRADE/OS · CONTENT AUDIT",
  intro:
    "Everything content/data.ts holds, everything content/derive.ts computes from it, and everything the bake wrote, on one page. Proofread here; edit content/data.ts; run npm run bake.",
  status: { placeholder: "Placeholder content", real: "Real content", builtOn: "Numbers as of", graphFresh: "fresh", graphStale: "stale — run npm run bake" },
  nav: "On this page",
  sections: {
    metrics: { id: "metrics", code: "DERIVE", title: "Derived metrics" },
    bake: { id: "bake", code: "BAKE", title: "Bake outputs" },
    warnings: { id: "warnings", code: "CHECK", title: "Warnings" },
    raw: { id: "raw", code: "DATA", title: "Raw data" },
  },
  metrics: {
    heroStrip: "Hero spec strip",
    research: "Research",
    provenance: "Provenance",
    byYear: "Publications by year",
    byYearNote: "One cell per record. Filled: published or accepted. Hollow: under review or in prep.",
    byVenueType: "By venue type",
    coAuthors: "Co-author frequency",
    credentials: "Credentials",
    byIssuer: "By issuer",
    byDomain: "By domain",
    records: "Records",
    career: "Career",
    skills: "Skills by category",
  },
  bake: {
    graph: "Publication graph",
    layouts: { topic: "Topic", year: "Year", venue: "Venue" },
    layoutNote:
      "Baked coordinates, each layout in the view that reads: Topic dimetric, Year oblique, Venue front-on. Shape is venue type, size is citations, and a dashed outline means not yet published. Hover a mark for its record.",
    legend: "Shape legend",
    citationsUnit: "citations",
    edgesByKind: "Edges by kind",
    citations: "Citations",
    verify: "Verify",
    searchIndex: "Search index",
  },
  warnings: { none: "No warnings.", count: "warnings" },
  empty: "—",
} as const;
