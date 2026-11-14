import type { MetadataRoute } from "next";
import { derived } from "@/content/derive";
import { absolute } from "@/lib/site";

/**
 * sitemap.xml (PROMPTS.md Part 15): home, every case study, every paper's page — the routes a
 * visitor can land on. Dated by the build that derived them (content/derive.ts buildDate).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const d = derived;
  const at = d.buildDate;
  return [
    { url: absolute("/"), lastModified: at, changeFrequency: "monthly", priority: 1 },
    ...d.publications.map((p) => ({ url: absolute(`/research/${p.slug}`), lastModified: at, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...d.projects.map((p) => ({ url: absolute(`/work/${p.slug}`), lastModified: at, changeFrequency: "yearly" as const, priority: 0.7 })),
  ];
}
