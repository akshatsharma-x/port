#!/usr/bin/env node
/**
 * The Part 4 gate (PROMPTS.md Part 4): the scroll engine and the transition grammar, driven in the
 * installed Chrome through window.__retrograde (?debug=1, components/stage/DebugOverlay.tsx).
 *
 *   BASE_URL=http://localhost:3200 node scripts/scroll-gate.mjs
 *
 * Viewports: 1440×900 @2x, 1920×1080 @1x, 390×844 @3x (touch) — interlock, pins, overflow, CLS.
 * Desktop scenarios: keyboard keys, continuous scroll side effects, rail click → TRACKING TEAR,
 * back/forward restoration, a route tear, soft detents, POWER CYCLE (theme, SCAN, off/on), and
 * DITHER RESOLVE on /dev/kitchen-sink. Then the reduced-motion edition. Every check prints
 * PASS/FAIL with its numbers; the full record lands in .artifacts/scroll-gate.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const probeHtml = await (await fetch(BASE + "/")).text();
if (!probeHtml.includes("retrograde:ui")) {
  console.error(`${BASE} is not serving RETROGRADE — set BASE_URL.`);
  process.exit(2);
}

const VIEWPORTS = [
  { name: "1440x900", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { name: "1920x1080", viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  {
    name: "390x844",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
];
const SECTIONS = ["system", "identity", "log", "archive", "work", "capabilities", "credentials", "connect", "halt"];
const PINS = { system: 100, log: 200, archive: 150 };
const GLYPHS = "▖▗▘▙▚▛▜▝▞▟░▒▓#%&*+=<>/\\";

const report = { base: BASE, at: new Date().toISOString(), checks: [], viewports: {}, scenarios: {} };
function check(name, pass, detail) {
  report.checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

/** CLS from the first paint (layout shifts without recent input), recorded before any script runs. */
const CLS_INIT = () => {
  window.__cls = { value: 0, shifts: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      const nodes = (e.sources ?? []).map((s) => s.node).filter(Boolean);
      const el = (n) => (n.nodeType === 3 ? n.parentElement : n);
      // the ?debug=1 overlay is a dev tool, not the product: its own text reflows are not counted
      if (nodes.length && nodes.every((n) => el(n)?.closest?.(".stage-debug"))) continue;
      window.__cls.value += e.value;
      window.__cls.shifts.push({ value: Math.round(e.value * 1e5) / 1e5, at: Math.round(e.startTime), sources: nodes.map((n) => { const x = el(n); return `${n.nodeType === 3 ? "#text<" : ""}${x?.tagName?.toLowerCase()}.${String(x?.className ?? "").split(" ")[0]}`; }) });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

const IGNORED_CONSOLE = [
  /Download the React DevTools/,
  /\[HMR\]/,
  /\[Fast Refresh\]/,
  // next dev only: the kitchen sink's test card becomes the LCP because the gate scrolls programmatically
  // (a real scroll is input, which ends LCP); it's below the fold, so `loading="eager"` would be wrong
  /was detected as the Largest Contentful Paint/,
];
function watchConsole(page, sink) {
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const text = m.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    sink.push(`[${m.type()}] ${text.slice(0, 400)}`);
  });
  page.on("pageerror", (e) => sink.push(`[pageerror] ${e.message.slice(0, 400)}`));
}

async function open(page, path = "/") {
  const sep = path.includes("?") ? "&" : "?";
  await page.goto(`${BASE}${path}${sep}debug=1`, { waitUntil: "load", timeout: 120_000 });
  await page.waitForFunction(() => window.__retrograde?.scroll, null, { timeout: 120_000, polling: 50 });
  await page.evaluate(() => document.fonts.ready);
}

async function openHome(page) {
  await open(page, "/");
  await page.waitForFunction(
    (n) => {
      const R = window.__retrograde;
      const reduced = document.documentElement.dataset.motion === "reduce";
      return R.scroll.store.getState().tracked.length === n && (reduced || document.querySelectorAll("[data-pin-length]").length === 3);
    },
    SECTIONS.length,
    { timeout: 30_000, polling: 50 },
  );
  await page.waitForTimeout(600);
}

/** Waits until no jump is under way and fx-gl is idle. */
const settled = (page, extra = 150) =>
  page
    .waitForFunction(() => !window.__retrograde.scroll.store.getState().jumping && !window.__retrograde.fx.busy, null, { timeout: 10_000, polling: 16 })
    .then(() => page.waitForTimeout(extra));

const jumpTo = (page, y) =>
  page.evaluate((target) => {
    const lenis = window.__retrograde.lenis();
    if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
    else window.scrollTo(0, target);
  }, y);

const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));
const sectionTop = (page, id) =>
  page.evaluate((x) => {
    // where a jump lands: the element's document top, below the chrome's top band (scroll-padding-top)
    const el = document.getElementById(x);
    const pad = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - pad));
  }, id);

const census = (page) =>
  page.evaluate(() => {
    const R = window.__retrograde;
    return { multi: R.census.multiContextFrames, fxFrames: R.census.framesWithFx, stageFrames: R.census.framesWithStage, fx: R.fx.frames, frozen: R.governor.stats.framesFrozen, funnel: R.funnel().frames, native: R.funnel().native };
  });

// ── 1 · interlock, pins, overflow and CLS at three viewports ────────────────────────────────
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch, userAgent: vp.userAgent });
  await ctx.addInitScript(CLS_INIT);
  const page = await ctx.newPage();
  const logs = [];
  watchConsole(page, logs);
  await openHome(page);
  const r = await page.evaluate(() => {
    const R = window.__retrograde;
    const svh = document.querySelector(".stage-probe--svh").offsetHeight;
    return {
      svh,
      tier: R.governor.snapshot.tier,
      gaps: R.governor.gaps(),
      interlockWarnings: R.governor.snapshot.interlock,
      pins: [...document.querySelectorAll("[data-pin]")].map((el) => ({ id: el.dataset.pin, svh: Math.round((Number(el.dataset.pinLength) / svh) * 1000) / 10 })),
      heightSvh: Math.round((document.documentElement.scrollHeight / svh) * 10) / 10,
      overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      slots: document.querySelectorAll("[data-stage-slot]").length,
      // a stage-less edition takes its slot out of the layout (CAPABILITIES on a phone): no stage docks there, no interlock is owed
      laidOut: [...document.querySelectorAll("[data-stage-slot]")].filter((el) => el.getBoundingClientRect().height > 0).length,
      posters: document.querySelectorAll(".stage-poster").length,
    };
  });
  // a full continuous pass down and back, so CLS covers every pin's start and end
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const lenis = window.__retrograde.lenis();
        const max = document.documentElement.scrollHeight - innerHeight;
        if (!lenis) {
          window.scrollTo(0, max);
          setTimeout(() => {
            window.scrollTo(0, 0);
            setTimeout(resolve, 300);
          }, 300);
          return;
        }
        lenis.scrollTo(max, { duration: 4, easing: (t) => t, force: true, onComplete: () => lenis.scrollTo(0, { duration: 2, easing: (t) => t, force: true, onComplete: () => setTimeout(resolve, 300) }) });
      }),
  );
  await page.waitForTimeout(400);
  const cls = await page.evaluate(() => window.__cls);
  report.viewports[vp.name] = { ...r, cls, console: logs };
  const min = Math.min(...r.gaps.map((g) => g.gapSvh));
  check(`interlock @ ${vp.name}: every gap between the ${r.laidOut} slots laid out ≥ 100 svh (min ${Math.round(min * 100)} svh)`, r.laidOut >= 4 && r.gaps.length === r.laidOut - 1 && r.gaps.every((g) => g.pass), r.gaps.map((g) => `${g.from}→${g.to} ${Math.round(g.gapSvh * 100)}svh`));
  check(`pins @ ${vp.name}: hero 100 · LOG 200 · ARCHIVE 150 svh, nothing else`, r.pins.length === 3 && r.pins.every((p) => Math.abs(p.svh - PINS[p.id]) <= 0.5), r.pins);
  check(`no horizontal overflow @ ${vp.name}`, r.overflowPx <= 0, { overflowPx: r.overflowPx });
  check(`CLS @ ${vp.name} (load + a full scroll down and up) = 0`, cls.value === 0, { cls: Math.round(cls.value * 1e5) / 1e5, shifts: cls.shifts.slice(0, 5) });
  check(`console clean @ ${vp.name}`, logs.length === 0, logs.slice(0, 5));
  await ctx.close();
}

// ── 2 · desktop scenarios ───────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const logs = [];
  watchConsole(page, logs);
  await openHome(page);

  // 2a · keyboard: native keys move the real scroll position, and Lenis agrees with it
  {
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    const keys = {};
    const press = async (key) => {
      const before = await scrollY(page);
      await page.keyboard.press(key);
      await page.waitForTimeout(700);
      const after = await page.evaluate(() => ({ y: Math.round(window.scrollY), lenis: Math.round(window.__retrograde.lenis()?.scroll ?? window.scrollY) }));
      keys[key] = { from: before, to: after.y, lenis: after.lenis };
      return after;
    };
    await jumpTo(page, 0);
    await page.waitForTimeout(300);
    const vh = await page.evaluate(() => innerHeight);
    await press("PageDown");
    await press("Space");
    await press("ArrowDown");
    await press("PageUp");
    const end = await press("End");
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await press("Home");
    report.scenarios.keyboard = keys;
    check("PageDown scrolls ≈ a viewport", keys.PageDown.to - keys.PageDown.from > vh * 0.6, keys.PageDown);
    check("Space scrolls ≈ a viewport", keys.Space.to - keys.Space.from > vh * 0.6, keys.Space);
    check("ArrowDown scrolls a line", keys.ArrowDown.to > keys.ArrowDown.from, keys.ArrowDown);
    check("PageUp scrolls back", keys.PageUp.to < keys.PageUp.from, keys.PageUp);
    check("End reaches the bottom", Math.abs(end.y - max) <= 2, { y: end.y, max });
    check("Home returns to the top", keys.Home.to === 0, keys.Home);
    check("native truth: scrollY = Lenis's scroll after every key", Object.values(keys).every((k) => Math.abs(k.to - k.lenis) <= 1), Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, v.to - v.lenis])));
  }

  // 2b · continuous scroll: HUD label glitch only, SECTION cue ≥ 1.2 s apart, rail, shallow hash, no history
  {
    await jumpTo(page, 0);
    await page.waitForTimeout(800);
    const before = await census(page);
    const result = await page.evaluate(
      ({ glyphs }) =>
        new Promise((resolve) => {
          const R = window.__retrograde;
          const label = document.querySelector(".hud-readout__section");
          const rec = { changes: [], labels: [], hashes: [], historyBefore: history.length, cuesBefore: { played: R.cues.played.get("SECTION") ?? 0, limited: R.cues.limited.get("SECTION") ?? 0 } };
          const unsub = R.scroll.store.subscribe((s, p) => {
            if (s.seq === p.seq) return;
            rec.changes.push({ section: s.section, cause: s.cause, t: Math.round(performance.now()) });
            queueMicrotask(() => rec.hashes.push(location.hash));
          });
          const mo = new MutationObserver(() => rec.labels.push(label.textContent));
          mo.observe(label, { childList: true, characterData: true, subtree: true });
          const lenis = R.lenis();
          const max = document.documentElement.scrollHeight - innerHeight;
          lenis.scrollTo(max, {
            duration: 14,
            easing: (t) => t,
            force: true,
            onComplete: () =>
              setTimeout(() => {
                unsub();
                mo.disconnect();
                rec.historyAfter = history.length;
                rec.cuesAfter = { played: R.cues.played.get("SECTION") ?? 0, limited: R.cues.limited.get("SECTION") ?? 0 };
                rec.glitchFrames = rec.labels.filter((l) => [...l].some((ch) => glyphs.includes(ch))).length;
                rec.finalLabel = label.textContent;
                rec.rail = [...document.querySelectorAll(".section-rail__link")].map((a) => ({ href: a.getAttribute("href"), state: a.dataset.state, current: a.getAttribute("aria-current") }));
                rec.hash = location.hash;
                resolve(rec);
              }, 1500),
          });
        }),
      { glyphs: GLYPHS },
    );
    const after = await census(page);
    report.scenarios.continuous = { ...result, labels: result.labels.slice(0, 40), census: { before, after } };
    const order = result.changes.map((c) => c.section);
    const gaps = result.changes.slice(1).map((c, i) => c.t - (result.changes[i]?.t ?? 0));
    check("continuous scroll visits every section in order", SECTIONS.slice(1).every((id, i) => order.indexOf(id) >= 0 && (i === 0 || order.indexOf(id) > order.indexOf(SECTIONS[i]))), order);
    check("…every change has cause 'scroll'", result.changes.every((c) => c.cause === "scroll"), [...new Set(result.changes.map((c) => c.cause))]);
    check("…the HUD section label glitches (stepped glyph frames) and lands on 09 HALT", result.glitchFrames > 0 && result.finalLabel === "09 HALT", { glitchFrames: result.glitchFrames, final: result.finalLabel });
    check("…no full-screen effect: fx-gl drew nothing", after.fx === before.fx && after.fxFrames === before.fxFrames, { fxFramesDelta: after.fx - before.fx });
    const played = result.cuesAfter.played - result.cuesBefore.played;
    const limited = result.cuesAfter.limited - result.cuesBefore.limited;
    check("…SECTION cue rate-limited to ≥ 1.2 s apart", played >= 1 && played <= Math.ceil(14 / 1.2) + 1 && played + limited === result.changes.length, { played, limited, changes: result.changes.length, sectionGapsMs: gaps });
    check("…the shallow hash follows (replaceState) without adding history entries", result.historyAfter === result.historyBefore && result.hash === "#halt" && result.hashes.includes("#archive"), { history: [result.historyBefore, result.historyAfter], hashes: result.hashes });
    check("…the rail: current = HALT, every other node visited", result.rail.length === 9 && result.rail.at(-1).current === "location" && result.rail.slice(0, -1).every((n) => n.state === "visited"), result.rail.map((n) => n.state));
    check("one RAF: one native frame per funnel frame", after.native - before.native <= after.funnel - before.funnel + 2, { native: after.native - before.native, funnel: after.funnel - before.funnel });
  }

  // 2c · rail click → TRACKING TEAR, history entry, teleport at the cut; then Back / Forward
  {
    const identityTop = await sectionTop(page, "identity");
    const y0 = identityTop + 400;
    await jumpTo(page, y0);
    await page.waitForTimeout(900); // the debounced position save
    const before = await census(page);
    const hist0 = await page.evaluate(() => history.length);
    await page.evaluate(() => {
      window.__tear = { samples: [] };
      const t0 = performance.now();
      const id = setInterval(() => {
        window.__tear.samples.push({ t: Math.round(performance.now() - t0), y: Math.round(scrollY) });
        if (performance.now() - t0 > 900) clearInterval(id);
      }, 4);
    });
    await page.click('.section-rail__link[href="#archive"]');
    await settled(page, 400);
    const after = await census(page);
    const t = await page.evaluate(() => ({
      hash: location.hash,
      history: history.length,
      routerOwned: !!history.state?.__NA,
      y: Math.round(scrollY),
      last: window.__retrograde.fx.lastPlay,
      section: window.__retrograde.scroll.store.getState(),
      samples: window.__tear.samples,
    }));
    const archiveTop = await sectionTop(page, "archive");
    const cut = t.samples.find((s) => Math.abs(s.y - y0) > 50);
    report.scenarios.railTear = { y0, archiveTop, ...t, samples: undefined, cutAtMs: cut?.t ?? null, census: { before, after } };
    check("rail click → TRACKING TEAR on fx-gl", t.last?.effect === "tear" && t.last.frames > 10, t.last);
    check("…the teleport happens under cover, at the cut (~180 ms after the click)", cut && cut.t >= 120 && cut.t <= 330, { cutAtMs: cut?.t });
    check("…lands on #archive", Math.abs(t.y - archiveTop) <= 2, { y: t.y, archiveTop });
    check("…pushes one history entry the router owns", t.history === hist0 + 1 && t.hash === "#archive" && t.routerOwned, { history: [hist0, t.history], hash: t.hash, __NA: t.routerOwned });
    check("…exactly one context draws per frame (the stage freezes under the tear)", after.multi === before.multi && after.frozen > before.frozen, { multiContextFrames: after.multi - before.multi, frozen: after.frozen - before.frozen });
    check("…the landing section changes with cause 'jump'", t.section.section === "archive" && t.section.cause === "jump", { section: t.section.section, cause: t.section.cause });

    await page.goBack();
    await settled(page, 500);
    const back = await page.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash, last: window.__retrograde.fx.lastPlay }));
    check("Back: the page and the scroll position both come back", Math.abs(back.y - y0) <= 2 && back.hash !== "#archive", { y: back.y, expected: y0, hash: back.hash });
    check("…under a tear that enters at its cut", back.last?.effect === "tear", back.last);
    await page.goForward();
    await settled(page, 500);
    const fwd = await page.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
    check("Forward: lands back on #archive", Math.abs(fwd.y - archiveTop) <= 2 && fwd.hash === "#archive", { y: fwd.y, expected: archiveTop, hash: fwd.hash });
    report.scenarios.history = { back, fwd };
    // the tear's picture, on its own untimed jump (a capture mid-tear stalls the frames it times)
    await page.click('.section-rail__link[href="#work"]');
    await page.waitForTimeout(110);
    await page.screenshot({ path: `${OUT}p4-tear-mid.png` });
    await settled(page, 300);
  }

  // 2d · a route with no shared element: tear, push at the cut, hold until it commits; Back restores
  {
    await jumpTo(page, 300);
    await page.waitForTimeout(900);
    await page.evaluate(() => (window.__sameDocument = true));
    // the home page has no route link of its own yet (the hero's CTAs are hashes and a new tab; the
    // case studies bring them): the rules are document-level, so a plain <a> added here is a real one
    await page.evaluate(() => {
      const a = Object.assign(document.createElement("a"), { id: "gate-route", href: "/dev/kitchen-sink", textContent: "route" });
      a.style.cssText = "position:fixed;left:50%;top:40%;z-index:2147483647;padding:12px";
      document.body.append(a);
    });
    const t0 = Date.now();
    await page.click("#gate-route");
    await page.waitForURL("**/dev/kitchen-sink**", { timeout: 30_000, waitUntil: "commit" });
    const urlAt = Date.now() - t0;
    await settled(page, 500);
    const there = await page.evaluate(() => ({ y: Math.round(scrollY), path: location.pathname, same: window.__sameDocument === true, last: window.__retrograde.fx.lastPlay }));
    await page.evaluate(() => document.getElementById("gate-route")?.remove());
    check("route link → TRACKING TEAR, soft navigation (no reload)", there.path === "/dev/kitchen-sink" && there.same && there.last?.effect === "tear", there);
    check("…the URL changes at the cut, not on click", urlAt >= 150, { urlChangedAfterMs: urlAt });
    check("…the new route starts at the top", there.y === 0, { y: there.y });
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
    await settled(page, 900);
    const home = await page.evaluate(() => ({ y: Math.round(scrollY), same: window.__sameDocument === true, pins: document.querySelectorAll("[data-pin-length]").length }));
    check("Back across routes: home again, scroll restored, pins re-measured", Math.abs(home.y - 300) <= 2 && home.same && home.pins === 3, home);
    report.scenarios.route = { urlAt, there, home };
  }

  // 2e · StickyStack steps + soft detents inside the LOG pin
  {
    const pin = await page.evaluate(() => {
      const el = document.querySelector('[data-pin="log"]');
      return { start: Number(el.dataset.pinStart), length: Number(el.dataset.pinLength), steps: el.querySelectorAll("[data-frame]").length };
    });
    const node = (k) => Math.round(pin.start + (k / (pin.steps - 1)) * pin.length);
    const near = Math.round(node(1) + 0.04 * pin.length);
    await jumpTo(page, near);
    await page.waitForTimeout(2600);
    const snapped = await scrollY(page);
    const step = await page.evaluate(() => document.querySelector('[data-pin="log"]').dataset.step);
    const far = Math.round(node(1) + 0.125 * pin.length);
    await jumpTo(page, far);
    await page.waitForTimeout(2600);
    const free = await scrollY(page);
    await jumpTo(page, Math.round(node(2)));
    // the frame's wipe is --dur-element (400 ms) from the frame the step lands on: wait it out, with slack
    await page.waitForTimeout(700);
    const frames = await page.evaluate(() => {
      const el = document.querySelector('[data-pin="log"]');
      return { step: el.dataset.step, active: [...el.querySelectorAll("[data-frame]")].findIndex((f) => f.hasAttribute("data-active")), clip: [...el.querySelectorAll("[data-frame]")].map((f) => getComputedStyle(f).clipPath) };
    });
    report.scenarios.detents = { pin, near, snapped, node1: node(1), far, free, step, frames };
    check("soft detent: 4% from a node, idle → eases onto the node", Math.abs(snapped - node(1)) <= 2, { from: near, to: snapped, node: node(1) });
    check("…12.5% away → left alone", Math.abs(free - far) <= 2, { at: far, now: free });
    check("StickyStack: discrete steps — one frame active, the rest clipped", frames.step === "2" && frames.active === 2 && frames.clip.filter((c) => c === "none" || c === "inset(0px)").length === 1, frames);
    // keyboard focus landing in an inactive (clipped) frame scrolls to that frame's node: the last
    // frame (the content sets how many there are; it must not be node 2's, the active one)
    const last = pin.steps - 1;
    const focus = await page.evaluate(async (last) => {
      const stack = document.querySelector('[data-pin="log"]');
      const target = stack.querySelector(`[data-frame="${last}"] h3`);
      target.tabIndex = -1;
      target.focus();
      await new Promise((r) => setTimeout(r, 900));
      return { step: stack.dataset.step, active: target.closest("[data-frame]").hasAttribute("data-active"), focused: document.activeElement === target };
    }, last);
    check("…focus inside an inactive frame scrolls to its node (focus is never invisible)", last > 2 && focus.step === String(last) && focus.active && focus.focused, { last, ...focus });
  }

  // 2f · POWER CYCLE: the theme switch inside a View Transition, the Paper SCAN, off → key → on
  {
    await jumpTo(page, 0);
    // let the hero's scene finish re-warming after the jump (a compile in flight delays any frame)
    await page.waitForFunction(() => { const s = window.__retrograde.governor.snapshot; return s.scenes.system.state === "LIVE" && s.scenes.system.drawable && !Object.values(s.scenes).some((v) => v.state === "PRIMED"); }, null, { timeout: 10_000, polling: 50 });
    await page.waitForTimeout(600);
    const vt = await page.evaluate(() => typeof document.startViewTransition === "function");
    // the screenshots get their own, untimed switch: a full-page capture mid-transition stalls frames
    const shot = page.evaluate(() => window.__retrograde.transitions.switchTheme("amber"));
    await page.waitForTimeout(140);
    await page.screenshot({ path: `${OUT}p4-power-off-fast.png` });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}p4-power-on-fast.png` });
    await shot;
    await page.evaluate(() => window.__retrograde.transitions.switchTheme("phosphor"));
    await page.waitForTimeout(500);
    const timing = page.evaluate(async () => {
      const t0 = performance.now();
      await window.__retrograde.transitions.switchTheme("amber");
      const ms = Math.round(performance.now() - t0);
      while (window.__retrograde.fx.busy) await new Promise((r) => setTimeout(r, 8)); // the beam may outlive the View Transition by a frame
      return { ms, theme: document.documentElement.dataset.theme, last: window.__retrograde.fx.lastPlay };
    });
    const amber = await timing;
    check("theme switch: OFF-fast → swap → ON-fast in a View Transition (≈ 600 ms)", vt && amber.theme === "amber" && amber.ms >= 550 && amber.ms <= 900 && amber.last?.effect === "power", { vt, ...amber });
    const paperRun = page.evaluate(async () => {
      const t0 = performance.now();
      await window.__retrograde.transitions.switchTheme("paper");
      const ms = Math.round(performance.now() - t0);
      while (window.__retrograde.fx.busy) await new Promise((r) => setTimeout(r, 8));
      return { ms, theme: document.documentElement.dataset.theme, last: window.__retrograde.fx.lastPlay };
    });
    const paper = await paperRun;
    // and the SCAN's picture, untimed
    await page.evaluate(() => window.__retrograde.transitions.switchTheme("amber"));
    await page.waitForTimeout(400);
    const scanShot = page.evaluate(() => window.__retrograde.transitions.switchTheme("paper"));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}p4-paper-scan.png` });
    await scanShot;
    check("into Paper: the SCAN (600 ms)", paper.theme === "paper" && paper.ms >= 550 && paper.ms <= 900 && paper.last?.effect === "scan", paper);
    await page.evaluate(() => window.__retrograde.transitions.switchTheme("phosphor"));
    await page.waitForTimeout(300);
    const off = await page.evaluate(async () => {
      const t0 = performance.now();
      await window.__retrograde.transitions.powerOff();
      return { ms: Math.round(performance.now() - t0), tube: document.documentElement.dataset.tube ?? null };
    });
    await page.screenshot({ path: `${OUT}p4-tube-off.png` });
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(700);
    const on = await page.evaluate(() => ({ tube: document.documentElement.dataset.tube ?? null, theme: document.documentElement.dataset.theme }));
    check("POWER OFF (450 ms) leaves the tube off; any key turns it back on — never a trap", off.tube === "off" && off.ms >= 420 && off.ms <= 800 && on.tube === null, { off, on });
    report.scenarios.power = { vt, amber, paper, off, on };
  }

  // 2g · DITHER RESOLVE (element tier) on /dev/kitchen-sink: 17 mask frames over 400 ms, then no mask
  {
    await page.goto(`${BASE}/dev/kitchen-sink?debug=1`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__retrograde?.scroll, null, { timeout: 60_000 });
    const sampleResolve = async (trigger) => {
      await page.evaluate(() => {
        const root = document.querySelector("[data-demo=dither] .dither");
        const hi = root.querySelector(".dither__hi");
        window.__dither = { states: [], masks: [], dots: [], t0: 0, t1: 0, timing: null };
        const sample = () => {
          const d = window.__dither;
          const s = root.dataset.state;
          const cs = getComputedStyle(hi);
          if (d.states.at(-1) !== s) d.states.push(s);
          if (s === "resolving") {
            d.t0 ||= performance.now();
            const a = hi.getAnimations()[0];
            if (a && !d.timing) {
              const t = a.effect.getTiming();
              d.timing = { duration: t.duration, easing: t.easing, frames: a.effect.getKeyframes().length };
              d.frameW = Number(String(cs.maskSize || cs.webkitMaskSize).split("px")[0]) / 17;
              d.period = parseFloat(hi.style.getPropertyValue("--dither-period")) || null;
            }
            const m = cs.maskPosition || cs.webkitMaskPosition;
            if (m && m !== "none" && d.masks.at(-1) !== m) d.masks.push(m);
            const r = cs.getPropertyValue("--dot-r").trim();
            if (r && d.dots.at(-1) !== r) d.dots.push(r);
          }
          if (s === "hi" && d.t0 && !d.t1) {
            d.t1 = performance.now();
            d.finalMask = cs.maskImage || cs.webkitMaskImage;
            d.mode = root.dataset.mode;
            return;
          }
          // measurement inside the page, sampled once per frame: it rides the head funnel like any caller
          // eslint-disable-next-line no-restricted-globals
          if (performance.now() - (d.start ??= performance.now()) < 4000) requestAnimationFrame(sample);
        };
        // eslint-disable-next-line no-restricted-globals
        requestAnimationFrame(sample);
      });
      await trigger();
      await page.waitForFunction(() => window.__dither.t1 > 0, null, { timeout: 8000 });
      return page.evaluate(() => {
        const d = window.__dither;
        // stepped, never interpolated: every sampled offset is a whole number of sprite frames
        const offsets = d.masks.map((m) => -parseFloat(m));
        const frames = d.frameW ? offsets.map((o) => o / d.frameW) : [];
        const radii = d.dots.map((r) => parseFloat(r));
        return { ...d, ms: Math.round(d.t1 - d.t0), frameIndices: frames.map((f) => Math.round(f * 1000) / 1000), wholeFrames: frames.every((f) => Math.abs(f - Math.round(f)) < 0.01), radii };
      });
    };
    // the sampler goes in first: the arrival (scrolling the lazy image into view) is the trigger
    const first = await sampleResolve(async () => {
      await page.evaluate(() => document.querySelector("[data-demo=dither]").scrollIntoView({ block: "center" }));
    });
    const box = await page.evaluate(() => {
      const r = document.querySelector("[data-demo=dither]").getBoundingClientRect();
      return { x: r.left + r.width * 0.25, y: r.top + r.height * 0.3 };
    });
    // Chrome reports steps(16, end) as its canonical "steps(16)"; the last sample is the reset as the mask is removed
    const STEPS16 = /^steps\(16(, ?(end|jump-end))?\)$/;
    const stepped = (d) => STEPS16.test(d.timing?.easing ?? "") && d.timing.duration === 400 && d.wholeFrames && d.masks.length >= 8 && Math.max(...d.frameIndices) >= 14 && d.frameIndices.slice(0, -1).every((f, i, a) => i === 0 || f >= a[i - 1]);
    check("DITHER RESOLVE on arrival: lo → resolving → hi", first.states.join(">").endsWith("resolving>hi"), first.states);
    check("…steps(16) over 400 ms through the 17-frame sprite (every sampled offset a whole frame), then the mask is removed", stepped(first) && first.ms >= 360 && first.ms <= 520 && (first.finalMask === "none" || first.finalMask === ""), { timing: first.timing, sampled: first.frameIndices, ms: first.ms, finalMask: first.finalMask });
    const clipOf = () => page.evaluate(() => { const r = document.querySelector("[data-demo=dither]").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const again = await sampleResolve(async () => {
      await page.mouse.move(box.x, box.y);
      // the HUD's front panel sits over the bottom-left band: bring the button clear of it first
      await page.evaluate(() => document.querySelector("[data-demo=dither] + div button").scrollIntoView({ block: "center" }));
      await page.waitForTimeout(900); // the scroll reveals new content: let its reveals finish first
      await page.click("[data-demo=dither] + div button");
    });
    // the mid-resolve picture, on an untimed replay (a capture mid-animation stalls frames)
    await page.waitForTimeout(300);
    await page.click("[data-demo=dither] + div button");
    await page.waitForTimeout(190);
    await page.screenshot({ path: `${OUT}p4-dither-mid.png`, clip: await clipOf() });
    await page.waitForTimeout(500);
    check("…replays on resolveKey (the index preview / dossier case)", stepped(again) && again.ms <= 520, { sampled: again.frameIndices, ms: again.ms });
    await page.evaluate(() => window.__retrograde.transitions.switchTheme("paper"));
    await page.waitForTimeout(400);
    const half = await sampleResolve(async () => {
      await page.evaluate(() => document.querySelector("[data-demo=dither] + div button").scrollIntoView({ block: "center" }));
      await page.waitForTimeout(900);
      await page.click("[data-demo=dither] + div button");
    });
    await page.waitForTimeout(300);
    await page.click("[data-demo=dither] + div button");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}p4-halftone-mid.png`, clip: await clipOf() });
    await page.waitForTimeout(500);
    const unit = half.period ? (half.period / 2 + 0.5) / 16 : 0; // lib/dither.ts halftoneFullRadius, in 16 steps
    check("Paper: HALFTONE — the dot radius grows in steps(16), never smoothly", half.mode === "halftone" && STEPS16.test(half.timing?.easing ?? "") && half.radii.length >= 8 && half.radii.every((r) => Math.abs(r / unit - Math.round(r / unit)) < 0.02) && half.ms <= 520, { mode: half.mode, timing: half.timing, radii: half.radii, ms: half.ms });
    await page.evaluate(() => window.__retrograde.transitions.switchTheme("phosphor"));
    await page.waitForTimeout(400);
    report.scenarios.dither = { first, again, half };

    // H-HOLD: at a tear's cut, single-line display type loses horizontal hold (wdth → 125) and
    // springs back on `overshoot`; nothing around it reflows
    const hh = await page.evaluate(async () => {
      const box = document.querySelector("[data-demo=hhold]");
      box.scrollIntoView({ block: "center" });
      await new Promise((r) => setTimeout(r, 300));
      const el = box.querySelector("[data-hhold]");
      const next = box.nextElementSibling;
      const before = { stretch: getComputedStyle(el).fontStretch, nextTop: next.getBoundingClientRect().top };
      const samples = [];
      const t0 = performance.now();
      box.querySelector("button").click();
      while (performance.now() - t0 < 1600) {
        await new Promise((r) => setTimeout(r, 8));
        samples.push({ t: Math.round(performance.now() - t0), wdth: el.style.getPropertyValue("--t-wdth") || null, nextTop: Math.round(next.getBoundingClientRect().top) });
      }
      const peaked = samples.find((x) => parseFloat(x.wdth) >= 124);
      const settled = samples.findLast((x) => x.wdth !== null);
      return { before, peakAtMs: peaked?.t ?? null, lastWdthAtMs: settled?.t ?? null, after: getComputedStyle(el).fontStretch, inline: el.style.getPropertyValue("--t-wdth") || null, nextMoved: samples.some((x) => Math.abs(x.nextTop - Math.round(before.nextTop)) > 1) };
    });
    check("H-HOLD: wdth jumps to 125 at the tear's cut, springs back to its base, nothing reflows", hh.peakAtMs !== null && hh.peakAtMs >= 120 && hh.peakAtMs <= 400 && hh.inline === null && hh.after === hh.before.stretch && !hh.nextMoved, hh);
    report.scenarios.hhold = hh;
  }

  report.scenarios.desktopConsole = logs;
  check("console clean through every desktop scenario", logs.length === 0, logs.slice(0, 8));
  await ctx.close();
}

// ── 3 · the reduced-motion edition ──────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await ctx.addInitScript(CLS_INIT);
  const page = await ctx.newPage();
  const logs = [];
  watchConsole(page, logs);
  await openHome(page);
  const r = await page.evaluate(() => {
    const R = window.__retrograde;
    const frames = [...document.querySelectorAll(".sticky-stack__frame")];
    return {
      motion: document.documentElement.dataset.motion,
      lenis: !!R.lenis(),
      pinSpacers: document.querySelectorAll(".pin-spacer").length,
      pinned: document.querySelectorAll("[data-pin-length]").length,
      framesVisible: frames.filter((f) => getComputedStyle(f).clipPath === "none").length,
      frames: frames.length,
      contexts: R.contexts(),
      // the one canvas outside the two contexts is IDENTITY's portrait, Canvas2D (DESIGN.md §7.4)
      canvases: document.querySelectorAll("canvas:not(.portrait__dots)").length,
      scrambling: document.querySelectorAll(".scramble[data-running]").length,
    };
  });
  check("reduced motion: Lenis off, no pins, every StickyStack frame stacked and visible", r.motion === "reduce" && !r.lenis && r.pinSpacers === 0 && r.pinned === 0 && r.framesVisible === r.frames && r.frames > 0, r);
  check("…no WebGL context ever created (no canvas but the 2D portrait)", r.canvases === 0 && (r.contexts.created ?? 0) === 0 && (r.contexts.seen ?? 0) === 0, { canvases: r.canvases, contexts: r.contexts });
  const y0 = await page.evaluate(() => Math.round(document.getElementById("identity").getBoundingClientRect().top + scrollY + 300));
  await page.evaluate((y) => window.scrollTo(0, y), y0);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    window.__cover = { start: 0, end: 0, click: 0 };
    // timed from the click itself: Playwright's own actionability wait (two stable frames, slow under
    // a 30 fps battery cap) is the harness, not the tear (it read 662 ms at 14% battery, Part 8)
    document.addEventListener("click", () => (window.__cover.click = performance.now()), { capture: true, once: true });
    const mo = new MutationObserver(() => {
      const c = document.getElementById("fx-cover");
      if (c && !window.__cover.start) {
        window.__cover.start = performance.now();
        const poll = setInterval(() => {
          if (c.getAnimations().length === 0 && performance.now() - window.__cover.start > 20) {
            window.__cover.end = performance.now();
            clearInterval(poll);
          }
        }, 2);
      }
    });
    mo.observe(document.body, { childList: true });
    if (document.getElementById("fx-cover")) {
      window.__cover.reuse = true;
    }
  });
  const t0 = await page.evaluate(() => performance.now());
  await page.click('.section-rail__link[href="#archive"]');
  await page.waitForFunction(() => !window.__retrograde.scroll.store.getState().jumping, null, { timeout: 5000, polling: 4 });
  const jump = await page.evaluate((start) => {
    const from = window.__cover.click || start;
    return { ms: Math.round(performance.now() - from), clickAfter: Math.round(from - start), y: Math.round(scrollY), hash: location.hash };
  }, t0);
  const archiveTop = await sectionTop(page, "archive");
  check("…the tear is a 160 ms --bg cover/uncover; the jump still lands and pushes history", jump.ms >= 150 && jump.ms <= 320 && Math.abs(jump.y - archiveTop) <= 2 && jump.hash === "#archive", { ...jump, archiveTop });
  await page.goBack();
  await page.waitForFunction(() => !window.__retrograde.scroll.store.getState().jumping, null, { timeout: 5000, polling: 4 });
  await page.waitForTimeout(400);
  const backY = await scrollY(page);
  check("…Back restores the scroll position", Math.abs(backY - y0) <= 2, { y: backY, expected: y0 });
  const fade = await page.evaluate(async () => {
    const t = performance.now();
    await window.__retrograde.transitions.switchTheme("amber");
    const ms = Math.round(performance.now() - t);
    await window.__retrograde.transitions.switchTheme("phosphor");
    return { ms, contexts: window.__retrograde.contexts() };
  });
  check("…the theme switch is a 200 ms crossfade (no flash), still no context", fade.ms >= 180 && fade.ms <= 400 && (fade.contexts.created ?? 0) === 0, fade);
  check("…SCRAMBLE shows its final text", r.scrambling === 0, { running: r.scrambling });
  const cls = await page.evaluate(() => window.__cls);
  check("…CLS = 0", cls.value === 0, { cls: cls.value, shifts: cls.shifts.slice(0, 5) });
  check("…console clean", logs.length === 0, logs.slice(0, 5));
  report.scenarios.reduced = { ...r, jump, backY, y0, fade, cls, console: logs };
  await ctx.close();
}

await browser.close();
const failed = report.checks.filter((c) => !c.pass);
report.summary = { checks: report.checks.length, passed: report.checks.length - failed.length, failed: failed.map((c) => c.name) };
writeFileSync(`${OUT}scroll-gate.json`, JSON.stringify(report, null, 2));
console.log(`\n${report.summary.passed}/${report.summary.checks} checks pass${failed.length ? ` — FAILED: ${failed.map((c) => c.name).join(" | ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
