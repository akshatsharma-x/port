import type { Derived } from "@/content/selectors";

/**
 * The share cards' paths and alt texts (PROMPTS.md Part 15) — pure, so the pages' metadata
 * (lib/seo.ts) can name a card without importing next/og: its WebAssembly anywhere in the app's
 * graph puts Turbopack's async-module runtime in every page's first-load JS (0.45 KB gz, measured).
 * The cards themselves are lib/og-cards.tsx, rendered by the bake (scripts/bake/og.ts).
 */
export const ogPath = (page: "home" | { work: string } | { research: string }): string =>
  page === "home" ? "/og/home.png" : "work" in page ? `/og/work/${page.work}.png` : `/og/research/${page.research}.png`;

/** Fills a content template's {braces} from a record (unknown keys stay visible). */
export const fillTemplate = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export const homeAlt = (d: Derived) => fillTemplate(d.site.meta.ogAlt.home, { name: d.profile.name, role: d.profile.role });
export const projectAlt = (d: Derived, p: Derived["projects"][number]) => fillTemplate(d.site.meta.ogAlt.project, { title: p.title, subtitle: p.subtitle });
export const paperAlt = (d: Derived, p: Derived["publications"][number]) => fillTemplate(d.site.meta.ogAlt.paper, { title: p.title, venue: p.venueShort, year: p.year });
