import { defineConfig } from "@playwright/test";

/**
 * The visual matrix (PROMPTS.md Part 14, e2e/visual.spec.ts): three themes × six widths × motion on
 * and off, against a production build. The baselines are macOS's (fonts rasterize per platform), so
 * CI runs this job on macOS.
 *
 *   npx playwright test                      BASE_URL (default http://localhost:3200); starts
 *   npx playwright test --update-snapshots   `next start` there if nothing is serving
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3200";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: ".artifacts/playwright", open: "never" }]],
  outputDir: ".artifacts/playwright-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, threshold: 0.2, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: { baseURL: BASE, channel: "chrome", deviceScaleFactor: 1 },
  webServer: { command: "npx next start -p 3200", url: BASE, reuseExistingServer: true, timeout: 120_000 },
});
