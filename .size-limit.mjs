/**
 * DESIGN.md §8.3's bundle and asset budgets, for size-limit (npm run size; CI), read from the
 * production build on disk (bake → next build → scripts/boot-manifest.mjs first).
 *
 * The same bytes scripts/weight.mjs and scripts/audit/measure.mjs count:
 *   - a route's first load: every <script src> its prerendered HTML names (noModule excluded —
 *     modern browsers never fetch it), gzipped
 *   - the stage runtime: public/boot-manifest.json's runtime chunks
 *   - a scene: the chunks carrying its shaders' uniforms, the runtime's own apart
 *   - the terminal: the chunk carrying its history key (only the panel's does)
 *   - fonts, textures: the files as served (already compressed formats), not gzipped
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const NEXT = ".next";
const CHUNKS = join(NEXT, "static/chunks");
const page = (file) => readFileSync(join(NEXT, "server/app", file), "utf8");
const firstLoad = (html) =>
  [...new Set([...html.matchAll(/<script([^>]*)src="([^"]+)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))].map((src) => join(NEXT, src.replace(/^\/_next\//, "").split("?")[0]));
const chunkFiles = readdirSync(CHUNKS).filter((f) => f.endsWith(".js"));
const text = (f) => readFileSync(join(CHUNKS, f), "utf8");
const manifest = JSON.parse(readFileSync("public/boot-manifest.json", "utf8"));
const runtime = manifest.runtime.map((c) => join(NEXT, c.url.replace(/^\/_next\//, "")));
const runtimeNames = new Set(runtime.map((f) => f.split("/").pop()));
const home = page("index.html");
const homeFirst = new Set(firstLoad(home).map((f) => f.split("/").pop()));
const carrying = (...marks) => chunkFiles.filter((f) => !runtimeNames.has(f) && !homeFirst.has(f) && marks.every((m) => text(f).includes(m))).map((f) => join(CHUNKS, f));
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);
const media = join(NEXT, "static/media");
const fonts = readdirSync(media).filter((f) => f.endsWith(".woff2"));
const preloaded = [...new Set([...home.matchAll(/<link[^>]+rel="preload"[^>]+href="\/_next\/static\/media\/([^"]+\.woff2)"/g)].map((m) => m[1]))];
const textures = [...walk("public/textures"), ...walk("public/media/projects").filter((f) => /cover-\d+\.avif$/.test(f)), ...walk("public/posters"), ...walk("public/data").filter((f) => f.endsWith(".bin"))];
const largest = textures.reduce((a, f) => (statSync(f).size > statSync(a).size ? f : a), textures[0]);
// shader uniforms only a scene's own chunk carries (scripts/audit/measure.mjs)
const SCENES = { system: ["uProfile", "uNdcPerWorld"], log: ["uStock", "uHole"], archive: ["uFogShape", "uFaint"], work: ["uSmear", "uMount"], capabilities: ["uShadow"] };
const gz = { gzip: true, brotli: false };
const raw = { gzip: false, brotli: false };

const budgets = [
  { name: "first-load JS · /", path: firstLoad(home), limit: "230 kB", ...gz },
  { name: "first-load JS · / (hard cap)", path: firstLoad(home), limit: "280 kB", ...gz },
  { name: "first-load JS · a case study", path: firstLoad(page("work/cognivault-ai.html")), limit: "230 kB", ...gz },
  { name: "first-load JS · a paper", path: firstLoad(page("research/food-waste-cold-chain-sci-2026.html")), limit: "230 kB", ...gz },
  // 60 until the owner's content (DESIGN.md v2.8, §8.3): the wall's fifteen cards and eleven projects; Vercel serves it as Brotli, 42 KB
  { name: "HTML · /", path: join(NEXT, "server/app/index.html"), limit: "70 kB", ...gz },
  { name: "stage runtime", path: runtime, limit: "250 kB", ...gz },
  ...Object.entries(SCENES).map(([id, marks]) => ({ name: `scene · ${id}`, path: carrying(...marks), limit: "35 kB", ...gz })),
  { name: "terminal", path: carrying("retrograde:shell-history"), limit: "30 kB", ...gz },
  { name: "terminal · its index", path: "public/search-index.json", limit: "60 kB", ...gz },
  { name: "fonts · all", path: fonts.map((f) => join(media, f)), limit: "165 kB", ...raw },
  { name: "fonts · preloaded", path: preloaded.map((f) => join(media, f)), limit: "125 kB", ...raw },
  { name: "textures · all", path: textures, limit: "2.5 MB", ...raw },
  { name: "textures · the largest file", path: largest, limit: "600 kB", ...raw },
];

export default budgets;
