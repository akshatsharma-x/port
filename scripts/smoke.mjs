#!/usr/bin/env node
/**
 * Browser smoke test (Part 1 gate). Drives the installed Chrome through the dev server and checks:
 * console errors / hydration warnings, CLS while loading and scrolling, which fonts preload,
 * focus brackets, the G overlay, theme persistence without a flash, and the reduced-motion
 * edition. Saves per-theme screenshots to .artifacts/.
 *
 *   npm run dev            (in another terminal)
 *   npm run smoke          BASE_URL=http://localhost:3000 by default
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const CLS_PROBE = () => {
  window.__cls = 0;
  window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__cls += e.value;
      window.__shifts.push({ value: e.value, sources: (e.sources || []).map((s) => s.node && (s.node.className || s.node.nodeName)) });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${url} did not come up in ${timeoutMs / 1000}s`);
}
await waitForServer(BASE);
if (!(await (await fetch(BASE + "/")).text()).includes("retrograde:ui")) {
  console.error(`${BASE} is not serving RETROGRADE — set BASE_URL to the right server.`);
  process.exit(2);
}

const report = { base: BASE, routes: {}, checks: {} };
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function open(path, { reducedMotion = "no-preference", width = 1440, height = 900, storage } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion });
  if (storage) await context.addInitScript((s) => localStorage.setItem("retrograde:ui", s), storage);
  await context.addInitScript(CLS_PROBE);
  const page = await context.newPage();
  const messages = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") messages.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, messages };
}

// Steps through the page programmatically (headless wheel input stalls part-way under Lenis),
// so every reveal, counter and bracket passes through the viewport.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
  });
  await page.waitForTimeout(1500); // let reveals and counters finish
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

// 1 · Home
{
  const { context, page, messages } = await open("/");
  const preloads = await page.$$eval('link[rel="preload"][as="font"]', (ls) => ls.map((l) => l.getAttribute("href")));
  const cls = await page.evaluate(() => window.__cls);
  await page.screenshot({ path: `${OUT}home.png` });
  report.routes["/"] = { messages, cls, preloadedFonts: preloads };
  await context.close();
}

// 2 · Kitchen sink, matrix view
{
  const { context, page, messages } = await open("/dev/kitchen-sink");
  const fonts = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight} ${f.stretch}`),
  );
  const families = await page.evaluate(() => ({
    display: getComputedStyle(document.querySelector(".t-display")).fontFamily.split(",")[0],
    body: getComputedStyle(document.querySelector(".t-body")).fontFamily.split(",")[0],
    mono: getComputedStyle(document.querySelector(".t-micro")).fontFamily.split(",")[0],
    stretchDisplay: getComputedStyle(document.querySelector(".t-display")).fontStretch,
  }));
  await scrollThrough(page);
  const cls = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts.slice(0, 8) }));
  const counters = await page.$$eval("[data-band='phosphor'] [data-digits]", (els) => els.map((e) => e.textContent));
  const revealed = await page.$$eval("[data-reveal]", (els) => els.map((e) => e.hasAttribute("data-revealed")));

  // focus brackets follow keyboard focus
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => ({
    visible: document.querySelector(".focus-brackets")?.getAttribute("data-visible"),
    active: document.activeElement?.textContent?.trim().slice(0, 40),
  }));

  // G overlay
  await page.mouse.click(5, 400);
  await page.keyboard.press("g");
  const gridOn = await page.$$eval(".grid-overlay .grid-overlay__col", (c) => c.length);
  await page.keyboard.press("g");
  const gridOff = await page.$$eval(".grid-overlay", (c) => c.length);

  for (const theme of ["phosphor", "amber", "paper"]) {
    const band = page.locator(`[data-band="${theme}"]`);
    const { top, height } = await band.evaluate((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, height: el.offsetHeight }));
    // tokens + type (top ~2600 css px of each band), page coordinates for a full-page clip
    await page.screenshot({ path: `${OUT}sink-${theme}-top.png`, clip: { x: 0, y: top, width: 1440, height: Math.min(2600, height) }, fullPage: true });
  }
  await page.screenshot({ path: `${OUT}sink-full.png`, fullPage: true, scale: "css" });
  report.routes["/dev/kitchen-sink"] = { messages, ...cls, fonts, families, counters, revealedAll: revealed.every(Boolean), revealCount: revealed.length };
  report.checks.focusBrackets = focus;
  report.checks.gridOverlay = { columnsWhenOn: gridOn, overlaysWhenOff: gridOff };
  await context.close();
}

// 3 · Theme persistence: a stored theme is on <html> before any app code runs (no flash)
{
  const stored = JSON.stringify({ state: { theme: "amber", sound: false, gfx: "auto" }, version: 1 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((s) => localStorage.setItem("retrograde:ui", s), stored);
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      window.__themeAtDCL = document.documentElement.dataset.theme;
    });
  });
  const page = await context.newPage();
  const messages = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && messages.push(m.text()));
  await page.goto(`${BASE}/dev/kitchen-sink`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  report.checks.themePersistence = {
    atDOMContentLoaded: await page.evaluate(() => window.__themeAtDCL),
    afterHydration: await page.evaluate(() => document.documentElement.dataset.theme),
    toolbarPressed: await page.$$eval("[aria-label='Page theme'] [aria-pressed='true']", (b) => b.map((x) => x.textContent.trim())),
    messages,
  };
  await context.close();
}

// 4 · Reduced-motion edition
{
  const { context, page, messages } = await open("/dev/kitchen-sink", { reducedMotion: "reduce" });
  const state = await page.evaluate(() => ({
    dataMotion: document.documentElement.dataset.motion,
    lenis: document.documentElement.classList.contains("lenis"),
    hiddenReveals: [...document.querySelectorAll("[data-reveal]")].filter((e) => getComputedStyle(e).clipPath !== "none").length,
    marqueeTransform: getComputedStyle(document.querySelector(".marquee__track")).transform,
  }));
  await page.locator('[data-band="paper"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}sink-reduced-motion.png` });
  report.checks.reducedMotion = { ...state, messages };
  await context.close();
}

// 5 · Phone viewport
{
  const { context, page, messages } = await open("/dev/kitchen-sink", { width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${OUT}sink-phone.png` });
  report.checks.phone = { horizontalOverflowPx: overflow, messages };
  await context.close();
}

// 6 · Content audit (Part 2): renders clean in every theme, no page-level sideways scroll
for (const theme of ["phosphor", "amber", "paper"]) {
  const storage = JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 });
  const { context, page, messages } = await open("/dev/content", { storage });
  await scrollThrough(page);
  const audit = await page.evaluate(() => ({
    cls: window.__cls,
    tables: document.querySelectorAll("table").length,
    previews: document.querySelectorAll("figure svg").length,
    marks: document.querySelectorAll("figure svg path").length,
    pageOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    graphStale: document.querySelector("[data-graph-stale]")?.getAttribute("data-graph-stale"),
  }));
  await page.screenshot({ path: `${OUT}content-${theme}.png`, fullPage: true, scale: "css" });
  await page.locator("#bake").screenshot({ path: `${OUT}content-${theme}-bake.png` });
  report.routes[`/dev/content (${theme})`] = { messages, ...audit };
  await context.close();
}
{
  const { context, page, messages } = await open("/dev/content", { width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${OUT}content-phone.png` });
  report.checks.contentPhone = { horizontalOverflowPx: overflow, messages };
  await context.close();
}

await browser.close();
writeFileSync(`${OUT}smoke.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
