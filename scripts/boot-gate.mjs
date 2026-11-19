#!/usr/bin/env node
/**
 * Gate B (PROMPTS.md Part 5): the boot and the persistent chrome, in the installed Chrome.
 *
 *   BASE_URL=http://localhost:3200 node scripts/boot-gate.mjs
 *
 * The boot: P1, lines whole and ≥ 40 ms apart, real bytes, POWER ON at 100% or 1.6 s, the hero by
 * 2.2 s, the name rising on the beam's open frame; skip from frame one (Esc before any script, Esc
 * and a click after); never replayed in a session; deep links get POWER ON-fast; the hard cap on a
 * throttled network, and with the main thread stalled after the script took over; the
 * reduced-motion edition. Sound: the engine's chain and the cue sheet's
 * peaks, rendered offline. The chrome: nav, front panel, cursor, #fx-css, scroll-padding.
 * Lighthouse runs separately (see the Part 5 report). Report: .artifacts/boot-gate.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const probe = await (await fetch(BASE + "/")).text();
if (!probe.includes("retrograde:ui")) {
  console.error(`${BASE} is not serving RETROGRADE — set BASE_URL.`);
  process.exit(2);
}
const BOOT = { p1Ms: 250, lineGapMs: 40, powerAtMs: 1600, capMs: 2200 };
const POWER = { onMs: 600, openMs: 420, onFastMs: 360, onFastOpenMs: 252 };
const fontBytes = JSON.parse(readFileSync(new URL("../app/fonts/manifest.json", import.meta.url), "utf8")).fonts.reduce((n, f) => n + f.bytes, 0);
let runtimeBytes = 0;
try {
  runtimeBytes = (await (await fetch(`${BASE}/boot-manifest.json`)).json()).runtime.reduce((n, c) => n + c.bytes, 0);
} catch {
  /* dev: no manifest */
}
// the hero's morph-target data the boot counts (lib/hero-targets.ts): the stage data and the land mask
let heroBytes = 0;
for (const url of ["/data/stage.json", "/data/land-256x128.bin"]) heroBytes += (await (await fetch(`${BASE}${url}`)).arrayBuffer()).byteLength;

const report = { base: BASE, at: new Date().toISOString(), checks: [], runs: {} };
function check(name, pass, detail) {
  report.checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

/** Before any page script: a frame-by-frame record of the boot, the overlay, the name and CLS. */
const INIT = () => {
  const rec = (window.__gate = { frames: [], lines: [], rising: null, hiddenAt: null, shutterAt: null, cls: 0, shifts: [] });
  const t = () => performance.now();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      const nodes = (e.sources ?? []).map((s) => s.node).filter(Boolean);
      const el = (n) => (n.nodeType === 3 ? n.parentElement : n);
      if (nodes.length && nodes.every((n) => el(n)?.closest?.(".stage-debug"))) continue;
      rec.cls += e.value;
      rec.shifts.push({ v: e.value, at: Math.round(e.startTime), src: nodes.map((n) => String(el(n)?.className ?? "")).join("|") });
    }
  }).observe({ type: "layout-shift", buffered: true });
  const sample = () => {
    const boot = document.querySelector(".boot");
    if (boot) {
      const cs = getComputedStyle(boot);
      const visible = cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
      if (!rec.first) rec.first = { at: t(), visible, mode: document.documentElement.dataset.boot };
      if (!visible && rec.hiddenAt === null && rec.first.visible) rec.hiddenAt = t();
      // each row, stamped with the frame it was added in (its frame is when it's on screen)
      if (!rec.watching) {
        rec.watching = true;
        new MutationObserver((records) => {
          const at = typeof document.timeline.currentTime === "number" ? document.timeline.currentTime : t();
          for (const m of records) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains("boot__row")) rec.lines.push(at);
        }).observe(boot, { childList: true, subtree: true });
      }
    }
    const sh = document.querySelector(".boot-shutter");
    if (sh && rec.shutterAt === null && getComputedStyle(sh).display !== "none") rec.shutterAt = t();
    const name = document.querySelector(".name-rise");
    if (name?.hasAttribute("data-rising") && rec.rising === null) rec.rising = t();
    if (t() < 6000) requestAnimationFrame(sample); // eslint-disable-line no-restricted-globals
  };
  requestAnimationFrame(sample); // eslint-disable-line no-restricted-globals
};

const IGNORED = [/Download the React DevTools/, /\[HMR\]/, /\[Fast Refresh\]/];
async function fresh(opts = {}, path = "/", { debug = false, waitUntil = "load", storage } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...opts });
  if (storage) await ctx.addInitScript((s) => localStorage.setItem("retrograde:ui", s), storage);
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && !IGNORED.some((re) => re.test(m.text())) && logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
  const [p, hash = ""] = path.split("#");
  const url = debug ? `${p}${p.includes("?") ? "&" : "?"}debug=1${hash ? `#${hash}` : ""}` : path;
  await page.goto(`${BASE}${url}`, { waitUntil });
  return { ctx, page, logs };
}
const read = (page) =>
  page.evaluate(() => ({
    mode: document.documentElement.dataset.boot,
    skip: document.documentElement.hasAttribute("data-boot-skip"),
    // the boot's clock: its first paint (lib/boot.ts bootOrigin), else the head script's t0
    t0: window.__boot?.origin ?? Math.max(window.__boot?.t0 ?? 0, performance.getEntriesByType("paint").find((e) => e.name === "first-paint")?.startTime ?? 0),
    marks: window.__boot?.marks ?? null,
    gate: window.__gate,
    progress: document.querySelector(".boot__progress")?.textContent ?? "",
    rows: [...document.querySelectorAll(".boot__row")].map((r) => [...r.children].map((c) => c.textContent)),
    navDecoded: performance.getEntriesByType("navigation")[0]?.decodedBodySize ?? 0,
    tube: document.documentElement.dataset.tube ?? null,
    bootState: JSON.parse(localStorage.getItem("retrograde:ui") ?? "null")?.state ?? null,
  }));
const rel = (r, at) => (at == null || r.t0 == null ? null : Math.round(at - r.t0));

const browser = await chromium.launch({ channel: "chrome", headless: true });

// ── 1 · the first visit to / ─────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await fresh({}, "/", { debug: true });
  await page.waitForFunction(() => window.__boot?.marks?.done, null, { timeout: 15_000 });
  await page.waitForTimeout(1200);
  const r = await read(page);
  const m = r.marks;
  const lineAt = r.gate.lines.map((at) => rel(r, at));
  const rawGaps = r.gate.lines.slice(1).map((at, i) => at - (r.gate.lines[i] ?? 0));
  const gaps = rawGaps.map((g) => Math.round(g * 10) / 10);
  const total = fontBytes + runtimeBytes + heroBytes + r.navDecoded;
  const mb = /([\d.]+) \/ ([\d.]+) MB/.exec(r.progress);
  const p3 = rel(r, m.p3);
  const open = rel(r, m.open);
  const fullyOpen = p3 === null ? null : p3 + (m.variant === "full" ? POWER.openMs : POWER.onFastOpenMs);
  report.runs.first = { ...r, lineAt, gaps, total, p3, open, fullyOpen, rising: rel(r, r.gate.rising) };
  check("first visit to /: the boot runs, on screen from the first frame", r.mode === "run" && r.gate.first?.visible, r.gate.first);
  check("P1: the caret alone for 250 ms — no line before it", lineAt.length > 0 && lineAt[0] >= BOOT.p1Ms, { firstLineAt: lineAt[0] });
  check("P2: lines print whole as their tasks resolve, ≥ 40 ms apart", rawGaps.every((g) => g >= BOOT.lineGapMs), { lines: r.rows.length, lineAt, gaps });
  check("…every line names a real reading", r.rows.length >= 6 && r.rows.every((row) => row[0] && row[1] && row[3]), r.rows.map((row) => `${row[0]} ${row[1]} ${row[3]}`));
  check("…the byte counter is real: fonts + stage runtime + the hero's data + this document", mb && Math.abs(Number(mb[2]) - total / 1e6) < 0.006, { shown: mb?.[0], expected: `${(total / 1e6).toFixed(2)} MB`, fontBytes, runtimeBytes, heroBytes, html: r.navDecoded });
  check("P3: POWER ON at 100% or 1.6 s, whichever came first", p3 !== null && p3 <= BOOT.powerAtMs + 50, { p3 });
  check("…the hero is fully visible by 2.2 s", fullyOpen !== null && fullyOpen <= BOOT.capMs, { p3, beamOpen: open, fullyOpen });
  check("…the name rises on the frame the beam opens", r.gate.rising !== null && Math.abs(rel(r, r.gate.rising) - open) <= 40, { rising: rel(r, r.gate.rising), open });
  check("…CLS 0 through the boot", r.gate.cls === 0, { cls: r.gate.cls, shifts: r.gate.shifts.slice(0, 4) });
  check("…console clean", logs.length === 0, logs.slice(0, 4));
  await page.screenshot({ path: `${OUT}boot-done.png` });

  // ── 2 · never replayed in the session: a reload is POWER ON-fast ──
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  const again = await read(page);
  report.runs.reload = again;
  check("never replays: a reload in the same session is POWER ON-fast, no overlay", again.mode === "fast" && !again.gate.first?.visible && again.gate.shutterAt !== null && again.gate.rising === null, { mode: again.mode, overlay: again.gate.first, shutter: rel(again, again.gate.shutterAt) });
  await ctx.close();
}

// ── 3 · deep links skip the boot ─────────────────────────────────────────────────────────────
for (const path of ["/#archive", "/dev/stage"]) {
  const { ctx, page, logs } = await fresh({}, path);
  await page.waitForTimeout(900);
  const r = await read(page);
  report.runs[`deep:${path}`] = r;
  check(`deep link ${path}: no boot — POWER ON-fast over the painted page`, r.mode === "fast" && !r.gate.first?.visible && r.gate.shutterAt !== null && logs.length === 0, { mode: r.mode, shutterFrom: rel(r, r.gate.shutterAt), console: logs.slice(0, 2) });
  await ctx.close();
}

// ── 4 · skip ──────────────────────────────────────────────────────────────────────────────
{
  // (a) Esc from the first frame — before any script has loaded (the head script's listener)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  // hold the app's scripts back, so the press lands before hydration
  let release;
  const held = new Promise((r) => (release = r));
  // scripts only — CSS is render-blocking and must arrive, or the head script itself would wait
  await page.route((url) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"), async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  const early = await read(page);
  release();
  await page.waitForTimeout(800);
  const after = await read(page);
  report.runs.skipEarly = { early, after };
  check("SKIP works from frame one: Esc before any script hides the boot (CSS ON-fast)", early.skip && early.gate.hiddenAt !== null && early.gate.shutterAt !== null, { skip: early.skip, hidden: rel(early, early.gate.hiddenAt), shutter: rel(early, early.gate.shutterAt) });
  check("…and the script, when it lands, doesn't replay it", after.marks?.done && !after.marks.p2 && after.gate.rising === null, after.marks);
  await ctx.close();
}
for (const how of ["Escape", "click"]) {
  const { ctx, page } = await fresh({}, "/");
  await page.waitForFunction(() => window.__boot?.marks?.p2, null, { timeout: 10_000 });
  const t = await page.evaluate(() => performance.now());
  if (how === "Escape") await page.keyboard.press("Escape");
  else await page.mouse.click(400, 400);
  await page.waitForFunction(() => window.__boot?.marks?.done, null, { timeout: 5000 });
  const r = await read(page);
  const took = Math.round(r.marks.done - t);
  report.runs[`skip:${how}`] = { ...r, took };
  check(`skip by ${how === "click" ? "a click anywhere" : "Esc"}: POWER ON-fast at once (≤ 360 ms + a frame), no rise`, r.marks.p3 - t < 50 && took <= POWER.onFastMs + 120 && r.gate.rising === null, { p3After: Math.round(r.marks.p3 - t), doneAfter: took });
  await ctx.close();
}

// ── 5 · the hard cap on a throttled network ──────────────────────────────────────────────────
// Judged from Chrome's own compositor frames (a trace's screenshots, as Lighthouse's filmstrip
// is): on a slow phone the main thread is still parsing scripts when the cap's compositor-only
// fade lands, so anything observed from the main thread — or a CDP screenshot, which waits for it
// — sees the hero late. The boot's frames are dark glass and mono text (JPEG: a few KB); the
// hero's are full of detail (tens of KB): the first frame at least half the size of the settled
// page (the median of the last ten) is the hero.
/** Loads / under a trace and returns its compositor frames, in ms from first contentful paint. */
async function filmstrip(page, cdp, ms) {
  const events = [];
  cdp.on("Tracing.dataCollected", (e) => events.push(...e.value));
  const traced = new Promise((r) => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.screenshot", "loading"] }, transferMode: "ReportEvents" });
  await page.goto(`${BASE}/`, { waitUntil: "commit", timeout: 60_000 });
  await page.waitForTimeout(ms);
  await cdp.send("Tracing.end");
  await traced;
  const fcp = events.find((e) => e.name === "firstContentfulPaint");
  const shots = events.filter((e) => e.name === "Screenshot" && e.args?.snapshot).map((e) => ({ ms: fcp ? (e.ts - fcp.ts) / 1000 : 0, bytes: Math.round((e.args.snapshot.length * 3) / 4) }));
  const after = shots.filter((f) => f.ms >= 0);
  const glass = after[0]?.bytes ?? 0;
  const tail = after.slice(-10).map((f) => f.bytes).sort((a, b) => a - b);
  const settled = tail[Math.floor(tail.length / 2)] ?? 0;
  const hero = after.find((f) => f.bytes >= settled / 2);
  const lastGlass = [...after].reverse().find((f) => hero && f.ms < hero.ms);
  const bootMax = Math.max(0, ...after.filter((f) => hero && f.ms < hero.ms).map((f) => f.bytes));
  return { shots, after, glass, settled, bootMax, hero, lastGlass };
}

const phoneContext = () => browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });

for (const [label, net] of [
  ["Slow 4G", { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }],
  ["3G", { latency: 300, downloadThroughput: (750 * 1024) / 8, uploadThroughput: (250 * 1024) / 8 }],
]) {
  const ctx = await phoneContext();
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, ...net });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const { shots, glass, settled, bootMax, hero, lastGlass } = await filmstrip(page, cdp, 6500);
  const r = await read(page);
  report.runs[`cap:${label}`] = { marks: r.marks, frames: shots.length, glassBytes: glass, bootMaxBytes: bootMax, settledBytes: settled, heroAt: hero ? Math.round(hero.ms) : null, lastGlassAt: lastGlass ? Math.round(lastGlass.ms) : null };
  check(`hard cap on ${label} + 4× CPU: the hero is on screen by 2.2 s of the boot (Chrome's compositor frames)`, !!hero && hero.ms <= BOOT.capMs, { heroFrameAt: hero ? Math.round(hero.ms) : null, lastBootFrameAt: lastGlass ? Math.round(lastGlass.ms) : null, bootKB: Math.round(bootMax / 100) / 10, heroKB: Math.round(settled / 100) / 10, scriptTookOver: !!r.marks?.controlled, variant: r.marks?.variant ?? "css-cap" });
  await ctx.close();
}

// A boot the script has taken over, whose main thread then stalls from P2 to 2.6 s (a slow phone
// hydrating, the runtime compiling): the CSS cap stays armed, so the compositor still shows the
// hero on time, and the script, when it wakes, cuts — no shutter covers the hero again.
const STALL_UNTIL_MS = 2600;
const STALL = (untilMs) => {
  const wait = () => {
    const b = window.__boot;
    if (!b?.marks?.p2) {
      requestAnimationFrame(wait); // eslint-disable-line no-restricted-globals
      return;
    }
    const end = (b.origin ?? b.t0) + untilMs;
    let spins = 0;
    while (performance.now() < end) spins++;
    b.stall = { spins, endedAt: Math.round(performance.now() - (b.origin ?? b.t0)) };
  };
  requestAnimationFrame(wait); // eslint-disable-line no-restricted-globals
};
{
  const ctx = await phoneContext();
  await ctx.addInitScript(INIT);
  await ctx.addInitScript(STALL, STALL_UNTIL_MS);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const { shots, after, glass, settled, bootMax, hero, lastGlass } = await filmstrip(page, cdp, 4500);
  const r = await read(page);
  const stall = await page.evaluate(() => window.__boot?.stall ?? null);
  // after the hero: never mostly covered again (shutters closing over it would be dark glass)
  const covered = after.find((f) => hero && f.ms > hero.ms && f.bytes < settled / 4);
  const during = after.filter((f) => f.ms > 300 && f.ms < STALL_UNTIL_MS - 100).length;
  report.runs.stall = { marks: r.marks, stall, frames: shots.length, framesDuringStall: during, glassBytes: glass, bootMaxBytes: bootMax, settledBytes: settled, heroAt: hero ? Math.round(hero.ms) : null, lastGlassAt: lastGlass ? Math.round(lastGlass.ms) : null, coveredAt: covered ? Math.round(covered.ms) : null };
  check(
    `a main thread stalled from P2 to ${STALL_UNTIL_MS / 1000} s after the script took over: the compositor's cap shows the hero by 2.2 s, and nothing covers it again`,
    !!r.marks?.controlled && !!stall && stall.endedAt >= STALL_UNTIL_MS && !!hero && hero.ms <= BOOT.capMs && !covered && r.marks?.variant === "cut" && r.gate.rising === null,
    { heroFrameAt: hero ? Math.round(hero.ms) : null, lastBootFrameAt: lastGlass ? Math.round(lastGlass.ms) : null, bootKB: Math.round(bootMax / 100) / 10, heroKB: Math.round(settled / 100) / 10, framesDuringStall: during, stalledUntil: stall?.endedAt ?? null, coveredAgainAt: covered ? Math.round(covered.ms) : null, variant: r.marks?.variant ?? null },
  );
  await ctx.close();
}

// No script at all (blocked, failed): the cap alone fades the overlay at 2.2 s, and its visibility
// step takes it out of hit-testing — the hero under it is clickable, not just visible.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  await page.route((url) => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"), (route) => route.abort());
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const probe = () =>
    page.evaluate(() => {
      const boot = document.querySelector(".boot");
      const cs = boot ? getComputedStyle(boot) : null;
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { at: Math.round(performance.now() - (window.__boot.origin ?? window.__boot.t0)), opacity: cs?.opacity ?? null, visibility: cs?.visibility ?? null, hitsBoot: !!hit?.closest(".boot"), h1: !!document.querySelector("h1")?.textContent };
    });
  const before = await probe();
  await page.waitForTimeout(2400 - before.at);
  const after = await probe();
  report.runs.noScript = { before, after };
  check(
    "no script at all: the boot shows, then at 2.2 s the cap fades it and takes it out of hit-testing (the hero is clickable)",
    before.visibility === "visible" && before.hitsBoot && after.at >= BOOT.capMs && Number(after.opacity) < 0.01 && after.visibility === "hidden" && !after.hitsBoot && after.h1,
    { before, after },
  );
  await ctx.close();
}

// ── 6 · the reduced-motion edition ────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await fresh({ reducedMotion: "reduce" }, "/", { debug: true });
  await page.waitForFunction(() => window.__boot?.marks?.done, null, { timeout: 15_000 });
  await page.waitForTimeout(500);
  const r = await read(page);
  const contexts = await page.evaluate(() => window.__retrograde?.contexts?.() ?? null);
  report.runs.reduced = { ...r, contexts };
  check("reduced motion: the boot runs and ends in a crossfade — no beam, no context, no rise", r.mode === "run" && r.marks.done - r.marks.p3 <= 420 && r.gate.rising === null && (contexts?.seen ?? 0) === 0, { crossfadeMs: Math.round(r.marks.done - r.marks.p3), contexts, rows: r.rows.length });
  check("…GPU line says it wasn't queried", r.rows.some((row) => /not queried/i.test(row[1] ?? "")), r.rows.find((row) => /gpu/i.test(row[0] ?? "")));
  check("…console clean", logs.length === 0, logs.slice(0, 4));
  await ctx.close();
}

// ── 7 · sound ─────────────────────────────────────────────────────────────────────────────────
{
  const saved = JSON.stringify({ state: { theme: "phosphor", sound: true, gfx: "auto" }, version: 1 });
  const { ctx, page, logs } = await fresh({}, "/", { debug: true, storage: saved });
  await page.waitForFunction(() => window.__retrograde?.audio && [...document.querySelectorAll(".boot__row")].some((r) => /snd/i.test(r.textContent ?? "")), null, { timeout: 15_000 });
  const before = await page.evaluate(async () => {
    const m = await window.__retrograde.audio();
    const e = m.existingEngine();
    return { engine: !!e, state: e?.ctx.state ?? null, line: [...document.querySelectorAll(".boot__row")].map((r) => r.textContent).find((t) => /snd/i.test(t)) ?? null };
  });
  await page.mouse.click(500, 500); // a gesture: skips the boot, and lets the context run
  await page.waitForTimeout(600);
  const after = await page.evaluate(async () => {
    const m = await window.__retrograde.audio();
    const e = m.existingEngine();
    return { state: e?.ctx.state ?? null, played: Object.fromEntries(window.__retrograde.cues.played) };
  });
  check("a saved SND ON: no AudioContext before a gesture (unless the browser allows it); the first gesture starts it", (before.engine ? before.state === "running" : true) && after.state === "running" && /on/i.test(before.line ?? ""), { before, after });
  // every implemented cue, rendered offline through the real master chain: true peaks
  const peaks = await page.evaluate(async () => {
    const m = await window.__retrograde.audio();
    const out = {};
    const cases = [["ENABLE", {}, m.PEAK_DB.ENABLE], ["BOOT", { variant: "tick" }, m.PEAK_DB.BOOT_TICK], ["BOOT", { variant: "thunk" }, m.PEAK_DB.BOOT_THUNK], ["POWER", { variant: "on" }, m.PEAK_DB.POWER], ["POWER", { variant: "off" }, m.PEAK_DB.POWER], ["TEAR", {}, m.PEAK_DB.TEAR], ["SECTION", {}, m.PEAK_DB.SECTION], ["COMMIT", {}, m.PEAK_DB.COMMIT], ["ARCHIVE", { hz: 880, ms: 120 }, m.PEAK_DB.ARCHIVE], ["ARCHIVE", { hz: 220, ms: 40 }, m.PEAK_DB.ARCHIVE], ["REPLOT", {}, m.PEAK_DB.REPLOT], ["GATE", {}, m.PEAK_DB.GATE], ["FLING", { intensity: 1 }, m.PEAK_DB.FLING], ["KEYCAP", { intensity: 1 }, m.PEAK_DB.KEYCAP], ["FLIP", {}, m.PEAK_DB.FLIP], ["STAMP", {}, m.PEAK_DB.STAMP], ["TRANSMIT", {}, m.PEAK_DB.TRANSMIT], ["HALT", {}, m.PEAK_DB.HALT], ["SHELL", { variant: "open" }, m.PEAK_DB.SHELL], ["SHELL", { variant: "close" }, m.PEAK_DB.SHELL], ["SHELL", { variant: "enter" }, m.PEAK_DB.SHELL], ["SHELL", { variant: "error" }, m.PEAK_DB.SHELL], ["DEGAUSS", {}, m.PEAK_DB.DEGAUSS]];
    // the jittered cues (±4–8% pitch at random) render RENDERS times: the worst take is the peak
    const RENDERS = 24;
    for (const [cue, detail, target] of cases) {
      const takes = [];
      let len = 0;
      for (let i = 0; i < RENDERS; i++) {
        // half a second of silence first: a live engine meets each cue with its compressor released;
        // then two seconds, past the longest cue (TRANSMIT's 1.4 s handshake and chime)
        const ctx = new OfflineAudioContext(1, 120000, 48000);
        const { input } = m.masterChain(ctx, ctx.destination);
        len = m.buildCue(ctx, input, cue, detail, 0.5);
        const buf = await ctx.startRendering();
        let peak = 0;
        for (const v of buf.getChannelData(0)) peak = Math.max(peak, Math.abs(v));
        takes.push(m.gainToDb(peak));
      }
      const round = (db) => Math.round(db * 10) / 10;
      out[`${cue}${detail.variant ? `:${detail.variant}` : detail.hz ? `:${detail.hz}Hz` : ""}`] = { peakDb: round(Math.max(...takes)), quietestDb: round(Math.min(...takes)), target, lengthS: len };
    }
    out.stubs = m.STUBS.map((c) => [c, m.buildCue(new OfflineAudioContext(1, 4800, 48000), new OfflineAudioContext(1, 4800, 48000).destination, c, {}, 0)]);
    return out;
  });
  report.runs.sound = { before, after, peaks };
  const cues = Object.entries(peaks).filter(([k]) => k !== "stubs");
  check("every implemented cue peaks at (or under) its sheet level in its loudest of 24 takes, and the mix under −6 dBFS", cues.every(([, v]) => v.peakDb <= v.target + 1 && v.peakDb <= -6 && v.peakDb >= v.target - 4), Object.fromEntries(cues.map(([k, v]) => [k, `${v.quietestDb === v.peakDb ? "" : `${v.quietestDb}…`}${v.peakDb} dBFS (sheet ${v.target})`])));
  // Part 8 implemented ARCHIVE and REPLOT, Part 9 GATE and FLING, Part 10 KEYCAP, Part 11 FLIP and STAMP, Part 12 TRANSMIT and HALT, Part 13 SHELL (and the Konami code's DEGAUSS)
  check("…and no cue is a stub any more: every one on the sheet sounds", peaks.stubs.length === 0, peaks.stubs.map(([c]) => c));
  check("…console clean", logs.length === 0, logs.slice(0, 4));
  await ctx.close();
}

// ── 8 · the chrome ────────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await fresh({}, "/#identity", { debug: true });
  await page.waitForFunction(() => window.__retrograde?.scroll, null, { timeout: 15_000 });
  await page.waitForTimeout(1200);
  const hud = await page.evaluate(() => ({
    readout: document.querySelector(".hud-readout")?.textContent,
    nav: [...document.querySelectorAll(".hud-nav__link")].map((a) => a.textContent),
    bar: document.querySelector(".hud-nav__active")?.dataset.on,
    rail: document.querySelectorAll(".section-rail__link").length,
    brackets: document.querySelectorAll(".hud-bezel > i").length,
    panel: [...document.querySelectorAll(".front-panel input, .front-panel button")].map((b) => b.textContent || b.value),
    pad: getComputedStyle(document.documentElement).scrollPaddingTop + " / " + getComputedStyle(document.documentElement).scrollPaddingBottom,
  }));
  check("HUD: RETROGRADE/OS · section · % · owner's local time + zone", /RETROGRADE\/OS · 02 IDENTITY\s+· \d{2,3}% · \d{2}:\d{2}:\d{2} [A-Z]{3,4}/.test(hud.readout ?? "") && /FPS/.test(hud.readout ?? ""), hud.readout);
  check("…nav WORK · RESEARCH · CREDENTIALS · CONTACT · ~, rail of nine, four corner brackets", hud.nav.length === 5 && hud.rail === 9 && hud.brackets >= 4, { nav: hud.nav, rail: hud.rail });
  // the nav's one indicator travels with the section
  await page.evaluate(() => window.__retrograde.lenis().scrollTo(document.getElementById("work").getBoundingClientRect().top + scrollY + 200, { immediate: true }));
  await page.waitForTimeout(900);
  const bar = await page.evaluate(() => { const b = document.querySelector(".hud-nav__active"); const a = document.querySelector('.hud-nav__link[data-section="work"]'); return { on: b.dataset.on, x: Math.round(Number(b.dataset.x)), w: Math.round(Number(b.dataset.w)), linkX: a.offsetLeft, linkW: a.offsetWidth, current: a.getAttribute("aria-current") }; });
  check("…the one shared indicator sits under the section you're in", bar.on === "on" && Math.abs(bar.x - bar.linkX) <= 1 && Math.abs(bar.w - bar.linkW) <= 1 && bar.current === "location", bar);
  // front panel: TUBE (POWER CYCLE), GRID, GFX, SND + its VU meter
  await page.click('.fp-pos:has(input[value="amber"])');
  await page.waitForTimeout(900);
  const tube = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, last: window.__retrograde.fx.lastPlay }));
  await page.click('.fp-pos:has(input[value="phosphor"])');
  await page.waitForTimeout(900);
  await page.keyboard.press("g");
  const gridOn = await page.evaluate(() => document.querySelectorAll(".grid-overlay__col").length);
  await page.keyboard.press("g");
  await page.click('.fp-switch:has-text("Gfx")');
  await page.waitForTimeout(300);
  const gfx = await page.evaluate(() => ({ tier: window.__retrograde.governor.snapshot.tier, pressed: [...document.querySelectorAll(".fp-switch")].map((b) => b.getAttribute("aria-pressed")) }));
  await page.click('.fp-switch:has-text("Gfx")');
  await page.click('.fp-switch:has-text("Snd")');
  await page.waitForTimeout(250);
  const vu = await page.evaluate(() => new Promise((res) => { let max = 0; const t0 = performance.now(); const id = setInterval(() => { max = Math.max(max, Number(document.querySelector(".fp-vu").dataset.lit)); if (performance.now() - t0 > 700) { clearInterval(id); res(max); } }, 20); }));
  const snd = await page.evaluate(async () => ({ state: (await window.__retrograde.audio()).existingEngine()?.ctx.state, enable: window.__retrograde.cues.played.get("ENABLE") ?? 0, commit: window.__retrograde.cues.played.get("COMMIT") ?? 0 }));
  check("front panel: TUBE switches by POWER CYCLE, G toggles the grid, GFX forces LOW", tube.theme === "amber" && tube.last?.effect === "power" && gridOn === 12 && gfx.tier === "LOW", { tube, gridCols: gridOn, gfx });
  check("…SND ON starts the engine; the 4-LED meter reads the real output (ENABLE lit it)", snd.state === "running" && snd.enable >= 1 && vu >= 1, { ...snd, vuMaxLit: vu });
  // cursor: snaps to a control as brackets, hides in text fields, absent on touch
  await page.mouse.move(10, 10);
  const btn = await page.evaluate(() => { const r = document.querySelector(".fp-switch").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
  await page.mouse.move(btn.x, btn.y);
  await page.waitForTimeout(500);
  const cursor = await page.evaluate(() => { const r = document.querySelector(".cursor__ring").getBoundingClientRect(); const d = document.querySelector(".cursor__dot").getBoundingClientRect(); return { ring: { w: Math.round(r.width), h: Math.round(r.height) }, dot: { x: Math.round(d.left + d.width / 2), y: Math.round(d.top + d.height / 2) }, hidden: getComputedStyle(document.querySelector(".cursor__dot")).visibility !== "visible", flag: document.documentElement.dataset.reticle ?? null, native: getComputedStyle(document.body).cursor }; });
  // drawn, read from the computed style (Part 16: this read a data-hidden attribute while the stylesheet's
  // gate read a flag nothing set — it passed for eleven parts with no reticle on screen)
  check("cursor: the hotspot is unlagged; the ring snaps to a control as brackets (+4 px a side); drawn as the native cursor hides", Math.abs(cursor.dot.x - btn.x) <= 1 && Math.abs(cursor.dot.y - btn.y) <= 1 && Math.abs(cursor.ring.w - (btn.w + 8)) <= 2 && !cursor.hidden && cursor.flag === "on" && cursor.native === "none", { cursor, btn });
  // fx-css: device-snapped pitch, grain on, roll by tier, gone under prefers-contrast: more
  const fx = await page.evaluate(() => ({ pitch: getComputedStyle(document.querySelector(".fx-scan")).getPropertyValue("--scan-pitch"), line: getComputedStyle(document.querySelector(".fx-scan")).getPropertyValue("--scan-line"), onRoot: getComputedStyle(document.documentElement).getPropertyValue("--scan-pitch") === "", grain: document.getElementById("fx-css").hasAttribute("data-grain"), scanAlpha: getComputedStyle(document.querySelector(".fx-scan")).opacity }));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-contrast", value: "more" }] });
  const contrast = await page.evaluate(() => getComputedStyle(document.getElementById("fx-css")).display);
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  check("#fx-css: pitch 3 CSS px at 2× (6 device px, line 2), set on #fx-css (not html), grain on, α 0.07; off under prefers-contrast: more", fx.pitch.trim() === "3px" && fx.line.trim() === "1px" && fx.onRoot && fx.grain && fx.scanAlpha === "0.07" && contrast === "none", { ...fx, contrastMore: contrast });
  check("…console clean", logs.length === 0, logs.slice(0, 4));
  report.runs.chrome = { hud, bar, tube, gfx, snd, vu, cursor, fx, contrast };
  await ctx.close();
}
{
  // coarse pointers get no custom cursor; the panel narrows to TUBE + SND on a phone
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#identity`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  const phone = await page.evaluate(() => ({ cursor: getComputedStyle(document.getElementById("cursor")).display, reticle: document.documentElement.dataset.reticle ?? null, panel: [...document.querySelectorAll(".front-panel > *")].filter((e) => getComputedStyle(e).display !== "none").length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop }));
  check("phone: no custom cursor on a coarse pointer; panel = TUBE + SND; no overflow", phone.cursor === "none" && phone.reticle === null && phone.panel === 2 && phone.overflow <= 0, phone);
  await page.screenshot({ path: `${OUT}boot-gate-phone.png` });
  await ctx.close();
}

await browser.close();
const failed = report.checks.filter((c) => !c.pass);
report.summary = { checks: report.checks.length, passed: report.checks.length - failed.length, failed: failed.map((c) => c.name) };
writeFileSync(`${OUT}boot-gate.json`, JSON.stringify(report, null, 2));
console.log(`\n${report.summary.passed}/${report.summary.checks} checks pass${failed.length ? ` — FAILED: ${failed.map((c) => c.name).join(" | ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
