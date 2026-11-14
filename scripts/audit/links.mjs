#!/usr/bin/env node
/**
 * The launch checklist's link scan (PROMPTS.md Part 15): every link the site has, resolved.
 *   - external: every https URL the built pages render (anchors, the JSON-LD's sameAs) or
 *     content/data.ts names; DOIs through doi.org's handle API, arXiv ids by their abstract page
 *     (as scripts/bake/verify.ts does); 401/403/429/999 are bot walls, reported, not "broken";
 *   - internal: every same-origin href and asset the pages and the sitemap name, each a 200.
 *
 *   BASE_URL=http://localhost:3200 node scripts/audit/links.mjs     (writes .artifacts/links.json)
 * Exits 1 if anything is broken.
 */
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 RETROGRADE-linkcheck";
const WALLS = new Set([401, 403, 429, 999]);

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const pages = ["/", ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).filter((p) => p !== "/"), "/this-page-does-not-exist"];
const external = new Set();
const internal = new Set(["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]);
const doi = new Set();
const arxiv = new Set();
for (const path of pages) {
  const html = await (await fetch(BASE + path)).text();
  for (const m of html.matchAll(/(?:href|src|content)="([^"]+)"/g)) {
    const u = m[1].replace(/&amp;/g, "&");
    if (/^https?:\/\//.test(u)) {
      const url = new URL(u);
      if (url.origin === new URL(BASE).origin || url.hostname === "localhost") internal.add(url.pathname + url.search);
      else external.add(url.href);
    } else if (u.startsWith("/") && !u.startsWith("//")) internal.add(u);
  }
  for (const m of html.matchAll(/"sameAs":(?:"([^"]+)"|\[([^\]]+)\])/g)) for (const s of (m[1] ? [m[1]] : m[2].split(",").map((x) => x.replace(/"/g, "")))) if (/^https:\/\//.test(s)) external.add(s);
}
const data = readFileSync(new URL("../../content/data.ts", import.meta.url), "utf8");
for (const m of data.matchAll(/https:\/\/[^\s"'`)]+/g)) external.add(m[0]);
for (const m of data.matchAll(/\bdoi:\s*"(10\.\d{4,9}\/[^"]+)"/g)) doi.add(m[1]);
for (const m of data.matchAll(/\barxivId:\s*"(\d{4}\.\d{4,5}(?:v\d+)?)"/g)) arxiv.add(m[1]);
// the next/image and chunk URLs are the build's own: checked by the gates, not here
const skip = (u) => /^\/_next\/(image|static)\b/.test(u);

async function probe(url, init = {}) {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000), ...init });
    if (res.status === 405 || res.status === 404 || res.status >= 500) res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(15_000), ...init });
    return { status: res.status, final: res.url };
  } catch (e) {
    return { status: 0, error: String(e?.cause?.code ?? e?.name ?? e) };
  }
}

const results = [];
for (const u of [...external].sort()) {
  const r = await probe(u);
  results.push({ kind: "external", url: u, ...r, verdict: r.status >= 200 && r.status < 400 ? "ok" : WALLS.has(r.status) ? "bot wall" : "broken" });
}
for (const d of doi) {
  const r = await probe(`https://doi.org/api/handles/${encodeURIComponent(d)}`, { method: "GET" });
  results.push({ kind: "doi", url: d, ...r, verdict: r.status === 200 ? "ok" : "broken" });
}
for (const a of arxiv) {
  const r = await probe(`https://arxiv.org/abs/${a}`);
  results.push({ kind: "arxiv", url: a, ...r, verdict: r.status === 200 ? "ok" : "broken" });
}
for (const u of [...internal].filter((u) => !skip(u)).sort()) {
  const res = await fetch(BASE + u, { redirect: "follow" });
  results.push({ kind: "internal", url: u, status: res.status, verdict: res.status === 200 || (u === "/this-page-does-not-exist" && res.status === 404) ? "ok" : "broken" });
}
writeFileSync(new URL("../../.artifacts/links.json", import.meta.url), JSON.stringify({ base: BASE, pages, results }, null, 2));
for (const r of results) console.log(`${r.verdict.padEnd(9)} ${String(r.status).padStart(3)}  ${r.kind.padEnd(8)} ${r.url}${r.final && r.final !== r.url ? `  → ${r.final}` : ""}${r.error ? `  (${r.error})` : ""}`);
const broken = results.filter((r) => r.verdict === "broken");
console.log(`\n${results.length} links: ${results.filter((r) => r.verdict === "ok").length} ok, ${results.filter((r) => r.verdict === "bot wall").length} behind a bot wall, ${broken.length} broken · DOIs ${doi.size}, arXiv ids ${arxiv.size}`);
process.exit(broken.length ? 1 : 0);
