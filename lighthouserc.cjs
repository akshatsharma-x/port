/**
 * Lighthouse CI: DESIGN.md §8.3's web vitals, on a production build (npm run lhci; CI).
 *
 * Devtools throttling (Slow 4G, 4× CPU), not the default simulated (Lantern) method: on localhost
 * every request ends within ~54 ms, so Lantern's estimate reads ~3.5 s LCP; devtools measures what
 * happens. Three runs, judged on the median run. INP isn't a navigation metric — it's measured from
 * the site's interactions in scripts/audit-gate.mjs (vitals). CHROME_PATH picks the browser.
 *
 * The CPU is throttled to one machine: the reference method's 4x on a benchmarkIndex of ~4,500
 * (§8.3), an effective ~1,125. A slower machine throttles less to measure the same phone:
 * LHCI_CPU_SLOWDOWN (CI sets 2.4 for GitHub's ~2,650 runner, whose 4x measured a slower phone and
 * failed every budget on its first run). The network stays Lighthouse's mobile defaults.
 */
const CPU = Number(process.env.LHCI_CPU_SLOWDOWN ?? 4);
const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const median = (n) => ({ maxNumericValue: n, aggregationMethod: "median-run" });

module.exports = {
  ci: {
    collect: {
      startServerCommand: process.env.LHCI_NO_SERVER ? undefined : "npx next start -p 3200",
      startServerReadyPattern: "Ready",
      url: [`${BASE}/`, `${BASE}/work/cognivault-ai`, `${BASE}/research/food-waste-cold-chain-sci-2026`],
      numberOfRuns: 3,
      settings: {
        throttlingMethod: "devtools",
        throttling: { rttMs: 150, throughputKbps: 1638.4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675, cpuSlowdownMultiplier: CPU },
        formFactor: "mobile",
        chromeFlags: "--headless=new",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    assert: {
      assertions: {
        "largest-contentful-paint": ["error", median(1800)],
        "cumulative-layout-shift": ["error", median(0.02)],
        "total-blocking-time": ["error", median(150)],
        "categories:performance": ["error", { minScore: 0.95, aggregationMethod: "median-run" }],
        "categories:accessibility": ["error", { minScore: 1, aggregationMethod: "median-run" }],
        "categories:best-practices": ["error", { minScore: 1, aggregationMethod: "median-run" }],
        "categories:seo": ["error", { minScore: 1, aggregationMethod: "median-run" }],
      },
    },
    upload: { target: "filesystem", outputDir: ".artifacts/lhci" },
  },
};
