import { describe, expect, it } from "vitest";
import citationsJson from "@/content/citations.json";
import { data } from "@/content/data";
import graphJson from "@/content/graph.json";
import { CitationsFileSchema, GraphFileSchema, parseContent, VerifyFileSchema } from "@/content/schema";
import { derive } from "@/content/selectors";
import verifyJson from "@/content/verify.json";

/**
 * The real content (content/data.ts, from the owner's résumés): it's marked real, nothing of the
 * placeholder persona is left in it, and it never publishes what the site promised not to.
 */
const NOW = new Date("2026-11-11T12:00:00Z");
const content = parseContent(data);
const d = derive(content, { citations: CitationsFileSchema.parse(citationsJson), verify: VerifyFileSchema.parse(verifyJson), graph: GraphFileSchema.parse(graphJson) }, NOW);
const all = JSON.stringify(data);

describe("the real content", () => {
  it("is marked real, and the bake runs live on it", () => {
    expect(content.isPlaceholder).toBe(false);
  });

  it("carries nothing of the placeholder persona or its fake identifiers", () => {
    for (const fake of ["Noor", "Halvorsen", ".example", "10.5555/", "PLACEHOLDER"]) expect(all).not.toContain(fake);
  });

  it("publishes no phone number", () => {
    expect(all).not.toMatch(/\+?\d[\d\s-]{9,}\d/);
  });

  it("derives the hero strip from the record: 1 year since July 2025, 5 projects, 2 papers, 0 citations", () => {
    expect(Object.fromEntries(d.heroStrip.map((s) => [s.key, s.value]))).toEqual({ years: 1, shipped: 5, papers: 2, citations: 0 });
  });

  it("has a fresh graph: my papers first, then the works they cite, one cites edge per citing pair", () => {
    expect(d.graph.stale).toBe(false);
    const records = content.publications.map((p) => p.slug).sort();
    const cited = content.citedWorks.map((w) => w.id).sort();
    expect(d.graph.nodes.map((n) => n.id)).toEqual([...records, ...cited]);
    expect(d.graph.nodes.map((n) => n.kind)).toEqual([...records.map(() => "record"), ...cited.map(() => "cited")]);
    // two papers, one topic thread between them; no co-authors listed yet, no related links
    expect(d.graph.edgeCounts).toEqual({ author: 0, related: 0, topic: 1, cites: content.citedWorks.reduce((n, w) => n + w.citedBy.length, 0) });
  });

  it("sets at most three accent phrases per bio paragraph, each in its paragraph", () => {
    const accents = content.profile.bio.accents ?? [];
    expect(accents.length).toBe(content.profile.bio.long.length);
    accents.forEach((list, i) => {
      expect(list.length).toBeLessThanOrEqual(3);
      for (const phrase of list) expect(content.profile.bio.long[i]).toContain(phrase);
    });
  });
});
