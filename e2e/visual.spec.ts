import { expect, test, type Page } from "@playwright/test";

/**
 * The visual matrix (PROMPTS.md Part 14): Phosphor, Amber and Paper × 320 / 375 / 768 / 1024 /
 * 1440 / 2560 px × motion on and off — the first screen of home, CONNECT (the form and its footer),
 * and a case study's first screen.
 *
 * What it holds still, so a difference is a real one: the clock (fixed), the grain, roll and
 * cursor (hidden), the HUD's fps and uptime (masked), CSS animations (finished). The stage's own
 * pixels — the live canvas or its poster, whichever the machine's tier gives — are hidden: the
 * matrix is the DOM, the chrome and the type around them. The scenes have their own gates; the
 * posters are bakes (tests/posters.test.ts).
 */

const THEMES = ["phosphor", "amber", "paper"] as const;
const SIZES = [
  [320, 568],
  [375, 667],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [2560, 1440],
] as const;
const MOTION = ["full", "reduce"] as const;
const FIXED = new Date("2026-11-14T10:00:00Z");
const STILL = "#fx-css, #cursor, .stage-poster, .stage-dock, #stage { visibility: hidden !important; }";

async function open(page: Page, path: string): Promise<void> {
  await page.clock.setFixedTime(FIXED);
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: STILL });
  await page.waitForTimeout(1200);
}

async function to(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "start" }), id);
  await page.waitForTimeout(1500);
}

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(name, { mask: [page.locator(".hud-readout__fps, .hud-readout__time")], maskColor: "#ff00ff" });

for (const theme of THEMES)
  for (const [width, height] of SIZES)
    for (const motion of MOTION)
      test.describe(`${theme} · ${width} · motion ${motion}`, () => {
        test.use({
          viewport: { width, height },
          isMobile: width < 768,
          hasTouch: width < 768,
          reducedMotion: motion === "reduce" ? "reduce" : "no-preference",
          storageState: {
            cookies: [],
            origins: [{ origin: process.env.BASE_URL ?? "http://localhost:3200", localStorage: [{ name: "retrograde:ui", value: JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }) }] }],
          },
        });
        test.beforeEach(async ({ page }) => {
          await page.addInitScript(() => sessionStorage.setItem("retrograde:booted", "1"));
        });

        test("home", async ({ page }) => {
          await open(page, "/");
          await shot(page, `home-${theme}-${width}-${motion}.png`);
          await to(page, "connect");
          await shot(page, `connect-${theme}-${width}-${motion}.png`);
        });

        test("a case study", async ({ page }) => {
          await open(page, "/work/cognivault-ai");
          await shot(page, `case-${theme}-${width}-${motion}.png`);
        });
      });
