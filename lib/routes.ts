import type { SectionId } from "@/content/schema";

/**
 * Every URL the site links to internally (DESIGN.md §7). Records with their own page get a route;
 * everything else is an anchor on home. One table, so the terminal's `open`, the nav and the
 * search index can't disagree.
 */
export const routes = {
  home: "/",
  section: (id: SectionId) => `/#${id}`,
  paper: (slug: string) => `/research/${slug}`,
  project: (slug: string) => `/work/${slug}`,
} as const;
