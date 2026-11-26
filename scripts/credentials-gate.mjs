#!/usr/bin/env node
/**
 * The gate for B1/B2 (PROMPTS.md Part 11): CREDENTIALS — Tier B, zero canvases — in the installed
 * Chrome, the pattern of scripts/capabilities-gate.mjs.
 *
 *   BASE_URL=http://localhost:3200 node scripts/credentials-gate.mjs      (a production build, RETROGRADE_DEV_ROUTES=1)
 *
 * Home, on the owner's real content (their credentials since v2.8): the wall and never a zero, RECORDS with
 * its true figures, the records' 6° tilt. The wall, on /dev/credentials/<state> (the fixture
 * persona's certificates): ID-1 geometry, the guilloche unique and stable, foil never under text,
 * the stamps' truth, the turn (click, Enter, Escape), the MRZ's check digits recomputed here, the
 * chips' FLIP, at most two live foils, will-change only while live, no filter on a moving card,
 * containment and 3D depth, the deal once from the bottom-right with its stamps' thuds; the
 * editions (reduced motion, the phone's TILT TO INSPECT, Paper, no JS) and every state (1, 40,
 * long, empty); CLS and a clean console. Report: .artifacts/credentials-gate.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const OUT = new URL("../.artifacts/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const ID1 = 85.6 / 53.98;
const REST = { mx: 0.62, my: 0.38 }; // lib/credentials.ts CRED.rest
const LIVE_MAX = 2; // CRED.liveFoil
const TILT = { card: 8, record: 6 }; // CRED.tilt
const LINGER_MS = 300; // CRED.willChangeLingerMs
const STAGGER_CAP_MS = 600; // lib/motion.ts stagger.capMs

const checks = [];
const report = { base: BASE, checks, measures: {} };
function check(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

/** ICAO 9303's 7-3-1 check digit, written again here so the gate doesn't trust lib/mrz.ts */
const digit = (s) => [...s].reduce((sum, c, i) => sum + (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55) * [7, 3, 1][i % 3], 0) % 10;

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

async function open(path, { viewport = { width: 1440, height: 900 }, dpr = 2, mobile = false, theme = "phosphor", reduced = false, js = true, debug = true, init = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference", javaScriptEnabled: js });
  await ctx.addInitScript(
    ({ theme }) => {
      sessionStorage.setItem("retrograde:booted", "1");
      localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
    },
    { theme },
  );
  await ctx.addInitScript(CLS_INIT);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !IGNORED.some((r) => r.test(m.text()))) logs.push(`${m.type()}: ${m.text()}`.slice(0, 240));
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 240)));
  ctx.on("requestfailed", (r) => logs.push(`requestfailed: ${r.failure()?.errorText ?? "?"} ${r.url()}`.slice(0, 240)));
  ctx.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()}: ${r.url()}`.slice(0, 240)));
  await page.goto(`${BASE}${path}${debug && js ? `${path.includes("?") ? "&" : "?"}debug=1` : ""}`, { waitUntil: "load" });
  if (js) await page.waitForTimeout(600);
  if (js && debug) await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
  return { ctx, page, logs };
}
/** the page's own scroll (Lenis where it runs) to an element */
const scrollTo = (page, sel, offset = 0) =>
  page.evaluate(
    ({ sel, offset }) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const y = el.getBoundingClientRect().top + scrollY + offset;
      const lenis = window.__retrograde?.lenis?.();
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      return true;
    },
    { sel, offset },
  );
const cues = (page) => page.evaluate(() => Object.fromEntries(window.__retrograde?.cues?.played ?? []));
/** the behaviour arrives on idle: wait for its marker */
const behaviour = (page) => page.waitForFunction(() => document.querySelector("[data-cred-root] .cred-back a[tabindex='-1'], .records") && (document.querySelector("[data-cred-root]") ? !!document.querySelector("[data-cred-root]").style.getPropertyValue("--turn-ms") : true), null, { timeout: 15_000 }).catch(() => null);

// ── 1 · home, the owner's content: their credentials since 2026-11-26 (v2.8) ──────────────
{
  const { ctx, page, logs } = await open("/#credentials");
  await scrollTo(page, "#credentials");
  await page.waitForTimeout(1200);
  const home = await page.evaluate(() => {
    const sec = document.querySelector("#credentials");
    // a Counter says its value twice (an sr-only copy and the animated digits): read the copy
    const said = (el) => el?.querySelector(".sr-only")?.textContent ?? el?.textContent ?? "";
    const lead = said(sec.querySelector(".records-lead__figure")).replace(/\D/g, "");
    const cards = [...sec.querySelectorAll(".cred")];
    return {
      wall: !!sec.querySelector(".cred-wall-wrap"),
      cards: cards.length,
      issuers: new Set(cards.map((c) => c.dataset.issuer)).size,
      active: cards.filter((c) => !c.hasAttribute("data-expired")).length,
      text: sec.innerText,
      strip: sec.querySelector(".section-strip__counts")?.textContent ?? null,
      records: [...sec.querySelectorAll(".record")].map((r) => ({ kind: r.dataset.kind, drawn: r.hasAttribute("data-drawn"), glyph: r.querySelector("use")?.getAttribute("href"), proof: !!r.querySelector(".record__proof") })),
      glyphsDefined: [...sec.querySelectorAll(".record use")].every((u) => !!document.querySelector(u.getAttribute("href"))),
      lead: Number(lead),
      tiles: [...sec.querySelectorAll(".records-tile")].map((t) => ({ label: t.querySelector("dt")?.textContent, value: said(t.querySelector(".records-tile__value")) })),
      press: !!sec.querySelector(".records-press"),
      transmissions: !!sec.querySelector(".transmissions"),
      canvases: sec.querySelectorAll("canvas").length,
    };
  });
  const kinds = home.records.reduce((m, r) => ({ ...m, [r.kind]: (m[r.kind] ?? 0) + 1 }), {});
  const many = (n, one, more) => `${n} ${n === 1 ? one : more}`;
  check("home: the owner's credentials on the wall (v2.8) — and no zero anywhere in the section", home.wall && home.cards > 0 && !/\b0 credentials?\b/i.test(home.text) && !/\b0\b/.test(home.strip ?? ""), { wall: home.wall, cards: home.cards, strip: home.strip });
  check(
    "home: the strip counts the credentials, their issuers, the active ones and the records, truly",
    home.strip?.toLowerCase() === [many(home.cards, "credential", "credentials"), many(home.issuers, "issuer", "issuers"), `${home.active} active`, many(home.records.length, "record", "records")].join(" · "),
    { strip: home.strip, cards: home.cards, issuers: home.issuers, active: home.active, records: home.records.length },
  );
  check(
    "home: RECORDS — one LED figure (every record) and three tiles, none a zero; the kind tiles count the cards",
    home.lead === home.records.length && home.tiles.length === 3 && home.tiles.every((t) => Number(String(t.value).replace(/\D/g, "")) > 0) && home.tiles.filter((t) => /honor/i.test(t.label ?? "")).every((t) => Number(t.value) === kinds.honor) && home.tiles.filter((t) => /award/i.test(t.label ?? "")).every((t) => Number(t.value) === kinds.award),
    { lead: home.lead, tiles: home.tiles, kinds },
  );
  check("home: record cards — bracketed, a kind glyph each (defined on the page), proof links only where there's proof; no empty press or transmissions", home.records.length > 0 && home.records.every((r) => r.drawn && r.glyph === `#rec-${r.kind}`) && home.glyphsDefined && !home.press && !home.transmissions && home.canvases === 0, home.records);
  // the records' tilt: at most 6° (below the wall since v2.8: brought into view first)
  await scrollTo(page, ".record", -240);
  await page.waitForTimeout(1500);
  const box = await page.locator(".record").first().boundingBox();
  for (let i = 0; i <= 10; i++) {
    await page.mouse.move(box.x + box.width * (0.5 + i * 0.04), box.y + box.height * 0.1);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(250);
  const tilt = await page.evaluate(() => {
    const r = document.querySelector(".record");
    return { rx: parseFloat(r.style.getPropertyValue("--cred-rx")), ry: parseFloat(r.style.getPropertyValue("--cred-ry")), live: r.hasAttribute("data-live"), will: r.style.willChange };
  });
  check("home: a record tilts to the pointer, at most 6° (B2), will-change only while live", tilt.live && Math.abs(tilt.ry) > 1 && Math.abs(tilt.ry) <= TILT.record + 1e-6 && Math.abs(tilt.rx) <= TILT.record + 1e-6 && tilt.will === "transform", tilt);
  check("home: CLS 0 and the console clean", (await page.evaluate(() => window.__cls)) < 0.001 && logs.length === 0, { cls: await page.evaluate(() => window.__cls), logs: logs.slice(0, 3) });
  await ctx.close();
}

// ── 2 · the wall: the fixture's twelve ──────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open("/dev/credentials/full");
  const armed = await page.evaluate(() => document.querySelector(".cred-wall")?.getAttribute("data-deal"));
  await behaviour(page);
  const armedAfter = await page.evaluate(() => document.querySelector(".cred-wall")?.getAttribute("data-deal"));
  const geo = await page.evaluate(() =>
    [...document.querySelectorAll(".cred")].map((li) => {
      const f = li.querySelector(".cred-front").getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(li.querySelector(".cred-front")).borderTopLeftRadius);
      const foil = [li.querySelector(".cred-seal"), li.querySelector(".cred-stripe")].map((e) => e.getBoundingClientRect());
      const text = [...li.querySelectorAll(".cred-issuer, .cred-title, .cred-meta > *")].map((e) => e.getBoundingClientRect());
      const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        slug: li.dataset.slug,
        ratio: f.width / f.height,
        radius: radius / f.width,
        foilUnderText: foil.some((a) => text.some((b) => meet(a, b))),
        stampOverStripe: meet(li.querySelector(".cred-stamp").getBoundingClientRect(), foil[1]),
        guilloche: [...li.querySelectorAll(".cred-guilloche use")].map((u) => u.getAttribute("transform")).join("|"),
        stamp: li.dataset.stamp,
        expired: li.hasAttribute("data-expired"),
        ink: getComputedStyle(li.querySelector(".cred-stamp")).color,
        sat: getComputedStyle(li).getPropertyValue("--foil-sat").trim(),
        mrz: [...li.querySelectorAll(".cred-mrz span")].map((s) => s.textContent),
      };
    }),
  );
  const hot = await page.evaluate(() => {
    const p = document.createElement("span");
    p.style.color = "var(--hot)";
    document.body.append(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  });
  const readout = await page.evaluate(() => document.querySelector(".cred-readout")?.textContent);
  check("the readout from derive.ts: 12 CREDENTIALS / 5 ISSUERS / 11 ACTIVE", readout?.toUpperCase() === "12 CREDENTIALS / 5 ISSUERS / 11 ACTIVE", readout);
  check("ISO/IEC 7810 ID-1: 85.60 × 53.98 (1.586:1), corner radius --r-card (3.7% of the width)", geo.length === 12 && geo.every((g) => Math.abs(g.ratio - ID1) < 0.01 && Math.abs(g.radius - 0.037) < 0.003), geo.map((g) => [+g.ratio.toFixed(3), +g.radius.toFixed(4)]).slice(0, 3));
  check("the guilloche is each card's own: every card's figures placed differently", new Set(geo.map((g) => g.guilloche)).size === geo.length, geo.length);
  check("foil only in the seal and the stripe, never under text; the stamp clear of the stripe", geo.every((g) => !g.foilUnderText && !g.stampOverStripe), geo.filter((g) => g.foilUnderText || g.stampOverStripe).map((g) => g.slug));
  check(
    "the stamps tell the truth: VERIFIED in --hot only where the build reached the URL, EXPIRED (in --fg-3, the foil greyed) on the expired, ON FILE otherwise",
    geo.some((g) => g.stamp === "verified") && geo.some((g) => g.stamp === "onFile") && geo.filter((g) => g.stamp === "verified").every((g) => g.ink === hot && !g.expired) && geo.filter((g) => g.expired).every((g) => g.stamp === "expired" && Number(g.sat) < 0.1 && g.ink !== hot) && geo.filter((g) => !g.expired).every((g) => Number(g.sat) === 1),
    geo.map((g) => `${g.stamp}${g.expired ? "(expired)" : ""}`),
  );
  check(
    "the MRZ: two lines of 30 in TD1's layout, every check digit right (recomputed here, 7-3-1)",
    geo.every(({ mrz: [a, b] }) => a?.length === 30 && b?.length === 30 && /^[A-Z0-9<]+$/.test(a + b) && (a[14] === "<" || Number(a[14]) === digit(a.slice(5, 14))) && Number(b[6]) === digit(b.slice(0, 6)) && Number(b[14]) === digit(b.slice(8, 14)) && Number(b[29]) === digit(a.slice(5, 30) + b.slice(0, 7) + b.slice(8, 15) + b.slice(18, 29))),
    geo.slice(0, 2).map((g) => g.mrz),
  );
  const build = await page.evaluate(() => ({
    filters: [...document.querySelectorAll(".cred, .cred-card, .cred-turn, .cred-face")].every((e) => getComputedStyle(e).filter === "none" && getComputedStyle(e).backdropFilter === "none"),
    // Chrome reports "layout paint style" as the keyword it equals, `content`
    contain: [...document.querySelectorAll(".cred")].every((e) => {
      const c = getComputedStyle(e).contain;
      return c === "content" || c === "strict" || ["layout", "paint", "style"].every((k) => c.includes(k));
    }),
    depth: Math.max(...[...document.querySelectorAll(".cred-face")].map((f) => {
      let n = 0;
      for (let e = f.parentElement; e; e = e.parentElement) if (getComputedStyle(e).transformStyle === "preserve-3d") n++;
      return n;
    })),
    flat: [...document.querySelectorAll(".cred-card, .cred-turn")].every((e) => getComputedStyle(e).overflow === "visible"),
    will: [...document.querySelectorAll(".cred, .cred-card")].filter((e) => getComputedStyle(e).willChange !== "auto").length,
    canvases: document.querySelectorAll("#credentials canvas").length,
  }));
  check("Tier B rules: no filter on a moving card, contain: layout paint style, preserve-3d two deep with no overflow clip on it, no canvas, no will-change at rest", build.filters && build.contain && build.depth <= 2 && build.flat && build.will === 0 && build.canvases === 0, build);

  // the deal: armed below the fold; once in view, every card from the bottom-right, stamps landing with it
  const c0 = await cues(page);
  await scrollTo(page, ".cred-wall", -120);
  await page.waitForTimeout(150);
  const dealt = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.target?.closest?.(".cred-wall"))
      .map((a) => ({ delay: a.effect.getTiming().delay, target: a.effect.target.className })),
  );
  await page.waitForTimeout(2200);
  const c1 = await cues(page);
  const stampsToThud = geo.filter((g) => g.stamp !== "onFile").length;
  const delays = dealt.filter((a) => a.target === "cred").map((a) => a.delay);
  check(
    `the deal: armed below the fold, then each card from the bottom-right (≤ ${STAGGER_CAP_MS} ms of stagger), its stamp landing with a STAMP thud for each VERIFIED and EXPIRED`,
    armed === "armed" && armedAfter === "armed" && delays.length >= 12 && Math.max(...delays) <= STAGGER_CAP_MS + 1 && (c1.STAMP ?? 0) - (c0.STAMP ?? 0) === stampsToThud && dealt.some((a) => a.target === "cred-stamp"),
    { armed, animations: dealt.length, maxDelay: Math.max(...delays), thuds: (c1.STAMP ?? 0) - (c0.STAMP ?? 0), want: stampsToThud },
  );
  await scrollTo(page, ".dev-fixture", 0);
  await page.waitForTimeout(300);
  await scrollTo(page, ".cred-wall", -120);
  await page.waitForTimeout(200);
  check("…once: back in view, no second deal", (await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.(".cred-wall") && a.playState === "running").length)) === 0);

  // the lamp: a sweep across the wall never has more than two live foils; at rest nothing is live
  let maxLive = 0;
  const row = await page.locator(".cred").nth(0).boundingBox();
  const row3 = await page.locator(".cred").nth(2).boundingBox();
  await page.evaluate(() => {
    window.__frames = [];
    let t = performance.now();
    const loop = (now) => {
      window.__frames.push(now - t);
      t = now;
      if (window.__frames.length < 200) requestAnimationFrame(loop); // eslint-disable-line no-restricted-globals
    };
    requestAnimationFrame(loop); // eslint-disable-line no-restricted-globals
  });
  for (let i = 0; i <= 40; i++) {
    await page.mouse.move(row.x + ((row3.x + row3.width - row.x) * i) / 40, row.y + row.height * 0.5);
    await page.waitForTimeout(16);
    if (i % 4 === 0) maxLive = Math.max(maxLive, await page.evaluate(() => document.querySelectorAll(".cred[data-live]").length));
  }
  const hovered = await page.evaluate(() => {
    const li = document.querySelector(".cred[data-live]");
    return li && { mx: Number(li.style.getPropertyValue("--mx")), rx: parseFloat(li.style.getPropertyValue("--cred-rx")), ry: parseFloat(li.style.getPropertyValue("--cred-ry")), will: li.style.willChange };
  });
  const frames = await page.evaluate(() => window.__frames.slice(5));
  frames.sort((a, b) => a - b);
  report.measures.sweep = { p50: frames[Math.floor(frames.length / 2)], p95: frames[Math.floor(frames.length * 0.95)] };
  check(`the lamp: at most ${LIVE_MAX} live foils however fast the sweep; the live card tilts ≤ ${TILT.card}° with will-change on`, maxLive <= LIVE_MAX && hovered && Math.abs(hovered.ry) <= TILT.card + 1e-6 && Math.abs(hovered.rx) <= TILT.card + 1e-6 && hovered.will === "transform", { maxLive, hovered });
  check("…and the frames keep the display's pace through it (one write a frame, nothing forced)", report.measures.sweep.p95 < 1000 / 60 + 4, report.measures.sweep);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(1600 + LINGER_MS);
  const rest = await page.evaluate(() => ({ live: document.querySelectorAll(".cred[data-live]").length, will: [...document.querySelectorAll(".cred")].filter((e) => e.style.willChange).length, mx: getComputedStyle(document.querySelector(".cred")).getPropertyValue("--mx").trim() }));
  check("left alone, every card settles to the resting lamp (0.62, 0.38) and will-change goes 300 ms after", rest.live === 0 && rest.will === 0 && Number(rest.mx) === REST.mx, rest);

  // the turn: click, Enter; Escape turns back and returns focus
  const cA = await cues(page);
  const first = page.locator(".cred").nth(1);
  await first.locator(".cred-flip").click();
  await page.waitForTimeout(900);
  const turned = await page.evaluate(() => {
    const li = document.querySelectorAll(".cred")[1];
    const a = li.querySelector(".cred-verify");
    return { flipped: li.hasAttribute("data-flipped"), pressed: li.querySelector(".cred-flip").getAttribute("aria-pressed"), tab: a?.tabIndex ?? null, target: a?.target, rel: a?.rel, transform: getComputedStyle(li.querySelector(".cred-turn")).transform };
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const back = await page.evaluate(() => ({ flipped: document.querySelectorAll(".cred")[1].hasAttribute("data-flipped"), focus: document.activeElement?.className ?? "" }));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const entered = await page.evaluate(() => document.querySelectorAll(".cred")[1].hasAttribute("data-flipped"));
  await page.keyboard.press("Escape");
  const cB = await cues(page);
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check(
    "the turn: a click turns the card (rotateY 180°) with a FLIP, its VERIFY ↗ reachable and opening a new tab; Escape turns it back and returns focus; Enter turns it; focus is visible",
    turned.flipped && turned.pressed === "true" && turned.tab === 0 && turned.target === "_blank" && /noopener/.test(turned.rel) && /matrix3d\(-1/.test(turned.transform) && !back.flipped && back.focus.includes("cred-flip") && entered && (cB.FLIP ?? 0) - (cA.FLIP ?? 0) === 4 && ring !== "none",
    { turned, back, entered, flips: (cB.FLIP ?? 0) - (cA.FLIP ?? 0), ring },
  );

  // the chips: an issuer narrows the wall, the cards that stay FLIP; All brings them back
  await scrollTo(page, ".cred-head", -120);
  await page.waitForTimeout(200);
  // an issuer whose cards sit apart on the wall, so the ones that stay have somewhere to move
  await page.locator('.cred-filters button[data-filter="issuer"][data-value="Amazon Web Services"]').click();
  await page.waitForTimeout(60);
  const moving = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.classList?.contains("cred")).length);
  await page.waitForTimeout(600);
  const narrowed = await page.evaluate(() => ({ shown: [...document.querySelectorAll(".cred")].filter((c) => !c.hidden).map((c) => c.dataset.issuer), count: document.querySelector("[data-cred-count]")?.textContent }));
  await page.locator('.cred-filters button[data-filter="issuer"][data-value=""]').click();
  await page.waitForTimeout(500);
  const all = await page.evaluate(() => [...document.querySelectorAll(".cred")].filter((c) => !c.hidden).length);
  check("the chips: an issuer narrows the wall (the count says so) and the cards that stay FLIP to their places; All brings back the twelve", narrowed.shown.length > 0 && narrowed.shown.every((i) => i === "Amazon Web Services") && /of 12/.test(narrowed.count ?? "") && moving > 0 && all === 12, { ...narrowed, moving, all });
  check("the wall: CLS 0 and the console clean", (await page.evaluate(() => window.__cls)) < 0.001 && logs.length === 0, { cls: await page.evaluate(() => window.__cls), logs: logs.slice(0, 3) });
  await ctx.close();
}

// ── 3 · the editions ────────────────────────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open("/dev/credentials/full", { reduced: true });
  await behaviour(page);
  await scrollTo(page, ".cred-wall", -120);
  await page.waitForTimeout(500);
  const box = await page.locator(".cred").nth(0).boundingBox();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
  await page.waitForTimeout(300);
  await page.locator(".cred").nth(0).locator(".cred-flip").click();
  await page.waitForTimeout(30);
  const r = await page.evaluate(() => {
    const li = document.querySelector(".cred");
    return { deal: document.querySelector(".cred-wall").getAttribute("data-deal"), anims: document.getAnimations().length, live: document.querySelectorAll(".cred[data-live]").length, mx: getComputedStyle(li).getPropertyValue("--mx").trim(), my: getComputedStyle(li).getPropertyValue("--my").trim(), dur: getComputedStyle(li.querySelector(".cred-turn")).transitionDuration, flipped: li.hasAttribute("data-flipped") };
  });
  // the reduced-motion edition's global rule makes every transition 0.001 s: at once
  check("reduced motion: no tilt, the foil frozen at (0.62, 0.38), the turn at once, no deal", r.deal === null && r.live === 0 && Number(r.mx) === REST.mx && Number(r.my) === REST.my && parseFloat(r.dur) <= 0.01 && r.flipped, r);
  check("reduced motion: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  // a phone: TILT TO INSPECT asks for the gyro only when tapped; then the cards in view catch the light
  const init = () => {
    window.__asked = 0;
    window.DeviceOrientationEvent.requestPermission = () => {
      window.__asked++;
      return Promise.resolve("granted");
    };
  };
  const { ctx, page, logs } = await open("/dev/credentials/full", { viewport: { width: 390, height: 844 }, dpr: 3, mobile: true, init });
  await behaviour(page);
  await scrollTo(page, ".cred-head", -60);
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({ chip: !document.querySelector("[data-cred-tilt]").hidden, asked: window.__asked, overflow: document.documentElement.scrollWidth - innerWidth, rows: [...document.querySelectorAll(".cred-filters__group")].map((g) => Math.round(g.getBoundingClientRect().height)) }));
  await page.locator("[data-cred-tilt]").tap();
  await page.waitForTimeout(200);
  await scrollTo(page, ".cred-wall", -40);
  await page.waitForTimeout(300);
  for (const [beta, gamma] of [[40, 0], [52, 14], [30, -18]]) {
    await page.evaluate(({ beta, gamma }) => window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { beta, gamma, alpha: 0 })), { beta, gamma });
    await page.waitForTimeout(80);
  }
  const after = await page.evaluate(() => ({ asked: window.__asked, lit: [...document.querySelectorAll(".cred")].filter((c) => c.style.getPropertyValue("--mx")).map((c) => [c.style.getPropertyValue("--mx"), c.style.getPropertyValue("--my")]), chip: document.querySelector("[data-cred-tilt]").getAttribute("aria-pressed") }));
  const card = page.locator(".cred").nth(0);
  await card.locator(".cred-flip").tap();
  await page.waitForTimeout(900);
  const tapped = await page.evaluate(() => document.querySelector(".cred").hasAttribute("data-flipped"));
  check(
    "a phone: TILT TO INSPECT shows, and asks for device motion only when tapped; then at most two cards in view catch the light from the gyro; a tap turns a card; the chips scroll in one row a group; no sideways overflow",
    before.chip && before.asked === 0 && after.asked === 1 && after.chip === "true" && after.lit.length > 0 && after.lit.length <= LIVE_MAX && tapped && before.overflow <= 0 && before.rows.every((h) => h < 48),
    { before, after, tapped },
  );
  check("a phone: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  const { ctx, page, logs } = await open("/dev/credentials/full", { theme: "paper" });
  const p = await page.evaluate(() => ({ sat: getComputedStyle(document.querySelector(".cred:not([data-expired])")).getPropertyValue("--foil-sat").trim(), blend: getComputedStyle(document.querySelector(".foil"), "::before").mixBlendMode }));
  check("Paper: the foil becomes silver stamping (little hue, an overlay sheen)", Number(p.sat) < 0.2 && p.blend === "overlay", p);
  check("Paper: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 4 · every state ─────────────────────────────────────────────────────────────────────────
for (const state of ["one", "forty", "long", "empty"]) {
  const { ctx, page, logs } = await open(`/dev/credentials/${state}`);
  await behaviour(page);
  await scrollTo(page, "#credentials", 0);
  await page.waitForTimeout(1600);
  const s = await page.evaluate(() => {
    const titles = [...document.querySelectorAll(".cred-title")];
    return {
      cards: document.querySelectorAll(".cred").length,
      readout: document.querySelector(".cred-readout")?.textContent ?? null,
      records: document.querySelectorAll(".record").length,
      empty: document.querySelector("#credentials")?.innerText.includes("Nothing on file yet") ?? false,
      clamped: titles.every((t) => t.getBoundingClientRect().height <= parseFloat(getComputedStyle(t).lineHeight) * 3 + 1),
      monograms: document.querySelectorAll(".cred-seal__mark").length,
      noExpiry: [...document.querySelectorAll(".cred-facts dd")].filter((d) => /no expiry/i.test(d.textContent)).length,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  const html = await (await page.request.get(`${BASE}/dev/credentials/${state}`)).body();
  report.measures[state] = { ...s, htmlGzKB: +(gzipSync(html).length / 1024).toFixed(1) };
  const ok = {
    one: s.cards === 1 && s.readout?.toUpperCase() === "1 CREDENTIAL / 1 ISSUER / 1 ACTIVE" && s.records === 1,
    forty: s.cards === 40 && s.overflow <= 0,
    long: s.cards === 6 && s.clamped && s.monograms === 6 && s.noExpiry === 3 && s.overflow <= 0,
    empty: s.cards === 0 && s.records === 0 && s.empty,
  }[state];
  check(`state ${state}: ${{ one: "one card (\"1 credential / 1 issuer / 1 active\") and one record", forty: "forty cards, nothing overflows", long: "very long titles clamped at three lines, missing logos as monograms, no expiry said so", empty: "nothing on file, said once" }[state]}; console clean`, ok && logs.length === 0, { ...report.measures[state], logs: logs.slice(0, 2) });
  await ctx.close();
}

// ── 5 · no JavaScript: the cards are whole, the back under the front ─────────────────────────
for (const path of ["/dev/credentials/full", "/"]) {
  const { ctx, page } = await open(path, { js: false, debug: false });
  const n = await page.evaluate(() => {
    const backs = [...document.querySelectorAll(".cred-back")];
    return {
      cards: document.querySelectorAll(".cred").length,
      backs: backs.every((b) => getComputedStyle(b).transform === "none"),
      chips: document.querySelector(".cred-filters") ? getComputedStyle(document.querySelector(".cred-filters")).display : null,
      flips: [...document.querySelectorAll(".cred-flip")].every((b) => getComputedStyle(b).display === "none"),
      records: document.querySelectorAll(".record").length,
      verify: document.querySelectorAll(".cred-verify[href]").length,
    };
  });
  check(`no JS (${path}): every card whole with its back under it and VERIFY reachable; no dead chips or buttons; the records there`, n.records > 0 && (path === "/" ? n.cards > 0 : n.cards === 12) && n.backs && n.chips === "none" && n.flips && n.verify > 0, n);
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}credentials-gate.json`, JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed${failed.length ? ` — failed: ${failed.map((c) => c.name.split(":")[0]).join(", ")}` : ""}`);
console.log(JSON.stringify(report.measures));
process.exit(failed.length ? 1 : 0);
