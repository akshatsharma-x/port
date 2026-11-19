#!/usr/bin/env node
/**
 * The CPU throttle that makes this machine the reference phone (DESIGN.md §8.3), for Lighthouse CI.
 *
 * The budgets are set on the reference method: 4× CPU on a benchmarkIndex of ~4,500, an effective
 * ~1,125. A runner's speed varies run to run (GitHub's read ~2,650 on its first Part 16 run and
 * ~2,470 on a later one, 1,886 cold), so a fixed multiplier measured a different phone each time
 * — 9% slower than the reference on the day LHCI failed at 2.4×. This measures the machine with
 * the same Lighthouse LHCI runs (three runs, which also warm it; the median), and prints
 * LHCI_CPU_SLOWDOWN = benchmarkIndex / 1,125 for lighthouserc.cjs. The network isn't touched.
 *
 *   node scripts/audit/calibrate.mjs [url]   >> "$GITHUB_ENV"     (CHROME_PATH picks the browser)
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const REFERENCE = 4500 / 4; // the reference method's effective benchmarkIndex
const url = process.argv[2] ?? `${process.env.BASE_URL ?? "http://localhost:3200"}/`;
const cli = createRequire(import.meta.url).resolve("lighthouse/cli/index.js");
const bis = [];
for (let i = 0; i < 3; i++) {
  const out = execFileSync(process.execPath, [cli, url, "--only-audits=first-contentful-paint", "--form-factor=mobile", "--throttling-method=devtools", "--chrome-flags=--headless=new", "--output=json", "--output-path=stdout", "--quiet"], { encoding: "utf8", maxBuffer: 64 << 20 });
  bis.push(Math.round(JSON.parse(out).environment.benchmarkIndex));
}
const bi = [...bis].sort((a, b) => a - b)[1];
const slowdown = Math.min(8, Math.max(1, Math.round((bi / REFERENCE) * 10) / 10));
console.error(`benchmarkIndex ${bis.join(", ")} (median ${bi}) → CPU ${slowdown}× (reference ${REFERENCE} effective)`);
console.log(`LHCI_CPU_SLOWDOWN=${slowdown}`);
