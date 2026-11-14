import { CitationsFileSchema, type CitationsFile, type Content } from "../../content/schema";
import { CONCURRENCY, formatJson, isoDay, OUT, pool, probe, readJson, writeIfChanged, type StepContext } from "./lib";

/**
 * citations (DESIGN.md §8.2) → content/citations.json: cited_by_count from OpenAlex for every
 * paper with a DOI, each stamped with the date it was read. derive() overlays these on the
 * content/data.ts counts and labels each figure with its source and as-of date (law 2). Since
 * v1.9 the works my papers cite are read too, by DOI: their stars' sizes in ARCHIVE's sky.
 *
 * Never fails the build. Unreachable API → the last values stay, with their own dates, and a
 * warning. A DOI OpenAlex doesn't index → that paper keeps its content/data.ts count and source.
 */
export const OPENALEX_API = "https://api.openalex.org";

export const DRY_CITATIONS: CitationsFile = { version: 1, mode: "dry", source: null, asOf: null, counts: {}, cited: {} };

const encodeDoi = (doi: string) => doi.split("/").map(encodeURIComponent).join("/");

export function openAlexUrl(doi: string, env: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams({ select: "id,doi,cited_by_count" });
  // The polite pool (mailto) and an API key are both optional; neither is required to read.
  if (env.OPENALEX_MAILTO) params.set("mailto", env.OPENALEX_MAILTO);
  if (env.OPENALEX_API_KEY) params.set("api_key", env.OPENALEX_API_KEY);
  return `${OPENALEX_API}/works/doi:${encodeDoi(doi)}?${params}`;
}

type Outcome =
  | { kind: "ok"; citations: number; openalexId: string }
  | { kind: "missing" }
  | { kind: "error"; detail: string }
  | { kind: "network"; detail: string }
  | { kind: "skipped" };

function parseWork(body: string): { citations: number; openalexId: string } | null {
  try {
    const json = JSON.parse(body) as { id?: unknown; cited_by_count?: unknown };
    const n = json.cited_by_count;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || typeof json.id !== "string") return null;
    return { citations: n, openalexId: json.id.replace(/^https:\/\/openalex\.org\//, "") };
  } catch {
    return null;
  }
}

type Counts = CitationsFile["counts"];
/** what's looked up: my papers (`counts`, by slug) and the works they cite (`cited`, by id, v1.9) */
interface Item {
  group: "counts" | "cited";
  key: string;
  doi: string;
  label: string;
}

export async function refreshCitations(
  content: Content,
  previous: CitationsFile | null,
  ctx: StepContext & { env?: Record<string, string | undefined> },
): Promise<{ file: CitationsFile; summary: string }> {
  if (ctx.mode === "dry") return { file: DRY_CITATIONS, summary: "dry — placeholder content; counts come from content/data.ts" };
  if (ctx.mode === "offline") {
    return {
      file: previous ?? DRY_CITATIONS,
      summary: previous?.asOf ? `offline — kept counts read on ${previous.asOf}` : "offline — counts come from content/data.ts",
    };
  }

  const today = isoDay(ctx.now);
  const byKey = (a: { key: string }, b: { key: string }) => (a.key < b.key ? -1 : 1);
  const items: Item[] = [
    ...content.publications.flatMap((p) => (p.doi ? [{ group: "counts" as const, key: p.slug, doi: p.doi, label: p.slug }] : [])).sort(byKey),
    ...content.citedWorks.flatMap((w) => (w.doi ? [{ group: "cited" as const, key: w.id, doi: w.doi, label: `cited work ${w.id}` }] : [])).sort(byKey),
  ];
  let down = false; // the first transport failure means no network: don't wait out every timeout
  const outcomes = await pool(items, CONCURRENCY, async (it): Promise<Outcome> => {
    if (down) return { kind: "skipped" };
    const r = await probe(ctx.fetch, openAlexUrl(it.doi, ctx.env));
    if (r.kind === "network") {
      down = true;
      return { kind: "network", detail: r.reason };
    }
    if (r.status === 404) return { kind: "missing" };
    if (r.status !== 200) return { kind: "error", detail: `HTTP ${r.status}` };
    const work = parseWork(r.body);
    return work ? { kind: "ok", ...work } : { kind: "error", detail: "unexpected response" };
  });

  const maps: Record<Item["group"], Counts> = { counts: {}, cited: {} };
  const refreshed = { counts: 0, cited: 0 };
  let kept = 0;
  items.forEach((it, i) => {
    const o = outcomes[i];
    if (o?.kind === "ok") {
      maps[it.group][it.key] = { doi: it.doi, citations: o.citations, openalexId: o.openalexId, asOf: today };
      refreshed[it.group]++;
      return;
    }
    if (o?.kind === "missing") {
      ctx.warn(`citations: OpenAlex has no record of ${it.doi} (${it.label}) — ${it.group === "counts" ? "keeping its content/data.ts count" : "its star stays the smallest"}`);
      return;
    }
    if (o?.kind === "error") ctx.warn(`citations: ${it.label} — ${o.detail} from OpenAlex; keeping the last value`);
    const last = previous?.[it.group][it.key];
    if (last && last.doi === it.doi) {
      maps[it.group][it.key] = last;
      kept++;
    }
  });

  const total = refreshed.counts + refreshed.cited;
  if (total === 0 && down) {
    const reason = outcomes.find((o) => o.kind === "network");
    ctx.warn(`citations: OpenAlex unreachable (${reason?.kind === "network" ? reason.detail : "network"}) — kept the last values`);
    return { file: previous ?? DRY_CITATIONS, summary: previous?.asOf ? `unreachable — kept counts read on ${previous.asOf}` : "unreachable — counts come from content/data.ts" };
  }

  const papers = items.filter((it) => it.group === "counts").length;
  const cited = items.length - papers;
  const file = CitationsFileSchema.parse({ version: 1, mode: "live", source: "OpenAlex", asOf: total > 0 ? today : (previous?.asOf ?? null), counts: maps.counts, cited: maps.cited });
  return {
    file,
    summary: `${refreshed.counts}/${papers} refreshed from OpenAlex${cited ? ` · cited works ${refreshed.cited}/${cited}` : ""}${kept ? ` · ${kept} kept from an earlier run` : ""}`,
  };
}

export async function citationsStep(content: Content, ctx: StepContext): Promise<string> {
  const parsed = CitationsFileSchema.safeParse(await readJson(OUT.citations));
  const { file, summary } = await refreshCitations(content, parsed.success ? parsed.data : null, { ...ctx, env: process.env });
  const changed = await writeIfChanged(OUT.citations, formatJson(file));
  return `${summary}${changed ? "" : " · unchanged"}`;
}
