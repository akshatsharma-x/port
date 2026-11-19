#!/usr/bin/env node
/**
 * Gate D's own checks (PROMPTS.md Part 14): what the eleven part gates don't already hold, in the
 * installed Chrome against a production build.
 *
 *   BASE_URL=http://localhost:3200 node scripts/audit-gate.mjs [--only=a,b]   (RETROGRADE_DEV_ROUTES=1)
 *
 * governor  · exactly two WebGL contexts by architecture; COLD disposal back to the memory baseline
 * tiers     · HIGH/MID/LOW/OFF and which stages each runs live; the boot's probe; DPR regression
 *             under load and back; the HUD's GFX LOW visibly taking over
 * bakes     · no runtime force simulation, textures through createImageBitmap, no KTX2 needed
 * motion    · reduced motion creates no WebGL context anywhere; the SVG sky; the foil at .62 / .38
 * keyboard  · the skip link first; every stop visible, never under the HUD; no trap outside dialogs
 * semantics · landmarks, one h1 and no skipped levels, alt text, live regions; axe (WCAG 2.2 AA)
 * contrast  · DESIGN.md §5.3's under-FX numbers, measured on the real build in every theme
 * foil      · never under text, at every tilt the lamp gives
 * reach     · every paper and certificate by keyboard alone, readable in the accessibility tree
 * resilience· no WebGL, failed media, no JS, NO SIGNAL (404, and 500 from /dev/throw)
 * layout    · 320–2560 px without overflow; no 100vh; touch targets ≥ 44 px on coarse pointers;
 *             no hover-only affordance; cert cards tap to flip
 * cursor    · one of the two cursors always on screen (Part 16): the native one until the pointer
 *             moves and in dialogs and fields, else the reticle — painted on top, proven in pixels —
 *             over the boot, a View Transition, HALT's dark tube and the reduced tear; never neither
 *             after a dossier or the terminal closes under a still pointer
 * Report: .artifacts/audit-gate.json (and the home page's accessibility tree, .artifacts/a11y-tree.txt)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { inp } from "./audit/inp.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, ".artifacts");
mkdirSync(OUT, { recursive: true });
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const run = (part) => !ONLY.length || ONLY.includes(part);
const TIERS = { HIGH: { dpr: 1.75, points: 250_000 }, MID: { dpr: 1.5, points: 90_000 }, LOW: { dpr: 1.25, points: 35_000 } }; // DESIGN.md §4.2
const LIVE_AT_LOW = ["system", "work"]; // §4.2: Hero + Projects
const SCENES = ["system", "log", "archive", "work", "capabilities"];
const TARGET = 44; // the prompt's touch target (WCAG 2.5.5)
const WIDTHS = [320, 375, 768, 1024, 1440, 2560];
const FX_TABLE = [
  // DESIGN.md §5.3: theme, text token, surface, base, average under FX, worst single pixel
  ["phosphor", "--fg-3", "--bg", 7.33, 6.71, 5.52],
  ["phosphor", "--fg-3", "--bg-raised", 6.9, 6.22, 5.0],
  ["phosphor", "--hot", "--bg", 5.82, 5.35, 4.39],
  ["phosphor", "--hot", "--bg-raised", 5.48, 4.96, 3.98],
  ["amber", "--fg-3", "--bg-raised", 6.78, 6.08, 4.86],
  ["paper", "--fg-3", "--bg", 5.84, 5.53, 4.76],
  ["paper", "--hot", "--bg", 5.71, 5.41, 4.66],
];

const checks = [];
const report = { base: BASE, checks, measures: {} };
const CI = process.argv.includes("--ci"); // hosted CI: no GPU (WebGL is SwiftShader), so no frame times
const skipped = [];
function skip(part, name, why) {
  skipped.push({ part, name, why });
  console.log(`SKIP  [${part}] ${name} — ${why}`);
}
function check(part, name, pass, detail) {
  checks.push({ part, name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${part}] ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`.slice(0, 1600));
}

const GL_CENSUS = () => {
  window.__gl = { created: 0, canvases: [] };
  const wrap = (proto) => {
    const orig = proto.getContext;
    proto.getContext = function (type, ...rest) {
      const ctx = orig.call(this, type, ...rest);
      if (ctx && /webgl/i.test(type) && !this.__glCounted) {
        this.__glCounted = true;
        window.__gl.created++;
        window.__gl.canvases.push(this.id || this.className || this.constructor.name);
      }
      return ctx;
    };
  };
  wrap(HTMLCanvasElement.prototype);
  if (typeof OffscreenCanvas !== "undefined") wrap(OffscreenCanvas.prototype);
};
const CLS_INIT = () => {
  window.__cls = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      const nodes = (e.sources ?? []).map((s) => s.node).filter(Boolean);
      const el = (n) => (n.nodeType === 3 ? n.parentElement : n);
      if (nodes.length && nodes.every((n) => el(n)?.closest?.(".stage-debug"))) continue;
      window.__cls += e.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

let browser = await chromium.launch({ channel: "chrome" });
async function part(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(name, "the part ran to its end", false, String(e?.message ?? e).split("\n")[0].slice(0, 300));
    for (const c of browser.contexts()) await c.close().catch(() => {});
  }
}

async function open(path = "/", { viewport = { width: 1440, height: 900 }, mobile = false, theme = "phosphor", reduced = false, js = true, debug = true, tier = null, clipboard = false, launch = null, dpr = 1 } = {}) {
  const b = launch ?? browser;
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference", javaScriptEnabled: js });
  if (clipboard) await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await ctx.addInitScript(({ theme }) => {
    sessionStorage.setItem("retrograde:booted", "1");
    localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
  }, { theme });
  await ctx.addInitScript(GL_CENSUS);
  await ctx.addInitScript(CLS_INIT);
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !/React DevTools/.test(m.text()) && logs.push(`${m.type()}: ${m.text()}`.slice(0, 200)));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 200)));
  const q = [debug && js ? "debug=1" : null, tier ? `tier=${tier}` : null].filter(Boolean).join("&");
  const res = await page.goto(`${BASE}${path}${q ? `${path.includes("?") ? "&" : "?"}${q}` : ""}`, { waitUntil: "load" });
  if (js) await page.waitForTimeout(900);
  if (js && debug) await page.addStyleTag({ content: ".stage-debug{display:none!important}" }).catch(() => {});
  return { ctx, page, logs, status: res?.status() ?? 0 };
}
const snap = (page) => page.evaluate(() => {
  const s = window.__retrograde?.governor?.snapshot;
  return s ? { tier: s.tier, tierFinal: s.tierFinal, dpr: s.dpr, mode: s.mode, resident: s.resident, scenes: Object.fromEntries(Object.entries(s.scenes).map(([k, v]) => [k, v.state])), reasons: s.tierReasons ?? s.reasons ?? null } : null;
});
const toSection = (page, id) =>
  page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY;
    const l = window.__retrograde?.lenis?.();
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, id);
const sweep = async (page, ms = 900) => {
  for (const id of ["system", "identity", "log", "archive", "work", "capabilities", "credentials", "connect", "halt"]) {
    await toSection(page, id);
    await page.waitForTimeout(ms);
  }
};
const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

// ── governor ────────────────────────────────────────────────────────────────────────────────
if (run("governor")) await part("governor", async () => {
  const { ctx, page, logs } = await open("/", { tier: "HIGH" });
  await page.waitForFunction(() => window.__retrograde?.governor?.snapshot?.scenes?.system === "LIVE" || window.__retrograde?.governor?.snapshot?.scenes?.system?.state === "LIVE", null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const at0 = await page.evaluate(() => ({ gl: window.__gl, mem: window.__retrograde.governor.dev.runtimeMemory?.(), resident: window.__retrograde.governor.snapshot.resident }));
  await sweep(page, 1300);
  const mid = await page.evaluate(() => window.__gl.created);
  await toSection(page, "system");
  // COOLING's grace (2 s) and the scheduler's next pass
  await page.waitForTimeout(6000);
  const at1 = await page.evaluate(() => ({ mem: window.__retrograde.governor.dev.runtimeMemory?.(), resident: window.__retrograde.governor.snapshot.resident }));
  check("governor", "exactly two WebGL contexts by architecture — the stage and #fx-gl — and never a third over a full pass", at0.gl.created === 2 && mid === 2, { created: at0.gl.created, canvases: at0.gl.canvases, afterPass: mid });
  check("governor", "COLD is disposed: after every scene has gone LIVE and COLD, GPU memory is back to its baseline (same residents)", JSON.stringify(at0.resident) === JSON.stringify(at1.resident) && at0.mem && at1.mem && at1.mem.geometries === at0.mem.geometries && at1.mem.textures === at0.mem.textures && at1.mem.programs <= at0.mem.programs, { before: at0, after: at1 });
  check("governor", "…console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
});

// ── tiers ───────────────────────────────────────────────────────────────────────────────────
if (run("tiers")) await part("tiers", async () => {
  const live = {};
  for (const tier of ["HIGH", "MID", "LOW", "OFF"]) {
    const { ctx, page, logs } = await open("/", { tier, dpr: 2 });
    await page.waitForTimeout(2500);
    const s0 = await snap(page);
    const lit = [];
    for (const id of SCENES) {
      await toSection(page, id);
      await page.waitForTimeout(2200);
      const s = await snap(page);
      if (s?.scenes[id] === "LIVE") lit.push(id);
    }
    const gl = await page.evaluate(() => window.__gl.created);
    live[tier] = { tier: s0?.tier, dpr: s0?.dpr, lit, gl, logs: logs.length };
    await ctx.close();
  }
  report.measures.tiers = live;
  const want = { HIGH: SCENES, MID: SCENES, LOW: LIVE_AT_LOW, OFF: [] };
  check("tiers", "each tier runs the stages DESIGN.md §4.2 gives it (all five at HIGH and MID, Hero + Projects at LOW, none at OFF), DPR within its cap", Object.entries(want).every(([t, w]) => JSON.stringify(live[t].lit) === JSON.stringify(w) && live[t].tier === t && (t === "OFF" || live[t].dpr <= TIERS[t].dpr + 1e-9)) && Object.values(live).every((l) => l.logs === 0), live);
  // the boot's probe on its own (no forced tier): it decides, and says why
  if (CI) skip("tiers", "the probe's decision, GFX LOW over it", "the tier is the GPU's");
  else {
    const { ctx, page } = await open("/", { dpr: 2 });
    await page.waitForFunction(() => window.__retrograde?.governor?.snapshot?.tierFinal, null, { timeout: 30_000 }).catch(() => {});
    const s = await page.evaluate(() => {
      const g = window.__retrograde.governor;
      return { tier: g.snapshot.tier, final: g.snapshot.tierFinal, reasons: g.snapshot.tierReasons, probes: g.snapshot.probes };
    });
    report.measures.probe = s;
    check("tiers", "the boot's probe decides the tier on its own: a measured probe, then final (reasons only when something capped it)", s.final && ["HIGH", "MID", "LOW"].includes(s.tier) && s.probes.length > 0 && s.probes.every((p) => p.frames > 0 && p.p90Ms > 0), s);
    // DPR regression, the ladder §4.2 gives it: under load the 120 Hz stage first caps at 60; only
    // if 60 can't hold does DPR step down, 0.25 at a time to 1.0; when the load ends it climbs back.
    // Scrolling the hero's pin keeps it at full rate (at rest it's idle or on demand, where DPR
    // holds by design). The trace samples the snapshot in the page, every 16 ms.
    {
      const cdp = await ctx.newCDPSession(page);
      await page.evaluate(() => {
        window.__dpr = [];
        let last = "";
        setInterval(() => {
          const s = window.__retrograde.governor.snapshot;
          const k = `${s.mode} ${s.dpr}`;
          if (k !== last) window.__dpr.push([Math.round(performance.now()), s.mode, s.dpr]);
          last = k;
        }, 16);
      });
      await page.mouse.move(720, 450);
      let dir = 1;
      let n = 0;
      const scrollFor = async (ms) => {
        const end = Date.now() + ms;
        while (Date.now() < end) {
          await page.mouse.wheel(0, 120 * dir);
          if (++n % 6 === 0) dir = -dir;
          await page.waitForTimeout(40);
        }
      };
      const phase = async (rate, loadMs, restMs) => {
        const from = await page.evaluate(() => window.__dpr.length);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        const t = await page.evaluate(() => performance.now());
        await scrollFor(loadMs);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        const released = await page.evaluate(() => performance.now());
        await scrollFor(restMs);
        const trace = (await page.evaluate(() => window.__dpr)).slice(from);
        return { rate, released: Math.round(released - t), trace: trace.map(([ms, mode, dpr]) => [Math.round(ms - t), mode, dpr]) };
      };
      const light = await phase(20, 8000, 4000); // the cap absorbs it
      const heavy = await phase(80, 9000, 6000); // the cap can't
      report.measures.dpr = { light, heavy };
      const dprs = (tr, from, to) => tr.filter(([ms]) => ms >= from && ms < to).map(([, , d]) => d);
      const steps = (list) => list.every((d, i) => i === 0 || Math.abs(d - list[i - 1]) <= 0.25 + 1e-9);
      const lightAll = dprs(light.trace, -Infinity, Infinity);
      check("tiers", "DPR holds under a load the 60 Hz cap absorbs (120 → 60 first), and doesn't step down when it ends", light.trace.some(([, m]) => m === "capped") && lightAll.every((d) => d === TIERS.HIGH.dpr), light);
      const down = dprs(heavy.trace, 0, heavy.released);
      const up = dprs(heavy.trace, heavy.released, Infinity);
      check("tiers", "under a load it can't absorb, DPR steps down 0.25 at a time to the floor (1.0); with the load gone it climbs back", Math.min(...down) === 1 && steps(down) && steps(up) && Math.max(...up) > 1, { down, up, trace: heavy.trace });
    }
    await ctx.close();
  }
  // the HUD's GFX LOW: the tier visibly drops (LOW's particle count, its DPR cap), and AUTO brings it back
  if (!CI) {
    const { ctx, page, logs } = await open("/", { dpr: 2 });
    await page.waitForFunction(() => window.__retrograde?.governor?.snapshot?.tierFinal, null, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const before = await snap(page);
    const gfx = page.locator(".front-panel .fp-switch").last();
    const press = () => gfx.click({ timeout: 3000 }).catch(() => gfx.evaluate((b) => b.click()));
    await press();
    await page.waitForTimeout(2500);
    const low = await snap(page);
    const shotLow = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 700 } });
    await press();
    await page.waitForTimeout(2500);
    const auto = await snap(page);
    const shotAuto = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 700 } });
    const pressed = await gfx.getAttribute("aria-pressed");
    check("tiers", "GFX LOW visibly takes over (tier LOW, its DPR cap; the picture changes) and AUTO hands it back", low.tier === "LOW" && low.dpr <= TIERS.LOW.dpr + 1e-9 && auto.tier === before.tier && !shotLow.equals(shotAuto) && pressed === "false" && logs.length === 0, { before: [before.tier, before.dpr], low: [low.tier, low.dpr], auto: [auto.tier, auto.dpr], logs: logs.slice(0, 2) });
    await ctx.close();
  }
});

// ── bakes ───────────────────────────────────────────────────────────────────────────────────
if (run("bakes")) await part("bakes", async () => {
  const dir = join(ROOT, ".next/static/chunks");
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  const text = (f) => readFileSync(join(dir, f), "utf8");
  const force = files.filter((f) => /forceSimulation|forceManyBody|d3-force/.test(text(f)));
  const bitmap = files.filter((f) => text(f).includes("createImageBitmap"));
  const ktx = readdirSync(join(ROOT, "public"), { recursive: true }).filter((f) => String(f).endsWith(".ktx2"));
  const atlases = ["public/textures/log-cards.webp", "public/textures/foil-grain.webp", "public/textures/bluenoise-64.png"].map((f) => {
    try {
      readFileSync(join(ROOT, f));
      return true;
    } catch {
      return false;
    }
  });
  const posters = readdirSync(join(ROOT, "public/posters")).filter((f) => f.endsWith(".png"));
  check("bakes", "the graph's layout is baked (no force simulation in any client chunk); textures decode through createImageBitmap; atlases and posters are baked; no KTX2 (no tier is over its VRAM, §8.3)", force.length === 0 && bitmap.length > 0 && atlases.every(Boolean) && posters.length >= 5 && ktx.length === 0, { force, bitmapChunks: bitmap.length, posters: posters.length, ktx: ktx.length });
});

// ── reduced motion: no WebGL context, anywhere ──────────────────────────────────────────────
if (run("motion")) await part("motion", async () => {
  const seen = [];
  {
    const { ctx, page, logs } = await open("/", { reduced: true });
    await sweep(page, 500);
    const svg = await page.evaluate(() => !!document.querySelector("#archive .archive-sky-svg"));
    await page.keyboard.press("~");
    await page.waitForTimeout(800);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await toSection(page, "archive");
    await page.waitForTimeout(400);
    const link = page.locator("#archive .ledger__link").first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(1500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
    }
    seen.push(["/ (all sections, the terminal, a dossier)", await page.evaluate(() => window.__gl.created), svg, logs.length]);
    await ctx.close();
  }
  for (const path of ["/work/cognivault-ai", "/research/food-waste-cold-chain-sci-2026", "/dev/credentials/full"]) {
    const { ctx, page, logs } = await open(path, { reduced: true });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(800);
    const foil = path.includes("credentials") ? await page.evaluate(() => [...document.querySelectorAll(".cred-card")].slice(0, 3).map((c) => [getComputedStyle(c).getPropertyValue("--mx").trim(), getComputedStyle(c).getPropertyValue("--my").trim()])) : null;
    seen.push([path, await page.evaluate(() => window.__gl.created), foil, logs.length]);
    await ctx.close();
  }
  report.measures.reducedMotion = seen;
  const foil = seen.find(([p]) => p.includes("credentials"))?.[2] ?? [];
  check("motion", "reduced motion creates no WebGL context at all — every section, the terminal, a dossier, a case study, a paper, the credential wall (DESIGN.md §3.9)", seen.every(([, gl]) => gl === 0) && seen.every(([, , , l]) => l === 0), seen);
  check("motion", "…the sky is its build-time SVG, and the foil rests at --mx .62 / --my .38", seen[0][2] === true && foil.length > 0 && foil.every(([x, y]) => Number(x) === 0.62 && Number(y) === 0.38), { svg: seen[0][2], foil });
});

// ── keyboard ────────────────────────────────────────────────────────────────────────────────
if (run("keyboard")) await part("keyboard", async () => {
  const { ctx, page, logs } = await open("/");
  await page.waitForTimeout(1200);
  const stops = [];
  const MAX = 700;
  for (let i = 0; i < MAX; i++) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { end: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1;
      // an SVG target shows its focus on its shape: a stroke at least 2 px (the unit chart's cells)
      const stroke = el instanceof SVGElement && [...el.querySelectorAll("rect, path, circle")].some((n) => getComputedStyle(n).stroke !== "none" && parseFloat(getComputedStyle(n).strokeWidth) >= 2);
      const brackets = document.querySelector(".focus-brackets[data-visible='true']");
      const hud = [...document.querySelectorAll("#hud .hud-top, #hud .hud-bottom")].map((b) => b.getBoundingClientRect());
      const inHud = !!el.closest("#hud");
      // WCAG 2.4.11 (AA): never entirely hidden by the HUD — sampled on a 5 × 5 grid over its box, the
      // HUD's own keys excepted. Partly covered is reported (no part hidden is 2.4.12, AAA)
      let seen = 0;
      let samples = 0;
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
          const x = r.left + ((i + 0.5) / 5) * r.width;
          const y = r.top + ((j + 0.5) / 5) * r.height;
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          samples++;
          const hit = document.elementFromPoint(x, y);
          const band = hud.some((b) => b.height > 0 && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom);
          if (!band && (!hit || !hit.closest("#hud"))) seen++;
        }
      const under = !inHud && samples > 0 && seen === 0;
      const covered = !inHud && samples > 0 && seen < samples;
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("value") || el.id || "").trim().replace(/\s+/g, " ").slice(0, 40),
        visible: outline || stroke || !!brackets,
        onScreen: r.bottom > 0 && r.top < innerHeight && r.width > 0 && r.height > 0,
        obscured: under,
        partly: covered && !under,
        cls: (typeof el.className === "string" ? el.className : el.className?.baseVal ?? "").split(" ")[0],
        dialog: !!el.closest("dialog"),
        tabindex: el.getAttribute("tabindex"),
      };
    });
    if (s.end) break;
    stops.push(s);
    if (stops.length > 2 && s.label === stops[0].label && s.tag === stops[0].tag) break; // back at the start: no trap
  }
  report.measures.keyboard = { stops: stops.length, partlyUnderHud: stops.filter((s) => s.partly).map((s) => `${s.tag}.${s.cls}`), sample: stops.slice(0, 12) };
  const bad = stops.filter((s) => !s.visible || !s.onScreen || s.obscured);
  const positive = await page.evaluate(() => [...document.querySelectorAll("[tabindex]")].filter((e) => Number(e.getAttribute("tabindex")) > 0).length);
  check("keyboard", "the first stop is a skip link to the page's main", /skip/i.test(stops[0]?.label ?? "") && stops[0]?.visible && stops[0]?.onScreen, stops[0]);
  check("keyboard", `every one of the page's stops (${stops.length}) shows its focus and is on screen, never under the HUD (WCAG 2.4.7, 2.4.11)`, stops.length > 20 && bad.length === 0, { stops: stops.length, bad: bad.slice(0, 8) });
  check("keyboard", "a logical order (DOM order: no positive tabindex) and no trap outside the dialogs (Tab runs off the page's end)", positive === 0 && stops.length < MAX && !stops.some((s) => s.dialog), { positive, stops: stops.length });
  // the skip link itself: Enter → focus in main, past the HUD
  await page.goto(`${BASE}/?debug=1`, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const skip = await page.evaluate(() => ({ focus: document.activeElement?.id || document.activeElement?.tagName, inMain: !!document.activeElement?.closest("main") }));
  await page.keyboard.press("Tab");
  const next = await page.evaluate(() => ({ inMain: !!document.activeElement?.closest("main"), inHud: !!document.activeElement?.closest("#hud") }));
  check("keyboard", "the skip link puts focus on main; the next Tab is in the page, past the HUD", skip.focus === "main" && next.inMain && !next.inHud, { skip, next });
  // the dialogs keep focus, and let it go with Esc (WCAG 2.1.2: Esc is the standard exit, and both say so)
  await page.keyboard.press("~");
  await page.waitForTimeout(900);
  const trail = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Shift+Tab");
    trail.push(await page.evaluate(() => (document.activeElement?.closest("dialog") ? "dialog" : document.activeElement?.closest("#screen, #hud") ? "page" : "outside")));
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => !document.querySelector("dialog[open]"));
  check("keyboard", "the terminal keeps focus (Tab completes, Shift+Tab walks it) and Esc — said in its banner — lets go (WCAG 2.1.2)", trail.every((t) => t !== "page") && after, { trail, closed: after });
  // the dossier: a modal over home — Tab stays in it (or leaves for the browser's own UI, never the
  // page behind), Esc closes it and focus goes back to the link that opened it
  await toSection(page, "archive");
  await page.waitForTimeout(600);
  const opener = page.locator("#archive .ledger__link").first();
  await opener.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !!document.querySelector("dialog[open]"), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  const inDossier = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    inDossier.push(await page.evaluate(() => (document.activeElement?.closest("dialog[open]") ? "dialog" : document.activeElement?.closest("#screen, #hud") ? "page" : "outside")));
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  const back = await page.evaluate(() => ({ closed: !document.querySelector("dialog[open]"), focus: document.activeElement?.getAttribute("href") ?? document.activeElement?.tagName, path: location.pathname }));
  check("keyboard", "the dossier keeps focus (Tab walks it, never the page behind) and Esc closes it, focus back on its link (WCAG 2.1.2, 2.4.3)", inDossier.includes("dialog") && !inDossier.includes("page") && back.closed && back.path === "/" && /^\/research\//.test(back.focus ?? ""), { tabs: inDossier, ...back });
  check("keyboard", "…console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
});

// ── semantics: landmarks, headings, alt, live regions; axe ──────────────────────────────────
const axeSource = readFileSync(join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");
const axe = async (page) => {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(" ").slice(0, 80) }));
  });
};
if (run("semantics")) await part("semantics", async () => {
  const pages = [["/", {}], ["/work/cognivault-ai", {}], ["/research/food-waste-cold-chain-sci-2026", {}], ["/this-page-does-not-exist", {}]];
  const shape = [];
  for (const [path] of pages) {
    const { ctx, page } = await open(path);
    const s = await page.evaluate(() => {
      const role = (sel) => document.querySelectorAll(sel).length;
      const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => !h.closest("[hidden], [aria-hidden='true']")).map((h) => Number(h.tagName[1]));
      const skips = hs.filter((h, i) => i > 0 && h > hs[i - 1] + 1).length;
      const imgs = [...document.querySelectorAll("img")];
      return {
        main: role("main"),
        banner: [...document.querySelectorAll("header")].filter((h) => !h.closest("main, article, section, aside, nav")).length,
        contentinfo: [...document.querySelectorAll("footer")].filter((f) => !f.closest("main, article, section, aside, nav")).length,
        navs: [...document.querySelectorAll("nav")].map((n) => n.getAttribute("aria-label") || "(unnamed)"),
        h1: hs.filter((h) => h === 1).length,
        skips,
        noAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
        live: [...document.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]")].length,
      };
    });
    shape.push([path, s]);
    await ctx.close();
  }
  report.measures.semantics = shape;
  check("semantics", "landmarks: one main; a banner (the HUD); a footer on home; every nav named; one h1 and no skipped heading level; alt on every image", shape.every(([p, s]) => s.main === 1 && s.banner >= 1 && (p !== "/" || s.contentinfo === 1) && s.navs.every((n) => n !== "(unnamed)") && s.h1 === 1 && s.skips === 0 && s.noAlt === 0), shape);
  // axe, across the states a visitor meets
  const states = [
    ["home, every section in", "/", {}, async (p) => sweep(p, 350)],
    ["the terminal open", "/", {}, async (p) => {
      await p.keyboard.press("~");
      await p.waitForTimeout(1200);
    }],
    ["a dossier open", "/", {}, async (p) => {
      await toSection(p, "archive");
      await p.waitForTimeout(500);
      await p.locator("#archive .ledger__link").first().click();
      await p.waitForTimeout(1500);
    }],
    ["a case study", "/work/cognivault-ai", {}, null],
    ["a paper's page", "/research/food-waste-cold-chain-sci-2026", {}, null],
    ["NO SIGNAL (404)", "/this-page-does-not-exist", {}, null],
    ["a phone", "/", { viewport: { width: 390, height: 844 }, mobile: true }, async (p) => sweep(p, 300)],
    ["Paper", "/", { theme: "paper" }, async (p) => sweep(p, 300)],
    ["reduced motion", "/", { reduced: true }, async (p) => sweep(p, 300)],
    ["the credential wall", "/dev/credentials/full", {}, null],
  ];
  const found = [];
  for (const [label, path, opts, prep] of states) {
    const { ctx, page } = await open(path, opts);
    if (prep) await prep(page);
    const v = await axe(page);
    found.push([label, v]);
    await ctx.close();
  }
  report.measures.axe = found;
  const serious = found.flatMap(([l, v]) => v.filter((x) => x.impact === "critical" || x.impact === "serious").map((x) => `${l}: ${x.id} (${x.nodes}) ${x.target}`));
  const all = found.flatMap(([l, v]) => v.map((x) => `${l}: ${x.id} [${x.impact}] (${x.nodes})`));
  check("semantics", `axe (WCAG 2.2 A/AA) across ${states.length} states: no critical or serious violation`, serious.length === 0, serious.slice(0, 12));
  check("semantics", "…and none at all", all.length === 0, all.slice(0, 12));
  // the accessibility tree a screen reader reads, kept for the report
  {
    const { ctx, page } = await open("/");
    const tree = await page.locator("body").ariaSnapshot();
    writeFileSync(join(OUT, "a11y-tree.txt"), tree);
    report.measures.a11yTreeLines = tree.split("\n").length;
    await ctx.close();
  }
});

// ── no information by color alone (WCAG 1.4.1) ─────────────────────────────────────────────────
if (run("color")) await part("color", async () => {
  const { ctx, page, logs } = await open("/");
  await toSection(page, "archive");
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => {
    // the constellation's venue types: a shape each, and its name
    const legend = [...document.querySelectorAll("#archive .shape-legend__item")].map((li) => ({ d: li.querySelector("svg path")?.getAttribute("d") ?? "", label: li.textContent.trim(), dashed: !!li.querySelector(".shape-glyph__dash"), faint: !!li.querySelector(".shape-glyph--faint"), key: li.classList.contains("shape-legend__item--key") }));
    // the venue types; the keys (dashed = not yet, faint = cited, tuned = the dial's — Part 16) aren't types
    const kinds = legend.filter((l) => !l.dashed && !l.faint && !l.key);
    // a status is a glyph and words: availability, the ledger's statuses, the panel's LEDs (lit or hollow)
    const avail = [...document.querySelectorAll(".availability__status")].map((p) => ({ dot: !!p.querySelector(".availability__dot"), text: p.textContent.trim() }));
    const statuses = [...document.querySelectorAll(".ledger__status")].map((x) => x.textContent.trim());
    const leds = [...document.querySelectorAll(".front-panel .fp-led")].map((l) => {
      const cs = getComputedStyle(l);
      const on = !!l.closest(".fp-pos:has(input:checked), .fp-switch[aria-pressed='true']");
      const filled = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      return { on, filled };
    });
    return { kinds, legend: legend.length, avail, statuses, leds };
  });
  const shapes = new Set(s.kinds.map((k) => k.d));
  check("color", `the constellation's venue types are shapes and words, not hues alone: ${s.kinds.length} types, ${shapes.size} distinct shapes, every one named (and cited / in-prep by a dashed or faint stroke)`, s.kinds.length >= 7 && shapes.size === s.kinds.length && s.kinds.every((k) => k.label.length > 1) && s.legend > s.kinds.length, s.kinds.map((k) => k.label));
  check("color", "a status is a glyph and words: availability, the ledger's statuses; the panel's LEDs are lit when on and hollow when off", s.avail.length > 0 && s.avail.every((a) => a.dot && a.text.length > 3) && s.statuses.every((t) => t.length > 1) && s.leds.length >= 4 && s.leds.every((l) => l.on === l.filled), { avail: s.avail, statuses: s.statuses, leds: s.leds });
  const stamps = await (async () => {
    const c = await open("/dev/credentials/full");
    const t = await c.page.evaluate(() => [...document.querySelectorAll(".cred-stamp")].map((x) => x.textContent.trim()));
    await c.ctx.close();
    return t;
  })();
  check("color", `every credential's stamp is a word (VERIFIED / ON FILE / EXPIRED), never a color: ${stamps.length} stamps`, stamps.length > 0 && stamps.every((t) => t.length > 2) && logs.length === 0, [...new Set(stamps)]);
  await ctx.close();
});

// ── contrast under the FX, on the real build ────────────────────────────────────────────────
if (run("contrast")) await part("contrast", async () => {
  const rows = [];
  for (const theme of ["phosphor", "amber", "paper"]) {
    const { ctx, page } = await open("/", { theme });
    await page.waitForTimeout(800);
    for (const [t, text, surface, base, avg, worst] of FX_TABLE.filter((r) => r[0] === theme)) {
      // a patch of the surface and a block of the text's own color, under the glass (#fx-css, z50)
      await page.evaluate(({ text, surface }) => {
        document.getElementById("fx-probe")?.remove();
        const el = document.createElement("div");
        el.id = "fx-probe";
        el.style.cssText = `position:fixed;left:40px;top:200px;width:480px;height:160px;z-index:45;display:grid;grid-template-columns:1fr 1fr;background:var(${surface})`;
        el.innerHTML = `<div style="background:var(${surface})"></div><div style="background:var(${text})"></div>`;
        document.body.append(el);
      }, { text, surface });
      await page.waitForTimeout(150);
      let lo = Infinity;
      let sumBg = 0;
      let sumFg = 0;
      let nBg = 0;
      let nFg = 0;
      let worstPair = Infinity;
      for (let k = 0; k < 6; k++) {
        const shot = await page.screenshot({ clip: { x: 40, y: 200, width: 480, height: 160 } });
        const px = await page.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = new OffscreenCanvas(img.width, img.height);
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, img.width, img.height).data;
          const half = img.width / 2;
          const bg = [];
          const fg = [];
          for (let y = 4; y < img.height - 4; y++)
            for (let x = 4; x < img.width - 4; x++) {
              if (Math.abs(x - half) < 6) continue;
              const i = (y * img.width + x) * 4;
              (x < half ? bg : fg).push([d[i], d[i + 1], d[i + 2]]);
            }
          return { bg, fg };
        }, shot.toString("base64"));
        const lb = px.bg.map(lum);
        const lf = px.fg.map(lum);
        sumBg += lb.reduce((a, b) => a + b, 0);
        nBg += lb.length;
        sumFg += lf.reduce((a, b) => a + b, 0);
        nFg += lf.length;
        const dark = lf.reduce((a, b) => a + b, 0) / lf.length > lb.reduce((a, b) => a + b, 0) / lb.length;
        // the worst single pixel: the text's dimmest (or, on paper, lightest) pixel against the surface's mean
        const meanBg = lb.reduce((a, b) => a + b, 0) / lb.length;
        const edge = dark ? Math.min(...lf) : Math.max(...lf);
        worstPair = Math.min(worstPair, ratio(edge, meanBg));
        lo = Math.min(lo, worstPair);
        await page.waitForTimeout(110);
      }
      const measured = { theme: t, text, surface, base, avg: +ratio(sumFg / nFg, sumBg / nBg).toFixed(2), worst: +lo.toFixed(2), table: { avg, worst } };
      rows.push(measured);
    }
    await ctx.close();
  }
  report.measures.contrastUnderFx = rows;
  // the table's text rule: --hot as text only where ≥ 4.5 holds on average; the worst pixel is reported, not gated, as in §5.3
  check("contrast", "DESIGN.md §5.3's under-FX contrast, measured on the real build: every pair's average holds ≥ 4.5 and sits within 0.3 of the table", rows.length === FX_TABLE.length && rows.every((r) => r.avg >= 4.5 && Math.abs(r.avg - r.table.avg) <= 0.3), rows.map((r) => `${r.theme} ${r.text}/${r.surface}: avg ${r.avg} (table ${r.table.avg}) · worst ${r.worst} (table ${r.table.worst})`));
});

// ── the foil never under text, at every tilt ────────────────────────────────────────────────
if (run("foil")) await part("foil", async () => {
  const { ctx, page, logs } = await open("/dev/credentials/full");
  await page.evaluate(() => document.querySelector(".cred-wall, .cred")?.scrollIntoView());
  await page.waitForTimeout(1500);
  const cards = await page.locator(".cred-card").count();
  const overlaps = [];
  let poses = 0;
  for (let c = 0; c < Math.min(cards, 4); c++) {
    const card = page.locator(".cred-card").nth(c);
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) continue;
    for (const fx of [0.05, 0.5, 0.95])
      for (const fy of [0.05, 0.5, 0.95]) {
        await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 3 });
        await page.waitForTimeout(260);
        poses++;
        const hit = await card.evaluate((el) => {
          const front = el.querySelector(".cred-front") ?? el;
          const r = (n) => n.getBoundingClientRect();
          const foil = [...front.querySelectorAll(".foil")].map(r).filter((b) => b.width && b.height);
          const text = [...front.querySelectorAll(".cred-title, .cred-issuer, .cred-level, .cred-serial, .cred-stamp")].map(r).filter((b) => b.width && b.height);
          const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          return foil.flatMap((f) => text.map((t) => inter(f, t))).filter((a) => a > 1).length;
        });
        if (hit) overlaps.push([c, fx, fy, hit]);
      }
  }
  check("foil", `the foil never sits under text, at every tilt the lamp gives (${poses} poses over ${Math.min(cards, 4)} cards)`, poses > 0 && overlaps.length === 0 && logs.length === 0, { poses, overlaps: overlaps.slice(0, 6), logs: logs.slice(0, 2) });
  await ctx.close();
});

// ── every paper and certificate, by keyboard alone ──────────────────────────────────────────
if (run("reach")) await part("reach", async () => {
  const papers = (await (await fetch(`${BASE}/search-index.json`)).json()).docs.filter((d) => d.kind === "paper");
  const { ctx, page, logs } = await open("/");
  const reached = [];
  for (const p of papers) {
    // focus the paper's link in ARCHIVE's ledger by Tab alone, then Enter
    await toSection(page, "archive");
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector("#archive")?.focus?.());
    let found = false;
    await page.locator("#archive").evaluate((el) => {
      el.setAttribute("tabindex", "-1");
      el.focus();
    });
    for (let i = 0; i < 120 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate((href) => document.activeElement?.getAttribute?.("href") === href, `/research/${p.slug}`);
    }
    if (!found) {
      reached.push([p.slug, false]);
      continue;
    }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1600);
    const read = await page.evaluate(() => {
      const d = document.querySelector("dialog:modal") ?? document.querySelector("main");
      return d?.innerText?.slice(0, 2000) ?? "";
    });
    reached.push([p.slug, read.includes(p.title)]);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
  }
  check("reach", "every paper by keyboard alone: Tab to it in ARCHIVE's ledger, Enter opens its record, readable (no 3D touched)", reached.length === papers.length && reached.every(([, ok]) => ok) && logs.length === 0, { reached, logs: logs.slice(0, 2) });
  await ctx.close();
  // certificates: each card's turn key is a stop; Enter turns it; its back reads in the accessibility tree
  {
    const { ctx, page, logs } = await open("/dev/credentials/full");
    const n = await page.locator("li.cred").count();
    const read = [];
    for (let i = 0; i < n; i++) {
      const card = page.locator("li.cred").nth(i);
      const key = card.locator(".cred-flip");
      await key.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
      const turned = await card.evaluate((el) => el.hasAttribute("data-flipped"));
      const id = (await card.locator(".cred-facts__id").first().textContent())?.trim() ?? "";
      const tree = await card.ariaSnapshot();
      const verify = await card.locator(".cred-verify").evaluateAll((as) => as.every((a) => a.tabIndex === 0));
      read.push([i, turned && !!id && tree.includes(id) && verify]);
      await page.keyboard.press("Enter"); // and back
      await page.waitForTimeout(500);
    }
    check("reach", `every certificate by keyboard (${n} on the wall): its turn key, Enter to read its back — the credential ID in the accessibility tree, its verify link a stop`, n > 0 && read.every(([, ok]) => ok) && logs.length === 0, { cards: n, read: read.filter(([, ok]) => !ok), logs: logs.slice(0, 2) });
    await ctx.close();
  }
});

// ── resilience ──────────────────────────────────────────────────────────────────────────────
if (run("resilience")) await part("resilience", async () => {
  // no WebGL at all: the posters and the 2D editions are the site
  {
    const noGl = await chromium.launch({ channel: "chrome", args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
    const { ctx, page, logs } = await open("/", { launch: noGl });
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.querySelector("main")?.innerText.length ?? 0);
    const shown = new Set();
    for (const id of SCENES) {
      await toSection(page, id);
      await page.waitForTimeout(500);
      const ok = await page.evaluate((id) => {
        // WORK's and CAPABILITIES' bands show their stage-less edition (the CSS carousel, the key grid)
        const band = document.querySelector(`[data-stage-slot="${id}"]`)?.closest("[data-stage]");
        if (band?.getAttribute("data-stage") === "off") return band.getBoundingClientRect().height > 0 && band.innerText.trim().length > 20;
        const p = document.querySelector(`[data-stage-slot="${id}"] > .stage-poster`);
        if (!p || p.hasAttribute("data-live") || getComputedStyle(p).visibility === "hidden") return false;
        const r = p.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(p, "::before").maskImage.includes("url(");
      }, id);
      if (ok) shown.add(id);
    }
    const s = await page.evaluate(() => ({ tier: window.__retrograde?.governor?.snapshot?.tier, slots: document.querySelectorAll("[data-stage-slot]").length, cls: window.__cls }));
    Object.assign(s, { posters: shown.size, text });
    const errs = logs.filter((l) => !/WebGL|GPU|context/i.test(l));
    check("resilience", "WebGL unavailable: tier OFF, every stage shows its poster or its stage-less edition, the whole site readable, CLS 0, no error beyond WebGL's own", s.tier === "OFF" && s.posters === s.slots && s.slots >= 5 && s.text > 2000 && s.cls < 0.02 && errs.length === 0, { ...s, errs: errs.slice(0, 3) });
    await ctx.close();
    await noGl.close();
  }
  // media that fail: the boxes hold, the alt text is there
  {
    const { ctx, page, logs } = await open("/", { debug: true });
    await page.route(/\.(avif|webp|jpg|jpeg|png)(\?|$)/, (r) => (/posters|textures|icon/.test(r.request().url()) ? r.continue() : r.abort("failed")));
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(1200);
    await sweep(page, 400);
    const s = await page.evaluate(() => {
      const g = window.__retrograde.governor.snapshot;
      const failed = Object.entries(g.scenes).filter(([, v]) => v.error).map(([k]) => k);
      return { cls: window.__cls, broken: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0 && !i.alt).length, failed, postersKept: failed.every((id) => !document.querySelector(`[data-stage-slot="${id}"] > .stage-poster`)?.hasAttribute("data-live")) };
    });
    // the stage reports a scene whose media failed (console.error, by design) and keeps its poster
    const errs = logs.filter((l) => !/Failed to load resource|ERR_FAILED|net::/i.test(l) && !/\[stage\] (loading|scene) "?\w+"? failed/.test(l));
    check("resilience", "failed media: every image box holds its space (CLS < 0.02) and says its alt text; a scene whose media failed keeps its poster; nothing else breaks", s.cls < 0.02 && s.broken === 0 && s.postersKept && errs.length === 0, { ...s, errs: errs.slice(0, 3) });
    await ctx.close();
  }
  // a slow network (≈ 3G: 400 ms RTT, 400 kbps): the server's page reads before the JS arrives, the
  // posters hold while the runtime downloads, nothing errors
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => sessionStorage.setItem("retrograde:booted", "1"));
    await ctx.addInitScript(CLS_INIT);
    const page = await ctx.newPage();
    const logs = [];
    page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(m.text().slice(0, 160)));
    page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 160)));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 });
    const t0 = Date.now();
    await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 60_000 });
    await page.waitForSelector("h1", { timeout: 30_000 });
    const readable = Date.now() - t0;
    const early = await page.evaluate(() => ({ h1: document.querySelector("h1")?.textContent?.trim().length ?? 0, poster: !!document.querySelector("[data-stage-slot='system'] > .stage-poster:not([data-live])") }));
    await page.waitForLoadState("load", { timeout: 90_000 });
    await page.waitForTimeout(3000);
    const late = await page.evaluate(() => ({ cls: window.__cls, hydrated: document.documentElement.dataset.hydrated !== undefined }));
    check("resilience", `a slow network (400 ms, 400 kbps): the hero's words are on screen at ${(readable / 1000).toFixed(1)} s, its poster in the slot, before the JS; then it hydrates, CLS ${late.cls.toFixed(3)}, nothing errors`, early.h1 > 3 && early.poster && late.hydrated && late.cls < 0.02 && logs.length === 0, { readableMs: readable, ...early, ...late, logs: logs.slice(0, 3) });
    await ctx.close();
  }
  // no JavaScript: the server's HTML is the site
  {
    const on = await open("/");
    const withJs = await on.page.evaluate(() => [...document.querySelectorAll("h1,h2,h3")].length);
    await on.ctx.close();
    const { ctx, page } = await open("/", { js: false });
    const s = await page.evaluate(() => ({ headings: [...document.querySelectorAll("h1,h2,h3")].length, links: document.querySelectorAll("a[href]").length, hero: !!document.querySelector("h1")?.textContent?.trim(), text: document.body.innerText.length }));
    check("resilience", "JavaScript off: the same headings and the links are there, the hero readable — the SSR content is the site", s.headings === withJs && s.hero && s.links > 30 && s.text > 3000, { ...s, withJs });
    await ctx.close();
  }
  // NO SIGNAL: 404, and 500 (a server error) / an error with no status (a client one)
  {
    const { ctx, page, logs, status } = await open("/this-page-does-not-exist");
    await page.waitForTimeout(600);
    const s = await page.evaluate(() => ({ h1: document.querySelector("h1")?.textContent, link: document.querySelector('main a[href="/"]')?.textContent, drift: document.getAnimations().filter((a) => /no-signal/.test(a.animationName ?? "")).length, main: document.querySelector("main")?.id }));
    await page.keyboard.press("~");
    await page.waitForTimeout(900);
    const terminal = await page.evaluate(() => !!document.querySelector("dialog[data-shell][open]"));
    const errs = logs.filter((l) => !/status of 404/.test(l)); // the browser's own line for the document's 404
    check("resilience", "404: NO SIGNAL — a real 404 status, the drifting box, `goto system` home, and ~ opens the terminal there", status === 404 && /no signal/i.test(s.h1 ?? "") && s.link && s.drift >= 2 && s.main === "main" && terminal && errs.length === 0, { status, ...s, terminal, logs: errs.slice(0, 2) });
    await ctx.close();
    const rm = await open("/this-page-does-not-exist", { reduced: true });
    const still = await rm.page.evaluate(() => document.getAnimations().filter((a) => /no-signal/.test(a.animationName ?? "")).length);
    await rm.ctx.close();
    // the error screen replaces the layout (no head script, no data-motion): it reads the preference itself
    const re = await open("/dev/throw?at=server", { reduced: true, debug: false });
    const stillError = await re.page.evaluate(() => ({ drift: document.getAnimations().filter((a) => /no-signal/.test(a.animationName ?? "")).length, h1: document.querySelector("h1")?.textContent }));
    await re.ctx.close();
    check("resilience", "…and under reduced motion the box stands still, on the 404 and on the error screen", still === 0 && stillError.drift === 0 && /no signal/i.test(stillError.h1 ?? ""), { still, stillError });
    for (const at of ["server", "client"]) {
      const e = await open(`/dev/throw?at=${at}`, { debug: false });
      await e.page.waitForTimeout(800);
      const t = await e.page.evaluate(() => ({ h1: document.querySelector("h1")?.textContent, text: document.querySelector("main")?.innerText ?? "", retry: !!document.querySelector("main button") }));
      check("resilience", `an error (${at}): NO SIGNAL with a retry${at === "server" ? ", the 500 said" : ", no status claimed"}`, /no signal/i.test(t.h1 ?? "") && t.retry && (at === "server" ? /500/.test(t.text) : !/500/.test(t.text)), { status: e.status, ...t, text: t.text.slice(0, 120) });
      await e.ctx.close();
    }
  }
});

// ── vitals beyond Lighthouse's: INP, CLS over a whole visit, the JS heap (§8.3) ─────────────────
if (run("vitals")) await part("vitals", async () => {
  const at4 = await inp(browser, BASE, 4);
  report.measures.inp4x = at4;
  check("vitals", `INP ≤ 150 ms at 4× CPU, over the site's interactions (${at4.interactions}): ${at4.inpMs} ms`, at4.interactions >= 8 && at4.inpMs <= 150, at4);
  // CLS across a whole visit: every section, in a phone and a desktop window (Lighthouse sees only the load)
  for (const [label, opts] of [["desktop", {}], ["phone", { viewport: { width: 390, height: 844 }, mobile: true }]]) {
    const { ctx, page, logs } = await open("/", opts);
    await sweep(page, 700);
    const cls = await page.evaluate(() => window.__cls);
    check("vitals", `CLS ≤ 0.02 over a whole visit, every section (${label}): ${cls.toFixed(4)}`, cls <= 0.02 && logs.length === 0, { cls, logs: logs.slice(0, 2) });
    await ctx.close();
  }
  // the JS heap after every scene has been LIVE at HIGH
  {
    const { ctx, page } = await open("/", { tier: "HIGH", dpr: 2 });
    await sweep(page, 1500);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const heap = await cdp.send("Runtime.getHeapUsage");
    const mb = +(heap.usedSize / 1e6).toFixed(1);
    check("vitals", `the JS heap ≤ 90 MB after every scene has been LIVE at HIGH: ${mb} MB`, mb <= 90, { usedMB: mb, totalMB: +(heap.totalSize / 1e6).toFixed(1) });
    await ctx.close();
  }
});

// ── layout: widths, 100vh, touch targets, hover, tap to flip ────────────────────────────────
if (run("layout")) await part("layout", async () => {
  const over = [];
  for (const w of WIDTHS)
    for (const path of ["/", "/work/cognivault-ai", "/research/food-waste-cold-chain-sci-2026", "/this-page-does-not-exist"]) {
      const { ctx, page } = await open(path, { viewport: { width: w, height: Math.round(w * 0.62) || 600 }, mobile: w < 768, debug: false });
      await page.waitForTimeout(400);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (o > 0) over.push([w, path, o]);
      await ctx.close();
    }
  check("layout", `320–2560 px (${WIDTHS.join(", ")}): no horizontal overflow on home, a case study, a paper, NO SIGNAL`, over.length === 0, over);
  const sheets = ["styles", "components", "app"].flatMap((d) => readdirSync(join(ROOT, d), { recursive: true }).map(String).filter((f) => f.endsWith(".css")).map((f) => join(d, f)));
  const css = sheets.flatMap((f) => readFileSync(join(ROOT, f), "utf8").split("\n").map((l, i) => [f, i + 1, l]));
  const vh = css.filter(([, , l]) => /\b\d+(\.\d+)?d?vh\b/.test(l.replace(/\/\*.*?\*\//g, "")) && !/^\s*(\/[*/]|\*)/.test(l));
  check("layout", `no vh or dvh in any stylesheet (${sheets.length}): the svh / lvh units §2.7 specifies`, vh.length === 0, vh.map(([f, n, l]) => `${f}:${n} ${l.trim()}`).slice(0, 6));
  // hover-only: a rule that reveals on :hover must reveal on keyboard focus too
  const rules = [];
  for (const f of sheets) {
    const text = readFileSync(join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim();
      if (!/:hover/.test(sel)) continue;
      const reveals = /(?:^|;)\s*(opacity\s*:\s*[1-9]|visibility\s*:\s*visible|display\s*:\s*(?!none)|clip-path\s*:\s*(?:none|inset\(0)|max-height)/.test(m[2]);
      if (!reveals) continue;
      if (/:focus-visible|:focus-within|:focus\b/.test(sel)) continue;
      rules.push(`${f}: ${sel.replace(/\s+/g, " ").slice(0, 100)}`);
    }
  }
  check("layout", "no hover-only affordance: whatever :hover reveals, keyboard focus reveals too", rules.length === 0, rules.slice(0, 8));
  // touch targets on coarse pointers: each one where a visitor taps it — scrolled to the middle of
  // the screen (the HUD's own keys where they are) — and its whole 44 px box must land on it; a tap
  // on a control's own <label> is the control's (the panel's keys, CONNECT's prompts)
  for (const [w, h] of [[390, 844], [320, 568]]) {
    const { ctx, page } = await open("/", { viewport: { width: w, height: h }, mobile: true });
    await page.waitForTimeout(800);
    const n = await page.evaluate(() => {
      const sel = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [tabindex='0']";
      const all = [...document.querySelectorAll(sel)].filter((el) => !el.closest("[aria-hidden='true'], [hidden], .sr-only, .teletype__trap, .skip-link, dialog:not([open])"));
      all.forEach((el, i) => el.setAttribute("data-target-i", String(i)));
      return all.length;
    });
    const results = [];
    for (let i = 0; i < n; i++) {
      const r = await page.evaluate(([i, T]) => {
        const el = document.querySelector(`[data-target-i="${i}"]`);
        const cs = getComputedStyle(el);
        let box = el.getBoundingClientRect();
        if (!box.width || !box.height || cs.visibility === "hidden" || cs.display === "none") return null;
        // inline links inside a sentence are exempt (WCAG 2.5.5's inline exception)
        if (el.tagName === "A" && cs.display === "inline" && el.closest("p, li")?.textContent.trim().length > el.textContent.trim().length + 20) return null;
        const fixed = !!el.closest("#hud");
        if (!fixed) {
          const y = box.top + scrollY - innerHeight / 2 + box.height / 2;
          const l = window.__retrograde?.lenis?.();
          if (l) l.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
          box = el.getBoundingClientRect();
        }
        const own = (hit) => !!hit && (el === hit || el.contains(hit) || [...(el.labels ?? [])].some((lb) => lb === hit || lb.contains(hit)));
        const at = (x, y) => own(document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), Math.max(0, Math.min(innerHeight - 1, y))));
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const name = `${el.tagName.toLowerCase()}.${(typeof el.className === "string" ? el.className : "").split(" ")[0]} "${(el.getAttribute("aria-label") || el.textContent || el.labels?.[0]?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 22)}" ${Math.round(box.width)}×${Math.round(box.height)}`;
        const href = el.getAttribute("href");
        if (!at(cx, cy)) return { name, href, covered: true };
        const d = T / 2 - 1;
        return { name, href, ok: at(cx - d, cy) && at(cx + d, cy) && at(cx, cy - d) && at(cx, cy + d) && at(cx - d, cy - d) && at(cx + d, cy + d) };
      }, [i, TARGET]);
      if (r) results.push(r);
    }
    // WCAG 2.5.5's exception: the same destination is a ≥ 44 px link elsewhere on the page
    const passing = new Set(results.filter((r) => r.ok && r.href).map((r) => r.href));
    const covered = results.filter((r) => r.covered).map((r) => r.name);
    const equivalent = results.filter((r) => !r.ok && !r.covered && r.href && passing.has(r.href)).map((r) => r.name);
    const small = results.filter((r) => !r.ok && !r.covered && !(r.href && passing.has(r.href))).map((r) => r.name);
    report.measures[`targets${w}`] = { checked: n, small, equivalent, covered };
    if (equivalent.length) console.log(`      under ${TARGET} px with an equivalent ≥ ${TARGET} px link on the page (2.5.5's exception, ${equivalent.length}): ${equivalent.slice(0, 6).join(" · ")}`);
    check("layout", `touch targets ≥ ${TARGET} px at ${w} × ${h} (a coarse pointer), each where it's tapped: ${small.length} of ${n} under`, small.length === 0, small.slice(0, 14));
    if (covered.length) console.log(`      covered at their centre even in the middle of the screen (${covered.length}): ${covered.slice(0, 8).join(" · ")}`);
    await ctx.close();
  }
  // cert cards tap to flip
  {
    const { ctx, page, logs } = await open("/dev/credentials/full", { viewport: { width: 390, height: 844 }, mobile: true });
    await page.waitForTimeout(800);
    const card = page.locator("li.cred").first();
    await card.evaluate((el) => {
      const y = el.getBoundingClientRect().top + scrollY - innerHeight / 2 + el.getBoundingClientRect().height / 2;
      window.__retrograde.lenis().scrollTo(y, { immediate: true, force: true });
    });
    await page.waitForTimeout(400);
    // the wall reveals its cards as they arrive: measure once nothing on it is moving
    await page.waitForFunction(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming?.().iterations !== Infinity).length === 0, null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    const box = await card.locator(".cred-card").boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    const once = await card.evaluate((el) => [el.hasAttribute("data-flipped"), el.querySelector(".cred-flip")?.getAttribute("aria-pressed")]);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    const twice = await card.evaluate((el) => [el.hasAttribute("data-flipped"), el.querySelector(".cred-flip")?.getAttribute("aria-pressed")]);
    check("layout", "a credential card turns over at a tap on its face, and back at the next (a phone)", once[0] && once[1] === "true" && !twice[0] && twice[1] === "false" && logs.length === 0, { once, twice, logs: logs.slice(0, 2) });
    await ctx.close();
  }
});

// ── the cursor: one of the two always on screen (DESIGN.md §7.3, Part 16) ─────────────────────────
// native: the computed cursor of what's under the pointer (a modal's ::backdrop over its backdrop)
// isn't `none`. reticle: its hotspot is visible and painted on top — a crop with it against the same
// crop with #cursor hidden flips the hotspot's own device pixels. A View Transition's snapshots are
// paused for the pair; where the beam (#fx-gl, drawn every tick) still moves, it's hidden for the pair.
if (run("cursor")) await part("cursor", async () => {
  const DPR = 2;
  // two frames in the page (a gate's own wait, outside the site's ticker)
  const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // eslint-disable-line no-restricted-globals
  const state = (page, pt) => page.evaluate(([x, y]) => {
    const html = document.documentElement;
    const dot = document.querySelector(".cursor__dot");
    const cs = dot && getComputedStyle(dot);
    const d = dot?.getBoundingClientRect();
    const under = document.elementFromPoint(x, y);
    const modal = document.querySelector("dialog:modal");
    let native = getComputedStyle(under ?? html).cursor;
    if (modal && under === modal) {
      const r = modal.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) native = getComputedStyle(modal, "::backdrop").cursor;
    }
    return { flag: html.dataset.reticle ?? null, drawn: cs?.visibility === "visible" && cs?.display !== "none", dot: d && { x: d.left, y: d.top, w: d.width, h: d.height }, native, modal: !!modal, under: under ? `${under.tagName.toLowerCase()}${under.classList[0] ? "." + under.classList[0] : ""}` : null };
  }, [pt.x, pt.y]);
  const pair = async (page, pt, dot, hideBeam) => {
    const clip = { x: Math.max(0, pt.x - 14), y: Math.max(0, pt.y - 14), width: 28, height: 28 };
    await page.evaluate((hideBeam) => {
      window.__vtPaused = document.getAnimations().filter((x) => x.playState === "running" && /^::view-transition/.test(x.effect?.pseudoElement ?? ""));
      window.__vtPaused.forEach((x) => x.pause());
      if (hideBeam) document.head.insertAdjacentHTML("beforeend", "<style id='__nobeam'>#fx-gl{visibility:hidden!important}</style>");
    }, hideBeam);
    await frames(page);
    const a = await page.screenshot({ clip });
    await page.evaluate(() => document.head.insertAdjacentHTML("beforeend", "<style id='__nocur'>#cursor{visibility:hidden!important}</style>"));
    await frames(page);
    const b = await page.screenshot({ clip });
    await page.evaluate(() => {
      document.getElementById("__nocur")?.remove();
      document.getElementById("__nobeam")?.remove();
      (window.__vtPaused ?? []).forEach((x) => x.play());
    });
    const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const B = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let coreN = 0, coreC = 0, restN = 0, restC = 0, contrast = 1;
    for (let j = 0; j < A.info.height; j++) for (let i = 0; i < A.info.width; i++) {
      const x = clip.x + (i + 0.5) / DPR, y = clip.y + (j + 0.5) / DPR, k = (j * A.info.width + i) * 4;
      const changed = Math.max(...[0, 1, 2].map((c) => Math.abs(A.data[k + c] - B.data[k + c]))) > 40;
      const core = x >= dot.x && x <= dot.x + dot.w && y >= dot.y && y <= dot.y + dot.h;
      const near = x >= dot.x - 6 && x <= dot.x + dot.w + 6 && y >= dot.y - 6 && y <= dot.y + dot.h + 6;
      if (core) {
        coreN++;
        if (changed) {
          coreC++;
          contrast = Math.max(contrast, ratio(lum([A.data[k], A.data[k + 1], A.data[k + 2]]), lum([B.data[k], B.data[k + 1], B.data[k + 2]])));
        }
      } else if (!near) {
        restN++;
        if (changed) restC++;
      }
    }
    const noise = restN ? restC / restN : 0;
    // 10 of the hotspot's 16 device pixels: a mid-tone under part of it (the SCAN's edge) is the one
    // place `difference` gives little; by chance, under ≤ 10% noise, odds below 1e-6
    return { painted: coreN >= 8 && coreC / coreN >= Math.max(0.6, noise + 0.5) && noise <= 0.6, core: `${coreC}/${coreN}`, noise: +noise.toFixed(3), contrast: +contrast.toFixed(1), ...(hideBeam ? { beamHidden: true } : {}) };
  };
  const sample = async (page, label, pt) => {
    await frames(page);
    const s = await state(page, pt);
    let px = null;
    if (s.drawn && s.dot) {
      px = await pair(page, pt, s.dot, false);
      if (!px.painted && px.noise > 0.1) px = await pair(page, pt, s.dot, true);
    }
    const native = s.native !== "none";
    const reticle = !!px?.painted && !s.modal;
    return { label, by: reticle ? "reticle" : native ? `native:${s.native}` : "NONE", visible: reticle || native, reticle, native, flag: s.flag, under: s.under, ...(px ? { px } : {}) };
  };
  const mid = (page, sel) => page.locator(sel).first().boundingBox().then((b) => ({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }));
  const go = async (page, pt, ms = 450) => {
    await page.mouse.move(pt.x, pt.y, { steps: 6 });
    await page.waitForTimeout(ms);
  };
  const click = async (page) => {
    await page.mouse.down();
    await page.mouse.up();
  };
  const dossier = async (page) => {
    const link = page.locator(".ledger__link").first();
    await link.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const b = await link.boundingBox();
    const pt = { x: Math.round(b.x + 24), y: Math.round(b.y + b.height / 2) };
    await go(page, pt, 250);
    await click(page);
    await page.waitForSelector("dialog.dossier-dialog[open]", { timeout: 5000 });
    await page.waitForTimeout(1100);
    return pt;
  };

  {
    const { ctx, page, logs } = await open("/", { debug: false, dpr: DPR });
    await page.waitForTimeout(1300);
    const before = await sample(page, "before any move", { x: 720, y: 450 });
    check("cursor", "until the pointer first moves, the native cursor shows (no reticle drawn)", before.native && before.flag === null, before);

    const moved = [];
    await go(page, { x: 700, y: 430 });
    moved.push(await sample(page, "home", { x: 700, y: 430 }));
    const link = await mid(page, '.hud-nav__link[data-section="work"]');
    await go(page, link);
    moved.push(await sample(page, "over a link (brackets)", link));
    // the ring growing to a control and back is never a layout shift (it was, its corners anchored right
    // and bottom, once the reticle showed): sweep the nav, the rail and back, no click
    await page.evaluate(() => {
      window.__cursorShifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) for (const src of e.sources ?? []) if (src.node?.parentElement?.closest?.("#cursor") || src.node?.closest?.("#cursor")) window.__cursorShifts.push(e.value);
      }).observe({ type: "layout-shift" });
    });
    for (const sel of ['.hud-nav__link[data-section="archive"]', '.hud-nav__link[data-section="connect"]', ".hud-nav__key", ".section-rail__link"]) {
      const at = await mid(page, sel).catch(() => null);
      if (!at) continue;
      await go(page, at, 350);
      await go(page, { x: at.x - 160, y: at.y + 220 }, 350);
    }
    const cursorShifts = await page.evaluate(() => window.__cursorShifts);
    check("cursor", "the ring snapping to a control and back is never a layout shift (its corners move by transform)", cursorShifts.length === 0, { shifts: cursorShifts.length, sum: cursorShifts.reduce((x, y) => x + y, 0) });

    // the owner's report: a record's details, then CLOSE — and Esc, Back, the backdrop
    const ways = [];
    let pt = await dossier(page);
    ways.push(await sample(page, "dossier open, pointer still", pt));
    const close = await mid(page, ".dossier-dialog__close");
    await go(page, close, 300);
    ways.push(await sample(page, "over CLOSE", close));
    await click(page);
    await page.waitForTimeout(120);
    ways.push(await sample(page, "CLOSE, pointer still, 120 ms", close));
    await page.waitForTimeout(900);
    ways.push(await sample(page, "CLOSE, pointer still, 1 s", close));
    pt = await dossier(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
    ways.push(await sample(page, "Esc, pointer still", pt));
    pt = await dossier(page);
    await page.goBack();
    await page.waitForTimeout(1000);
    ways.push(await sample(page, "Back, pointer still", pt));
    const inDialog = ways.slice(0, 2).every((w) => w.native && !w.reticle);
    const afterClose = ways.slice(2).every((w) => w.visible) && ways.slice(3).every((w) => w.reticle);
    check("cursor", "a record's dossier: the native cursor inside it; closed by CLOSE, Esc or Back under a still pointer, the reticle is back where the pointer is (the owner's report: no cursor after CLOSE)", inDialog && afterClose, ways);

    const term = [];
    const key = await mid(page, ".hud-nav__key");
    await go(page, key, 300);
    await click(page);
    await page.waitForTimeout(900);
    term.push(await sample(page, "terminal open, pointer still", key));
    const inside = { x: 720, y: 520 };
    await go(page, inside, 300);
    term.push(await sample(page, "over the terminal", inside));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1100);
    term.push(await sample(page, "terminal closed by Esc, pointer still", inside));
    check("cursor", "the terminal: a cursor at every step — opened by its key, closed by Esc under a still pointer", term.every((t) => t.visible) && term[1].native && term[2].reticle, term);

    await page.evaluate(() => document.querySelector("#connect .teletype__input")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(1200);
    const field = await mid(page, "#connect .teletype__input");
    await go(page, field, 300);
    const onField = await sample(page, "over a text field", field);
    check("cursor", "a text field: the native I-beam, the reticle aside", onField.native && /text/.test(onField.by) && !onField.reticle, onField);

    // over every layer the page draws: a View Transition mid-flight (the theme's POWER CYCLE, Paper's
    // SCAN), HALT's dark tube, the power-on after it
    const over = [];
    for (const theme of ["amber", "paper"]) {
      await toSection(page, "identity");
      await page.waitForTimeout(600);
      const sw = await mid(page, `.fp-pos:has(input[value="${theme}"])`);
      await go(page, sw, 300);
      await click(page);
      await page.waitForTimeout(60);
      await page.mouse.move(760, 470, { steps: 2 });
      over.push(await sample(page, `${theme}: mid View Transition, moving`, { x: 760, y: 470 }));
      await page.waitForTimeout(1200);
      await go(page, { x: 640, y: 380 });
      moved.push(await sample(page, `${theme}: settled`, { x: 640, y: 380 }));
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1400);
    await go(page, { x: 740, y: 470 }, 400);
    const halted = await page.evaluate(() => document.documentElement.dataset.tube ?? null);
    over.push({ ...(await sample(page, "HALT: the tube off", { x: 740, y: 470 })), tube: halted });
    await click(page);
    await page.waitForTimeout(150);
    over.push(await sample(page, "HALT: a click powers on", { x: 740, y: 470 }));
    check("cursor", "moved, the reticle is painted on top at ≥ 3:1 — every theme, over a link — and the native cursor hides", moved.every((m) => m.reticle && !m.native && m.px.contrast >= 3), moved);
    check("cursor", "above every layer: a View Transition mid-flight (POWER CYCLE, SCAN) and HALT's dark tube and power-on show the reticle where the pointer is", over.every((o) => o.reticle) && halted === "off", over);
    check("cursor", "…console clean", logs.length === 0, logs.slice(0, 4));
    await ctx.close();
  }
  {
    // the boot (a first visit: no session flag) — the reticle over the POST screen, at z62 above its z45
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "commit" });
    await page.waitForSelector(".boot", { state: "attached" });
    await page.waitForTimeout(500);
    const still = await sample(page, "boot, before any move", { x: 720, y: 450 });
    // a cached boot can end before the pointer is first read: once hydrated, hold its overlay on screen
    // (as it stands while the POST prints) and put the pointer over it
    // (after its POWER ON: a View Transition's hit test is the root)
    await page.waitForTimeout(3500);
    await page.addStyleTag({ content: "html .boot{position:fixed!important;inset:0!important;z-index:45!important;display:block!important;opacity:1!important;visibility:visible!important;animation:none!important;pointer-events:auto!important}" });
    await go(page, { x: 700, y: 440 }, 300);
    const boot = await page.evaluate(() => { const b = document.querySelector(".boot"); const cs = getComputedStyle(b); return { display: cs.display, z: cs.zIndex, under: document.elementFromPoint(700, 440)?.closest(".boot") !== null }; });
    const moved = await sample(page, "boot overlay, moved", { x: 700, y: 440 });
    check("cursor", "the boot: the native cursor until the pointer moves, then the reticle above the POST screen (z62 over its z45)", still.native && moved.reticle && boot.display === "block" && boot.under, { still, moved, boot });
    await ctx.close();
  }
  {
    // reduced motion: the tear is a 160 ms cover (z60) — the reticle is above it
    const { ctx, page } = await open("/", { debug: false, dpr: DPR, reduced: true });
    await page.waitForTimeout(1300);
    await go(page, { x: 700, y: 430 }, 300);
    const nav = await mid(page, '.hud-nav__link[data-section="work"]');
    await go(page, nav, 200);
    await click(page);
    await page.waitForTimeout(40);
    await page.mouse.move(nav.x - 150, nav.y + 250, { steps: 2 });
    const cover = await sample(page, "reduced: the tear's cover, moving", { x: nav.x - 150, y: nav.y + 250 });
    check("cursor", "reduced motion: the reticle over the tear's cover (no lag, never covered)", cover.reticle, cover);
    await ctx.close();
  }
});

await browser.close();
report.skipped = skipped;
writeFileSync(join(OUT, "audit-gate.json"), JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed${skipped.length ? ` · ${skipped.length} skipped (no GPU)` : ""} · report: .artifacts/audit-gate.json`);
process.exit(failed.length ? 1 : 0);
