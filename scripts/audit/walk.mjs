#!/usr/bin/env node
/**
 * The polish pass's walk (PROMPTS.md Part 16): every screen of the site in Phosphor, Amber and Paper,
 * with motion on and off, on a desktop and a phone — twelve editions — shot into
 * .artifacts/walk/<theme>-<motion>-<device>/NN-name.png, with a contact sheet per edition
 * (sheet.png). Each screen also measures what a still can't show (walk.json):
 *   - orphans: a heading whose last line is one word;
 *   - numbers set in a proportional face (DESIGN §2.5: numbers that change are mono);
 *   - every CSS transition and animation timing in use, and the running animations', to hold
 *     against lib/motion.ts's tokens.
 *
 *   BASE_URL=http://localhost:3200 node scripts/audit/walk.mjs [--only=phosphor-full-desktop,...]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../../.artifacts/walk/", import.meta.url).pathname;
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null;
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const HIDE = ".stage-debug { display: none !important; }";

// in the page: what a still can't show
function measure() {
  const hidden = (el) => !!el.closest(".sr-only, [aria-hidden='true'], [hidden]");
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
  };
  const sel = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join("")}`;
  // orphans: per-word line boxes over the heading's text nodes
  const orphans = [];
  for (const h of document.querySelectorAll("h1, h2, h3, h4, [class*='title'], [class*='heading'], [class*='__h']")) {
    if (!vis(h) || hidden(h)) continue;
    const words = [];
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (hidden(n.parentElement)) continue;
      for (const m of n.data.matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        const rect = r.getClientRects()[0];
        if (rect) words.push({ w: m[0], top: rect.top, h: rect.height });
      }
    }
    if (words.length < 3) continue;
    const lines = [];
    for (const w of words) {
      const line = lines.find((l) => Math.abs(l.top - w.top) < w.h * 0.5);
      if (line) line.words.push(w.w);
      else lines.push({ top: w.top, words: [w.w] });
    }
    lines.sort((a, b) => a.top - b.top);
    const last = lines[lines.length - 1];
    if (lines.length >= 2 && last.words.length === 1) orphans.push({ sel: sel(h), lines: lines.length, last: last.words[0], text: h.textContent.trim().slice(0, 90) });
  }
  // digits in a proportional face
  const numerals = [];
  const seen = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!/\d/.test(n.data)) continue;
    const el = n.parentElement;
    if (!el || hidden(el) || !vis(el) || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (/JetBrains/i.test(cs.fontFamily)) continue;
    numerals.push({ sel: sel(el), text: n.data.trim().slice(0, 60), face: cs.fontFamily.split(",")[0].replace(/["']/g, ""), tabular: cs.fontVariantNumeric });
  }
  // timings in use
  const timings = new Map();
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    const add = (kind, dur, fn, what) => {
      if (!dur || /^0s(, 0s)*$/.test(dur)) return;
      const key = `${kind} ${dur} ${fn}`;
      const t = timings.get(key) ?? { kind, dur, fn, what, n: 0, sample: sel(el) };
      t.n++;
      timings.set(key, t);
    };
    add("transition", cs.transitionDuration, cs.transitionTimingFunction, cs.transitionProperty);
    if (cs.animationName !== "none") add("animation", cs.animationDuration, cs.animationTimingFunction, cs.animationName);
  }
  const running = document.getAnimations().map((a) => {
    const t = a.effect?.getTiming?.() ?? {};
    return { name: a.animationName ?? a.transitionProperty ?? a.id ?? "waapi", dur: t.duration, easing: t.easing, iterations: t.iterations, target: a.effect?.target ? sel(a.effect.target) : null };
  });
  return { orphans, numerals, timings: [...timings.values()], running };
}

async function scrollTo(page, y) {
  await page.evaluate((y) => {
    const l = window.__retrograde?.lenis?.();
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, y);
}

const sectionTop = (page, q) => page.evaluate((q) => {
  const el = document.querySelector(q);
  return el ? el.getBoundingClientRect().top + scrollY : null;
}, q);
const pin = (page, id) => page.evaluate((id) => window.__retrograde?.scroll?.geometry?.().pins.find((p) => p.id === id) ?? null, id);

async function edition(browser, theme, motion, device) {
  const name = `${theme}-${motion}-${device}`;
  const dir = `${OUT}${name}/`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ ...DEVICES[device], reducedMotion: motion === "reduce" ? "reduce" : "no-preference" });
  await ctx.addInitScript((theme) => localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 })), theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  const shots = [];
  const shoot = async (label, settle = 1300) => {
    await page.waitForTimeout(settle);
    const file = `${String(shots.length).padStart(2, "0")}-${label}.png`;
    await page.screenshot({ path: dir + file, style: HIDE });
    shots.push({ label, file, ...(await page.evaluate(measure)) });
  };

  // the boot, once, on a first visit (motion on; reduced motion has none)
  await page.goto(`${BASE}/?debug=1`, { waitUntil: "commit" });
  if (motion === "full") await shoot("boot", 900);
  await page.evaluate(() => sessionStorage.setItem("retrograde:booted", "1"));
  await page.goto(`${BASE}/?debug=1`, { waitUntil: "load" });
  await shoot("system", 2500);
  const at = async (label, y, settle) => {
    if (y === null) return;
    await scrollTo(page, y);
    await shoot(label, settle);
  };
  await at("identity", await sectionTop(page, "#identity"));
  for (const id of ["log", "archive"]) {
    const p = await pin(page, id);
    if (p) {
      await at(`${id}-start`, p.start);
      await at(`${id}-mid`, p.start + p.length * 0.5);
    } else await at(id, await sectionTop(page, `#${id}`));
  }
  for (const [label, q, off, settle] of [["printout", ".printout-wrap", -80], ["ledger", ".ledger", -120], ["work", "#work", 0], ["index", ".work-index", -120], ["capabilities", "#capabilities", 0, 3200], ["panel", ".keys-panel", -120], ["records", "#credentials", 0], ["connect", "#connect", 0]]) {
    const y = await sectionTop(page, q);
    await at(label, y === null ? null : Math.max(0, y + off), settle);
  }
  // the footer, just above HALT's last pixel
  await scrollTo(page, await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - 6));
  await shoot("footer");
  // CONNECT's errors: an empty send
  const cy = await sectionTop(page, "#connect");
  if (cy !== null) {
    await scrollTo(page, cy);
    await page.waitForTimeout(600);
    const sent = await page.evaluate(() => {
      const b = document.querySelector("#connect form button[type='submit']");
      b?.click();
      return !!b;
    });
    if (sent) await shoot("connect-errors", 900);
  }
  // the terminal (an empty send focused CONNECT's first field: a typed ~ would land there)
  await page.evaluate(() => document.activeElement?.blur?.());
  await scrollTo(page, 0);
  await page.waitForTimeout(600);
  if (device === "desktop") await page.keyboard.press("~");
  else await page.locator(".hud-nav__key").first().click().catch(() => undefined);
  await shoot("terminal", 1600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  // a dossier, over home (the intercepted route)
  const ly = await sectionTop(page, ".ledger");
  if (ly !== null) {
    await scrollTo(page, ly - 120);
    await page.waitForTimeout(800);
    const opened = await page.evaluate(() => {
      const a = document.querySelector(".ledger__link");
      a?.click();
      return !!a;
    });
    if (opened) await shoot("dossier", 2200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }
  // the pages
  for (const [label, path, scroll] of [
    ["case", "/work/cognivault-ai", 0],
    ["case-body", "/work/cognivault-ai", "hero"],
    ["case-end", "/work/cognivault-ai", "end"],
    ["paper", "/research/food-waste-cold-chain-sci-2026", 0],
    ["paper-body", "/research/food-waste-cold-chain-sci-2026", 0.9],
    ["no-signal", "/this-page-does-not-exist", 0],
    ["credentials", "/dev/credentials/full", "wall"],
  ]) {
    await page.goto(`${BASE}${path}?debug=1`, { waitUntil: "load" });
    await page.waitForTimeout(900);
    if (scroll === "hero") await scrollTo(page, await page.evaluate(() => (document.querySelector(".case__hero")?.getBoundingClientRect().bottom ?? 0) + scrollY));
    else if (scroll === "end") await scrollTo(page, await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - 6));
    else if (scroll === "wall") await scrollTo(page, await page.evaluate(() => (document.querySelector("#credentials")?.getBoundingClientRect().top ?? 0) + scrollY));
    else if (scroll) await scrollTo(page, await page.evaluate((f) => innerHeight * f, scroll));
    await shoot(label, 1800);
  }
  // a credential's back
  const flipped = await page.evaluate(() => {
    const b = document.querySelector(".cred-flip");
    b?.scrollIntoView({ block: "center" });
    b?.click();
    return !!b;
  });
  if (flipped) await shoot("credential-back", 1500);
  await ctx.close();

  // the sheet: four across, labelled
  const W = device === "desktop" ? 480 : 195;
  const tiles = await Promise.all(shots.map(async (s) => {
    const img = await sharp(dir + s.file).resize({ width: W }).png().toBuffer();
    const { height } = await sharp(img).metadata();
    const label = Buffer.from(`<svg width="${W}" height="18"><rect width="100%" height="100%" fill="#000"/><text x="4" y="13" font-family="Menlo" font-size="11" fill="#fff">${s.file.replace(".png", "")}</text></svg>`);
    return { img, height, label };
  }));
  const cols = device === "desktop" ? 4 : 8;
  const rowH = Math.max(...tiles.map((t) => t.height)) + 18 + 6;
  const comp = [];
  tiles.forEach((t, i) => {
    const x = (i % cols) * (W + 6);
    const y = Math.floor(i / cols) * rowH;
    comp.push({ input: t.label, left: x, top: y }, { input: t.img, left: x, top: y + 18 });
  });
  await sharp({ create: { width: cols * (W + 6), height: Math.ceil(tiles.length / cols) * rowH, channels: 3, background: "#ff00ff" } }).composite(comp).png().toFile(`${dir}sheet.png`);
  writeFileSync(`${dir}walk.json`, JSON.stringify({ edition: name, errors, shots }, null, 1));
  console.log(`${name}: ${shots.length} screens, ${errors.length} page errors`);
}

const browser = await chromium.launch({ channel: "chrome" });
for (const theme of ["phosphor", "amber", "paper"])
  for (const motion of ["full", "reduce"])
    for (const device of ["desktop", "phone"]) {
      if (only && !only.includes(`${theme}-${motion}-${device}`)) continue;
      await edition(browser, theme, motion, device);
    }
await browser.close();
