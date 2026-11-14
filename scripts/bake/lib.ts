import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Shared plumbing for the bake steps (DESIGN.md §8.2). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const OUT = {
  graph: join(ROOT, "content/graph.json"),
  citations: join(ROOT, "content/citations.json"),
  verify: join(ROOT, "content/verify.json"),
  searchIndex: join(ROOT, "public/search-index.json"),
} as const;

/**
 * dry     — placeholder content: no network, stable output, nothing can fail on a link.
 * offline — `--offline` / RETROGRADE_OFFLINE=1 (and `npm run dev`): keep the last network results.
 * live    — real content, network on: refresh citations, check every identifier.
 */
export type BakeMode = "dry" | "offline" | "live";

export function resolveMode(argv: readonly string[], env: Record<string, string | undefined>, isPlaceholder: boolean): BakeMode {
  if (isPlaceholder) return "dry";
  if (argv.includes("--offline") || env.RETROGRADE_OFFLINE === "1") return "offline";
  return "live";
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface StepContext {
  mode: BakeMode;
  now: Date;
  fetch: Fetch;
  warn: (message: string) => void;
}

/** Fails the build: the step's message is printed as the reason. */
export class BakeError extends Error {
  override name = "BakeError";
}

export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * JSON that diffs well: anything that fits on one line (≤ 120 columns) stays on one line, the
 * rest breaks one item per line. Same value → same bytes, which is what makes bakes comparable.
 */
export function formatJson(value: unknown, width = 120): string {
  const render = (v: unknown, indent: string, prefix: number): string => {
    const flat = JSON.stringify(v) ?? "null";
    if (v === null || typeof v !== "object" || indent.length + prefix + flat.length <= width) return flat;
    const inner = `${indent}  `;
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      return `[\n${v.map((item) => inner + render(item, inner, 0)).join(",\n")}\n${indent}]`;
    }
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    if (entries.length === 0) return "{}";
    return `{\n${entries
      .map(([k, x]) => {
        const key = `${JSON.stringify(k)}: `;
        return inner + key + render(x, inner, key.length);
      })
      .join(",\n")}\n${indent}}`;
  };
  return `${render(value, "", 0)}\n`;
}

/** Writes only when the bytes differ, so an unchanged bake doesn't touch mtimes (no HMR churn). */
export async function writeIfChanged(path: string, data: string | Uint8Array): Promise<boolean> {
  const next = typeof data === "string" ? Buffer.from(data) : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const previous = await readFile(path).catch(() => null);
  if (previous && Buffer.compare(previous, next) === 0) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next);
  return true;
}

export async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

/** Runs `task` over `items` with at most `limit` in flight; results keep the input order. */
export async function pool<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await task(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const REQUEST_TIMEOUT_MS = 10_000;
export const CONCURRENCY = 4;
export const USER_AGENT = "RETROGRADE-bake/1 (portfolio build; link and citation check)";

export type Probe = { kind: "response"; status: number; body: string } | { kind: "network"; reason: string };

/** One HTTP request that never throws: transport failures come back as `network`. */
export async function probe(fetchFn: Fetch, url: string, init: RequestInit = {}): Promise<Probe> {
  try {
    const res = await fetchFn(url, {
      redirect: "follow",
      ...init,
      headers: { "user-agent": USER_AGENT, accept: "application/json, text/html;q=0.9, */*;q=0.8", ...init.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = init.method === "HEAD" ? "" : await res.text().catch(() => "");
    return { kind: "response", status: res.status, body };
  } catch (error) {
    return { kind: "network", reason: error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error) };
  }
}
