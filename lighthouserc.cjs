/**
 * Lighthouse CI: DESIGN.md §8.3's web vitals, on a production build (npm run lhci; CI).
 *
 * Devtools throttling (Slow 4G, 4× CPU), not the default simulated (Lantern) method: on localhost
 * every request ends within ~54 ms, so Lantern's estimate reads ~3.5 s LCP; devtools measures what
 * happens. Three runs, judged on the median run. INP isn't a navigation metric — it's measured from
 * the site's interactions in scripts/audit-gate.mjs (vitals). CHROME_PATH picks the browser.
 */
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
