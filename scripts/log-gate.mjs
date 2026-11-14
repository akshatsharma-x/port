#!/usr/bin/env node
/**
 * Gate C for A2 (PROMPTS.md Part 7): LOG's punch-card rail measured at every tier it runs on, and its
 * claims checked, in the installed Chrome — the pattern of scripts/hero-gate.mjs.
 *
 *   BASE_URL=http://localhost:3200 node scripts/log-gate.mjs      (a production build, RETROGRADE_DEV_ROUTES=1)
 *
 * Numbers per tier (HIGH · MID forced with ?debug=1&tier=; LOW has no LOG stage — DESIGN.md §4.2):
 * GPU ms as timed and saturated, CPU ms, draw calls, VRAM (scene + post; the canvas apart), FPS, at
 * every role and mid-flight. Claims: ≤ 4 geometry draws and ≤ 4 ms GPU (§4.3 A2), the deck is the
 * content's in deck order, scroll owns the camera, a year on the scale flies it there, the cursor
 * bows the card it's over, the bank is ±6° in travel and level at rest, the phone edition rises
 * through the pin, the reduced-motion and Paper editions, the PRINTOUT's form, a clean console.
 * Report: .artifacts/log-gate.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const TIERS = { HIGH: { dpr: 1.75, vramMB: 160 }, MID: { dpr: 1.5, vramMB: 64 } };
const BUDGET = { geometryDraws: 4, gpuMs: 4, bankDeg: 6 };

const checks = [];
const report = { base: BASE, machine: `${cpus()[0]?.model ?? "?"} · ${cpus().length} cores`, tiers: {}, scenarios: {}, checks };
function check(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

const browser = await chromium.launch({ channel: "chrome" });
const IGNORED = [/Download the React DevTools/];

async function open({ tier = null, viewport = { width: 1440, height: 900 }, dpr = 2, mobile = false, theme = "phosphor", reduced = false, live = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript((theme) => {
    sessionStorage.setItem("retrograde:booted", "1");
    localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
    // count WebGL contexts (the About portrait's 2D canvas is not one)
    window.__gl = 0;
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (String(type).startsWith("webgl")) window.__gl++;
      return get.call(this, type, ...rest);
    };
  }, theme);
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !IGNORED.some((r) => r.test(m.text()))) logs.push(`${m.type()}: ${m.text()}`.slice(0, 240));
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 240)));
  await page.goto(`${BASE}/?debug=1${tier ? `&tier=${tier}` : ""}#log`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__retrograde?.governor.snapshot.tierFinal, null, { timeout: 90_000, polling: 100 });
  if (live && !reduced) {
    await page.waitForFunction(() => {
      const s = window.__retrograde.governor.snapshot;
      return s.scenes.log.state === "LIVE" && !s.scenes.log.poster && window.__retrograde.governor.dev.log;
    }, null, { timeout: 90_000, polling: 100 });
  }
  await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
  return { ctx, page, logs };
}

const pin = (page) => page.evaluate(() => window.__retrograde.scroll.geometry().pins.find((p) => p.id === "log"));
async function scrollToProgress(page, p) {
  const geo = await pin(page);
  await page.evaluate(
    async ({ geo, p }) => {
      const lenis = window.__retrograde.lenis();
      const from = Math.max(0, Math.min(1, (window.scrollY - geo.start) / geo.length));
      const steps = Math.max(1, Math.round((Math.abs(p - from) * geo.length) / 8));
      for (let s = 1; s <= steps; s++) {
        lenis.scrollTo(geo.start + geo.length * (from + ((p - from) * s) / steps), { immediate: true, force: true });
        await new Promise((r) => requestAnimationFrame(r)); // eslint-disable-line no-restricted-globals
      }
    },
    { geo, p },
  );
}
const deck = (page) => page.evaluate(() => window.__retrograde.governor.dev.log?.debugState() ?? null);
async function settle(page, ms = 2600) {
  await page.waitForTimeout(ms);
}

/** ~2 s with input every 100 ms (the governor stays in full mode), then the saturated bench. */
async function measure(page, label) {
  await page.evaluate(() => window.__retrograde.governor.resetStats());
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(1300 + (i % 5) * 3, 120);
    await page.waitForTimeout(100);
  }
  const r = await page.evaluate(async () => {
    const g = window.__retrograde.governor;
    const st = g.stats;
    const s = g.snapshot;
    const fb = g.dev.framebufferBytes?.() ?? 0;
    const post = g.dev.postBytes?.() ?? 0;
    const scene = s.scenes.log.vramBytes;
    return {
      tier: s.tier,
      dpr: s.dpr,
      gpuP50: st.gpu.count ? +st.gpu.percentile(50).toFixed(2) : null,
      gpuP95: st.gpu.count ? +st.gpu.percentile(95).toFixed(2) : null,
      cpuP50: st.work.count ? +st.work.percentile(50).toFixed(2) : null,
      calls: st.last.calls,
      fps: st.intervals.count ? Math.round(1000 / st.intervals.percentile(50)) : null,
      vramMB: +((scene + post) / 1e6).toFixed(1),
      vram: { sceneMB: +(scene / 1e6).toFixed(2), postMB: +(post / 1e6).toFixed(1), canvasMB: +(fb / 1e6).toFixed(1) },
      saturatedMs: await g.dev.bench?.("log", 60),
      postGeometry: g.dev.postCalls?.() ?? null,
    };
  });
  return { label, ...r };
}

// ── 1 · HIGH and MID: every role, and mid-flight ───────────────────────────────────────────────
for (const [tier, spec] of Object.entries(TIERS)) {
  const { ctx, page, logs } = await open({ tier });
  const roles = await page.evaluate(() => document.querySelectorAll(".log-pin .sticky-stack__frame").length);
  const rows = [];
  for (let i = 0; i < roles; i++) {
    for (const [label, p] of [[`role ${i + 1}`, i / Math.max(1, roles - 1)], ...(i < roles - 1 ? [[`→ ${i + 1}–${i + 2}`, (i + 0.5) / Math.max(1, roles - 1)]] : [])]) {
      await scrollToProgress(page, p);
      await settle(page, 1800);
      rows.push(await measure(page, label));
    }
  }
  const warm = await page.evaluate(() => window.__retrograde.governor.snapshot.scenes.log.warmMs);
  report.tiers[tier] = { rows, warmMs: warm };
  console.log(`\n${tier} — DPR ${rows[0]?.dpr} · warm ${warm} ms`);
  for (const r of rows) console.log(`  ${r.label.padEnd(10)} GPU ${String(r.gpuP50).padStart(5)} / ${String(r.gpuP95).padStart(5)} ms (p50/p95 timed) · ${String(r.saturatedMs?.toFixed?.(3) ?? r.saturatedMs).padStart(6)} ms saturated · CPU ${r.cpuP50} ms · ${r.calls} calls · VRAM ${r.vramMB} MB (+ canvas ${r.vram.canvasMB}) · ${r.fps} fps`);
  check(`${tier}: the tier at its DPR cap`, rows.every((r) => r.tier === tier && r.dpr <= spec.dpr + 1e-6), rows.map((r) => [r.tier, r.dpr]).slice(0, 2));
  check(`${tier}: the GPU within 4 ms (§4.3 A2), saturated`, rows.every((r) => r.saturatedMs !== null && r.saturatedMs <= BUDGET.gpuMs), rows.map((r) => r.saturatedMs));
  check(`${tier}: draw calls ≤ 40 in all`, rows.every((r) => r.calls <= 40), rows.map((r) => r.calls));
  check(`${tier}: VRAM (LIVE + WARM + post targets, §8.3) within the tier's ${spec.vramMB} MB`, rows.every((r) => r.vramMB <= spec.vramMB), rows[0]?.vram);
  check(`${tier}: console clean`, logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 2 · the claims ────────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ tier: "HIGH" });
  // the deck is the content's: one card per role, in the mirror's order, each punched with its company
  const stage = await page.evaluate(async () => (await (await fetch("/data/stage.json")).json()).log.cards);
  const frames = await page.evaluate(() => [...document.querySelectorAll(".log-pin .sticky-stack__frame .log-panel__where")].map((e) => e.textContent?.split(" · ")[0]?.toUpperCase() ?? ""));
  check("the deck is the content's: a card per role, newest first, each punched with its company", stage.length === frames.length && stage.every((c, i) => c.text.startsWith(frames[i] ?? "?")), { cards: stage.map((c) => c.text), frames });

  // geometry draws: the scene's own calls (cards, shafts, light) are the frame's minus the post chain's
  const scene = await page.evaluate(() => {
    const g = window.__retrograde.governor;
    return { calls: g.stats.last.calls, memory: g.dev.runtimeMemory?.() };
  });
  const geometry = await page.evaluate(() => window.__retrograde.governor.dev.log?.group?.children?.length ?? null);
  check("≤ 4 geometry draws (§4.3 A2): the cards, the shafts, the light", geometry !== null && geometry <= BUDGET.geometryDraws, { meshes: geometry, frameCalls: scene.calls });

  // scroll owns the camera: at each role's node the deck's camera rests on that card, and the mirror shows it
  const roles = stage.length;
  const owned = [];
  const blocked = [];
  const panel = [];
  for (let i = 0; i < roles; i++) {
    await scrollToProgress(page, i / Math.max(1, roles - 1));
    await settle(page);
    const s = await deck(page);
    const active = await page.evaluate(() => Number(document.querySelector(".log-pin")?.dataset.step ?? -1));
    owned.push({ i, camera: +s.active.toFixed(3), step: active, rollDeg: +s.rollDeg.toFixed(2) });
    // nothing lies over the scale: each of its buttons is what the pointer hits at its own centre
    blocked.push(
      ...(await page.evaluate(
        (i) =>
          [...document.querySelectorAll(".year-scale__year, .year-scale__role")].flatMap((b) => {
            const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return hit && b.contains(hit) ? [] : [{ role: i, button: b.textContent || b.getAttribute("aria-label"), hit: hit?.className ?? null }];
          }),
        i,
      )),
    );
    // …while the active panel keeps it (its text is selectable, its chips hoverable)
    panel.push(
      await page.evaluate(() => {
        const h = document.querySelector(".log-pin > .sticky-stack__frame[data-active] .log-panel h3");
        const r = h?.getBoundingClientRect();
        const hit = r ? document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2) : null;
        return !!(h && hit && h.contains(hit));
      }),
    );
  }
  check("scroll owns the camera: at each role the deck rests on its card, the mirror on its frame", owned.every((o) => Math.abs(o.camera - o.i) < 0.02 && o.step === o.i), owned);
  check("…and at rest the camera is level (it banks in travel only)", owned.every((o) => Math.abs(o.rollDeg) < 0.05), owned.map((o) => o.rollDeg));
  check("the year scale takes the pointer at every role: no frame lies over its buttons", blocked.length === 0, blocked.slice(0, 4));
  check("…and the active panel keeps the pointer (its text selectable)", panel.every(Boolean), panel);

  // in travel: banked within ±6°
  await scrollToProgress(page, 0);
  await settle(page);
  const rolls = [];
  await page.evaluate(() => {
    const geo = window.__retrograde.scroll.geometry().pins.find((p) => p.id === "log");
    window.__retrograde.lenis().scrollTo(geo.start + geo.length, { duration: 1.2 });
  });
  for (let k = 0; k < 24; k++) {
    await page.waitForTimeout(60);
    rolls.push(+(await deck(page)).rollDeg.toFixed(2));
  }
  const peak = Math.max(...rolls.map(Math.abs));
  check("in travel the camera banks on the rail's curves, within ±6°", peak > 0.2 && peak <= BUDGET.bankDeg + 1e-6, { peakDeg: peak });
  await settle(page);

  // a year on the scale flies there: the newest role that ran that year, on the heavy spring
  const years = await page.evaluate(() => [...document.querySelectorAll(".year-scale__year")].map((b) => ({ year: b.textContent, role: Number(b.getAttribute("data-role")) })));
  const target = years.at(-1)?.year;
  const expected = years.at(-1)?.role ?? -1;
  await page.click(`.year-scale__year >> text=${target}`);
  const flight = [];
  for (let k = 0; k < 30; k++) {
    await page.waitForTimeout(80);
    flight.push(+(await deck(page)).active.toFixed(3));
  }
  await settle(page);
  const landed = await deck(page);
  const step = await page.evaluate(() => Number(document.querySelector(".log-pin")?.dataset.step ?? -1));
  const moved = flight.filter((v, k) => k > 0 && v !== flight[k - 1]).length;
  check(`a year on the scale (${target}) flies the camera to its newest role, on the heavy spring`, step === expected && Math.abs(landed.active - expected) < 0.02 && moved >= 4, { expected, step, landed: +landed.active.toFixed(3), framesInFlight: moved });

  // the cursor bows the card it's over, and brightens its light
  await scrollToProgress(page, 0);
  await settle(page);
  const card = await page.evaluate(() => {
    const c = document.querySelector('[data-stage-slot="log"]')?.getBoundingClientRect();
    return c ? { x: c.left + c.width * 0.3, y: c.top + c.height * 0.48 } : null;
  });
  await page.mouse.move(card.x - 30, card.y);
  await page.mouse.move(card.x, card.y, { steps: 6 });
  await settle(page, 900);
  const hover = await deck(page);
  check("the cursor bows the card it's over (a vertex bend) and its light brightens", hover.hovered === 0 && hover.bend > 0.9, hover);
  await page.mouse.move(1430, 20);
  await settle(page, 900);
  check("…and lets it go", (await deck(page)).bend < 0.05);

  check("claims: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 3 · the editions ──────────────────────────────────────────────────────────────────────────
{
  // LOW (desktop): no LOG stage — the poster stands (§4.2)
  const { ctx, page, logs } = await open({ tier: "LOW", live: false });
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => window.__retrograde.governor.snapshot.scenes.log);
  check("LOW: no LOG stage — the slot keeps its poster", s.state !== "LIVE" && s.poster === true, s);
  check("LOW: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  // the phone edition: the same cards in CSS, rising through the pin
  const { ctx, page, logs } = await open({ viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, live: false });
  await page.waitForTimeout(1500);
  const visible = await page.evaluate(() => getComputedStyle(document.querySelector(".phone-deck")).display !== "none");
  const states = [];
  const n = await page.evaluate(() => document.querySelectorAll(".phone-card").length);
  for (let i = 0; i < n; i++) {
    await scrollToProgress(page, i / Math.max(1, n - 1));
    await settle(page, 1200);
    states.push(
      await page.evaluate((i) => {
        const cards = [...document.querySelectorAll(".phone-card")].map((c) => c.getBoundingClientRect().top);
        const frame = document.querySelector(".log-pin")?.getBoundingClientRect();
        return { i, step: Number(document.querySelector(".log-pin")?.dataset.step), active: Math.round(cards[i] ?? 0), next: Math.round(cards[i + 1] ?? Infinity), bottom: Math.round(frame?.bottom ?? 0) };
      }, i),
    );
  }
  check("phones: the phone edition, not a stage (LOW by policy)", visible, { visible });
  check("…its cards rise through the pin: the active one in place, the next one below the screen", states.every((s) => s.step === s.i && s.active < 400 && (s.next === null || s.next >= s.bottom)), states);
  check("phones: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ reduced: true, live: false });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    webgl: window.__gl,
    frames: document.querySelectorAll(".log-pin .sticky-stack__frame").length,
    pinned: getComputedStyle(document.querySelector(".log-pin")).position,
  }));
  check("reduced motion: no WebGL, the frames static, no pin", r.webgl === 0 && r.frames > 0 && r.pinned !== "sticky", r);
  check("reduced motion: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ tier: "HIGH", theme: "paper" });
  await settle(page, 1500);
  const ground = await page.evaluate(() => window.__retrograde.governor.dev.postGround?.() ?? null);
  check("Paper: the deck on a light table — the ground is the page's paper, no bloom", !!ground, ground);
  check("Paper: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 4 · the PRINTOUT ──────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ live: false });
  const p = await page.evaluate(() => {
    const sheet = document.querySelector(".printout__sheet");
    const cs = getComputedStyle(sheet);
    const w = sheet.parentElement.getBoundingClientRect().width;
    const sizes = cs.backgroundSize.split(",").map((s) => s.trim());
    const perforation = parseFloat(sizes[0]?.split(" ")[1] ?? "0");
    const strip = getComputedStyle(sheet, "::before");
    const holes = parseFloat(strip.backgroundSize.split(" ")[1] ?? "0");
    const rows = [...document.querySelectorAll(".printout__rows > li")].length;
    const resume = document.querySelector(".printout__resume")?.getAttribute("href");
    return { inch: +(w / 9.5).toFixed(2), perforation: +perforation.toFixed(2), holes: +holes.toFixed(2), rows, resume };
  });
  const content = await page.evaluate(() => document.querySelectorAll(".log-pin .sticky-stack__frame").length);
  check("PRINTOUT: perforated every 11 in, tractor holes every ½ in, at the form's own scale", Math.abs(p.perforation - p.inch * 11) < 0.5 && Math.abs(p.holes - p.inch * 0.5) < 0.5, p);
  check("…the condensed log and the education, and it ends with RESUME ↗", p.rows >= content + 1 && !!p.resume, { rows: p.rows, roles: content, resume: p.resume });
  check("PRINTOUT: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}log-gate.json`, JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks pass${failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(" · ")}` : ""}`);
process.exitCode = failed.length ? 1 : 0;
