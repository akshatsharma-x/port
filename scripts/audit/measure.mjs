#!/usr/bin/env node
/**
 * Part 14's measurements against DESIGN.md §8.3, one table before and after.
 *
 *   BASE_URL=http://localhost:3200 node scripts/audit/measure.mjs <tag>   (a production build; the
 *   gates' reports in .artifacts/<tag>/ for the scene profiles, Lighthouse's in .artifacts/<tag>/lh/)
 *
 * - Bundles: first-load JS, CSS and HTML per route (gzip -9 of what a modern browser downloads, the
 *   method of scripts/weight.mjs); the stage runtime (public/boot-manifest.json); each scene's own
 *   chunk, recorded in the browser as each section's scene arrives; the terminal's.
 * - Assets: the fonts (all, and those preloaded) and the textures (all, the largest file).
 * - The five Tier-A scenes, per tier, from the gates' reports: draw calls, VRAM (scene + post), the
 *   saturated GPU frame (the true cost on Apple GPUs, §8.3) and the timer's p95, CPU, fps.
 * - Web vitals: Lighthouse's LCP, CLS and TBT (its reports), and INP measured here — the Event
 *   Timing API over the site's interactions, unthrottled and at 4× CPU.
 * Writes .artifacts/<tag>/budgets.json and prints the table.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";
import { inp } from "./inp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const ROOT = new URL("../../", import.meta.url).pathname;
const TAG = process.argv[2] ?? "now";
const DIR = join(ROOT, ".artifacts", TAG);
const ROUTES = ["/", "/work/cognivault-ai", "/research/food-waste-cold-chain-sci-2026", "/this-page-does-not-exist"];
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => +(n / 1000).toFixed(1);
const out = { tag: TAG, base: BASE, measuredAt: new Date().toISOString() };

// ── bundles per route ────────────────────────────────────────────────────────────────────────
out.routes = {};
for (const route of ROUTES) {
  const res = await fetch(BASE + route);
  const html = await res.text();
  const scripts = [...new Set([...html.matchAll(/<script([^>]*)src="([^"]+)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))];
  const styles = [...new Set([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]))];
  let js = 0;
  for (const s of scripts) js += gz(Buffer.from(await (await fetch(BASE + s)).arrayBuffer()));
  let css = 0;
  for (const s of styles) css += gz(Buffer.from(await (await fetch(BASE + s)).arrayBuffer()));
  out.routes[route] = { status: res.status, jsKB: kb(js), cssKB: kb(css), htmlKB: kb(gz(Buffer.from(html))) };
}

// ── the stage runtime, the fonts, the textures ──────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(join(ROOT, "public/boot-manifest.json"), "utf8"));
let runtime = 0;
for (const c of manifest.runtime ?? []) {
  const url = c.url;
  if (url) runtime += gz(Buffer.from(await (await fetch(BASE + url)).arrayBuffer()));
}
out.runtimeKB = kb(runtime);
const home = await (await fetch(BASE + "/")).text();
const media = join(ROOT, ".next/static/media");
const fonts = existsSync(media) ? readdirSync(media).filter((f) => f.endsWith(".woff2")) : [];
// next/font emits the subset each face uses; the set is the one the pages link
const linked = [...new Set([...home.matchAll(/\/_next\/static\/media\/([^"')]+\.woff2)/g)].map((m) => m[1]))];
const fontBytes = (names) => names.reduce((n, f) => n + (existsSync(join(media, f)) ? statSync(join(media, f)).size : 0), 0);
out.fonts = { files: fonts.length, totalKB: kb(fontBytes(fonts)), preloadedKB: kb(fontBytes(linked)), preloaded: linked.length };
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);
const textures = [...walk(join(ROOT, "public/textures")), ...walk(join(ROOT, "public/media/projects")).filter((f) => /cover-\d+\.avif$/.test(f)), ...walk(join(ROOT, "public/posters")), ...walk(join(ROOT, "public/data")).filter((f) => f.endsWith(".bin"))];
const sizes = textures.map((f) => ({ f: f.slice(ROOT.length), b: statSync(f).size }));
out.textures = { files: sizes.length, totalKB: kb(sizes.reduce((n, x) => n + x.b, 0)), largest: sizes.sort((a, b) => b.b - a.b)[0] ? { file: sizes[0].f, kb: kb(sizes[0].b) } : null };

// ── each scene's own chunk: the built chunks that carry its shaders' uniforms ─────────────────
// (in the browser they arrive early — the governor prefetches them on idle — so they're found here)
const MARKERS = { system: ["uProfile", "uNdcPerWorld"], log: ["uStock", "uHole"], archive: ["uFogShape", "uFaint"], work: ["uSmear", "uMount"], capabilities: ["uShadow"] };
const chunkDir = join(ROOT, ".next/static/chunks");
const chunkFiles = existsSync(chunkDir) ? readdirSync(chunkDir).filter((f) => f.endsWith(".js")) : [];
const runtimeFiles = new Set((manifest.runtime ?? []).map((c) => c.url.split("/").pop()));
out.scenes = {};
for (const [scene, marks] of Object.entries(MARKERS)) {
  const hits = chunkFiles.filter((f) => {
    const text = readFileSync(join(chunkDir, f), "utf8");
    return marks.every((m) => text.includes(m));
  });
  const own = hits.filter((f) => !runtimeFiles.has(f));
  out.scenes[scene] = { chunks: own.length, inRuntime: hits.some((f) => runtimeFiles.has(f)), kb: kb(own.reduce((n, f) => n + gz(readFileSync(join(chunkDir, f))), 0)) };
}
const browser = await chromium.launch({ channel: "chrome" });

out.inp = { desktop: await inp(browser, BASE, 1), cpu4x: await inp(browser, BASE, 4) };

// ── the stage at HIGH: warm-up per scene, geometry while LIVE, the JS heap after a full pass, and
// the texture bytes fetched before the first stage is live (§8.3) ─────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => sessionStorage.setItem("retrograde:booted", "1"));
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const fetched = [];
  let liveAt = null;
  page.on("response", async (r) => {
    const u = r.url().replace(BASE, "");
    if (!/^\/(textures|posters|data|media\/projects)\//.test(u)) return;
    const len = Number(r.headers()["content-length"] ?? 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
    fetched.push({ u, len, t: Date.now() });
  });
  await page.goto(`${BASE}/?debug=1&tier=HIGH`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__retrograde?.governor?.snapshot?.scenes?.system?.state === "LIVE" && window.__retrograde.governor.snapshot.scenes.system.drawable, null, { timeout: 60_000, polling: 16 });
  liveAt = Date.now();
  const stage = {};
  for (const id of ["system", "log", "archive", "work", "capabilities"]) {
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      const y = el.getBoundingClientRect().top + scrollY;
      window.__retrograde.lenis().scrollTo(y, { immediate: true, force: true });
    }, id);
    await page.waitForFunction((id) => window.__retrograde.governor.snapshot.scenes[id].state === "LIVE", id, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    stage[id] = await page.evaluate((id) => {
      const g = window.__retrograde.governor;
      return { warmMs: g.snapshot.scenes[id].warmMs, triangles: g.stats.last.triangles, points: g.stats.last.points, calls: g.stats.last.calls };
    }, id);
  }
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
  const heap = await cdp.send("Runtime.getHeapUsage");
  const before = fetched.filter((f) => f.t <= liveAt);
  out.stage = { scenes: stage, heapMB: +(heap.usedSize / 1e6).toFixed(1), texturesBeforeLiveKB: kb(before.reduce((n, f) => n + f.len, 0)), texturesBeforeLive: before.map((f) => f.u) };
  await ctx.close();
}
// audio: the cues are synthesized; lib/audio.ts's SAMPLES names the files there are (fetched after enable)
{
  const table = /export const SAMPLES[^=]*=\s*\{([^}]*)\}/.exec(readFileSync(join(ROOT, "lib/audio.ts"), "utf8"))?.[1] ?? "";
  const urls = [...table.matchAll(/["'](\/[^"']+)["']/g)].map((m) => m[1]);
  out.audio = { files: urls.length, kb: kb(urls.reduce((n, u) => n + (existsSync(join(ROOT, "public", u)) ? statSync(join(ROOT, "public", u)).size : 0), 0)) };
}
await browser.close();

// ── the five scenes' profiles, from the gates' reports ───────────────────────────────────────
const report = (g) => (existsSync(join(DIR, `${g}-gate.json`)) ? JSON.parse(readFileSync(join(DIR, `${g}-gate.json`), "utf8")) : null);
out.profiles = {};
for (const [scene, g] of [["system (hero)", "hero"], ["log", "log"], ["archive", "archive"], ["work", "work"], ["capabilities", "capabilities"]]) {
  const r = report(g);
  if (!r?.tiers) continue;
  out.profiles[scene] = {};
  for (const [tier, t] of Object.entries(r.tiers)) {
    const rows = (t.rows ?? []).filter((x) => typeof x === "object");
    if (!rows.length) continue;
    const max = (k) => Math.max(...rows.map((x) => x[k] ?? 0));
    const min = (k) => Math.min(...rows.map((x) => x[k] ?? Infinity));
    out.profiles[scene][tier] = {
      calls: max("calls"),
      vramMB: +Math.max(...rows.map((x) => (x.vram ? (x.vram.sceneMB ?? 0) + (x.vram.postMB ?? 0) : (x.vramMB ?? 0)))).toFixed(1),
      saturatedMs: +max("saturatedMs").toFixed(2),
      gpuP95: +max("gpuP95").toFixed(2),
      cpuP50: +max("cpuP50").toFixed(2),
      fps: min("fps"),
      points: max("points") || undefined,
    };
  }
}

// ── Lighthouse's vitals, if its reports are here ─────────────────────────────────────────────
const lh = join(DIR, "lh");
if (existsSync(lh)) {
  out.lighthouse = {};
  for (const f of readdirSync(lh).filter((x) => x.endsWith(".json"))) {
    const r = JSON.parse(readFileSync(join(lh, f), "utf8"));
    const a = r.audits;
    out.lighthouse[f.replace(/\.json$/, "")] = { url: r.finalDisplayedUrl?.replace(BASE, ""), perf: Math.round(r.categories.performance.score * 100), a11y: Math.round((r.categories.accessibility?.score ?? 0) * 100), lcpMs: Math.round(a["largest-contentful-paint"].numericValue), cls: +a["cumulative-layout-shift"].numericValue.toFixed(3), tbtMs: Math.round(a["total-blocking-time"].numericValue), bench: Math.round(r.environment.benchmarkIndex) };
  }
}

writeFileSync(join(DIR, "budgets.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
