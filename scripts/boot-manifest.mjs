#!/usr/bin/env node
/**
 * postbuild: public/boot-manifest.json — what the boot streams, in real bytes (DESIGN.md §7.4:
 * "the percentage is real bytes"). The stage runtime is a dynamic import whose chunk list
 * Turbopack writes literally into the importing chunk; this finds the chunk that carries
 * StageRuntime (by the marker literal it alone carries), reads that import's full chunk list
 * (StageRuntime + three/R3F) and records each file's decoded size — what fetch() streams — and
 * the same for every file under /data/ (the scenes' data, which the boot counts too).
 *
 *   npm run build   (runs this after next build)
 */
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHUNKS = join(ROOT, ".next/static/chunks");
const OUT = join(ROOT, "public/boot-manifest.json");
const MARK = "retrograde:stage-runtime";

const files = readdirSync(CHUNKS).filter((f) => f.endsWith(".js"));
const text = new Map(files.map((f) => [f, readFileSync(join(CHUNKS, f), "utf8")]));
const marked = files.filter((f) => text.get(f).includes(MARK));
if (marked.length !== 1) {
  console.error(`[boot-manifest] expected one chunk carrying "${MARK}", found ${marked.length}: ${marked.join(", ")}`);
  process.exit(1);
}
// e.v(t=>Promise.all(["static/chunks/a.js","static/chunks/b.js"].map(t=>e.l(t))).then(()=>t(123)))
const LIST = /\[((?:"static\/chunks\/[^"]+\.js",?)+)\]\.map\(/g;
let set = null;
for (const src of text.values()) {
  for (const m of src.matchAll(LIST)) {
    const list = [...m[1].matchAll(/"static\/chunks\/([^"]+\.js)"/g)].map((x) => x[1]);
    if (list.includes(marked[0])) set = list;
  }
  if (set) break;
}
if (!set) {
  console.error(`[boot-manifest] no import lists ${marked[0]} — has Turbopack's chunk loading changed?`);
  process.exit(1);
}
const runtime = set.map((f) => ({ url: `/_next/static/chunks/${f}`, bytes: statSync(join(CHUNKS, f)).size }));

// every file the scenes fetch from /data/ — static ones from public/, route handlers prerendered at
// build (force-static) from their .body — at its decoded size: what a reader counts. Next serves
// the JSON gzipped and chunked, with no Content-Length, so this is the only place its size is known.
const data = [];
const walk = (dir, url, keep) => {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) walk(join(dir, e.name), `${url}/${e.name}`, keep);
    else if (keep(e.name)) data.push({ url: `${url}/${e.name.replace(/\.body$/, "")}`, bytes: statSync(join(dir, e.name)).size });
  }
};
walk(join(ROOT, "public/data"), "/data", () => true);
walk(join(ROOT, ".next/server/app/data"), "/data", (f) => f.endsWith(".body"));
data.sort((a, b) => a.url.localeCompare(b.url));

writeFileSync(OUT, `${JSON.stringify({ version: 2, runtime, data }, null, 2)}\n`);

// Turbopack also copies a module worker's TypeScript source into static/media, under a module
// no chunk ever requires (the worker itself ships as a bundled chunk): source is never an asset
const MEDIA = join(ROOT, ".next/static/media");
let strays = [];
try {
  strays = readdirSync(MEDIA).filter((f) => /\.(ts|tsx|mts)$/.test(f));
} catch {
  /* no media yet */
}
for (const f of strays) rmSync(join(MEDIA, f));
if (strays.length) console.log(`boot-manifest: removed ${strays.length} stray source file${strays.length === 1 ? "" : "s"} from static/media (${strays.join(", ")})`);
const total = runtime.reduce((n, c) => n + c.bytes, 0);
console.log(`boot-manifest: stage runtime = ${runtime.length} chunks, ${(total / 1e6).toFixed(2)} MB decoded · data = ${data.map((d) => `${d.url} ${d.bytes} B`).join(", ")} → public/boot-manifest.json`);
