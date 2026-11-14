#!/usr/bin/env node
/**
 * Gate C for A5 (PROMPTS.md Part 10): CAPABILITIES' keycap pile measured at the tiers it runs on,
 * and its claims checked, in the installed Chrome — the pattern of scripts/work-gate.mjs.
 *
 *   BASE_URL=http://localhost:3200 node scripts/capabilities-gate.mjs      (a production build, RETROGRADE_DEV_ROUTES=1)
 *
 * Cost is measured on the budget's cap — ?debug=1&keys=40, the real keys repeated to forty — at
 * rest, hovered, in motion (HIGH: a key held and swung through the pile; MID: the float) and
 * gathered, at HIGH and MID (LOW and phones get the HTML edition). Claims (§4.3 A5, §7.4): one
 * InstancedMesh of ≤ 1.5k-triangle caps and one of shadows (2 geometry draws), ≤ 6 MB VRAM, the
 * physics ≤ 0.3 ms a frame, the GPU ≤ 3 ms; the sim sleeps settled and offscreen; the keys are the
 * content's; hover, click, throw, type-to-press (the page's shortcuts stand aside, Esc leaves),
 * gather; the panel (columns, the rubric meter, derived evidence, no percentages); the editions
 * (MID's float, LOW, the phone, reduced motion, no JS, tier OFF, Paper); the poster; CLS and a
 * clean console. Report: .artifacts/capabilities-gate.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
// DPR caps and VRAM budgets: lib/tier.ts TIERS, §8.3
const TIERS = { HIGH: { dpr: 1.75, vramMB: 160 }, MID: { dpr: 1.5, vramMB: 64 } };
const BUDGET = { keys: 40, triangles: 1500, geometryDraws: 2, sceneMB: 6, physicsMs: 0.3, gpuMs: 3 };
const LIT_MS = 1800; // lib/capabilities.ts KEYS.litMs
const RUBRIC = /^L([1-5]) (USED|BUILT|SHIPPED|LED|TAUGHT\/PUBLISHED)$/;

const checks = [];
const report = { base: BASE, machine: `${cpus()[0]?.model ?? "?"} · ${cpus().length} cores`, tiers: {}, checks };
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

async function open({ tier = null, keys = null, viewport = { width: 1440, height: 900 }, dpr = 2, mobile = false, theme = "phosphor", reduced = false, js = true, live = true, debug = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference", javaScriptEnabled: js });
  await ctx.addInitScript(
    ({ theme }) => {
      sessionStorage.setItem("retrograde:booted", "1");
      localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
    },
    { theme },
  );
  await ctx.addInitScript(CLS_INIT);
  const page = await ctx.newPage();
  const logs = [];
  const requests = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !IGNORED.some((r) => r.test(m.text()))) logs.push(`${m.type()}: ${m.text()}`.slice(0, 240));
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 240)));
  ctx.on("request", (r) => requests.push(r.url()));
  ctx.on("requestfailed", (r) => logs.push(`requestfailed: ${r.failure()?.errorText ?? "?"} ${r.url()}`.slice(0, 240)));
  ctx.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()}: ${r.url()}`.slice(0, 240)));
  const q = new URLSearchParams({ ...(debug ? { debug: "1" } : {}), ...(tier ? { tier } : {}), ...(keys ? { keys: String(keys) } : {}) });
  await page.goto(`${BASE}/${q.size ? `?${q}` : ""}#capabilities`, { waitUntil: "load" });
  if (js && debug) await page.waitForFunction(() => window.__retrograde?.governor.snapshot.tierFinal, null, { timeout: 90_000, polling: 100 });
  if (js && debug) await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
  if (js && debug && live) {
    await page.evaluate(() => {
      const el = document.querySelector('[data-stage-slot="capabilities"]');
      window.__retrograde.lenis()?.scrollTo(el.getBoundingClientRect().top + window.scrollY, { immediate: true, force: true });
    });
    await page.waitForFunction(() => {
      const s = window.__retrograde.governor.snapshot.scenes.capabilities;
      return s.state === "LIVE" && !s.poster && window.__retrograde.governor.dev.capabilities;
    }, null, { timeout: 90_000, polling: 100 });
    await page.waitForSelector(".keys-chips__chip", { timeout: 30_000 });
    await park(page);
    await page.waitForTimeout(400);
  }
  return { ctx, page, logs, requests };
}

const pile = (page) => page.evaluate(() => window.__retrograde.governor.dev.capabilities?.debugState() ?? null);
const cues = (page) => page.evaluate(() => Object.fromEntries(window.__retrograde.cues.played));
const frames = (page) => page.evaluate(() => window.__retrograde.governor.stats.framesRendered);
/** the pointer off the pile (below the band) */
const park = (page) => page.mouse.move(6, page.viewportSize().height - 6);
/** key i's centre on screen and its radius (CSS px) */
const keyAt = (page, i) =>
  page.evaluate((i) => {
    const d = window.__retrograde.governor.dev.capabilities.debugState();
    const slot = document.querySelector('[data-stage-slot="capabilities"]').getBoundingClientRect();
    return { x: slot.left + d.screen[i * 3], y: slot.top + d.screen[i * 3 + 1], r: d.screen[i * 3 + 2] };
  }, i);
const asleep = (page, timeout = 8000) =>
  page
    .waitForFunction(() => window.__retrograde.governor.dev.capabilities.debugState().asleep, null, { timeout, polling: 50 })
    .then(
      () => true,
      () => false,
    );
const offHome = (d) => Math.max(...Array.from({ length: d.count }, (_, i) => Math.hypot(d.positions[i * 3] - d.homes[i * 3], d.positions[i * 3 + 1] - d.homes[i * 3 + 1], d.positions[i * 3 + 2] - d.homes[i * 3 + 2])));
const lit = (page) => page.evaluate(() => [...document.querySelectorAll(".skill-row[data-lit]")].map((r) => r.dataset.skill));

/** the stats of the frames drawn while `during` runs, then the GPU's cost of this state, saturated */
async function measure(page, label, during = async () => page.waitForTimeout(1200)) {
  await page.evaluate(() => window.__retrograde.governor.resetStats());
  await during();
  return {
    label,
    ...(await page.evaluate(async () => {
      const g = window.__retrograde.governor;
      const st = g.stats;
      const s = g.snapshot;
      return {
        tier: s.tier,
        dpr: s.dpr,
        drawn: st.framesRendered,
        gpuP50: st.gpu.count ? +st.gpu.percentile(50).toFixed(2) : null,
        cpuP50: st.work.count ? +st.work.percentile(50).toFixed(2) : null,
        cpuP95: st.work.count ? +st.work.percentile(95).toFixed(2) : null,
        calls: st.last.calls,
        fps: st.intervals.count ? Math.round(1000 / st.intervals.percentile(50)) : null,
        vram: { sceneMB: +(s.scenes.capabilities.vramBytes / 1e6).toFixed(2), postMB: +((g.dev.postBytes?.() ?? 0) / 1e6).toFixed(1) },
        saturatedMs: await g.dev.bench?.("capabilities", 60),
      };
    })),
  };
}

// ── 1 · cost: HIGH and MID at the budget's cap (forty keys) ───────────────────────────────────
for (const [tier, spec] of Object.entries(TIERS)) {
  const { ctx, page, logs } = await open({ tier, keys: BUDGET.keys });
  const shape = await pile(page);
  const sim = shape.mode === "sim";
  if (sim) await asleep(page);
  const rows = [await measure(page, "rest")];
  // hovered: the pointer on a key, nudged so the stage keeps drawing
  const k0 = await keyAt(page, 0);
  rows.push(
    await measure(page, "hover", async () => {
      for (let i = 0; i < 40; i++) {
        await page.mouse.move(k0.x + (i % 3), k0.y + (i % 2));
        await page.waitForTimeout(30);
      }
    }),
  );
  // in motion: HIGH holds a key and swings it through the pile; MID floats
  let physics = null;
  if (sim) {
    const k1 = await keyAt(page, 1);
    await page.mouse.move(k1.x, k1.y);
    await page.mouse.down();
    rows.push(
      await measure(page, "thrown", async () => {
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math.PI * 4;
          await page.mouse.move(k1.x + Math.cos(a) * 260, k1.y + Math.sin(a) * 90);
          await page.waitForTimeout(20);
        }
      }),
    );
    await page.mouse.up();
    physics = await page.evaluate(() => {
      const p = window.__retrograde.governor.dev.capabilities;
      p.benchPhysics(120);
      return { at60: +p.benchPhysics(1200, 2).toFixed(4), at30: +p.benchPhysics(1200, 4).toFixed(4) };
    });
  } else {
    await park(page);
    rows.push(await measure(page, "float"));
  }
  // gathered: a category forward, the rest parted around it
  await park(page);
  await page.locator(".keys-chips__chip").nth(2).click();
  await park(page);
  rows.push(await measure(page, "gathered", async () => (sim ? asleep(page) : page.waitForTimeout(1500))));
  await page.locator(".keys-chips__chip").nth(0).click();
  await park(page);
  const warm = await page.evaluate(() => window.__retrograde.governor.snapshot.scenes.capabilities.warmMs);
  report.tiers[tier] = { rows, physics, warmMs: warm, pile: { mode: shape.mode, keys: shape.count, triangles: shape.triangles, meshes: shape.meshes } };
  console.log(`\n${tier} — ${shape.mode} · DPR ${rows[0]?.dpr} · ${shape.count} keys × ${shape.triangles} triangles · warm ${warm} ms${physics ? ` · physics ${physics.at60} ms/frame at 60 Hz (2 steps), ${physics.at30} at 30 fps (4 steps)` : ""}`);
  for (const r of rows) console.log(`  ${r.label.padEnd(9)} GPU ${String(r.saturatedMs?.toFixed?.(3) ?? r.saturatedMs).padStart(6)} ms saturated (${r.gpuP50 ?? "–"} timed p50) · CPU ${r.cpuP50 ?? "–"} / ${r.cpuP95 ?? "–"} ms p50/p95 · ${r.drawn} drawn · ${r.calls} calls · VRAM scene ${r.vram.sceneMB} MB (+ post ${r.vram.postMB}) · ${r.fps ?? "–"} fps`);
  check(
    `${tier}: the pile at A5's cap — ${BUDGET.keys} keys: one InstancedMesh of sculpted caps (≤ ${BUDGET.triangles} triangles each) and one of blob shadows, ${BUDGET.geometryDraws} geometry draws`,
    shape.count === BUDGET.keys && shape.triangles <= BUDGET.triangles && shape.meshes.length === BUDGET.geometryDraws && shape.meshes.every((m) => m.instanced && m.count === BUDGET.keys),
    { keys: shape.count, triangles: shape.triangles, meshes: shape.meshes },
  );
  check(`${tier}: ${tier === "HIGH" ? "the micro-sim" : "the sine float"} (§5)`, shape.mode === (tier === "HIGH" ? "sim" : "float"), shape.mode);
  check(`${tier}: the tier at its DPR cap`, rows.every((r) => r.tier === tier && r.dpr <= spec.dpr + 1e-6), rows.map((r) => [r.tier, r.dpr]));
  check(`${tier}: the GPU within ${BUDGET.gpuMs} ms (§4.3 A5) at rest, hovered, in motion and gathered, saturated`, rows.every((r) => r.saturatedMs !== null && r.saturatedMs <= BUDGET.gpuMs), rows.map((r) => r.saturatedMs));
  check(`${tier}: the scene within A5's ${BUDGET.sceneMB} MB of VRAM`, rows.every((r) => r.vram.sceneMB <= BUDGET.sceneMB), rows.map((r) => r.vram.sceneMB));
  check(`${tier}: VRAM (the scene + post targets, §8.3) within the tier's ${spec.vramMB} MB`, rows.every((r) => r.vram.sceneMB + r.vram.postMB <= spec.vramMB), rows.map((r) => +(r.vram.sceneMB + r.vram.postMB).toFixed(1)));
  if (physics) check(`${tier}: the physics within A5's ${BUDGET.physicsMs} ms a frame at the cap, thrown — two fixed steps at 60 Hz, four at the 30 fps cap`, physics.at60 <= BUDGET.physicsMs && physics.at30 <= BUDGET.physicsMs, physics);
  if (sim) {
    // settled, it sleeps: with the pointer away nothing is drawn
    await asleep(page);
    await page.waitForTimeout(300);
    const f0 = await frames(page);
    await page.waitForTimeout(1200);
    const f1 = await frames(page);
    check(`${tier}: the sim sleeps once settled — nothing drawn while the pile rests`, f1 === f0, { drawn: f1 - f0 });
  } else {
    const f0 = await frames(page);
    await page.waitForTimeout(1000);
    const f1 = await frames(page);
    check(`${tier}: the float keeps the keys afloat while it's on screen`, f1 - f0 > 20, { drawn: f1 - f0 });
  }
  await page.evaluate(() => window.__retrograde.lenis()?.scrollTo(0, { immediate: true, force: true }));
  const away = await page.waitForFunction(() => window.__retrograde.governor.snapshot.scenes.capabilities.state !== "LIVE", null, { timeout: 5000 }).then(
    () => true,
    () => false,
  );
  check(`${tier}: offscreen, it sleeps — scrolled away, the pile leaves LIVE`, away, await page.evaluate(() => window.__retrograde.governor.snapshot.scenes.capabilities.state));
  check(`${tier}: console clean`, logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 2 · the claims, desktop HIGH, the real content ─────────────────────────────────────────────
{
  const { ctx, page, logs } = await open({ tier: "HIGH" });
  await asleep(page);
  const d0 = await pile(page);
  const dom = await page.evaluate(() => {
    const strip = [...document.querySelectorAll(".keys-primary li")];
    const probe = document.createElement("span");
    probe.style.fontSize = "var(--step-4)";
    document.body.append(probe);
    const step4 = getComputedStyle(probe).fontSize;
    probe.remove();
    return {
      strip: strip.map((li) => li.textContent),
      stripSize: strip.map((li) => getComputedStyle(li).fontSize),
      step4,
      rows: [...document.querySelectorAll(".skill-row")].map((r) => r.dataset.skill),
      keycaps: document.querySelectorAll(".keygrid .keycap").length,
      primaryCaps: document.querySelectorAll(".keygrid .keycap[data-primary]").length,
      tipWords: [...document.querySelectorAll(".skill-row")].map((r) => ({ skill: r.dataset.skill, name: r.querySelector("dt")?.textContent, years: r.querySelector(".skill__years")?.textContent, level: r.querySelector(".skill__level .t-micro")?.textContent })),
    };
  });
  check(
    "the keys are the content's: a key per skill, the panel's rows and the CSS grid the same; PRIMARY STACK's six at --step-4, the six accent keys",
    d0.count === dom.rows.length && dom.keycaps === dom.rows.length && dom.strip.length === 6 && dom.primaryCaps === 6 && dom.stripSize.every((s) => s === dom.step4),
    { keys: d0.count, rows: dom.rows.length, keycaps: dom.keycaps, strip: dom.strip, primaryCaps: dom.primaryCaps, size: [dom.stripSize[0], dom.step4] },
  );

  // hover: the key lifts, the rest dim, and the tooltip says name · years · level
  const i = dom.rows.indexOf("fastapi");
  const k = await keyAt(page, i);
  await page.mouse.move(k.x, k.y);
  await page.waitForTimeout(600);
  const hov = await pile(page);
  const tip = await page.evaluate(() => {
    const t = document.querySelector(".keys-tip[data-shown]");
    return t ? { name: t.querySelector(".keys-tip__name")?.textContent, meta: t.querySelector(".keys-tip__meta")?.textContent } : null;
  });
  const want = dom.tipWords[i];
  check(
    "hover: the key under the pointer lifts, the rest dim, and one tooltip says its name · years · level",
    hov.hovered === i && hov.dim[i] < 0.01 && hov.dim.every((v, j) => j === i || v > 0.95) && tip?.name === want.name && tip?.meta === `${want.years} · ${want.level}`,
    { hovered: hov.hovered, tip, want: { name: want.name, meta: `${want.years} · ${want.level}` } },
  );

  // click: a press, a KEYCAP clack, its row lit in the panel, and out again
  const c0 = await cues(page);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
  const c1 = await cues(page);
  const litNow = await lit(page);
  await page.waitForTimeout(LIT_MS + 400);
  const litLater = await lit(page);
  check("click: the key presses with one KEYCAP clack and its row lights in the panel, for 1.8 s", (c1.KEYCAP ?? 0) - (c0.KEYCAP ?? 0) === 1 && litNow.length === 1 && litNow[0] === "fastapi" && litLater.length === 0, { clacks: (c1.KEYCAP ?? 0) - (c0.KEYCAP ?? 0), lit: litNow, after: litLater });

  // throw: grab, fling, it flies and clacks, then drifts home and sleeps
  await park(page);
  await asleep(page);
  const j = dom.rows.indexOf("python");
  const kp = await keyAt(page, j);
  const c2 = await cues(page);
  await page.mouse.move(kp.x, kp.y);
  await page.mouse.down();
  for (let s = 1; s <= 8; s++) {
    await page.mouse.move(kp.x + s * 55, kp.y - s * 8);
    await page.waitForTimeout(16);
  }
  const held = (await pile(page)).grabbed;
  await page.mouse.up();
  await park(page);
  await page.waitForTimeout(200);
  const flying = offHome(await pile(page));
  const t0 = Date.now();
  const slept = await asleep(page, 10_000);
  const settleMs = Date.now() - t0;
  const c3 = await cues(page);
  const home = offHome(await pile(page));
  check(
    "throw: a drag grabs the key and a release throws it; it clacks off the pile, drifts back to its category's home and sleeps",
    held === j && flying > 1 && (c3.KEYCAP ?? 0) > (c2.KEYCAP ?? 0) && slept && home < 0.01,
    { held, offHome: +flying.toFixed(2), clacks: (c3.KEYCAP ?? 0) - (c2.KEYCAP ?? 0), settleMs, rest: +home.toFixed(4) },
  );

  // type-to-press: the stage has focus — a name presses its key, G and S stand aside, space doesn't scroll, Esc leaves
  const grid0 = await page.evaluate(() => !!document.querySelector(".grid-overlay:not([data-flash])"));
  const sound0 = await page.evaluate(() => JSON.parse(localStorage.getItem("retrograde:ui") ?? "{}").state?.sound ?? null);
  await page.focus(".keys-layer");
  const y0 = await page.evaluate(() => Math.round(scrollY));
  const c4 = await cues(page);
  await page.keyboard.type("fastapi", { delay: 50 });
  await page.waitForTimeout(250);
  const typedLit = await lit(page);
  const c5 = await cues(page);
  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await page.keyboard.press(" ");
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ grid: !!document.querySelector(".grid-overlay:not([data-flash])"), sound: JSON.parse(localStorage.getItem("retrograde:ui") ?? "{}").state?.sound ?? null, y: Math.round(scrollY), focus: document.activeElement?.className, hint: !!document.querySelector(".keys-hint[data-shown]") }));
  check(
    "type-to-press: with the keys focused, typing a skill's name presses its key once (a clack, its row lit); the hint shows; G, S and space stand aside",
    typedLit.includes("fastapi") && (c5.KEYCAP ?? 0) - (c4.KEYCAP ?? 0) === 1 && after.grid === grid0 && after.sound === sound0 && after.y === y0 && after.focus?.includes("keys-layer") && after.hint,
    { lit: typedLit, clacks: (c5.KEYCAP ?? 0) - (c4.KEYCAP ?? 0), after, before: { grid: grid0, sound: sound0, y: y0 } },
  );
  await page.keyboard.press("Escape");
  const escaped = await page.evaluate(() => ({ inLayer: !!document.activeElement?.closest(".keys-layer"), hint: !!document.querySelector(".keys-hint[data-shown]") }));
  await page.keyboard.press("g");
  await page.waitForTimeout(150);
  const gridBack = await page.evaluate(() => !!document.querySelector(".grid-overlay:not([data-flash])"));
  await page.keyboard.press("g");
  check("Esc leaves the keys: focus goes, and G is the page's again", !escaped.inLayer && !escaped.hint && gridBack !== grid0, { escaped, gridToggled: gridBack !== grid0 });

  // gather: a chip re-clusters the pile — the category forward at the middle, the rest parted around it, nothing behind it on screen
  await park(page);
  const cats = await page.locator(".keys-chips__chip").count();
  await page.locator(".keys-chips__chip").nth(2).click();
  await park(page);
  const gslept = await asleep(page);
  const g = await pile(page);
  const catOf = await page.evaluate(() => [...document.querySelectorAll(".keys-panel > section")].map((s) => [...s.querySelectorAll(".skill-row")].map((r) => r.dataset.skill)));
  const inCat = (slug) => catOf.findIndex((list) => list.includes(slug));
  const mine = dom.rows.map((s, n) => (inCat(s) === 1 ? n : -1)).filter((n) => n >= 0);
  const rest = dom.rows.map((s, n) => (inCat(s) !== 1 ? n : -1)).filter((n) => n >= 0);
  const z = (n) => g.positions[n * 3 + 2];
  const sc = (n) => ({ x: g.screen[n * 3], y: g.screen[n * 3 + 1], r: g.screen[n * 3 + 2] });
  let clear = Infinity;
  for (const m of mine) for (const o of rest) clear = Math.min(clear, Math.hypot(sc(m).x - sc(o).x, sc(m).y - sc(o).y) - sc(m).r - sc(o).r);
  const slot = await page.evaluate(() => document.querySelector('[data-stage-slot="capabilities"]').getBoundingClientRect().width);
  const cx = mine.reduce((a, n) => a + sc(n).x, 0) / mine.length;
  const checked = await page.evaluate(() => [...document.querySelectorAll(".keys-chips input")].findIndex((i) => i.checked));
  check(
    "gather: a category chip re-clusters the pile — that category forward at the middle, the rest parted around it, none behind it on screen; then it sleeps",
    g.cluster === 1 && checked === 2 && Math.min(...mine.map(z)) > Math.max(...rest.map(z)) && clear >= 0 && Math.abs(cx - slot / 2) < slot * 0.08 && gslept,
    { cluster: g.cluster, chip: checked, clearPx: +clear.toFixed(1), middle: [Math.round(cx), Math.round(slot / 2)], slept: gslept },
  );
  // …and by keyboard: the chips are radios
  await page.focus(".keys-chips input:checked");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  const byKey = (await pile(page)).cluster;
  await page.locator(".keys-chips__chip").nth(0).click();
  await park(page);
  await page.waitForTimeout(200);
  check("…by keyboard too (the chips are one radio group), and All lets the pile go back", cats === 5 && byKey === 2 && (await pile(page)).cluster === null, { chips: cats, byKey });

  // the panel: canonical, categories as columns, each skill a DataRow — years, a rubric meter, evidence; no percentages
  const panel = await page.evaluate(() => {
    const css = (v) => {
      const p = document.createElement("span");
      p.style.background = `var(${v})`;
      document.body.append(p);
      const c = getComputedStyle(p).backgroundColor;
      p.remove();
      return c;
    };
    const sections = [...document.querySelectorAll(".keys-panel > section")];
    return {
      columns: sections.map((s) => ({ top: Math.round(s.getBoundingClientRect().top), left: Math.round(s.getBoundingClientRect().left), heading: s.querySelector("h3")?.textContent })),
      rows: [...document.querySelectorAll(".skill-row")].map((r) => ({
        skill: r.dataset.skill,
        years: r.querySelector(".skill__years")?.textContent,
        segs: r.querySelectorAll(".meter__seg").length,
        on: r.querySelectorAll(".meter__seg[data-on]").length,
        onColor: getComputedStyle(r.querySelector(".meter__seg[data-on]")).backgroundColor,
        offColor: r.querySelector(".meter__seg:not([data-on])") ? getComputedStyle(r.querySelector(".meter__seg:not([data-on])")).backgroundColor : null,
        label: r.querySelector(".skill__level .t-micro")?.textContent,
        labelShown: getComputedStyle(r.querySelector(".skill__level .t-micro")).textTransform,
        evidence: r.querySelector(".skill__evidence")?.textContent,
        dl: r.closest("dl") !== null,
      })),
      fill: css("--accent-fill"),
      wash: css("--accent-wash"),
      text: document.querySelector("#capabilities")?.closest("section")?.innerText ?? document.querySelector(".keys-panel").innerText,
    };
  });
  const rowsOk = panel.rows.every((r) => r.dl && /^\d+ years?$/.test(r.years ?? "") && r.segs === 5 && RUBRIC.test(r.label ?? "") && Number(RUBRIC.exec(r.label)?.[1]) === r.on && r.onColor === panel.fill && (r.offColor === null || r.offColor === panel.wash) && /^(In \d+ (project|paper|role)s?( · \d+ (project|paper|role)s?)*|Not yet in a project, paper or role)$/.test(r.evidence ?? ""));
  check(
    "the panel: categories as columns, each skill a DataRow — its years, a 5-segment meter (--accent-fill on --accent-wash) labelled by the rubric, and its derived evidence; no percentages",
    panel.columns.length === 4 && new Set(panel.columns.map((c) => c.top)).size === 1 && panel.columns.every((c, n) => n === 0 || c.left > panel.columns[n - 1].left) && rowsOk && !/%/.test(panel.text),
    { columns: panel.columns.map((c) => c.heading), sample: panel.rows.slice(0, 2), bad: panel.rows.filter((r) => !(r.segs === 5 && RUBRIC.test(r.label ?? ""))).slice(0, 2) },
  );
  const a11y = await page.evaluate(() => {
    const l = document.querySelector(".keys-layer");
    return { role: l?.getAttribute("role"), rd: l?.getAttribute("aria-roledescription"), label: l?.getAttribute("aria-label"), tab: l?.tabIndex, grid: document.querySelector(".keygrid")?.getAttribute("aria-hidden"), described: !!document.querySelector(".keys-band .sr-only")?.textContent?.length, meterHidden: [...document.querySelectorAll(".meter")].every((m) => m.getAttribute("aria-hidden") === "true") };
  });
  check("accessible: one labelled focus stop for the keys (a group, roledescription keyboard); the stage and the CSS grid hidden from AT, described in words; the meters' words are the rubric's", a11y.role === "group" && a11y.rd === "keyboard" && !!a11y.label && a11y.tab === 0 && a11y.grid === "true" && a11y.described && a11y.meterHidden, a11y);
  const cls = await page.evaluate(() => window.__cls);
  check("CLS: nothing shifts", cls <= 0.001, { cls });
  check("console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 3 · the editions ───────────────────────────────────────────────────────────────────────────
{
  // MID: the float — hover and press, no throw
  const { ctx, page, logs } = await open({ tier: "MID" });
  const d = await pile(page);
  const k = await keyAt(page, 2);
  const c0 = await cues(page);
  await page.mouse.move(k.x, k.y);
  await page.mouse.down();
  for (let s = 1; s <= 6; s++) {
    await page.mouse.move(k.x + s * 40, k.y);
    await page.waitForTimeout(16);
  }
  const grabbed = (await pile(page)).grabbed;
  await page.mouse.up();
  await page.waitForTimeout(200);
  const k2 = await keyAt(page, 2);
  await page.mouse.move(k2.x, k2.y);
  await page.waitForTimeout(300);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
  const c1 = await cues(page);
  check("MID: the keys float (no physics) — a drag throws nothing, a click still presses with a clack", d.mode === "float" && grabbed === -1 && (c1.KEYCAP ?? 0) - (c0.KEYCAP ?? 0) === 1 && (await lit(page)).length === 1, { mode: d.mode, grabbed, clacks: (c1.KEYCAP ?? 0) - (c0.KEYCAP ?? 0) });
  check("MID: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

/** the HTML edition in a context: the CSS keycap grid shown in the band, the slot out of it, a tap presses */
async function htmlEdition(label, opts, { press = true, poster = false } = {}) {
  const { ctx, page, logs, requests } = await open({ ...opts, live: false });
  // Lenis where it runs (not under reduced motion), the page's own scroll otherwise
  await page.evaluate(() => {
    const y = document.querySelector(".keys-band").getBoundingClientRect().top + scrollY;
    const lenis = window.__retrograde?.lenis?.();
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  });
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => {
    const band = document.querySelector(".keys-band");
    const grid = band.querySelector(".keygrid");
    const slot = band.querySelector("[data-stage-slot]");
    return {
      grid: getComputedStyle(grid).display,
      caps: grid.querySelectorAll(".keycap").length,
      slot: getComputedStyle(slot).display,
      band: Math.round(band.getBoundingClientRect().height),
      vh: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
      rows: document.querySelectorAll(".skill-row").length,
      segs: document.querySelectorAll(".meter__seg").length,
      scene: window.__retrograde?.governor.snapshot.scenes.capabilities.state ?? null,
      off: band.dataset.stage ?? null,
    };
  });
  let pressed = null;
  if (press && opts.js !== false) {
    const c0 = await cues(page);
    const box = await page.locator(".keygrid .keycap").nth(0).boundingBox();
    if (opts.mobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const c1 = await cues(page);
    pressed = { clacks: (c1.KEYCAP ?? 0) - (c0.KEYCAP ?? 0), lit: await lit(page) };
  }
  const posters = requests.filter((u) => u.includes("/posters/capabilities"));
  const ok = st.grid === "grid" && st.caps === st.rows && st.caps > 0 && st.slot === "none" && st.overflow <= 0 && st.segs === st.rows * 5 && st.scene !== "LIVE" && (!press || opts.js === false || (pressed.clacks === 1 && pressed.lit.length === 1)) && (!poster || posters.length === 0);
  check(`${label}: the CSS keycap grid in the band (the slot out of it), the panel whole${press && opts.js !== false ? "; a tap presses with a clack and lights the row" : ""}${poster ? "; no poster fetched" : ""}`, ok, { ...st, pressed, posters: posters.length });
  // with JS off, the browser declining the page's scripts is the point, not an error
  const errors = opts.js === false ? logs.filter((l) => !/^requestfailed: csp .*\/_next\/static\/.*\.js$/.test(l)) : logs;
  check(`${label}: console clean`, errors.length === 0, errors.slice(0, 3));
  await ctx.close();
}
await htmlEdition("LOW (desktop)", { tier: "LOW" });
await htmlEdition("the phone (390 × 844, touch)", { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true }, { poster: true });
await htmlEdition("reduced motion", { reduced: true });
await htmlEdition("tier OFF", { tier: "OFF" });
await htmlEdition("no JS", { js: false, debug: false }, { press: false, poster: true });

{
  // Paper: daylight matcap and dye-sublimated legends — the pile live and clean
  const { ctx, page, logs } = await open({ tier: "HIGH", theme: "paper" });
  const d = await pile(page);
  check("Paper: the pile under the daylight matcap with dye-sublimated legends", d.theme === 2 && d.paper === 1 && d.count > 0, { theme: d.theme, paper: d.paper });
  check("Paper: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 4 · the canonical poster ────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const sizes = {};
  for (const f of ["capabilities.png", "capabilities-portrait.png", "capabilities-tablet.png"]) {
    const r = await page.request.get(`${BASE}/posters/${f}`);
    sizes[f] = r.ok() ? (await r.body()).length : r.status();
  }
  // a 1-bit capture of the pile, not a stub: a few KB
  check("the canonical poster is registered and captured — wide, portrait and tablet (the pile at rest, nothing hovered)", Object.values(sizes).every((n) => n > 1000), sizes);
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}capabilities-gate.json`, JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed${failed.length ? ` — failed: ${failed.map((c) => c.name.split(":")[0]).join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
