#!/usr/bin/env node
/**
 * The launch checklist's cross-browser check (PROMPTS.md Part 15): Chrome, Firefox and Safari's
 * engine (WebKit) on a desktop, and iOS Safari and Android Chrome as Playwright emulates them
 * (WebKit with the iPhone 15's descriptor, Chrome with the Pixel 7's) — emulations, not devices.
 * On each: home through every section, a case study, a paper, NO SIGNAL; no uncaught error, no
 * console error, no sideways overflow, the hero's h1, the HUD; the theme switch and the terminal
 * (desktop); the stage's tier and its contexts. A first-screen shot each, in .artifacts/browsers/.
 *
 *   BASE_URL=http://localhost:3200 node scripts/audit/browsers.mjs     Exits 1 on a failure.
 */
import { mkdirSync } from "node:fs";
import { chromium, devices, firefox, webkit } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../../.artifacts/browsers/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const TARGETS = [
  { name: "Chrome", type: chromium, launch: { channel: "chrome" }, context: { viewport: { width: 1440, height: 900 } }, desktop: true },
  { name: "Firefox", type: firefox, launch: {}, context: { viewport: { width: 1440, height: 900 } }, desktop: true },
  { name: "Safari (WebKit)", type: webkit, launch: {}, context: { viewport: { width: 1440, height: 900 } }, desktop: true },
  { name: "iOS Safari (iPhone 15, emulated)", type: webkit, launch: {}, context: { ...devices["iPhone 15"] }, desktop: false },
  { name: "Android Chrome (Pixel 7, emulated)", type: chromium, launch: { channel: "chrome" }, context: { ...devices["Pixel 7"] }, desktop: false },
];
const PAGES = ["/", "/work/cognivault-ai", "/research/food-waste-cold-chain-sci-2026", "/this-page-does-not-exist"];
const IGNORE = [/status of 404/]; // the browser's own line for the 404 page's document

let failures = 0;
for (const t of TARGETS) {
  const browser = await t.type.launch(t.launch);
  const ctx = await browser.newContext(t.context);
  await ctx.addInitScript(() => sessionStorage.setItem("retrograde:booted", "1"));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`.slice(0, 180)));
  page.on("console", (m) => m.type() === "error" && !IGNORE.some((r) => r.test(m.text())) && errors.push(`console: ${m.text()}`.slice(0, 180)));
  const rows = [];
  for (const path of PAGES) {
    const res = await page.goto(`${BASE}${path}?debug=1`, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(1500);
    if (path === "/") await page.screenshot({ path: `${OUT}${t.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png` });
    const s = await page.evaluate(() => ({
      h1: document.querySelector("h1")?.textContent?.trim().slice(0, 40) ?? null,
      hud: !!document.querySelector("#hud .hud-top") && getComputedStyle(document.querySelector("#hud")).display !== "none",
      overflow: document.documentElement.scrollWidth - innerWidth,
      tier: window.__retrograde?.governor?.snapshot?.tier ?? null,
      gl: document.querySelectorAll("canvas").length,
    }));
    if (path === "/") {
      // every section, by the page's own scroll
      for (const id of ["identity", "log", "archive", "work", "capabilities", "credentials", "connect"]) {
        await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const y = el.getBoundingClientRect().top + scrollY;
          const l = window.__retrograde?.lenis?.();
          if (l) l.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
        }, id);
        await page.waitForTimeout(700);
      }
      if (t.desktop) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator(".front-panel input[value='amber']").evaluate((i) => i.click());
        await page.waitForTimeout(1500);
        s.theme = await page.evaluate(() => document.documentElement.dataset.theme);
        await page.locator(".front-panel input[value='phosphor']").evaluate((i) => i.click());
        await page.waitForTimeout(1200);
        await page.keyboard.press("~");
        await page.waitForTimeout(1500);
        s.terminal = await page.evaluate(() => !!document.querySelector("dialog[data-shell][open]"));
        await page.keyboard.press("Escape");
        await page.waitForTimeout(900);
        s.terminalClosed = await page.evaluate(() => !document.querySelector("dialog[open]"));
      }
    }
    const ok = res && (res.status() === 200 || (path.includes("does-not-exist") && res.status() === 404)) && s.h1 && s.hud && s.overflow <= 0 && (path !== "/" || !t.desktop || (s.theme === "amber" && s.terminal && s.terminalClosed));
    rows.push({ path, status: res?.status(), ...s, ok });
  }
  const bad = rows.filter((r) => !r.ok);
  const pass = bad.length === 0 && errors.length === 0;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${t.name} · ${browser.version()} · tier ${rows[0]?.tier ?? "—"} · canvases ${rows[0]?.gl}${t.desktop ? ` · theme ${rows[0]?.theme} · terminal ${rows[0]?.terminal && rows[0]?.terminalClosed ? "opens/closes" : "✗"}` : ""}`);
  for (const r of bad) console.log(`      ${r.path}: ${JSON.stringify(r)}`);
  for (const e of errors.slice(0, 6)) console.log(`      ${e}`);
  await browser.close();
}
process.exit(failures ? 1 : 0);
