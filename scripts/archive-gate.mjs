#!/usr/bin/env node
/**
 * Gate C for A3 (PROMPTS.md Part 8): ARCHIVE's citation constellation measured at the tiers it runs
 * on, and its claims checked, in the installed Chrome — the pattern of scripts/log-gate.mjs.
 *
 *   BASE_URL=http://localhost:3200 node scripts/archive-gate.mjs      (a production build, RETROGRADE_DEV_ROUTES=1)
 *
 * Cost is measured on the budget's own caps — ?debug=1&sky=stress, a synthetic sky of 200 glyphs and
 * 2,000 edges (components/stage/archive/stress.ts) — across the pin and in the middle of a re-plot,
 * at HIGH and MID (LOW and phones have no ARCHIVE stage, §4.2), and on the real sky for reference.
 * Claims: 2 geometry draws, no textures, ≤ 3 ms GPU (§4.3 A3); the sky is the content's; scroll
 * flies the retrograde loop; the dial tunes as it passes (ARCHIVE cues); a chip re-plots with the
 * heaviest settling last; hover; a click opens the dossier over the sky without moving the page; Esc
 * closes it; the keyboard reaches every star; the ledger sorts; the unit chart links; the metrics'
 * lead; the editions (phone, reduced motion, Paper, LOW); the dossier page; a clean console.
 * Report: .artifacts/archive-gate.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const TIERS = { HIGH: { dpr: 1.75, vramMB: 160 }, MID: { dpr: 1.5, vramMB: 64 } };
const BUDGET = { geometryDraws: 2, gpuMs: 3 };

const checks = [];
const report = { base: BASE, machine: `${cpus()[0]?.model ?? "?"} · ${cpus().length} cores`, tiers: {}, scenarios: {}, checks };
function check(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

const browser = await chromium.launch({ channel: "chrome" });
const IGNORED = [/Download the React DevTools/];

async function open({ tier = null, sky = null, viewport = { width: 1440, height: 900 }, dpr = 2, mobile = false, theme = "phosphor", reduced = false, live = true, path = "/", hash = "archive" } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await ctx.addInitScript((theme) => {
    sessionStorage.setItem("retrograde:booted", "1");
    localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
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
  ctx.on("requestfailed", (r) => logs.push(`requestfailed: ${r.failure()?.errorText ?? "?"} ${r.url()}`.slice(0, 240)));
  ctx.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()}: ${r.url()}`.slice(0, 240)));
  const q = new URLSearchParams({ debug: "1", ...(tier ? { tier } : {}), ...(sky ? { sky } : {}) });
  await page.goto(`${BASE}${path}?${q}${hash ? `#${hash}` : ""}`, { waitUntil: "load" });
  if (path === "/") await page.waitForFunction(() => window.__retrograde?.governor.snapshot.tierFinal, null, { timeout: 90_000, polling: 100 });
  if (live && !reduced && path === "/") {
    await page.waitForFunction(() => {
      const s = window.__retrograde.governor.snapshot;
      return s.scenes.archive.state === "LIVE" && !s.scenes.archive.poster && window.__retrograde.governor.dev.archive;
    }, null, { timeout: 90_000, polling: 100 });
  }
  if (path === "/") await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
  return { ctx, page, logs };
}

const pin = (page) => page.evaluate(() => window.__retrograde.scroll.geometry().pins.find((p) => p.id === "archive"));
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
const sky = (page) => page.evaluate(() => window.__retrograde.governor.dev.archive?.debugState() ?? null);

async function measure(page, label) {
  await page.evaluate(() => window.__retrograde.governor.resetStats());
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(40 + (i % 5) * 3, 860);
    await page.waitForTimeout(100);
  }
  const r = await page.evaluate(async () => {
    const g = window.__retrograde.governor;
    const st = g.stats;
    const s = g.snapshot;
    const fb = g.dev.framebufferBytes?.() ?? 0;
    const post = g.dev.postBytes?.() ?? 0;
    const scene = s.scenes.archive.vramBytes;
    return {
      tier: s.tier,
      dpr: s.dpr,
      gpuP50: st.gpu.count ? +st.gpu.percentile(50).toFixed(2) : null,
      gpuP95: st.gpu.count ? +st.gpu.percentile(95).toFixed(2) : null,
      cpuP50: st.work.count ? +st.work.percentile(50).toFixed(2) : null,
      calls: st.last.calls,
      fps: st.intervals.count ? Math.round(1000 / st.intervals.percentile(50)) : null,
      vramMB: +((scene + post) / 1e6).toFixed(1),
      vram: { sceneMB: +(scene / 1e6).toFixed(3), postMB: +(post / 1e6).toFixed(1), canvasMB: +(fb / 1e6).toFixed(1) },
      saturatedMs: await g.dev.bench?.("archive", 60),
    };
  });
  return { label, ...r };
}

// ── 1 · cost: HIGH and MID on the budget's caps; the real sky for reference ─────────────────────
for (const [tier, spec] of Object.entries(TIERS)) {
  const { ctx, page, logs } = await open({ tier, sky: "stress" });
  const shape = await sky(page);
  const rows = [];
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    await scrollToProgress(page, p);
    await page.waitForTimeout(1600);
    rows.push(await measure(page, `pin ${Math.round(p * 100)}%`));
  }
  // mid-re-plot: the frame cost while 200 springs move and 2,000 edges re-plot
  await page.evaluate(() => window.__retrograde.archive.getState().setLayout("year"));
  await page.waitForTimeout(250);
  rows.push(await measure(page, "re-plot"));
  const warm = await page.evaluate(() => window.__retrograde.governor.snapshot.scenes.archive.warmMs);
  report.tiers[tier] = { rows, warmMs: warm, sky: { nodes: shape?.count, edges: shape?.edges } };
  console.log(`\n${tier} — DPR ${rows[0]?.dpr} · ${shape?.count} glyphs · ${shape?.edges} edges · warm ${warm} ms`);
  for (const r of rows) console.log(`  ${r.label.padEnd(9)} GPU ${String(r.gpuP50).padStart(5)} / ${String(r.gpuP95).padStart(5)} ms (p50/p95 timed) · ${String(r.saturatedMs?.toFixed?.(3) ?? r.saturatedMs).padStart(6)} ms saturated · CPU ${r.cpuP50} ms · ${r.calls} calls · VRAM ${r.vramMB} MB (scene ${r.vram.sceneMB}, + canvas ${r.vram.canvasMB}) · ${r.fps} fps`);
  check(`${tier}: the stress sky is at A3's caps`, shape?.count === 200 && shape?.edges === 2000, { nodes: shape?.count, edges: shape?.edges });
  check(`${tier}: the tier at its DPR cap`, rows.every((r) => r.tier === tier && r.dpr <= spec.dpr + 1e-6), rows.map((r) => [r.tier, r.dpr]).slice(0, 2));
  check(`${tier}: the GPU within 3 ms (§4.3 A3) at the caps, saturated`, rows.every((r) => r.saturatedMs !== null && r.saturatedMs <= BUDGET.gpuMs), rows.map((r) => r.saturatedMs));
  check(`${tier}: draw calls ≤ 40 in all`, rows.every((r) => r.calls <= 40), rows.map((r) => r.calls));
  check(`${tier}: VRAM (LIVE + WARM + post targets, §8.3) within the tier's ${spec.vramMB} MB`, rows.every((r) => r.vramMB <= spec.vramMB), rows[0]?.vram);
  check(`${tier}: console clean`, logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ tier: "HIGH" });
  await scrollToProgress(page, 0.5);
  await page.waitForTimeout(1600);
  const r = await measure(page, "real sky");
  report.tiers.real = r;
  console.log(`\nreal sky (HIGH) — GPU ${r.gpuP50} / ${r.gpuP95} ms timed · ${r.saturatedMs?.toFixed?.(3)} ms saturated · CPU ${r.cpuP50} ms · ${r.calls} calls · VRAM ${r.vramMB} MB · ${r.fps} fps`);
  check("real sky: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 2 · the claims ────────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ tier: "HIGH" });
  const stage = await page.evaluate(async () => (await (await fetch("/data/stage.json")).json()).graph);
  const shape = await sky(page);
  // the HTML layer comes with the scene (SkyLayer, Part 14): its chunk lands just after A3 warms
  await page.waitForSelector(".sky-node", { state: "attached", timeout: 15_000 }).catch(() => {});
  const html = await page.evaluate(() => ({ records: document.querySelectorAll(".sky-node--record").length, cited: document.querySelectorAll(".sky-node--cited").length, ledger: document.querySelectorAll(".ledger__row").length }));
  const recordsFirst = stage.nodes.every((n, i) => (i < shape.records ? n.kind === 0 : n.kind === 1));
  check("the sky is the content's: a glyph per record and cited work, records first, every edge", shape.count === stage.nodes.length && shape.edges === stage.edges.length && html.records === shape.records && html.records + html.cited === shape.count && html.ledger === shape.records && recordsFirst, { glyphs: shape.count, edges: shape.edges, html, recordsFirst });

  const draws = await page.evaluate(() => {
    const s = window.__retrograde.governor.dev.archive;
    const meshes = [];
    let textures = 0;
    s.group.traverse((o) => {
      if (o.isMesh || o.isLine || o.isPoints) meshes.push({ type: o.type, instanced: !!o.isInstancedMesh, count: o.count ?? null });
      const mat = o.material;
      for (const m of mat ? (Array.isArray(mat) ? mat : [mat]) : []) {
        for (const v of Object.values(m)) if (v?.isTexture) textures++;
        for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture) textures++;
      }
    });
    return { meshes, textures };
  });
  check("2 geometry draws (§4.3 A3): one InstancedMesh of glyphs, one LineSegments of edges; no textures", draws.meshes.length === BUDGET.geometryDraws && draws.meshes.some((m) => m.instanced) && draws.meshes.some((m) => m.type === "LineSegments") && draws.textures === 0, draws);

  // scroll flies the retrograde loop: forward, back, forward again
  const az = [];
  for (let k = 0; k <= 20; k++) {
    await scrollToProgress(page, k / 20);
    await page.waitForTimeout(450);
    az.push(+(await sky(page)).camera.azimuthDeg.toFixed(2));
  }
  const d = az.slice(1).map((v, k) => Math.sign(v - (az[k] ?? 0)));
  const runs = d.filter((s, k) => s !== 0 && s !== d.slice(0, k).filter((x) => x !== 0).at(-1));
  check("scroll flies the retrograde loop: prograde, a loop back, prograde again", runs.join(",") === "1,-1,1", { azimuthDeg: az, runs });

  // the dial (on the stress sky below): the real one is two papers mirrored about its center

  // hover: a record's star scales, its neighbors light, and the one tooltip names it
  await scrollToProgress(page, 0.5);
  await page.waitForTimeout(1600);
  const star = await page.evaluate(() => {
    const el = document.querySelector('[data-sky-node="0"]');
    return el ? { label: el.getAttribute("aria-label") } : null;
  });
  const node0 = await page.evaluate(() => window.__retrograde.governor.dev.archive.screen(0));
  if (node0) {
    await page.mouse.move(node0.x - 40, node0.y);
    await page.mouse.move(node0.x, node0.y, { steps: 6 });
    await page.waitForTimeout(700);
  }
  const hover = await page.evaluate(() => {
    const s = window.__retrograde.governor.dev.archive.debugState();
    const tip = document.querySelector(".sky-tip");
    // a sparse sky (ARCHIVE.sparse, Part 16) labels its records in place: the hovered record's own
    // tag lights and names it, and the tooltip stands aside for it
    const tag = document.querySelector('[data-sky-tag="0"]');
    return {
      hovered: s.hovered,
      tip: tip?.querySelector(".sky-tip__title")?.textContent ?? "",
      tipShown: tip ? getComputedStyle(tip).opacity === "1" : false,
      tag: tag?.querySelector(".sky-tag__title")?.textContent ?? null,
      tagLit: tag?.getAttribute("data-on") === "true" && getComputedStyle(tag).opacity === "1",
    };
  });
  const named = hover.tag !== null ? hover.tagLit && !hover.tipShown && star?.label?.startsWith(hover.tag) : hover.tipShown && hover.tip.length > 0 && star?.label?.startsWith(hover.tip);
  check("hover: the star under the cursor is picked, and it's named — its own tag, lit, in a sparse sky; else the one tooltip", node0 && hover.hovered === 0 && named, { node0, hover, label: star?.label });

  // click: the dossier opens over the sky (the URL changes, the page doesn't move), HOT in the sky
  const y0 = await page.evaluate(() => Math.round(scrollY));
  await page.mouse.click(node0?.x ?? 0, node0?.y ?? 0);
  await page.waitForURL("**/research/**", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  const opened = await page.evaluate(() => ({ path: location.pathname, dialog: !!document.querySelector("dialog.dossier-dialog[open]"), y: Math.round(scrollY), hot: window.__retrograde.archive.getState().hot, title: document.querySelector(".dossier__title")?.textContent ?? "" }));
  const dolly = await sky(page);
  check("a click opens the record's dossier over the sky: a <dialog>, a shareable URL, the page unmoved", opened.dialog && opened.path.startsWith("/research/") && Math.abs(opened.y - y0) <= 2, { ...opened, y0 });
  check("…the open record is HOT, and the camera dollies to it", opened.hot === 0 && dolly.hot === 0 && dolly.camera.distance < (shape.reach ? shape.reach * 3 : 1e9), { hot: opened.hot, camera: dolly.camera });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  const closed = await page.evaluate(() => ({ path: location.pathname, dialog: !!document.querySelector("dialog.dossier-dialog[open]"), y: Math.round(scrollY), hot: window.__retrograde.archive.getState().hot }));
  check("…Esc closes it: back to /, the page where it was, nothing HOT", !closed.dialog && closed.path === "/" && Math.abs(closed.y - y0) <= 2 && closed.hot === null, closed);

  // the keyboard: one tab stop into the sky, arrows travel star to star, Enter opens a record
  const keys = await page.evaluate(() => {
    const first = document.querySelector('.sky-nodes [tabindex="0"]');
    first?.focus();
    return { focused: document.activeElement?.dataset?.skyNode ?? null, stops: document.querySelectorAll('.sky-nodes [tabindex="0"]').length };
  });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  const travelled = await page.evaluate(() => ({ focused: document.activeElement?.dataset?.skyNode ?? null, pointed: window.__retrograde.archive.getState().pointed, ring: (() => { const b = document.activeElement?.getBoundingClientRect(); return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null; })() }));
  check("the keyboard: one tab stop into the sky, arrows move between stars, the focused one framed (≥ 24 px)", keys.stops === 1 && keys.focused !== null && travelled.focused !== null && travelled.pointed === Number(travelled.focused) && (travelled.ring?.w ?? 0) >= 24, { keys, travelled });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const viaKey = await page.evaluate(() => ({ path: location.pathname, dialog: !!document.querySelector("dialog.dossier-dialog[open]") }));
  check("…Enter on a record opens its dossier", viaKey.dialog && viaKey.path.startsWith("/research/"), viaKey);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);

  // a dossier's keyword chip narrows the sky: the dialog closes, the bar names the keyword and its
  // matches (never ALL while it holds), the matching ledger rows light, the rest recede; CLEAR goes
  // back to all and keeps the keyboard in the bar
  // (from the keyboard: the camera may still be easing back from the last dolly, so a star's old
  // screen position is no target)
  await page.evaluate(() => document.querySelector('.sky-nodes [tabindex="0"]')?.focus());
  await page.keyboard.press("Enter");
  await page.waitForURL("**/research/**", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  await page.click("dialog[open] .dossier__keywords button", { timeout: 10_000 });
  await page.waitForURL((u) => u.pathname === "/", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
  const narrowed = await page.evaluate(() => {
    const r = window.__retrograde;
    const k = r.archive.getState().keyword;
    return {
      dialog: !!document.querySelector("dialog[open]"),
      path: location.pathname,
      word: k?.word ?? null,
      matches: k?.matches ?? [],
      scope: document.querySelector(".archive-query__item")?.textContent ?? "",
      lit: [...document.querySelectorAll(".ledger__row[data-lit]")].length,
      sky: r.governor.dev.archive.debugState().lit,
    };
  });
  check(
    "a dossier's keyword chip narrows the sky: back over it, the bar names the keyword and its matches, those rows and stars lit",
    !narrowed.dialog && narrowed.path === "/" && !!narrowed.word && narrowed.scope.includes(narrowed.word) && narrowed.matches.length > 0 && narrowed.lit === narrowed.matches.length && narrowed.matches.every((i) => narrowed.sky?.includes(i)),
    narrowed,
  );
  await page.focus(".archive-query__clear");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const cleared = await page.evaluate(() => ({
    word: window.__retrograde.archive.getState().keyword,
    sky: window.__retrograde.governor.dev.archive.debugState().lit,
    scope: document.querySelector(".archive-query__item")?.textContent ?? "",
    lit: document.querySelectorAll(".ledger__row[data-lit]").length,
    focus: document.activeElement?.classList.contains("archive-query") ?? false,
  }));
  check("…CLEAR goes back to all: the whole sky lit, the bar says ALL again, focus kept in the bar", cleared.word === null && cleared.sky === null && cleared.lit === 0 && cleared.focus && !cleared.scope.includes(narrowed.word ?? "\u0000"), cleared);

  // a chip re-plots: every star springs to its YEAR coordinates, REPLOT plays
  const replot = await page.evaluate(async () => {
    const r = window.__retrograde;
    const before = r.cues.played.get("REPLOT") ?? 0;
    document.querySelector('label.layout-chips__chip:has(input[value="year"])')?.click();
    await new Promise((res) => setTimeout(res, 2500));
    const s = r.governor.dev.archive.debugState();
    return { layout: s.layout, store: r.archive.getState().layout, settled: Math.max(...s.offGoal) < 0.01, cue: (r.cues.played.get("REPLOT") ?? 0) - before, checked: document.querySelector('input[name="archive-layout"]:checked')?.value };
  });
  check("a layout chip re-plots the sky: every star on its YEAR coordinates, the REPLOT cue", replot.layout === "year" && replot.store === "year" && replot.settled && replot.cue === 1 && replot.checked === "year", replot);

  // the ledger: a real table, sortable with aria-sort; a row points at its star; the unit chart links
  const ledger = await page.evaluate(async () => {
    const th = [...document.querySelectorAll(".ledger thead th")];
    const cites = th.find((t) => t.textContent?.toLowerCase().includes("citation"));
    cites?.querySelector("button")?.click();
    await new Promise((res) => setTimeout(res, 100));
    return {
      table: !!document.querySelector("table.ledger caption"),
      sort: cites?.getAttribute("aria-sort"),
      rowLinks: [...document.querySelectorAll(".ledger__link")].map((a) => a.getAttribute("href")),
      cells: [...document.querySelectorAll(".unit-chart__cell")].map((a) => a.getAttribute("href")),
      lead: document.querySelector(".archive-metrics__caption .t-micro")?.textContent ?? "",
      provenance: [...document.querySelectorAll(".archive-metrics__from")].map((e) => e.textContent).every((t) => / as of \d{4}-\d{2}-\d{2}$/i.test(t ?? "")),
      legend: document.querySelectorAll(".shape-legend__item svg").length,
    };
  });
  check("the ledger: a real <table>, sorted by citations with aria-sort, each title its dossier's link", ledger.table && ledger.sort === "descending" && ledger.rowLinks.every((h) => h?.startsWith("/research/")), ledger);
  await page.hover(".ledger__row .ledger__venue");
  await page.waitForTimeout(150);
  const pointed = await page.evaluate(() => ({ store: window.__retrograde.archive.getState().pointed, sky: window.__retrograde.governor.dev.archive.debugState().pointed }));
  await page.mouse.move(5, 5);
  check("…pointing at a row lights its star (the shared store, the sky)", pointed.store !== null && pointed.store >= 0 && pointed.sky === pointed.store, pointed);
  check("the unit chart: a cell per paper, each its dossier's link", ledger.cells.length === shape.records && ledger.cells.every((h) => h?.startsWith("/research/")), { cells: ledger.cells.length });
  check("the metrics: every figure with its provenance; the lead is PEER-REVIEWED PAPERS until cited (v1.9)", ledger.provenance && /peer-reviewed/i.test(ledger.lead), { lead: ledger.lead, provenance: ledger.provenance });
  check("the shape legend is on screen with the sky: the seven shapes, the dashed key (and Part 16's tuned key)", ledger.legend >= 8, { glyphs: ledger.legend });
  check("claims: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

{
  // the dial: as the camera passes, the star nearest the view's center takes focus and plays its note
  const { ctx, page, logs } = await open({ tier: "HIGH", sky: "stress" });
  const focus = await page.evaluate(async () => {
    const r = window.__retrograde;
    const before = r.cues.played.get("ARCHIVE") ?? 0;
    const seen = new Set();
    const geo = r.scroll.geometry().pins.find((p) => p.id === "archive");
    for (let k = 0; k <= 40; k++) {
      r.lenis().scrollTo(geo.start + (geo.length * k) / 40, { immediate: true, force: true });
      await new Promise((res) => setTimeout(res, 160));
      const f = r.governor.dev.archive.debugState().dial;
      if (f >= 0) seen.add(f);
    }
    return { focused: seen.size, cues: (r.cues.played.get("ARCHIVE") ?? 0) - before };
  });
  check("the dial: as the camera passes, the nearest star takes focus, each playing its ARCHIVE note", focus.focused >= 5 && focus.cues >= focus.focused - 1, focus);

  // the re-plot: heavier (more-cited) stars move slower — mass = 1 + normalized citations. A spring
  // from rest covers the same share of its own journey in the same time whatever the distance, so
  // the share still to go at one moment compares stars that travel different distances (raw settle
  // times don't: a light star with far to go can land after a heavy one with little)
  const settle = await page.evaluate(async () => {
    const r = window.__retrograde;
    r.archive.getState().setLayout("venue");
    await new Promise((res) => requestAnimationFrame(res)); // eslint-disable-line no-restricted-globals
    const d0 = r.governor.dev.archive.debugState().offGoal;
    const t0 = performance.now();
    while (performance.now() - t0 < 140) await new Promise((res) => requestAnimationFrame(res)); // eslint-disable-line no-restricted-globals
    const mid = r.governor.dev.archive.debugState();
    const left = mid.offGoal.map((d, i) => ((d0[i] ?? 0) > 0.5 ? d / (d0[i] ?? 1) : null));
    const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
    const heavy = left.filter((q, i) => q !== null && (mid.mass[i] ?? 1) > 1.6);
    const light = left.filter((q, i) => q !== null && (mid.mass[i] ?? 1) < 1.05);
    let landed = false;
    const t1 = performance.now();
    while (performance.now() - t1 < 4000 && !landed) {
      await new Promise((res) => setTimeout(res, 100));
      landed = Math.max(...r.governor.dev.archive.debugState().offGoal) < 0.01;
    }
    return { heavyLeft: +median(heavy).toFixed(3), lightLeft: +median(light).toFixed(3), heavy: heavy.length, light: light.length, landed };
  });
  check("a re-plot springs every star home, the most-cited slowest: the furthest still to go at any moment", settle.landed && settle.heavy > 5 && settle.light > 5 && settle.heavyLeft > settle.lightLeft, settle);
  check("dial and re-plot: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 3 · the editions ──────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ tier: "LOW", live: false });
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => window.__retrograde.governor.snapshot.scenes.archive);
  check("LOW: no ARCHIVE stage — the slot keeps its poster (the drawn constellation)", s.state !== "LIVE" && s.poster === true, s);
  // where A3 can't run, its stars can't be placed: no layer, so no tab stop parked off screen (Part 14)
  const layer = await page.evaluate(() => ({ overlay: !!document.querySelector(".sky-overlay"), stops: document.querySelectorAll(".sky-node").length }));
  check("LOW: no constellation layer — the ledger carries every record", !layer.overlay && layer.stops === 0, layer);
  check("LOW: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, live: false });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const svg = document.querySelector(".archive-sky-svg");
    const row = document.querySelector(".ledger__row");
    const out = { svg: svg ? getComputedStyle(svg).display !== "none" : false, slot: getComputedStyle(document.querySelector('.archive-backdrop > [data-stage-slot="archive"]')).visibility, overlay: document.querySelector(".sky-overlay") ? getComputedStyle(document.querySelector(".sky-overlay")).display : "absent", card: row ? getComputedStyle(row).display : null, live: window.__retrograde.governor.snapshot.scenes.archive.state };
    return out;
  });
  check("phones: the drawn constellation is the header, no stage, no constellation layer (it comes only with A3); the ledger as record cards", r.svg && r.slot === "hidden" && r.overlay === "absent" && r.card === "grid" && r.live !== "LIVE", r);
  await page.evaluate(() => document.querySelector(".ledger__link")?.click());
  await page.waitForTimeout(1500);
  const sheet = await page.evaluate(() => { const d = document.querySelector("dialog.dossier-dialog[open]"); const b = d?.getBoundingClientRect(); return { open: !!d, w: Math.round(b?.width ?? 0), h: Math.round(b?.height ?? 0), vw: innerWidth, vh: innerHeight }; });
  check("phones: the dossier as a full-screen sheet", sheet.open && sheet.w === sheet.vw && sheet.h >= sheet.vh - 1, sheet);
  check("phones: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
  // the drawn header in the pinned frame: whole between the query bar and the HUD's bottom band, at
  // about 1:1, so a glyph's shape is legible (a fixed offset put a star on the legend at 360 px)
  const { ctx, page, logs } = await open({ viewport, dpr: 3, mobile: true, live: false });
  await page.waitForTimeout(1000);
  const start = await page.evaluate(() => window.__retrograde.scroll.geometry().pins.find((p) => p.id === "archive").start);
  await page.evaluate((y) => window.scrollTo(0, y + 10), start);
  await page.waitForTimeout(1200);
  const fit = await page.evaluate(() => {
    const fig = [...document.querySelectorAll(".archive-sky-svg .sky-svg__figure")].find((f) => getComputedStyle(f).display !== "none");
    const box = (el) => el.getBoundingClientRect();
    const svg = fig?.querySelector("svg");
    const ink = fig ? [...fig.querySelectorAll(".sky-svg__node, .sky-svg__label")].map(box) : [];
    return {
      figure: fig?.classList.contains("sky-svg__figure--tall") ? "tall" : fig ? "wide" : null,
      scale: svg ? Math.round((box(svg).width / svg.viewBox.baseVal.width) * 100) / 100 : 0,
      glyphPx: Math.min(...[...(fig?.querySelectorAll(".sky-svg__node") ?? [])].map((n) => Math.round(box(n).width * 10) / 10)),
      inkTop: Math.round(Math.min(...ink.map((b) => b.top))),
      inkBottom: Math.round(Math.max(...ink.map((b) => b.bottom))),
      inkLeft: Math.round(Math.min(...ink.map((b) => b.left))),
      inkRight: Math.round(Math.max(...ink.map((b) => b.right))),
      query: Math.round(box(document.querySelector(".archive-query")).bottom),
      band: Math.round(box(document.querySelector(".hud-bottom")).top),
      vw: innerWidth,
      scrollW: document.documentElement.scrollWidth,
    };
  });
  check(
    `phones ${viewport.width}×${viewport.height}: the drawn header lies whole between the query bar and the HUD's bottom band, about 1:1 (glyphs ≥ 9 px)`,
    fit.figure === "tall" && fit.inkTop >= fit.query && fit.inkBottom <= fit.band && fit.inkLeft >= 0 && fit.inkRight <= fit.vw && fit.scrollW === fit.vw && fit.scale >= 0.85 && fit.glyphPx >= 9,
    fit,
  );
  check(`phones ${viewport.width}×${viewport.height}: console clean`, logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ reduced: true, live: false });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const edge = document.querySelector(".sky-svg__edge");
    return { webgl: window.__gl, svg: getComputedStyle(document.querySelector(".archive-sky-svg")).display !== "none", offset: edge ? getComputedStyle(edge).strokeDashoffset : null, pinned: getComputedStyle(document.querySelector(".archive-pin")).position };
  });
  check("reduced motion: no WebGL; the drawn constellation, its edges simply there; no pin", r.webgl === 0 && r.svg && (r.offset === "0" || r.offset === "0px") && r.pinned !== "sticky", r);
  check("reduced motion: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open({ tier: "HIGH", theme: "paper" });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const s = window.__retrograde.governor.dev.archive;
    const mats = [];
    s.group.traverse((o) => o.material && mats.push(o.material.blendEquation));
    return { equations: mats, ground: window.__retrograde.governor.dev.postGround?.() ?? null };
  });
  // three.js: MinEquation 103, MaxEquation 104
  check("Paper: ink on a chart — the sky blends with MIN (the darkest ink wins) over the page's paper", r.equations.length === 2 && r.equations.every((e) => e === 103) && !!r.ground, r);
  check("Paper: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 4 · the dossier's own page ────────────────────────────────────────────────────────────────
{
  const slugs = await (async () => {
    const { ctx, page } = await open({ live: false });
    const s = await page.evaluate(() => [...document.querySelectorAll(".ledger__link")].map((a) => a.getAttribute("href")));
    await ctx.close();
    return s;
  })();
  const first = slugs.at(-1) ?? slugs[0];
  const { ctx, page, logs } = await open({ path: first, hash: null, live: false });
  await page.waitForTimeout(1200);
  const doc = await page.evaluate(() => ({ dialog: !!document.querySelector("dialog[open]"), h1: document.querySelector("h1.dossier__title")?.textContent ?? "", title: document.title, tldr: document.querySelector(".dossier__tldr p")?.textContent ?? "", strip: document.querySelector(".dossier__strip")?.textContent ?? "", next: document.querySelector(".dossier__step--next")?.getAttribute("href") ?? null, prev: document.querySelector(".dossier__step--prev")?.getAttribute("href") ?? null }));
  check("visited directly, the dossier is a full page: its h1, its title, the TLDR under it, the strip", !doc.dialog && doc.h1.length > 0 && doc.title.startsWith(doc.h1) && doc.tldr.length > 0 && /^AR-\d{4}/.test(doc.strip), doc);
  await page.click(".copy-bibtex button");
  await page.waitForTimeout(300);
  const copied = await page.evaluate(async () => ({ toast: document.querySelector(".copy-bibtex__toast")?.textContent ?? "", clip: await navigator.clipboard.readText().catch(() => "") }));
  check("COPY BIBTEX: the entry on the clipboard, and a mono COPIED toast", /^@\w+\{/.test(copied.clip) && /copied/i.test(copied.toast), { toast: copied.toast, clip: copied.clip.slice(0, 40) });
  const step = doc.next ?? doc.prev;
  if (step) {
    // from a record's own page, its neighbor opens over it (the root intercept catches every soft step)
    await page.click(doc.next ? ".dossier__step--next" : ".dossier__step--prev");
    await page.waitForURL(`**${step}`, { timeout: 15_000 });
    await page.waitForTimeout(900);
    const over = await page.evaluate(() => ({ path: location.pathname, page: document.querySelector("main.dossier-page h1")?.textContent ?? "", dialog: document.querySelector("dialog.dossier-dialog[open] h2.dossier__title")?.textContent ?? "" }));
    check("from a record's own page, prev / next open the neighbor over it, the page kept underneath", over.path === step && over.page === doc.h1 && over.dialog.length > 0 && over.dialog !== doc.h1, over);
    // inside the dialog, a step pushes the next record in: a typed view transition (SLIDE ADVANCE)
    const vt = await page.evaluate(async () => {
      const link = document.querySelector("dialog[open] .dossier__step--prev, dialog[open] .dossier__step--next");
      if (!link) return { step: false };
      const seen = new Set();
      const watch = setInterval(() => document.getAnimations().forEach((a) => { const p = String(a.effect?.pseudoElement ?? ""); if (p.includes("view-transition")) seen.add(p); }), 16);
      link.click();
      await new Promise((r) => setTimeout(r, 700));
      clearInterval(watch);
      return { step: true, pseudo: [...seen], path: location.pathname, title: document.querySelector("dialog[open] h2.dossier__title")?.textContent ?? "" };
    });
    check("…and inside it, prev / next push the record across (SLIDE ADVANCE, a typed view transition)", !vt.step || (vt.pseudo.some((p) => p.includes("view-transition-new")) && vt.pseudo.some((p) => p.includes("view-transition-old"))), vt);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => ({ path: location.pathname, dialog: !!document.querySelector("dialog[open]"), page: document.querySelector("main.dossier-page h1")?.textContent ?? "" }));
    check("…Esc returns to the record's own page underneath", !back.dialog && back.page === doc.h1, back);
  }
  check("dossier page: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}archive-gate.json`, JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks pass${failed.length ? ` — FAILED: ${failed.map((f) => f.name).join(" · ")}` : ""}`);
process.exitCode = failed.length ? 1 : 0;
