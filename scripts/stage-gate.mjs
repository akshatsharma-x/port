#!/usr/bin/env node
/**
 * Gate A (PROMPTS.md Part 3). Drives /dev/stage?debug=1 in the installed Chrome and reads the
 * governor, the GL census (every draw/clear call, per context, per frame) and the context census
 * through window.__retrograde (components/stage/DebugOverlay.tsx).
 *
 *   BASE_URL=http://localhost:3200 node scripts/stage-gate.mjs
 *
 * Profiles: desktop 1440×900 @2x; mobile 412×915 @2.625, touch, CPU throttled 4× (CDP).
 * Pass: never more than two contexts, never two drawing in one frame, offscreen scenes at zero
 * draw calls — while scrolling fast both ways, jumping via anchors, navigating between routes and
 * forcing context loss — plus ≤ 1 LIVE and ≤ 2 resident.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PROFILES = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  {
    name: "mobile",
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    cpuThrottle: 4,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
  },
];

const probeHtml = await (await fetch(BASE + "/")).text();
if (!probeHtml.includes("retrograde:ui")) {
  console.error(`${BASE} is not serving RETROGRADE — set BASE_URL.`);
  process.exit(2);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

/** Everything the gate reads, in one evaluate. */
const READ = () => {
  const r = window.__retrograde;
  const g = r.governor;
  const s = g.snapshot;
  const st = g.stats;
  const p = (w, q) => (w.count ? Math.round(w.percentile(q) * 100) / 100 : null);
  const census = { ...r.census };
  delete census.uninstall;
  return {
    url: location.pathname,
    tier: s.tier,
    tierFinal: s.tierFinal,
    reasons: s.tierReasons,
    probes: s.probes,
    refreshHz: s.refreshHz,
    dpr: s.dpr,
    deviceDpr: s.deviceDpr,
    runtime: s.runtime,
    mode: s.mode,
    contextLost: s.contextLost,
    resident: s.resident,
    interlock: s.interlock,
    scenes: Object.fromEntries(Object.entries(s.scenes).map(([k, v]) => [k, { state: v.state, mounted: v.mounted, drawable: v.drawable, warmMs: v.warmMs, vramBytes: v.vramBytes }])),
    stats: {
      frame: st.frame,
      framesRendered: st.framesRendered,
      framesFrozen: st.framesFrozen,
      framesFx: st.framesFx,
      framesBoot: st.framesBoot,
      maxLive: st.maxLive,
      maxResident: st.maxResident,
      docked: st.docked,
      visible: st.visible,
      warms: { ...st.warms },
      last: st.last,
      interval: { p50: p(st.intervals, 50), p95: p(st.intervals, 95), p99: p(st.intervals, 99) },
      cpu: { p50: p(st.work, 50), p95: p(st.work, 95) },
      gpu: { p50: p(st.gpu, 50), p95: p(st.gpu, 95) },
    },
    census,
    contexts: r.contexts(),
    funnel: { ...r.funnel() },
    fxFrames: r.fx.frames,
    memory: g.dev.runtimeMemory?.() ?? null,
    framebufferBytes: g.dev.framebufferBytes?.() ?? null,
    sceneTime: Object.fromEntries(["system", "log", "archive", "work", "capabilities"].map((id) => [id, g.dev.sceneTime?.(id) ?? null])),
    postersShowing: document.querySelectorAll(".stage-poster:not([data-live])").length,
    slots: document.querySelectorAll("[data-stage-slot]").length,
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    innerWidth,
    scrollMax: document.documentElement.scrollHeight - innerHeight,
  };
};

const delta = (a, b) => ({
  multiContextFrames: b.census.multiContextFrames - a.census.multiContextFrames,
  offscreenStageDraws: b.census.offscreenStageDraws - a.census.offscreenStageDraws,
  stageDraws: b.census.stageDraws - a.census.stageDraws,
  framesWithStage: b.census.framesWithStage - a.census.framesWithStage,
  framesWithFx: b.census.framesWithFx - a.census.framesWithFx,
  framesRendered: b.stats.framesRendered - a.stats.framesRendered,
  frames: b.stats.frame - a.stats.frame,
  funnelFrames: b.funnel.frames - a.funnel.frames,
  nativeRaf: b.funnel.native - a.funnel.native,
});

async function scrollTo(page, y, duration) {
  await page.evaluate(
    ([target, d]) =>
      new Promise((resolve) => {
        const lenis = window.__retrograde.lenis();
        const done = () => resolve(undefined);
        if (!lenis) {
          window.scrollTo(0, target);
          setTimeout(done, d * 1000 + 200);
          return;
        }
        lenis.scrollTo(target, { duration: d, force: true, immediate: d === 0, onComplete: done });
        setTimeout(done, d * 1000 + 1500);
      }),
    [y, duration],
  );
}

async function run(profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile ?? false,
    hasTouch: profile.hasTouch ?? false,
    ...(profile.userAgent ? { userAgent: profile.userAgent } : {}),
  });
  // a GL warning carries no JS stack: record who asks WebGL about a program it no longer knows
  // (Part 7: "glGetProgramiv: Program object expected", once, in this gate's desktop run)
  // …and who deletes an object from another context, or from before a context loss (tagged at
  // create* with its canvas and that canvas's restore count)
  await context.addInitScript(() => {
    window.__glBad = [];
    const stack = () => (new Error().stack ?? "").split("\n").slice(3, 10).map((l) => l.trim()).join(" | ");
    const restores = new WeakMap();
    document.addEventListener("webglcontextrestored", (e) => restores.set(e.target, (restores.get(e.target) ?? 0) + 1), true);
    const born = new WeakMap();
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!C) continue;
      const get = C.prototype.getProgramParameter;
      C.prototype.getProgramParameter = function (program, pname) {
        if (program && !this.isContextLost() && !this.isProgram(program) && window.__glBad.length < 12) window.__glBad.push({ kind: "getProgramParameter", t: Math.round(performance.now()), pname, stack: stack() });
        return get.call(this, program, pname);
      };
      for (const k of ["Texture", "Buffer", "Framebuffer", "Renderbuffer", "Program", "Shader", "VertexArray", "Query", "Sampler"]) {
        const make = C.prototype[`create${k}`];
        const kill = C.prototype[`delete${k}`];
        if (!make || !kill) continue;
        C.prototype[`create${k}`] = function (...a) {
          const o = make.apply(this, a);
          if (o) born.set(o, { canvas: this.canvas, gen: restores.get(this.canvas) ?? 0 });
          return o;
        };
        C.prototype[`delete${k}`] = function (o) {
          const b = o && born.get(o);
          const gen = restores.get(this.canvas) ?? 0;
          if (b && (b.canvas !== this.canvas || b.gen !== gen) && window.__glBad.length < 12) window.__glBad.push({ kind: `delete${k}`, t: Math.round(performance.now()), bornGen: b.gen, nowGen: gen, sameCanvas: b.canvas === this.canvas, stack: stack() });
          return kill.call(this, o);
        };
      }
    }
  });
  const page = await context.newPage();
  const messages = [];
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && messages.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => messages.push(`pageerror: ${e.message}`));
  if (profile.cpuThrottle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuThrottle });
  }
  const read = () => page.evaluate(READ);
  const report = { profile: profile.name, scenarios: {}, messages };
  const t0 = Date.now();

  // ── boot ───────────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/dev/stage?debug=1`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForFunction(() => {
    const s = window.__retrograde?.governor.snapshot;
    return s && s.tierFinal && s.runtime === "ready" && s.scenes.system.state === "LIVE" && s.scenes.system.drawable;
  }, null, { timeout: 60_000, polling: 50 });
  await page.waitForFunction(() => window.__retrograde.governor.snapshot.refreshHz !== null, null, { timeout: 10_000, polling: 50 }).catch(() => undefined);
  const boot = await read();
  report.boot = {
    msToHeroLive: Date.now() - t0,
    tier: boot.tier,
    reasons: boot.reasons,
    probes: boot.probes,
    refreshHz: boot.refreshHz,
    dpr: boot.dpr,
    deviceDpr: boot.deviceDpr,
    heroWarmMs: boot.scenes.system.warmMs,
    heroVramBytes: boot.scenes.system.vramBytes,
    framebufferBytes: boot.framebufferBytes,
    memory: boot.memory,
    contexts: boot.contexts,
    overflowPx: boot.overflowPx,
    innerWidth: boot.innerWidth,
  };
  await page.screenshot({ path: `${OUT}gate-${profile.name}-boot.png` });

  // ── 1 · fast scroll, both directions ──────────────────────────────────────────────────
  {
    await page.evaluate(() => window.__retrograde.governor.resetStats());
    const a = await read();
    const max = a.scrollMax;
    const visits = new Set();
    for (let round = 0; round < 3; round++) {
      await scrollTo(page, max, 1.6);
      visits.add(JSON.stringify((await read()).stats.warms));
      await scrollTo(page, 0, 1.6);
    }
    // abuse: immediate jumps every 60 ms across the page, both ways
    for (let i = 0; i <= 20; i++) {
      await scrollTo(page, Math.round((max * ((i * 7) % 21)) / 20), 0);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(400);
    const b = await read();
    report.scenarios.fastScroll = { ...delta(a, b), maxLive: b.stats.maxLive, maxResident: b.stats.maxResident, warms: b.stats.warms, interval: b.stats.interval, cpu: b.stats.cpu, gpu: b.stats.gpu, scenesWarmMs: Object.fromEntries(Object.entries(b.scenes).map(([k, v]) => [k, v.warmMs])) };
  }

  // ── 2 · anchor jumps (Lenis smooth-scrolls nav links) ─────────────────────────────────
  {
    await scrollTo(page, 0, 0);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__retrograde.governor.resetStats());
    const a = await read();
    const jumps = [];
    // smooth jumps from the nav (clicked in place, as a fixed HUD would be — Playwright's own
    // scroll-into-view of the off-screen nav would race Lenis), then instant ones
    const plan = [...["archive", "system", "capabilities", "log", "work", "system"].map((id) => [id, "smooth"]), ...["capabilities", "log", "archive", "system"].map((id) => [id, "instant"])];
    for (const [id, how] of plan) {
      const start = Date.now();
      if (how === "smooth") await page.evaluate((x) => document.querySelector(`nav a[href="#${x}"]`).click(), id);
      else await page.evaluate((x) => window.__retrograde.lenis().scrollTo(`#${x}`, { immediate: true, force: true }), id);
      let ready = null;
      try {
        await page.waitForFunction((x) => {
          const s = window.__retrograde.governor.snapshot;
          const tierAllows = s.tier !== "LOW" || x === "system" || x === "work";
          return !tierAllows || (s.scenes[x].state === "LIVE" && s.scenes[x].drawable);
        }, id, { timeout: 8000, polling: 16 });
        ready = Date.now() - start;
      } catch {
        ready = "timeout";
      }
      await page.waitForTimeout(250);
      const r = await read();
      jumps.push({ to: id, how, msToLive: ready, live: Object.entries(r.scenes).filter(([, v]) => v.state === "LIVE").map(([k]) => k), resident: r.resident });
    }
    const b = await read();
    report.scenarios.anchorJumps = { ...delta(a, b), maxLive: b.stats.maxLive, maxResident: b.stats.maxResident, jumps };
  }

  // ── 3 · route navigation: the mesh keeps animating across it ──────────────────────────
  {
    await scrollTo(page, 0, 0);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.__retrograde.governor.resetStats());
    const a = await read();
    const before = { t: a.sceneTime.system, warms: a.stats.warms.system };
    await page.click('a[href="/dev/stage/system"]');
    await page.waitForURL("**/dev/stage/system", { timeout: 20_000, waitUntil: "commit" });
    await page.waitForTimeout(800);
    const mid = await read();
    await page.goBack();
    await page.waitForURL(/\/dev\/stage(\?debug=1)?(#.*)?$/, { timeout: 20_000, waitUntil: "commit" });
    await page.waitForTimeout(800);
    const back = await read();
    // and into a different scene's route
    await scrollTo(page, 0, 0);
    await page.click('a[href="/dev/stage/work"]');
    await page.waitForURL("**/dev/stage/work", { timeout: 20_000, waitUntil: "commit" });
    await page.waitForFunction(() => {
      const s = window.__retrograde.governor.snapshot;
      return s.scenes.work.state === "LIVE" && s.scenes.work.drawable;
    }, null, { timeout: 8000, polling: 16 });
    const work = await read();
    await page.goto(`${BASE}/dev/stage?debug=1`, { waitUntil: "load" }); // full reload resets the census: read deltas before
    await page.waitForFunction(() => window.__retrograde?.governor.snapshot.scenes.system.drawable, null, { timeout: 60_000, polling: 50 });
    report.scenarios.routes = {
      ...delta(a, work),
      maxLive: work.stats.maxLive,
      maxResident: work.stats.maxResident,
      systemAcrossRoute: {
        stateOnRoute: mid.scenes.system.state,
        clockBefore: before.t,
        clockOnRoute: mid.sceneTime.system,
        clockBack: back.sceneTime.system,
        rewarmedOnRoute: mid.stats.warms.system - before.warms,
        rewarmedBack: back.stats.warms.system - before.warms,
        contextsSeen: back.contexts.seen,
      },
      workOnItsRoute: work.scenes.work.state,
    };
  }

  // ── 4 · #fx-gl test wipe: the freeze handshake ────────────────────────────────────────
  {
    await scrollTo(page, 0, 0);
    await page.waitForTimeout(500);
    const a = await read();
    const wipe = page.evaluate(() => window.__retrograde.fx.wipe());
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}gate-${profile.name}-wipe.png` });
    await wipe;
    await page.waitForTimeout(300);
    const b = await read();
    report.scenarios.fxWipe = { ...delta(a, b), fxFrames: b.fxFrames - a.fxFrames, frozenFrames: b.stats.framesFrozen - a.stats.framesFrozen, stageResumed: b.stats.framesRendered > a.stats.framesRendered };
  }

  // ── 5 · offscreen: parked in a DOM-only interlock ─────────────────────────────────────
  {
    const zone = await page.evaluate(() => {
      const s = document.querySelector("[data-spacer='0']");
      const r = s.getBoundingClientRect();
      return r.top + scrollY + r.height / 2 - innerHeight / 2;
    });
    await scrollTo(page, zone, 0.6);
    await page.waitForTimeout(500);
    const a = await read();
    await page.waitForTimeout(1500);
    const b = await read();
    report.scenarios.offscreen = { ...delta(a, b), docked: b.stats.docked, mode: b.mode, scenes: Object.fromEntries(Object.entries(b.scenes).map(([k, v]) => [k, v.state])) };
  }

  // ── 6 · context loss: posters everywhere, then re-warm the current slot ───────────────
  {
    await scrollTo(page, 0, 0);
    await page.waitForTimeout(500);
    const a = await read();
    await page.evaluate(() => window.__retrograde.governor.dev.loseContext?.());
    await page.waitForFunction(() => window.__retrograde.governor.snapshot.contextLost, null, { timeout: 5000 });
    await page.waitForTimeout(600);
    const lost = await read();
    await page.screenshot({ path: `${OUT}gate-${profile.name}-context-lost.png` });
    await page.waitForTimeout(600);
    const lost2 = await read();
    const t = Date.now();
    await page.evaluate(() => window.__retrograde.governor.dev.restoreContext?.());
    await page.waitForFunction(() => {
      const s = window.__retrograde.governor.snapshot;
      return !s.contextLost && s.scenes.system.state === "LIVE" && s.scenes.system.drawable;
    }, null, { timeout: 10_000, polling: 16 });
    const msToRewarm = Date.now() - t;
    await page.waitForTimeout(400);
    const b = await read();
    report.scenarios.contextLoss = {
      ...delta(a, b),
      postersWhileLost: lost.postersShowing,
      slots: lost.slots,
      drawsWhileLost: lost2.census.stageDraws - lost.census.stageDraws,
      msToRewarm,
      rewarmedScenes: Object.entries(b.stats.warms).filter(([k, v]) => v > a.stats.warms[k]).map(([k]) => k),
      contextsSeen: b.contexts.seen,
      liveAfter: Object.entries(b.scenes).filter(([, v]) => v.state === "LIVE").map(([k]) => k),
    };
  }

  // ── 7 · hidden tab: the loop stops ─────────────────────────────────────────────────────
  {
    const other = await context.newPage();
    await other.goto("about:blank");
    await other.bringToFront();
    await page.waitForTimeout(300);
    const vis = await page.evaluate(() => document.visibilityState);
    const a = await read();
    await page.waitForTimeout(1500);
    const b = await read();
    await page.bringToFront();
    await other.close();
    report.scenarios.hiddenTab = { visibilityState: vis, ...delta(a, b) };
  }

  if (profile.name === "mobile") {
    await scrollTo(page, 0, 0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}gate-mobile-top.png` });
  } else {
    // the log slot (taller than the viewport: held like sticky) and the work slot (clipped)
    for (const id of ["log", "work"]) {
      await page.evaluate((x) => document.querySelector(`[data-stage-slot='${x}']`).scrollIntoView({ block: "start" }), id);
      await page.waitForFunction((x) => window.__retrograde.governor.snapshot.scenes[x].drawable, id, { timeout: 8000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}gate-desktop-${id}.png` });
    }
  }

  const end = await read();
  report.final = { contexts: end.contexts, census: end.census, funnel: end.funnel };
  report.glDeadPrograms = await page.evaluate(() => window.__glBad ?? []);
  if (report.glDeadPrograms.length) console.log(`${profile.name}: WebGL asked about a dead program —`, JSON.stringify(report.glDeadPrograms, null, 1));
  await context.close();
  return report;
}

// reduced motion: no WebGL context may ever exist
async function reducedMotion() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${BASE}/dev/stage?debug=1`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => ({
    glContextsCreated: (window.__glContexts ?? []).length,
    canvases: document.querySelectorAll("canvas").length,
    postersShowing: document.querySelectorAll(".stage-poster:not([data-live])").length,
    tier: window.__retrograde?.governor.snapshot.tier,
  }));
  await page.screenshot({ path: `${OUT}gate-reduced-motion.png` });
  await context.close();
  return r;
}

const results = [];
for (const profile of PROFILES) results.push(await run(profile));
const rm = await reducedMotion();
await browser.close();

const checks = [];
for (const r of results) {
  const s = r.scenarios;
  const all = Object.values(s);
  checks.push(
    [`${r.profile}: never more than two contexts`, r.final.contexts.seen <= 2 && r.final.contexts.aliveCount <= 2],
    [`${r.profile}: never two contexts drawing in one frame`, r.final.census.multiContextFrames === 0 && all.every((x) => (x.multiContextFrames ?? 0) === 0)],
    [`${r.profile}: offscreen scenes at zero draw calls`, r.final.census.offscreenStageDraws === 0 && s.offscreen.stageDraws === 0],
    [`${r.profile}: ≤ 1 LIVE, ≤ 2 resident`, all.every((x) => (x.maxLive ?? 0) <= 1 && (x.maxResident ?? 0) <= 2)],
    [`${r.profile}: every jump lands LIVE (or on its poster where the tier has no stage)`, s.anchorJumps.jumps.every((j) => j.msToLive !== "timeout")],
    [`${r.profile}: one native rAF per frame`, r.final.funnel.native <= r.final.funnel.frames + 2],
    [`${r.profile}: mesh keeps animating across routes (no re-warm)`, s.routes.systemAcrossRoute.stateOnRoute === "LIVE" && s.routes.systemAcrossRoute.rewarmedOnRoute === 0 && s.routes.systemAcrossRoute.clockOnRoute > s.routes.systemAcrossRoute.clockBefore],
    [`${r.profile}: wipe froze the stage`, s.fxWipe.fxFrames > 0 && s.fxWipe.multiContextFrames === 0 && s.fxWipe.stageResumed],
    [`${r.profile}: context loss → posters, then re-warm`, s.contextLoss.postersWhileLost === s.contextLoss.slots && s.contextLoss.drawsWhileLost === 0 && s.contextLoss.liveAfter.includes("system")],
    [`${r.profile}: no console errors or warnings`, r.messages.length === 0],
    [`${r.profile}: no horizontal overflow`, r.boot.overflowPx === 0 && r.boot.innerWidth === PROFILES.find((p) => p.name === r.profile).viewport.width],
  );
}
checks.push(["reduced motion: no WebGL context, posters only", rm.glContextsCreated === 0 && rm.canvases === 0 && rm.postersShowing === 5]);

const report = { base: BASE, results, reducedMotion: rm, checks: checks.map(([name, ok]) => ({ name, ok })) };
writeFileSync(`${OUT}stage-gate.json`, JSON.stringify(report, null, 2));
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(`\nreport: .artifacts/stage-gate.json`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
