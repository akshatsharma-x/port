#!/usr/bin/env node
/**
 * Long tasks in a throttled phone load, attributed (PROMPTS.md Part 15's trace of Part 14's 160 ms
 * outlier): Lighthouse's mobile conditions — 4× CPU, Slow 4G (562.5 ms, 1.6 Mbps), 412 × 823 — then
 * every main-thread task over 50 ms with the script, function and line at the top of its stack.
 *
 *   BASE_URL=http://localhost:3200 node scripts/audit/long-tasks.mjs [runs=3] [seconds=14]
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const RUNS = Number(process.argv[2] ?? 3);
const SECONDS = Number(process.argv[3] ?? 14);
const browser = await chromium.launch({ channel: "chrome" });

for (let run = 1; run <= RUNS; run++) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 562.5, downloadThroughput: (1638.4 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const events = [];
  cdp.on("Tracing.dataCollected", (e) => events.push(...e.value));
  const done = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: "toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack,v8.execute,loading", transferMode: "ReportEvents" });
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(SECONDS * 1000);
  await cdp.send("Tracing.end");
  await done;
  const nav = events.find((e) => e.name === "navigationStart" || e.name === "TracingStartedInBrowser");
  const t0 = nav?.ts ?? Math.min(...events.filter((e) => e.ts).map((e) => e.ts));
  const tasks = events.filter((e) => e.name === "RunTask" && e.dur > 50_000);
  const rows = tasks.map((t) => {
    const inside = events.filter((e) => e.tid === t.tid && e.ts >= t.ts && e.ts + (e.dur ?? 0) <= t.ts + t.dur && e.ts !== t.ts);
    const fn = inside.filter((e) => e.name === "FunctionCall" || e.name === "EvaluateScript" || e.name === "TimerFire" || e.name === "FireIdleCallback" || e.name === "FireAnimationFrame").sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))[0];
    const d = fn?.args?.data ?? {};
    const frame = d.stackTrace?.[0] ?? d;
    const url = String(frame.url ?? d.url ?? "").replace(BASE, "");
    return { at: Math.round((t.ts - t0) / 1000), ms: Math.round(t.dur / 1000), kind: fn?.name ?? "?", fn: frame.functionName ?? d.functionName ?? "", where: url ? `${url}:${frame.lineNumber ?? ""}:${frame.columnNumber ?? ""}` : "" };
  });
  console.log(`run ${run}: ${rows.length} tasks over 50 ms`);
  for (const r of rows) console.log(`  ${String(r.at).padStart(6)} ms  ${String(r.ms).padStart(4)} ms  ${r.kind.padEnd(16)} ${r.fn.padEnd(18)} ${r.where}`);
  await ctx.close();
}
await browser.close();
