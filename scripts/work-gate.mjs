#!/usr/bin/env node
/**
 * Gate C for A4 (PROMPTS.md Part 9): WORK's slide carousel measured at the tiers it runs on, and its
 * claims checked, in the installed Chrome — the pattern of scripts/archive-gate.mjs.
 *
 *   BASE_URL=http://localhost:3200 node scripts/work-gate.mjs      (a production build, RETROGRADE_DEV_ROUTES=1)
 *
 * Cost is measured on the budget's cap — ?debug=1&slides=8, the real slides repeated to eight — at
 * rest, mid-fling and fully projected, at HIGH, MID and LOW (A4 runs on phones). Claims: one
 * geometry draw, the covers at the tier's size, ≤ 4 ms GPU, VRAM ≤ 30 / 17 / 12 MB (§4.3 A4); the
 * rail is the content's; drag with inertia, sideways wheel and Shift+wheel, the keys; the vertical
 * wheel always the page's; the GATE clunk and the FLING whir; the PROJECTION out and back with no
 * tear; the editions (phone, reduced motion, tier OFF and its DOM FLIP, no JS, Paper); the INDEX's
 * filters, FLIP and preview; the case study (structure, metadata, SLIDE ADVANCE, the mini-dossier
 * round trip on the fixture page); CLS and a clean console. Report: .artifacts/work-gate.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const TIERS = { HIGH: { dpr: 1.75, coverW: 1024, sceneMB: 30, vramMB: 160 }, MID: { dpr: 1.5, coverW: 768, sceneMB: 17, vramMB: 64 }, LOW: { dpr: 1.5, coverW: 640, sceneMB: 12, vramMB: 24 } };
const BUDGET = { geometryDraws: 1, gpuMs: 4, flyMs: 680 };

const checks = [];
const report = { base: BASE, machine: `${cpus()[0]?.model ?? "?"} · ${cpus().length} cores`, tiers: {}, scenarios: {}, checks };
function check(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

const browser = await chromium.launch({ channel: "chrome" });
const IGNORED = [/Download the React DevTools/];
const CLS_INIT = () => {
  window.__cls = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      // the ?debug=1 overlay is a dev tool, not the product: its own reflows are not counted
      const nodes = (e.sources ?? []).map((s) => s.node).filter(Boolean);
      const el = (n) => (n.nodeType === 3 ? n.parentElement : n);
      if (nodes.length && nodes.every((n) => el(n)?.closest?.(".stage-debug"))) continue;
      window.__cls += e.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function open({ tier = null, slides = null, viewport = { width: 1440, height: 900 }, dpr = 2, mobile = false, theme = "phosphor", reduced = false, js = true, live = true, path = "/", hash = "work", debug = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference", javaScriptEnabled: js });
  await ctx.addInitScript(
    ({ theme }) => {
      sessionStorage.setItem("retrograde:booted", "1");
      localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
      window.__gl = 0;
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (String(type).startsWith("webgl")) window.__gl++;
        return get.call(this, type, ...rest);
      };
    },
    { theme },
  );
  await ctx.addInitScript(CLS_INIT);
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !IGNORED.some((r) => r.test(m.text()))) logs.push(`${m.type()}: ${m.text()}`.slice(0, 240));
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 240)));
  ctx.on("requestfailed", (r) => logs.push(`requestfailed: ${r.failure()?.errorText ?? "?"} ${r.url()}`.slice(0, 240)));
  ctx.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()}: ${r.url()}`.slice(0, 240)));
  const q = new URLSearchParams({ ...(debug ? { debug: "1" } : {}), ...(tier ? { tier } : {}), ...(slides ? { slides: String(slides) } : {}) });
  await page.goto(`${BASE}${path}${q.size ? `?${q}` : ""}${hash ? `#${hash}` : ""}`, { waitUntil: "load" });
  if (js && debug && path === "/") await page.waitForFunction(() => window.__retrograde?.governor.snapshot.tierFinal, null, { timeout: 90_000, polling: 100 });
  if (js && debug && live && !reduced && path === "/") {
    await page.waitForFunction(() => {
      const s = window.__retrograde.governor.snapshot.scenes.work;
      return s.state === "LIVE" && !s.poster && window.__retrograde.governor.dev.work;
    }, null, { timeout: 90_000, polling: 100 });
    await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
    // the slot fully in view
    await page.evaluate(() => {
      const el = document.querySelector('[data-stage-slot="work"]');
      window.__retrograde.lenis()?.scrollTo(el.getBoundingClientRect().top + window.scrollY, { immediate: true, force: true });
    });
    await page.waitForTimeout(700);
  }
  return { ctx, page, logs };
}

const rail = (page) => page.evaluate(() => window.__retrograde.governor.dev.work?.debugState() ?? null);
const cues = (page) => page.evaluate(() => Object.fromEntries(window.__retrograde.cues.played));
const gateLink = (page) => page.evaluate(() => {
  const a = document.querySelector('.work-layer__slide[aria-current="true"]');
  const r = a?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, href: a.getAttribute("href") } : null;
});
async function drag(page, from, dx, steps = 12, stepMs = 16) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) {
    await page.mouse.move(from.x + (dx * k) / steps, from.y);
    await page.waitForTimeout(stepMs);
  }
}

async function measure(page, label) {
  await page.evaluate(() => window.__retrograde.governor.resetStats());
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(40 + (i % 5) * 3, 860);
    await page.waitForTimeout(100);
  }
  return {
    label,
    ...(await page.evaluate(async () => {
      const g = window.__retrograde.governor;
      const st = g.stats;
      const s = g.snapshot;
      const fb = g.dev.framebufferBytes?.() ?? 0;
      const post = g.dev.postBytes?.() ?? 0;
      const scene = s.scenes.work.vramBytes;
      return {
        tier: s.tier,
        dpr: s.dpr,
        gpuP50: st.gpu.count ? +st.gpu.percentile(50).toFixed(2) : null,
        gpuP95: st.gpu.count ? +st.gpu.percentile(95).toFixed(2) : null,
        cpuP50: st.work.count ? +st.work.percentile(50).toFixed(2) : null,
        calls: st.last.calls,
        fps: st.intervals.count ? Math.round(1000 / st.intervals.percentile(50)) : null,
        vram: { sceneMB: +(scene / 1e6).toFixed(2), postMB: +(post / 1e6).toFixed(1), canvasMB: +(fb / 1e6).toFixed(1) },
        saturatedMs: await g.dev.bench?.("work", 60),
      };
    })),
  };
}

// ── 1 · cost: HIGH, MID and LOW at the budget's cap (eight slides) ─────────────────────────────
for (const [tier, spec] of Object.entries(TIERS)) {
  const phone = tier === "LOW";
  const { ctx, page, logs } = await open({ tier, slides: 8, ...(phone ? { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true } : {}) });
  const shape = await rail(page);
  const rows = [await measure(page, "rest")];
  // mid-fling: a sustained drag holds the rail at speed while it's measured
  const g = await gateLink(page);
  await page.evaluate(() => window.__retrograde.governor.resetStats());
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  const flingRow = await (async () => {
    const t0 = Date.now();
    let k = 0;
    const sampler = (async () => {
      const r = [];
      while (Date.now() - t0 < 1400) {
        k++;
        await page.mouse.move(g.x - ((k * 45) % (shape.pitchPx * 1.4)), g.y);
        await page.waitForTimeout(16);
        if (k % 20 === 0) r.push((await rail(page)).fling);
      }
      return r;
    })();
    const flings = await sampler;
    const row = await page.evaluate(async () => {
      const g = window.__retrograde.governor;
      const st = g.stats;
      // VRAM before the bench: its own offscreen target would count as the chain's
      const vram = { sceneMB: +(g.snapshot.scenes.work.vramBytes / 1e6).toFixed(2), postMB: +((g.dev.postBytes?.() ?? 0) / 1e6).toFixed(1), canvasMB: +((g.dev.framebufferBytes?.() ?? 0) / 1e6).toFixed(1) };
      const base = { gpuP50: st.gpu.count ? +st.gpu.percentile(50).toFixed(2) : null, gpuP95: st.gpu.count ? +st.gpu.percentile(95).toFixed(2) : null, cpuP50: st.work.count ? +st.work.percentile(50).toFixed(2) : null, calls: st.last.calls, fps: st.intervals.count ? Math.round(1000 / st.intervals.percentile(50)) : null, dpr: g.snapshot.dpr, tier: g.snapshot.tier, vram };
      return { ...base, saturatedMs: await g.dev.bench?.("work", 60) };
    });
    return { label: "fling", flingPeak: Math.max(0, ...flings), ...row };
  })();
  await page.mouse.up();
  rows.push(flingRow);
  await page.waitForTimeout(1500);
  // fully projected: a slide over the whole slot (the flight's last frame)
  await page.evaluate(() => window.__retrograde.governor.dev.work.hold(window.__retrograde.governor.dev.work.gate));
  await page.waitForTimeout(400);
  rows.push(await measure(page, "projected"));
  const warm = await page.evaluate(() => window.__retrograde.governor.snapshot.scenes.work.warmMs);
  report.tiers[tier] = { rows, warmMs: warm, rail: { slides: shape?.count, covers: shape?.covers, meshes: shape?.meshes } };
  console.log(`\n${tier} — DPR ${rows[0]?.dpr} · ${shape?.count} slides · covers ${shape?.covers?.width}×${shape?.covers?.height} × ${shape?.covers?.layers} · warm ${warm} ms`);
  for (const r of rows) console.log(`  ${r.label.padEnd(9)} GPU ${String(r.gpuP50).padStart(5)} / ${String(r.gpuP95).padStart(5)} ms (p50/p95 timed) · ${String(r.saturatedMs?.toFixed?.(3) ?? r.saturatedMs).padStart(6)} ms saturated · CPU ${r.cpuP50} ms · ${r.calls} calls · VRAM scene ${r.vram.sceneMB} MB (+ post ${r.vram.postMB}, canvas ${r.vram.canvasMB}) · ${r.fps} fps`);
  check(`${tier}: the rail at A4's cap — 8 slides, one InstancedMesh (1 geometry draw), covers ${spec.coverW} wide, a layer each`, shape?.count === 8 && shape.meshes.length === BUDGET.geometryDraws && shape.meshes[0]?.instanced && shape.covers.width === spec.coverW && shape.covers.layers === 8, { meshes: shape?.meshes, covers: shape?.covers });
  check(`${tier}: the tier at its DPR cap`, rows.every((r) => r.tier === tier && r.dpr <= spec.dpr + 1e-6), rows.map((r) => [r.tier, r.dpr]));
  check(`${tier}: the GPU within 4 ms (§4.3 A4) at rest, mid-fling and projected, saturated`, rows.every((r) => r.saturatedMs !== null && r.saturatedMs <= BUDGET.gpuMs), rows.map((r) => r.saturatedMs));
  // A4's VRAM is the covers' (eight, with their mips); the scene adds the mounts' print (R8) and a quad
  const coversMB = shape?.covers ? +((shape.covers.width * shape.covers.height * 4 * shape.covers.layers * 4) / 3 / 1e6).toFixed(2) : null;
  report.tiers[tier].coversMB = coversMB;
  check(`${tier}: the covers within A4's ${spec.sceneMB} MB of VRAM (eight, with their mips); the whole scene reported`, coversMB !== null && coversMB <= spec.sceneMB && rows.every((r) => r.vram.sceneMB <= spec.sceneMB + 2), { coversMB, sceneMB: rows[0]?.vram.sceneMB });
  check(`${tier}: a held drag reads as a fling (smear, whir and aberration > 0)`, flingRow.flingPeak > 0.3, { flingPeak: flingRow.flingPeak });
  check(`${tier}: VRAM (LIVE + WARM + post targets, §8.3) within the tier's ${spec.vramMB} MB`, rows.every((r) => r.vram.sceneMB + r.vram.postMB <= spec.vramMB), rows.map((r) => +(r.vram.sceneMB + r.vram.postMB).toFixed(1)));
  check(`${tier}: console clean`, logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 2 · the claims, desktop HIGH, the real content ─────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ tier: "HIGH" });
  const shape = await rail(page);
  const layer = await page.evaluate(() => ({
    links: [...document.querySelectorAll(".work-layer__slide")].map((a) => ({ href: a.getAttribute("href"), tab: a.tabIndex, transition: a.dataset.transition })),
    cssLinks: [...document.querySelectorAll(".work-css__link")].map((a) => a.getAttribute("href")),
  }));
  check(
    "the rail is the content's: a slide per featured project, each a link to its case study, one tab stop (the gate)",
    shape.count === layer.links.length && layer.links.every((l, i) => l.href === layer.cssLinks[i] && l.href.startsWith("/work/") && l.transition === "continuity") && layer.links.filter((l) => l.tab === 0).length === 1,
    { count: shape.count, links: layer.links.map((l) => l.href) },
  );

  // drag one pitch: it lands one along, with one GATE clunk; the whir ran
  const c0 = await cues(page);
  const g0 = await gateLink(page);
  await drag(page, g0, -shape.pitchPx);
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(1600);
  const afterDrag = await rail(page);
  const c1 = await cues(page);
  check("a drag of one pitch lands the next slide in the gate, with one GATE clunk; the FLING whir ran while it moved", afterDrag.gate === 1 && afterDrag.landed && (c1.GATE ?? 0) - (c0.GATE ?? 0) === 1 && (c1.FLING ?? 0) > (c0.FLING ?? 0), { gate: afterDrag.gate, gateCues: (c1.GATE ?? 0) - (c0.GATE ?? 0), whir: (c1.FLING ?? 0) - (c0.FLING ?? 0) });

  // a fling: released at speed, it coasts further than it was dragged
  const g1 = await gateLink(page);
  await drag(page, g1, -shape.pitchPx * 0.9, 5, 10);
  await page.mouse.up();
  await page.waitForTimeout(1800);
  const afterFling = await rail(page);
  check("a fling coasts: released at speed, it lands further than it was dragged, on a slide, at rest", afterFling.gate >= 3 && afterFling.landed && Math.abs(afterFling.position - Math.round(afterFling.position)) < 1e-3, { from: 1, landed: afterFling.gate });

  // the wheel: sideways and Shift move the rail and never the page; vertical is always the page's
  const g2 = await gateLink(page);
  await page.mouse.move(g2.x, g2.y);
  const y0 = await page.evaluate(() => Math.round(scrollY));
  for (let k = 0; k < 8; k++) {
    await page.mouse.wheel(-90, 0);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(1500);
  const sideways = { rail: await rail(page), y: await page.evaluate(() => Math.round(scrollY)) };
  await page.keyboard.down("Shift");
  for (let k = 0; k < 8; k++) {
    await page.mouse.wheel(0, 90);
    await page.waitForTimeout(16);
  }
  await page.keyboard.up("Shift");
  await page.waitForTimeout(1500);
  const shifted = { rail: await rail(page), y: await page.evaluate(() => Math.round(scrollY)) };
  check("a sideways wheel moves the rail, and the page stays put", sideways.rail.gate < afterFling.gate && sideways.y === y0, { gate: [afterFling.gate, sideways.rail.gate], y: [y0, sideways.y] });
  check("…Shift + a vertical wheel moves it too, the page still put", shifted.rail.gate > sideways.rail.gate && shifted.y === y0, { gate: [sideways.rail.gate, shifted.rail.gate], y: [y0, shifted.y] });
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(900);
  const vertical = { rail: await rail(page), y: await page.evaluate(() => Math.round(scrollY)) };
  check("the vertical wheel always scrolls the page; the rail doesn't move", vertical.y > y0 && vertical.rail.position === shifted.rail.position, { y: [y0, vertical.y], position: [shifted.rail.position, vertical.rail.position] });
  await page.evaluate((y) => window.__retrograde.lenis()?.scrollTo(y, { immediate: true, force: true }), y0);
  await page.waitForTimeout(700);

  // the keyboard: one stop, the arrows and Home / End move the rail and the focus with it
  await page.evaluate(() => document.querySelector('.work-layer__slide[aria-current="true"]')?.focus());
  await page.keyboard.press("Home");
  await page.waitForTimeout(1500);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1500);
  const keyed = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a?.getBoundingClientRect();
    return { gate: window.__retrograde.governor.dev.work.debugState().gate, focus: a?.getAttribute("href"), current: a?.getAttribute("aria-current"), outline: a ? getComputedStyle(a).outlineStyle : null, w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0) };
  });
  check("the keyboard: Home, then → moves the gate one along; focus follows it, visibly framed (≥ 24 px)", keyed.gate === 1 && keyed.current === "true" && keyed.outline !== "none" && keyed.w >= 24 && keyed.h >= 24, keyed);
  await page.keyboard.press("End");
  await page.waitForTimeout(1600);
  const ended = await rail(page);
  check("…End brings the last slide", ended.gate === shape.count - 1, { gate: ended.gate });

  // a click on a neighbour brings it to the gate, opening nothing
  const neighbour = await page.evaluate(() => {
    const a = [...document.querySelectorAll(".work-layer__slide")].find((x, i) => i === window.__retrograde.governor.dev.work.debugState().gate - 1);
    const r = a?.getBoundingClientRect();
    return r && r.width > 1 ? { x: Math.min(r.right - 10, r.x + r.width / 2), y: r.y + r.height / 2 } : null;
  });
  if (neighbour) await page.mouse.click(neighbour.x, neighbour.y);
  await page.waitForTimeout(1600);
  const clicked = { rail: await rail(page), path: await page.evaluate(() => location.pathname) };
  check("a click on a neighbour brings it to the gate and opens nothing", !!neighbour && clicked.rail.gate === shape.count - 2 && clicked.path === "/", { gate: clicked.rail.gate, path: clicked.path });

  // PROJECTION: out (no tear), the stage holding the viewport, the hero underneath, then let go
  await page.evaluate(() => {
    window.__projection = { take: false };
    const t0 = performance.now();
    const tick = () => {
      if (window.__retrograde.governor.takenOver === "work") window.__projection.take = true;
      if (performance.now() - t0 < 6000) requestAnimationFrame(tick); // eslint-disable-line no-restricted-globals
    };
    requestAnimationFrame(tick); // eslint-disable-line no-restricted-globals
  });
  const before = await cues(page);
  const href = (await gateLink(page)).href;
  const yLeft = await page.evaluate(() => Math.round(scrollY));
  await page.evaluate(() => document.querySelector('.work-layer__slide[aria-current="true"]')?.focus());
  await page.keyboard.press("Enter");
  await page.waitForURL(`**${href}`, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForFunction(() => window.__retrograde.governor.takenOver === null && document.querySelector("[data-projection-hero] img")?.complete, null, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const t = window.__retrograde.projection.trace ?? [];
    const at = (step) => Number((t.find((x) => x.includes(step)) ?? "").split(" ")[0]);
    const hero = document.querySelector("[data-projection-hero]")?.getBoundingClientRect();
    const img = document.querySelector("[data-projection-hero] img");
    return { path: location.pathname, y: Math.round(scrollY), take: window.__projection.take, released: window.__retrograde.governor.takenOver === null, flightMs: at(" flown") - at(" forward "), hero: hero ? { top: Math.round(hero.top), h: Math.round(hero.height), w: Math.round(hero.width) } : null, decoded: !!img && img.complete && img.naturalWidth > 0, layerHidden: document.getElementById("stage-takeover")?.hidden ?? null, vh: window.innerHeight, vw: window.innerWidth };
  });
  const afterOut = await cues(page);
  check("PROJECTION out: the stage holds the viewport, the route swaps under it — no tear — to the case study at its top", out.path === href && out.take && (afterOut.TEAR ?? 0) === (before.TEAR ?? 0) && out.y === 0, { ...out, tear: (afterOut.TEAR ?? 0) - (before.TEAR ?? 0) });
  check("…the DOM hero decodes under it — the whole viewport, the picture the slide was — and the stage lets go", out.decoded && out.released && out.layerHidden === true && out.hero?.top === 0 && out.hero?.w === out.vw && out.hero?.h >= out.vh, out.hero);
  check("…the flight is A4's 680 ms, under law 7's 900", out.flightMs >= BUDGET.flyMs * 0.9 && out.flightMs <= 900, { flightMs: out.flightMs });
  // Back: the slide flies home
  await page.evaluate(() => {
    window.__projection = { take: false };
    const t0 = performance.now();
    const tick = () => {
      if (window.__retrograde.governor.takenOver === "work") window.__projection.take = true;
      if (performance.now() - t0 < 6000) requestAnimationFrame(tick); // eslint-disable-line no-restricted-globals
    };
    requestAnimationFrame(tick); // eslint-disable-line no-restricted-globals
  });
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/" && window.__retrograde.governor.takenOver === null, null, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  const home = await page.evaluate(() => ({ path: location.pathname, y: Math.round(scrollY), take: window.__projection.take, rail: window.__retrograde.governor.dev.work?.debugState(), work: window.__retrograde.governor.snapshot.scenes.work.state }));
  const afterBack = await cues(page);
  check("PROJECTION back: the slide flies home to the gate — no tear — the page where you left it, the scene LIVE in its slot", home.path === "/" && home.take && Math.abs(home.y - yLeft) <= 2 && home.rail?.fly === 0 && home.rail?.gate === clicked.rail.gate && home.work === "LIVE" && (afterBack.TEAR ?? 0) === (before.TEAR ?? 0), { y: [yLeft, home.y], fly: home.rail?.fly, gate: home.rail?.gate, work: home.work });
  report.scenarios.projection = { out, home: { y: home.y, take: home.take }, trace: await page.evaluate(() => window.__retrograde.projection.trace) };
  check("desktop: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 3 · the editions ───────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ viewport: { width: 390, height: 844 }, dpr: 3, mobile: true });
  const r = await page.evaluate(() => {
    const s = window.__retrograde.governor;
    const g = document.querySelector('.work-layer__slide[aria-current="true"]')?.getBoundingClientRect();
    return { tier: s.snapshot.tier, work: s.snapshot.scenes.work.state, covers: s.dev.work?.debugState().covers, vramMB: +(s.snapshot.scenes.work.vramBytes / 1e6).toFixed(2), touch: getComputedStyle(document.querySelector(".work-layer")).touchAction, gate: g ? { left: Math.round(g.left), right: Math.round(g.right) } : null, vw: innerWidth };
  });
  check("phones: the stage carousel at LOW, its covers at 640, within 12 MB; a sideways swipe is the rail's, a vertical one the page's", r.tier === "LOW" && r.work === "LIVE" && r.covers?.width === 640 && r.vramMB <= 12 && r.touch === "pan-y" && r.gate && r.gate.left >= 0 && r.gate.right <= r.vw, r);
  check("phones: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ reduced: true, live: false });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    gl: window.__gl,
    css: getComputedStyle(document.querySelector(".work-css")).display,
    links: document.querySelectorAll(".work-css__link").length,
    slot: getComputedStyle(document.querySelector('.work-band > [data-stage-slot="work"]')).visibility,
    arc: getComputedStyle(document.querySelector(".work-css__slide")).animationName,
    layer: !!document.querySelector(".work-layer"),
  }));
  check("reduced motion: no WebGL; the CSS carousel in the slot's place, every slide a link, flat (no scroll-linked turn)", r.gl === 0 && r.css === "grid" && r.links > 0 && r.slot === "hidden" && r.arc === "none" && !r.layer, r);
  check("reduced motion: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ tier: "OFF", live: false });
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => Math.round(document.querySelector(".work-band").getBoundingClientRect().top + scrollY));
  await page.evaluate((y) => window.scrollTo(0, y), top);
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ band: document.querySelector(".work-band")?.dataset.stage ?? null, css: getComputedStyle(document.querySelector(".work-css")).display, arc: getComputedStyle(document.querySelector(".work-css__slide")).animationName }));
  check("tier OFF: the CSS curved carousel (turning as it scrolls) in the slot's place", r.band === "off" && r.css === "grid" && r.arc === "work-arc", r);
  // the DOM FLIP: the cover and the hero share a view-transition name
  const slug = await page.evaluate(() => document.querySelector(".work-css__link")?.getAttribute("href")?.split("/").pop());
  await page.evaluate(() => {
    window.__vt = [];
    const seen = () => {
      for (const a of document.getAnimations()) {
        const pe = a.effect?.pseudoElement;
        if (pe && !window.__vt.includes(pe)) window.__vt.push(pe);
      }
      if (window.__vt.length < 20) requestAnimationFrame(seen); // eslint-disable-line no-restricted-globals
    };
    requestAnimationFrame(seen); // eslint-disable-line no-restricted-globals
  });
  await page.click(".work-css__link");
  await page.waitForURL(`**/work/${slug}`, { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  const flip = await page.evaluate(() => ({ path: location.pathname, pseudo: window.__vt, tear: window.__retrograde.cues.played.get("TEAR") ?? 0 }));
  check("tier OFF: a slide opens as a DOM FLIP — its cover travels into the case study's hero (a shared view transition), no tear", flip.path === `/work/${slug}` && flip.pseudo.some((p) => p.includes(`cover-${slug}`)) && flip.tear === 0, flip);
  check("tier OFF: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page } = await open({ js: false, live: false, debug: false });
  const home = await page.evaluate(() => ({
    css: getComputedStyle(document.querySelector(".work-css")).display,
    slides: [...document.querySelectorAll(".work-css__link")].map((a) => a.getAttribute("href")),
    rows: [...document.querySelectorAll(".work-table__link")].map((a) => a.getAttribute("href")),
    filters: getComputedStyle(document.querySelector(".work-filters")).display,
    alts: [...document.querySelectorAll(".work-css__img")].map((i) => i.alt.length > 0),
  }));
  check("no JS: the work is all there — the CSS carousel and the INDEX, every project a real link, every cover with alt text; no dead filters", home.css === "grid" && home.slides.length > 0 && home.rows.length >= home.slides.length && home.filters === "none" && home.alts.every(Boolean), { slides: home.slides.length, rows: home.rows.length, filters: home.filters });
  const href = home.rows[0];
  await page.goto(`${BASE}${href}`, { waitUntil: "load" });
  const study = await page.evaluate(() => ({ h1: document.querySelector("h1")?.textContent ?? "", h2: [...document.querySelectorAll("h2")].map((h) => h.textContent), alt: document.querySelector("[data-projection-hero] img")?.alt ?? "" }));
  check("no JS: a case study is whole — its h1, its sections' headings, its hero's alt", study.h1.length > 0 && study.h2.length >= 4 && study.alt.length > 0, study);
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ tier: "HIGH", theme: "paper" });
  const r = await rail(page);
  check("Paper: a lightbox — dark ink through backlit film, the gate a loupe", r.paper === true, { paper: r.paper });
  check("Paper: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 4 · INDEX: the table, the filters' FLIP, the preview ───────────────────────────────────────
{
  const { ctx, page, logs } = await open({ tier: "HIGH" });
  const y = await page.evaluate(() => Math.round(document.querySelector(".work-index").getBoundingClientRect().top + scrollY - 100));
  await page.evaluate((y) => window.__retrograde.lenis()?.scrollTo(y, { immediate: true, force: true }), y);
  await page.waitForTimeout(1500);
  const table = await page.evaluate(() => ({
    rows: document.querySelectorAll(".work-table__row").length,
    links: [...document.querySelectorAll(".work-table__link")].every((a) => a.getAttribute("href")?.startsWith("/work/")),
    pending: [...document.querySelectorAll(".work-table__role, .work-table__year")].every((c) => c.querySelector("[aria-hidden]")?.textContent === "—" ? !!c.querySelector(".sr-only")?.textContent : true),
    heads: [...document.querySelectorAll(".work-table thead th")].map((t) => t.textContent.trim()),
  }));
  check("INDEX: a row per project — # · TITLE · ROLE · YEAR · STACK · → — each title its case study's link; a fact not in yet is a dash with words for a screen reader", table.rows >= 5 && table.links && table.pending && table.heads.length === 6, table);
  const filter = await page.evaluate(async () => {
    // the last category: its row moves up the table, so the FLIP has somewhere to go
    const chip = [...document.querySelectorAll('.work-filters button[data-filter="category"]')].filter((b) => b.dataset.value).at(-1);
    chip.click();
    await new Promise((r) => setTimeout(r, 30));
    const flipping = [...document.querySelectorAll(".work-table__row")].filter((r) => !r.hidden && r.getAnimations().length > 0).length;
    const shown = [...document.querySelectorAll(".work-table__row")].filter((r) => !r.hidden).length;
    const count = document.querySelector("[data-index-count]")?.textContent ?? "";
    const pressed = chip.getAttribute("aria-pressed");
    document.querySelector('.work-filters button[data-filter="category"][data-value=""]').click();
    await new Promise((r) => setTimeout(r, 30));
    return { value: chip.dataset.value, shown, count, pressed, flipping, back: [...document.querySelectorAll(".work-table__row")].filter((r) => !r.hidden).length };
  });
  check("INDEX filters: a category chip leaves its rows (counted, announced, pressed) and they FLIP; All brings every row back", filter.shown >= 1 && filter.shown < table.rows && filter.count.length > 0 && filter.pressed === "true" && filter.flipping >= 1 && filter.back === table.rows, filter);
  const row = await page.evaluate(() => { const r = document.querySelectorAll(".work-table__row")[1].getBoundingClientRect(); return { x: r.x + r.width * 0.3, y: r.y + r.height / 2 }; });
  await page.mouse.move(row.x - 120, row.y);
  const samples = [];
  for (let k = 0; k < 12; k++) {
    await page.mouse.move(row.x - 120 + k * 22, row.y);
    await page.waitForTimeout(16);
    samples.push(await page.evaluate(() => document.querySelector(".work-preview")?.style.transform ?? ""));
  }
  await page.waitForTimeout(500);
  const pv = await page.evaluate(() => ({ shown: !!document.querySelector(".work-preview[data-shown]"), pointed: window.__retrograde.work.getState().pointed }));
  const rot = samples.map((t) => Number(/rotate\((-?[\d.]+)deg\)/.exec(t)?.[1] ?? 0));
  check("INDEX preview (B4): the row's cover follows the cursor, turned by its velocity within ±4°; its slide lights on the rail", pv.shown && new Set(samples).size > 3 && rot.every((d) => Math.abs(d) <= 4) && rot.some((d) => Math.abs(d) > 0.2) && pv.pointed === 1, { rot: rot.map((d) => +d.toFixed(2)), pointed: pv.pointed });
  check("INDEX: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 5 · the case study ────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ path: "/work/churn-prediction", hash: "", live: false });
  await page.waitForTimeout(1500);
  const doc = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent ?? "",
    title: document.title,
    h2: [...document.querySelectorAll(".case h2")].map((h) => h.textContent),
    led: document.querySelector(".case__figure")?.textContent ?? "",
    tile: document.querySelector(".case__tile-value")?.textContent ?? "",
    desc: document.querySelector('meta[name="description"]')?.content ?? "",
    hero: document.querySelector("[data-projection-hero] img")?.alt ?? "",
    vt: getComputedStyle(document.querySelector("[data-projection-hero] img")).viewTransitionName,
    cls: window.__cls,
  }));
  check("a case study visited directly: its h1 and title, Context · Problem · Approach · Outcome · Stack in order (no role, links or papers until there are some)", doc.h1 === "Customer Churn Prediction" && doc.title.startsWith(doc.h1) && JSON.stringify(doc.h2) === JSON.stringify(["Context", "Problem", "Approach", "Outcome", "Stack"]) && doc.desc.length > 0 && doc.hero.length > 0, { h2: doc.h2, title: doc.title });
  check("…the Outcome: one LED figure and its tiles, from the project's own numbers", doc.led.includes("97%") && doc.tile.includes("0.98"), { led: doc.led, tile: doc.tile });
  check("…CLS 0 on its load", doc.cls === 0, { cls: doc.cls });
  // prev / next: SLIDE ADVANCE
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  const pushed = await page.evaluate(async () => {
    const link = document.querySelector(".case__step--next");
    const seen = new Set();
    const watch = () => {
      for (const a of document.getAnimations()) if (a.effect?.pseudoElement) seen.add(a.effect.pseudoElement);
    };
    const iv = setInterval(watch, 8);
    link.click();
    await new Promise((r) => setTimeout(r, 900));
    clearInterval(iv);
    return { pseudo: [...seen], path: location.pathname, tear: window.__retrograde.cues.played.get("TEAR") ?? 0 };
  });
  check("prev / next: SLIDE ADVANCE pushes the next project in (a typed view transition), no tear", pushed.path === "/work/wcag-analyzer" && pushed.pseudo.some((p) => p.includes("view-transition")) && pushed.tear === 0, pushed);
  check("case study: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ path: "/dev/work-fixture", hash: "", live: false });
  await page.waitForTimeout(1200);
  const cards = await page.evaluate(() => [...document.querySelectorAll(".mini-dossier")].map((a) => ({ href: a.getAttribute("href"), transition: a.dataset.transition })));
  await page.evaluate(() => document.querySelector(".mini-dossier")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  const y0 = await page.evaluate(() => Math.round(scrollY));
  await page.click(".mini-dossier");
  await page.waitForURL("**/research/**", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  const open1 = await page.evaluate(() => ({ path: location.pathname, dialog: !!document.querySelector("dialog.dossier-dialog[open]"), y: Math.round(scrollY), tear: window.__retrograde.cues.played.get("TEAR") ?? 0 }));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  const closed = await page.evaluate(() => ({ path: location.pathname, dialog: !!document.querySelector("dialog.dossier-dialog[open]"), y: Math.round(scrollY) }));
  check("PUBLISHED RESEARCH (on the fixture): each paper a mini-dossier that opens over the case study — no tear, the page unmoved — and Esc closes back to it", cards.length >= 1 && cards.every((c) => c.transition === "dossier" && c.href.startsWith("/research/")) && open1.dialog && open1.tear === 0 && Math.abs(open1.y - y0) <= 2 && !closed.dialog && closed.path === "/dev/work-fixture" && Math.abs(closed.y - y0) <= 2, { cards: cards.length, open: open1, closed });
  check("fixture: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}work-gate.json`, JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks pass${failed.length ? ` — FAILED: ${failed.map((c) => c.name).join("; ")}` : ""}`);
process.exitCode = failed.length ? 1 : 0;
