#!/usr/bin/env node
/**
 * Gate C (PROMPTS.md Part 6): the hero — A1 "SYSTEM" — measured at every tier, and its claims checked,
 * in the installed Chrome.
 *
 *   BASE_URL=http://localhost:3200 node scripts/hero-gate.mjs      (a production build, RETROGRADE_DEV_ROUTES=1)
 *
 * Numbers per tier (HIGH · MID · LOW forced with ?debug=1&tier=, on a desktop viewport, plus the phone
 * path): GPU ms as the governor's timer queries see it (the page's own load) and with the GPU
 * saturated (frames back to back), CPU ms, draw calls, points, VRAM (scene buffers + post targets +
 * canvas), FPS — at each checkpoint and mid-flight. The reference devices of DESIGN.md §8.3 (M1 Air,
 * M1 Pro, Galaxy A54) are not this machine: the report names what it ran on.
 *
 * Claims: the four states are true (the content's initials, the real graph, the sun now and the
 * owner's city, the page's own grid), scroll owns the morph, a click goes to the next checkpoint,
 * the cursor's parallax and field, the tiers' post chains, the canvas meets the page with no seam,
 * the name fills the 12 columns on one line, the hints, the "G" flash, the reduced-motion and
 * Paper editions, the phone's portrait poster, a P3 screen's colors (emulated), a clean console.
 * Report: .artifacts/hero-gate.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const TIERS = { HIGH: { particles: 250_000, dpr: 1.75, postCalls: 18, vramMB: 160 }, MID: { particles: 90_000, dpr: 1.5, postCalls: 12, vramMB: 64 }, LOW: { particles: 35_000, dpr: 1.25, postCalls: 3, vramMB: 24 } };
const graphFile = JSON.parse(readFileSync(new URL("../content/graph.json", import.meta.url), "utf8"));

const checks = [];
const report = { base: BASE, machine: `${cpus()[0]?.model ?? "?"} · ${cpus().length} cores`, tiers: {}, scenarios: {}, checks };
function check(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

const browser = await chromium.launch({ channel: "chrome" });
const IGNORED = [/Download the React DevTools/];

async function open({ tier = null, viewport = { width: 1440, height: 900 }, dpr = 2, mobile = false, theme = "phosphor", reduced = false, query = "", booted = true, gamut = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript(
    ({ theme, booted }) => {
      if (booted) sessionStorage.setItem("retrograde:booted", "1");
      localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
      window.__longtasks = [];
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__longtasks.push(Math.round(e.duration));
        }).observe({ type: "longtask", buffered: true });
      } catch {
        /* no long-task API */
      }
    },
    { theme, booted },
  );
  const page = await ctx.newPage();
  // a P3 screen, emulated: headless Chrome reports sRGB, so without this no gate takes §2.3's P3 path
  if (gamut) await (await ctx.newCDPSession(page)).send("Emulation.setEmulatedMedia", { features: [{ name: "color-gamut", value: gamut }] });
  const logs = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !IGNORED.some((r) => r.test(m.text()))) logs.push(`${m.type()}: ${m.text()}`.slice(0, 240));
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 240)));
  // the network, the workers' included: a worker's failed fetch logs nothing on the page's console
  // (Part 7: the initials' font 404'd in the worker since Part 6, and the system's sans drew them)
  ctx.on("requestfailed", (r) => logs.push(`requestfailed: ${r.failure()?.errorText ?? "?"} ${r.url()}`.slice(0, 240)));
  ctx.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()}: ${r.url()}`.slice(0, 240)));
  await page.goto(`${BASE}/?debug=1${tier ? `&tier=${tier}` : ""}${query}`, { waitUntil: "load" });
  if (!reduced) {
    await page.waitForFunction(
      () => {
        const s = window.__retrograde?.governor.snapshot;
        return s && s.tierFinal && s.scenes.system.state === "LIVE" && !s.scenes.system.poster && window.__retrograde.governor.dev.hero;
      },
      null,
      { timeout: 90_000, polling: 100 },
    );
    await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
  }
  return { ctx, page, logs };
}

/** linear → the 8-bit output's step: a seam is visible only if the ground differs by ≥ half a step */
const srgb8 = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const lsbApart = (g) => (g ? +Math.max(...g.cleared.map((v, i) => Math.abs(srgb8(v) - srgb8(g.ground[i])))).toFixed(3) : null);
const seamless = (g) => !!g && lsbApart(g) < 0.5;

const geometry = (page) => page.evaluate(() => window.__retrograde.scroll.geometry().pins.find((p) => p.id === "system"));
async function scrollToProgress(page, p, { smooth = true } = {}) {
  const geo = await geometry(page);
  await page.evaluate(
    async ({ geo, p, smooth }) => {
      const lenis = window.__retrograde.lenis();
      const from = (window.scrollY - geo.start) / geo.length;
      const steps = smooth ? Math.max(1, Math.round((Math.abs(p - from) * geo.length) / 6)) : 1;
      for (let s = 1; s <= steps; s++) {
        lenis.scrollTo(geo.start + geo.length * (from + ((p - from) * s) / steps), { immediate: true, force: true });
        await new Promise((r) => requestAnimationFrame(r)); // eslint-disable-line no-restricted-globals
      }
    },
    { geo, p, smooth },
  );
}

/** ~2.5 s at full rate (input every 100 ms keeps the governor out of its idle mode), then the saturated bench. */
async function measure(page, label) {
  await page.evaluate(() => window.__retrograde.governor.resetStats());
  for (let i = 0; i < 25; i++) {
    await page.mouse.move(700 + (i % 5) * 4, 300);
    await page.waitForTimeout(100);
  }
  const r = await page.evaluate(async () => {
    const g = window.__retrograde.governor;
    const st = g.stats;
    const s = g.snapshot;
    const fb = g.dev.framebufferBytes?.() ?? 0;
    const post = g.dev.postBytes?.() ?? 0;
    const scene = s.scenes.system.vramBytes;
    return {
      mode: s.mode,
      tier: s.tier,
      dpr: s.dpr,
      gpuP50: st.gpu.count ? +st.gpu.percentile(50).toFixed(2) : null,
      gpuP95: st.gpu.count ? +st.gpu.percentile(95).toFixed(2) : null,
      cpuP50: st.work.count ? +st.work.percentile(50).toFixed(2) : null,
      calls: st.last.calls,
      points: st.last.points,
      fps: st.intervals.count ? Math.round(1000 / st.intervals.percentile(50)) : null,
      /** frames the stage drew per second of ticks (the governor's mode decides: full, capped, idle) */
      stageFps: st.frame > 0 ? Math.round((st.framesRendered / st.frame) * (1000 / st.intervals.percentile(50))) : null,
      /** DESIGN.md §8.3's VRAM: LIVE + WARM + post targets; the canvas's own buffers apart */
      vramMB: +((scene + post) / 1e6).toFixed(1),
      vram: { sceneMB: +(scene / 1e6).toFixed(2), postMB: +(post / 1e6).toFixed(1), canvasMB: +(fb / 1e6).toFixed(1) },
      saturatedMs: await g.dev.bench?.("system", 60),
    };
  });
  return { label, ...r };
}

// ── 1 · every tier, every checkpoint, mid-flight ────────────────────────────────────────────────
const STOPS = [
  ["INITIALS", 0],
  ["→ mid-flight", 1 / 6],
  ["CONSTELLATION", 1 / 3],
  ["GLOBE", 2 / 3],
  ["LATTICE", 1],
];
for (const [name, opts] of [
  ["HIGH · desktop", { tier: "HIGH" }],
  ["MID · desktop", { tier: "MID" }],
  ["LOW · desktop", { tier: "LOW" }],
  ["LOW · phone (the phone policy)", { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true }],
]) {
  const { ctx, page, logs } = await open(opts);
  const rows = [];
  for (const [state, p] of STOPS) {
    await scrollToProgress(page, p);
    await page.waitForTimeout(400);
    rows.push({ state, ...(await measure(page, state)) });
  }
  const timing = await page.evaluate(() => ({ targetsMs: Math.round(window.__retrograde.governor.dev.hero.targets.ms), initialsFace: window.__retrograde.governor.dev.hero.targets.initialsFace, warmMs: window.__retrograde.governor.snapshot.scenes.system.warmMs, longtasks: window.__longtasks }));
  report.tiers[name] = { rows, timing, logs };
  const tier = rows[0]?.tier;
  const spec = TIERS[tier];
  console.log(`\n${name} — tier ${tier} @ DPR ${rows[0]?.dpr} · targets generated in ${timing.targetsMs} ms (worker) · warm ${timing.warmMs} ms`);
  for (const r of rows) console.log(`  ${r.state.padEnd(14)} GPU ${String(r.gpuP50).padStart(5)} / ${String(r.gpuP95).padStart(5)} ms (p50/p95 timed) · ${String(r.saturatedMs).padStart(6)} ms saturated · CPU ${r.cpuP50} ms · ${r.calls} calls · ${r.points} pts · VRAM ${r.vramMB} MB (+ canvas ${r.vram.canvasMB}) · stage ${r.stageFps} fps / display ${r.fps} (${r.mode})`);
  check(`${name}: the tier's particles at its DPR cap`, rows.every((r) => r.points === spec.particles && r.dpr <= spec.dpr), { points: rows[0]?.points, dpr: rows[0]?.dpr });
  check(`${name}: draw calls ≤ 40, the post chain within its tier (≤ ${spec.postCalls})`, rows.every((r) => r.calls <= 40 && r.calls - 1 <= spec.postCalls), rows.map((r) => r.calls));
  check(`${name}: VRAM (LIVE + WARM + post targets, §8.3) within the tier's ${spec.vramMB} MB`, rows.every((r) => r.vramMB <= spec.vramMB), rows[0]?.vram);
  check(`${name}: the initials drawn in the page's display face (the worker loaded it)`, timing.initialsFace === "display", { initialsFace: timing.initialsFace });
  check(`${name}: console clean`, logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 2 · the claims ──────────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ tier: "HIGH" });
  const stage = await (await fetch(`${BASE}/data/stage.json`)).json();
  const name = await page.evaluate(() => document.querySelector("h1")?.textContent ?? "");
  const initialsOf = name.split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("");
  check("INITIALS are the content's: stage.json's initials are the name's", stage.hero.initials === initialsOf, { initials: stage.hero.initials, name });
  check("CONSTELLATION is the real graph: every baked paper and edge of content/graph.json", stage.graph.nodes.length === graphFile.nodes.length && stage.graph.nodes.every((n, i) => JSON.stringify(n.topic) === JSON.stringify(graphFile.nodes[i]?.layouts.topic)), { nodes: stage.graph.nodes.length, edges: stage.graph.edges.length });

  // GLOBE: the sun where it is now (NOAA, the same equations), the owner's city
  const u = await page.evaluate(() => {
    const m = window.__retrograde.governor.dev.hero.material.uniforms;
    return { sun: m.uSun.value.toArray(), city: m.uCity.value.toArray(), repel: m.uRepel.value.toArray(), now: Date.now() };
  });
  const sub = ((date) => {
    const y = date.getUTCFullYear();
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const doy = Math.floor((date.getTime() - Date.UTC(y, 0, 1)) / 864e5) + 1;
    const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const g = ((2 * Math.PI) / (leap ? 366 : 365)) * (doy - 1 + (h - 12) / 24);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const d = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const lon = (-15 * (h - 12 + eq / 60) * Math.PI) / 180;
    return [Math.cos(d) * Math.sin(lon), Math.sin(d), Math.cos(d) * Math.cos(lon)];
  })(new Date(u.now));
  const angle = (a, b) => (Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
  const DEG = Math.PI / 180;
  const cityVec = [Math.cos(stage.hero.city.lat * DEG) * Math.sin(stage.hero.city.lon * DEG), Math.sin(stage.hero.city.lat * DEG), Math.cos(stage.hero.city.lat * DEG) * Math.cos(stage.hero.city.lon * DEG)].map((v) => v * 0.96);
  check("GLOBE: the terminator is the sun now (≤ 0.1° from the subsolar point), the city is the owner's", angle(u.sun, sub) <= 0.1 && Math.hypot(...u.city.map((v, i) => v - cityVec[i])) < 1e-3, { sunErrorDeg: +angle(u.sun, sub).toFixed(3), city: stage.hero.city });
  const land = await (await fetch(`${BASE}/data/land-256x128.bin`)).arrayBuffer();
  check("…its land mask is ≤ 4 KB", land.byteLength <= 4096, { bytes: land.byteLength });

  // LATTICE: the page's own grid, the About layout, the "G" flash
  const lattice = await page.evaluate(() => {
    const grid = document.querySelector("#identity .layout-grid");
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
    return { cols, blocks: document.querySelectorAll('#identity [data-lattice="block"]').length, lines: document.querySelectorAll('#identity [data-lattice="lines"]').length };
  });
  await scrollToProgress(page, 0.9);
  await page.waitForTimeout(300);
  const flash = await page.evaluate(async () => {
    const seen = [];
    const t0 = performance.now();
    const geo = window.__retrograde.scroll.geometry().pins.find((p) => p.id === "system");
    window.__retrograde.lenis().scrollTo(geo.start + geo.length, { immediate: true, force: true });
    while (performance.now() - t0 < 1500) {
      seen.push([Math.round(performance.now() - t0), !!document.querySelector(".grid-overlay[data-flash]")]);
      await new Promise((r) => requestAnimationFrame(r)); // eslint-disable-line no-restricted-globals
    }
    const on = seen.filter(([, v]) => v);
    return { shown: on.length > 0, forMs: on.length ? on[on.length - 1][0] - on[0][0] : 0, offAfter: !seen[seen.length - 1][1] };
  });
  check("LATTICE: the page's own 12 columns and the About layout; the \"G\" overlay flashes once as it lands", lattice.cols === 12 && lattice.blocks >= 1 && lattice.lines >= 1 && flash.shown && flash.offAfter && flash.forMs <= 700, { ...lattice, flash });

  // scroll owns the morph
  const owned = [];
  for (const p of [0, 0.17, 0.5, 0.83, 1]) {
    await scrollToProgress(page, p, { smooth: false });
    await page.waitForTimeout(150);
    owned.push(await page.evaluate(() => ({ progress: +window.__retrograde.scroll.pinProgress("system").toFixed(4), morph: +window.__retrograde.governor.dev.hero.material.uniforms.uMorph.value.toFixed(4) })));
  }
  check("scroll owns the morph: morph = 3 × pin progress, at every position", owned.every((o) => Math.abs(o.morph - 3 * o.progress) < 2e-3), owned);

  // a click → the next checkpoint (Lenis eases there)
  await scrollToProgress(page, 0, { smooth: false });
  await page.waitForTimeout(400);
  await page.mouse.click(720, 200);
  await page.waitForTimeout(1400);
  const afterClick = await page.evaluate(() => window.__retrograde.scroll.pinProgress("system"));
  check("a click on the hero scrolls to the next checkpoint (0 → ⅓)", Math.abs(afterClick - 1 / 3) < 0.01, { progress: +afterClick.toFixed(4) });

  // the cursor: ±3° yaw / ±2° pitch at the frame's edges (λ 4), the field on while over it
  await scrollToProgress(page, 0, { smooth: false });
  await page.mouse.move(1439, 1);
  await page.waitForTimeout(1600);
  const cam = await page.evaluate(() => {
    const m = window.__retrograde.governor.dev.hero.material.uniforms;
    return { field: m.uField.value.z, ndc: [m.uField.value.x, m.uField.value.y], repel: m.uRepel.value.toArray() };
  });
  // the field's damped camera angles (degrees), at the frame's top-right corner
  const angles = await page.evaluate(() => ({ yaw: window.__retrograde.governor.dev.hero.yaw, pitch: window.__retrograde.governor.dev.hero.pitch }));
  check("the cursor: parallax to ±3° yaw / ±2° pitch at the frame's edge (λ 4)", angles.yaw > 2.9 && angles.yaw <= 3 && angles.pitch > 1.9 && angles.pitch <= 2, angles);
  check("…and its field: on over the hero (λ 10), radius 12% of the viewport height", cam.field > 0.95 && Math.abs(cam.repel[0] - 0.24) < 1e-6, cam);

  // the name: one line, the 12 columns' width (±1%), the first H-HOLD heading
  const fit = await page.evaluate(() => {
    const h1 = document.querySelector(".hero-name");
    const text = h1.querySelector(".name-rise__text");
    const range = document.createRange();
    range.selectNodeContents(text);
    const rects = [...range.getClientRects()];
    const width = rects.reduce((w, r) => Math.max(w, r.right), 0) - (rects[0]?.left ?? 0);
    return { lines: new Set(rects.map((r) => Math.round(r.top))).size, ratio: +(width / h1.clientWidth).toFixed(4), wdth: getComputedStyle(h1).fontStretch, hhold: h1.hasAttribute("data-hhold") };
  });
  check("the name: one line, filling the 12 columns (±1%) by its wdth, an H-HOLD heading", fit.lines === 1 && Math.abs(fit.ratio - 1) <= 0.01 && fit.hhold, fit);

  // the micro-block's clock is the HUD's
  const clocks = await page.evaluate(() => [document.querySelector(".hero-micro__time")?.textContent, document.querySelector(".hud-readout__clock")?.textContent]);
  check("the micro-block's local time is the HUD's own clock", clocks[0] && clocks[0] === clocks[1], clocks);

  // the canvas meets the page: its ground is the theme's --bg, exactly
  const ground = await page.evaluate(() => window.__retrograde.governor.dev.postGround?.());
  check("no seam: the stage's cleared ground is the theme's --bg, to within half an 8-bit step", seamless(ground), { ...ground, lsb: lsbApart(ground) });
  report.scenarios.claims = { lattice, flash, owned, afterClick, cam, fit, clocks, ground };
  check("claims: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// the scroll hint leaves on the first scroll; the idle hint waits 25 s, names a key that works (the
// terminal exists since Part 13), and never shows twice
{
  const { ctx, page } = await open({ tier: "LOW" });
  const before = await page.evaluate(() => document.querySelector(".hero-hint--scroll").hasAttribute("data-gone"));
  await page.evaluate(() => window.__retrograde.lenis().scrollTo(40, { immediate: true, force: true }));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector(".hero-hint--scroll").hasAttribute("data-gone"));
  await page.evaluate(() => window.__retrograde.lenis().scrollTo(0, { immediate: true, force: true }));
  const idle = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const t0 = performance.now();
          const tick = () => (document.querySelector(".hero-hint--idle[data-shown]") ? resolve(Math.round(performance.now() - t0)) : performance.now() - t0 > 30_000 ? resolve(null) : setTimeout(tick, 100));
          tick();
        }),
    );
  const shownAt = await idle();
  // the key it names: ~ opens the terminal (and, as input, takes the hint away)
  await page.keyboard.press("~");
  await page.waitForTimeout(900);
  const opened = await page.evaluate(() => !!document.querySelector("dialog[data-shell][open]"));
  const gone = await page.evaluate(() => !document.querySelector(".hero-hint--idle[data-shown]") && localStorage.getItem("retrograde:hint-terminal") === "1");
  check("hints: SCROLL leaves on the first scroll; PRESS ~ FOR TERMINAL after 25 s idle, gone on input — and ~ opens the terminal", !before && after && shownAt !== null && shownAt >= 24_500 && gone && opened, { before, after, idleShownAfterMs: shownAt, gone, opened });
  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(600);
  const again = await idle();
  check("…once ever: the same visitor's next visit idles 30 s without it", again === null, { again });
  await ctx.close();
}

// ── 3 · editions ────────────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ reduced: true });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const h1 = document.querySelector("h1").getBoundingClientRect();
    const poster = document.querySelector('[data-stage-slot="system"] .stage-poster');
    // the About portrait is the one canvas outside the two contexts, and it's 2D (DESIGN.md §7.4)
    return { canvases: document.querySelectorAll("canvas:not(.portrait__dots)").length, posterShown: !!poster && !poster.hasAttribute("data-live"), nameInFirstViewport: h1.top >= 0 && h1.bottom <= innerHeight };
  });
  check("reduced motion: no WebGL, the poster, and the name on the first screen", r.canvases === 0 && r.posterShown && r.nameInFirstViewport && logs.length === 0, r);
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ reduced: true, viewport: { width: 390, height: 844 }, dpr: 3, mobile: true });
  await page.waitForTimeout(800);
  const mask = await page.evaluate(() => getComputedStyle(document.querySelector('[data-stage-slot="system"] .stage-poster'), "::before").maskImage);
  check("phone (portrait): the portrait poster", /system-portrait\.png/.test(mask) && logs.length === 0, { mask: mask.slice(0, 80) });
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ tier: "HIGH", theme: "paper" });
  const r = await measure(page, "INITIALS · Paper");
  const ground = await page.evaluate(() => window.__retrograde.governor.dev.postGround?.());
  check("Paper: ink stipple — no bloom, no persistence (points + one effect pass), the paper as the ground", r.calls === 2 && seamless(ground) && logs.length === 0, { calls: r.calls, lsb: lsbApart(ground), gpuP50: r.gpuP50, saturatedMs: r.saturatedMs });
  await ctx.close();
}

// a P3 screen (Part 15): the build writes §2.3's upgrades as lab() (Lightning CSS rewrites the authored
// oklch()), and until Part 15 the GL colors read only oklch(), so on every P3 screen in any browser
// (iPhones, most Macs' own displays, wide-gamut Android phones) the field drew the accent white. Its
// colors must be the theme's: within 0.1 (linear) of an sRGB screen's, which is the P3 accent's own
// clamp to sRGB; the white was 1.0 off.
for (const theme of ["phosphor", "amber"]) {
  const read = async (gamut) => {
    const { ctx, page, logs } = await open({ tier: "HIGH", theme, gamut });
    const r = await page.evaluate(() => {
      const u = window.__retrograde.governor.dev.hero.material.uniforms;
      const v = (k) => [u[k].value.x, u[k].value.y, u[k].value.z];
      return { p3: matchMedia("(color-gamut: p3)").matches, accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(), base: v("uColorBase"), signal: v("uColorSignal") };
    });
    await ctx.close();
    return { ...r, logs };
  };
  const s = await read("srgb");
  const p = await read("p3");
  const r3 = (x) => +x.toFixed(3);
  const apart = Math.max(...[...s.base, ...s.signal].map((x, i) => Math.abs(x - [...p.base, ...p.signal][i])));
  check(`P3 screen (emulated), ${theme}: the field's colors are the theme's, read from the build's lab() (≤ 0.1 linear from an sRGB screen's)`, p.p3 && !s.p3 && /^lab\(/.test(p.accent) && apart <= 0.1 && p.logs.length === 0 && s.logs.length === 0, { accent: p.accent, base: p.base.map(r3), srgbBase: s.base.map(r3), signal: p.signal.map(r3), apart: r3(apart), logs: [...s.logs, ...p.logs].slice(0, 3) });
  report.scenarios[`p3-${theme}`] = { srgb: s, p3: p, apart };
}

await browser.close();
const failed = checks.filter((c) => !c.pass);
writeFileSync(`${OUT}hero-gate.json`, JSON.stringify(report, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} checks pass${failed.length ? ` — FAILED: ${failed.map((c) => c.name).join(" | ")}` : ""}`);
process.exitCode = failed.length ? 1 : 0;
