import { VerifyFileSchema, type Content, type VerifyFile, type VerifyStatus } from "../../content/schema";
import { BakeError, CONCURRENCY, formatJson, isoDay, OUT, pool, probe, readJson, writeIfChanged, type Probe, type StepContext } from "./lib";

/**
 * verify (DESIGN.md §8.2) → content/verify.json: every DOI, arXiv id and credential verifyUrl,
 * checked at build time.
 *
 *   DOI       doi.org handle API: responseCode 1 = registered, 100 = no such DOI. Asking the
 *             registry directly avoids publisher sites, which often answer bots with 403.
 *   arXiv     HEAD arxiv.org/abs/<id>: 200 or 404.
 *   verifyUrl GET, following redirects: 2xx ok · 404/410 dead · 401/403/429/999 blocked (bot walls).
 *
 * A dead DOI or arXiv id fails the build: a paper must resolve. A credential whose URL is dead,
 * blocked or unreachable shows ON FILE instead of VERIFIED, with a warning (law 2: never claim a
 * check we didn't pass). Only failures observed in this run fail it, so offline builds always work.
 *
 * A credential page behind a sign-in (SIGN_IN_WALLS, v2.8) is never fetched: logged out, LinkedIn
 * answers a bot with HTTP 999 and a browser with its sign-in page, a 200 that would pass for proof.
 * It's recorded as blocked, so the card reads ON FILE; the link still opens for a signed-in visitor.
 */
export const SIGN_IN_WALLS = ["linkedin.com"] as const;

/** Whether a URL's host is one of SIGN_IN_WALLS (or a subdomain of one). */
export function behindSignIn(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return SIGN_IN_WALLS.some((w) => host === w || host.endsWith(`.${w}`));
  } catch {
    return false;
  }
}
export const DOI_HANDLE_API = "https://doi.org/api/handles";
export const ARXIV_ABS = "https://arxiv.org/abs";

type Kind = VerifyFile["results"][string]["kind"];
type Result = VerifyFile["results"][string];
export interface VerifyTarget {
  key: string;
  kind: Kind;
  owner: string;
  target: string;
}

export function verifyTargets(content: Content): VerifyTarget[] {
  const out: VerifyTarget[] = [];
  for (const p of content.publications) {
    if (p.doi) out.push({ key: `doi:${p.doi}`, kind: "doi", owner: p.slug, target: p.doi });
    if (p.arxivId) out.push({ key: `arxiv:${p.arxivId}`, kind: "arxiv", owner: p.slug, target: p.arxivId });
  }
  for (const c of content.certificates) {
    if (c.verifyUrl) out.push({ key: `verifyUrl:${c.slug}`, kind: "verifyUrl", owner: c.slug, target: c.verifyUrl });
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const skipped = (t: VerifyTarget): Result => ({ kind: t.kind, owner: t.owner, target: t.target, status: "skipped", httpStatus: null, checkedAt: null });

export function dryVerify(content: Content): VerifyFile {
  return { version: 1, mode: "dry", results: Object.fromEntries(verifyTargets(content).map((t) => [t.key, skipped(t)])) };
}

const encodePath = (s: string) => s.split("/").map(encodeURIComponent).join("/");

export function requestFor(t: VerifyTarget): { url: string; init: RequestInit } {
  if (t.kind === "doi") return { url: `${DOI_HANDLE_API}/${encodePath(t.target)}`, init: { method: "GET" } };
  if (t.kind === "arxiv") return { url: `${ARXIV_ABS}/${encodeURIComponent(t.target)}`, init: { method: "HEAD" } };
  return { url: t.target, init: { method: "GET", headers: { accept: "text/html,application/xhtml+xml" } } };
}

export function classify(kind: Kind, r: Probe): VerifyStatus {
  if (r.kind === "network") return "unreachable";
  const s = r.status;
  if (kind === "doi") {
    if (s === 404) return "dead";
    if (s !== 200) return s === 403 || s === 429 ? "blocked" : "unreachable";
    try {
      const code = (JSON.parse(r.body) as { responseCode?: unknown }).responseCode;
      // 1 = handle found; 200 = found, but no values of the requested type; 100 = not found
      return code === 1 || code === 200 ? "ok" : code === 100 ? "dead" : "unreachable";
    } catch {
      return "unreachable";
    }
  }
  if (s >= 200 && s < 300) return "ok";
  if (s === 404 || s === 410) return "dead";
  if (s === 401 || s === 403 || s === 429 || s === 999) return "blocked";
  if (s >= 500) return "unreachable";
  return kind === "arxiv" ? "unreachable" : "dead";
}

export async function verifyLinks(
  content: Content,
  previous: VerifyFile | null,
  ctx: StepContext,
): Promise<{ file: VerifyFile; summary: string; failures: string[] }> {
  const targets = verifyTargets(content);
  if (ctx.mode === "dry") return { file: dryVerify(content), summary: `dry — ${targets.length} checks skipped (placeholder content)`, failures: [] };

  // Results for targets that still exist; anything new is unchecked until the next live run.
  const carried = (t: VerifyTarget): Result => {
    const last = previous?.results[t.key];
    return last && last.target === t.target && last.owner === t.owner ? last : skipped(t);
  };
  if (ctx.mode === "offline") {
    const file: VerifyFile = { version: 1, mode: previous?.mode ?? "dry", results: Object.fromEntries(targets.map((t) => [t.key, carried(t)])) };
    return { file, summary: `offline — kept ${Object.values(file.results).filter((r) => r.checkedAt).length}/${targets.length} earlier results`, failures: [] };
  }

  const today = isoDay(ctx.now);
  let down = false;
  const walled = new Set(targets.filter((t) => t.kind === "verifyUrl" && behindSignIn(t.target)).map((t) => t.key));
  const probes = await pool(targets, CONCURRENCY, async (t) => {
    if (down || walled.has(t.key)) return null;
    const { url, init } = requestFor(t);
    const r = await probe(ctx.fetch, url, init);
    if (r.kind === "network" && t.kind === "doi") down = true; // the registry itself is unreachable: assume offline
    return r;
  });

  const results: VerifyFile["results"] = {};
  const failures: string[] = [];
  let checked = 0;
  targets.forEach((t, i) => {
    if (walled.has(t.key)) {
      results[t.key] = { kind: t.kind, owner: t.owner, target: t.target, status: "blocked", httpStatus: null, checkedAt: today };
      return;
    }
    const r = probes[i];
    if (!r) {
      results[t.key] = carried(t);
      return;
    }
    const status = classify(t.kind, r);
    if (status === "unreachable" && r.kind === "network") {
      // can't tell: keep the last result (with its own date) rather than inventing one
      const last = carried(t);
      results[t.key] = last.checkedAt ? last : { ...last, status: "unreachable", checkedAt: today };
      ctx.warn(`verify: ${t.kind} ${t.target} (${t.owner}) unreachable — ${r.reason}`);
      return;
    }
    checked++;
    results[t.key] = { kind: t.kind, owner: t.owner, target: t.target, status, httpStatus: r.kind === "response" ? r.status : null, checkedAt: today };
    const http = r.kind === "response" ? ` (HTTP ${r.status})` : "";
    if (status === "dead" && t.kind !== "verifyUrl") failures.push(`${t.kind === "doi" ? "DOI" : "arXiv id"} ${t.target} on ${t.owner} does not resolve${http}`);
    else if (t.kind === "verifyUrl" && status !== "ok") ctx.warn(`verify: credential ${t.owner} verify URL is ${status}${http} — it shows ON FILE, not VERIFIED`);
    else if (status !== "ok") ctx.warn(`verify: ${t.kind} ${t.target} (${t.owner}) is ${status}${http} — not counted as verified`);
  });
  if (down) ctx.warn("verify: doi.org unreachable — kept earlier results for the remaining checks");
  if (walled.size) ctx.warn(`verify: ${walled.size} credential link${walled.size === 1 ? " needs" : "s need"} a sign-in (${SIGN_IN_WALLS.join(", ")}) — not fetched, they show ON FILE`);

  const file = VerifyFileSchema.parse({ version: 1, mode: "live", results });
  const ok = Object.values(results).filter((r) => r.status === "ok").length;
  return { file, summary: `${checked}/${targets.length} checked · ${ok} ok${walled.size ? ` · ${walled.size} behind a sign-in` : ""}${failures.length ? ` · ${failures.length} dead` : ""}`, failures };
}

export async function verifyStep(content: Content, ctx: StepContext): Promise<string> {
  const parsed = VerifyFileSchema.safeParse(await readJson(OUT.verify));
  const { file, summary, failures } = await verifyLinks(content, parsed.success ? parsed.data : null, ctx);
  // Written before failing, so /dev/content shows exactly which identifier is dead.
  const changed = await writeIfChanged(OUT.verify, formatJson(file));
  if (failures.length) throw new BakeError(`dead identifiers — fix them in content/data.ts:\n  ${failures.join("\n  ")}`);
  return `${summary}${changed ? "" : " · unchanged"}`;
}
