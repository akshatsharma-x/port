#!/usr/bin/env node
/**
 * The gate for Part 13 (PROMPTS.md): ∞ SHELL, the terminal, in the installed Chrome — the pattern of
 * scripts/connect-gate.mjs.
 *
 *   BASE_URL=http://localhost:3200 node scripts/shell-gate.mjs      (a production build)
 *
 * First-load carries only what opens it; the panel's chunk (≤ 30 KB gz) and /search-index.json
 * (≤ 60 KB gz) arrive on the first open. The openers (~, /, the HUD's key — never from a field,
 * never over a dialog), the native modal (inert page, focus kept, named), its geometry and its own
 * POWER CYCLE, the caret, the stream at 120 lines/s and every way to cut it, history, Tab, "did you
 * mean", and every command against the data — decode against LOG's own stage data. Its effects
 * (navigation with a tear, the clipboard, the HUD's switches, CONNECT), rain's 30 s, the index or
 * the chunk failing, the Konami degauss, the editions, contrast, CLS and a clean console.
 * Report: .artifacts/shell-gate.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, ".artifacts");
mkdirSync(OUT, { recursive: true });
const CHUNK_BUDGET = 30_000; // DESIGN.md §8.3 Terminal ≤ 30 KB gz
const INDEX_BUDGET = 60 * 1024; // content/search-index.ts SEARCH_INDEX_BUDGET_GZ
const LINES_PER_SEC = 120; // lib/motion.ts artifact.terminalLinesPerSec
const RAIN_MS = 30_000; // artifact.rainMs
const POWER = { onMs: 600, offMs: 450, reducedMs: 200, scanMs: 600 }; // lib/motion.ts signature
const DEGAUSS = { ms: 1200, sweepMs: 900 }; // lib/motion.ts degauss
const PANEL = { maxWidth: 960, svh: 0.62, radius: "18px", scan: 0.1 }; // DESIGN.md §7.4 SHELL
const BLINK = "1.06s"; // --blink
const SHELL_KEY = "retrograde:shell-history"; // lib/shell/config.ts SHELL.historyKey: only the panel's chunk has it
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

const checks = [];
const report = { base: BASE, checks, measures: {} };
function check(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const fold = (s) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();

// the data, as the terminal reads it, and as LOG's deck reads its cards
const index = await (await fetch(`${BASE}/search-index.json`)).json();
const stage = await (await fetch(`${BASE}/data/stage.json`)).json();
const L = index.labels.shell;
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));

const html = await (await fetch(`${BASE}/`)).text();
const firstLoad = [...new Set([...html.matchAll(/<script([^>]*)src="([^"]+)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))].filter((s) => !/next-devtools/.test(s));

const browser = await chromium.launch({ channel: "chrome" });
const IGNORED = [/Download the React DevTools/];
const CLS_INIT = () => {
  window.__cls = 0;
  window.__shifts = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      const nodes = (e.sources ?? []).map((s) => s.node).filter(Boolean);
      const el = (n) => (n.nodeType === 3 ? n.parentElement : n);
      if (nodes.length && nodes.every((n) => el(n)?.closest?.(".stage-debug"))) continue;
      window.__cls += e.value;
      window.__shifts.push({ v: +e.value.toFixed(4), src: (e.sources ?? []).map((s) => el(s.node)?.className?.toString().slice(0, 40)) });
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function open(path = "/", { viewport = { width: 1440, height: 900 }, mobile = false, theme = "phosphor", reduced = false, debug = true, clipboard = false, block = null, tz = "Europe/London" } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference", timezoneId: tz });
  if (clipboard) await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await ctx.addInitScript(
    ({ theme }) => {
      sessionStorage.setItem("retrograde:booted", "1");
      localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
    },
    { theme },
  );
  await ctx.addInitScript(CLS_INIT);
  const page = await ctx.newPage();
  if (block) await page.route(block, (r) => r.abort("failed"));
  const logs = [];
  const blocked = (u) => !!block && (u ?? "").includes(block.replace(/\*/g, ""));
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (IGNORED.some((r) => r.test(m.text()))) return;
    if (/Failed to load resource/.test(m.text()) && blocked(m.location()?.url)) return;
    logs.push(`${m.type()}: ${m.text()}`.slice(0, 240));
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 240)));
  ctx.on("requestfailed", (r) => !blocked(r.url()) && logs.push(`requestfailed: ${r.failure()?.errorText ?? "?"} ${r.url()}`.slice(0, 240)));
  ctx.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()}: ${r.url()}`.slice(0, 240)));
  const requests = [];
  ctx.on("request", (r) => requests.push(r.url().replace(BASE, "")));
  await page.goto(`${BASE}${path}${debug ? `${path.includes("?") ? "&" : "?"}debug=1` : ""}`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  if (debug) await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
  return { ctx, page, logs, requests };
}
const isOpen = (page) => page.evaluate(() => !!document.querySelector("dialog[data-shell][open]"));
const opened = (page) => page.waitForFunction(() => !!document.querySelector("dialog[data-shell][open]"), null, { timeout: 15_000 });
/** the banner is in and the panel's POWER ON has finished (its box is the real one again) */
const ready = (page) => page.waitForFunction(() => [...document.querySelectorAll('dialog[data-shell] [role="log"] > div')].length >= 4 && document.querySelector("dialog[data-shell]").getAnimations().length === 0, null, { timeout: 15_000 });
const lines = (page) => page.evaluate(() => [...document.querySelectorAll('dialog[data-shell] [role="log"] > div')].map((l) => l.textContent));
const run = async (page, cmd, settle = 700) => {
  await page.keyboard.type(cmd);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(settle);
};
/** what a command printed: the lines after its echo */
const output = async (page, cmd) => {
  const all = await lines(page);
  const at = all.map((l, i) => [l, i]).filter(([l]) => l.endsWith(`$ ${cmd}`)).at(-1)?.[1] ?? -1;
  return all.slice(at + 1);
};
const cues = (page) => page.evaluate(() => Object.fromEntries(window.__retrograde?.cues?.played ?? []));
const jumpTo = (page, y) =>
  page.evaluate((y) => {
    const l = window.__retrograde?.lenis?.();
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }, y);

// ── 1 · first-load, the chunk, the index ────────────────────────────────────────────────────
{
  const bodies = await Promise.all(firstLoad.map(async (s) => (await fetch(BASE + s)).text()));
  check("first-load JS carries only what opens the terminal: no panel, no commands, no degauss", bodies.every((b) => !b.includes(SHELL_KEY) && !b.includes("fx-degauss")), { scripts: firstLoad.length, panel: bodies.filter((b) => b.includes(SHELL_KEY)).length });
  const { ctx, page, logs, requests } = await open();
  await page.waitForTimeout(1500);
  const beforeOpen = requests.filter((r) => /search-index\.json/.test(r)).length;
  const before = new Set(requests);
  await page.keyboard.press("~");
  await opened(page);
  await ready(page);
  const fresh = [...new Set(requests.filter((r) => !before.has(r)))];
  const js = await Promise.all(fresh.filter((r) => /\.js(\?|$)/.test(r)).map(async (r) => ({ r, b: Buffer.from(await (await fetch(BASE + r)).arrayBuffer()) })));
  const css = await Promise.all(fresh.filter((r) => /\.css(\?|$)/.test(r)).map(async (r) => ({ r, b: Buffer.from(await (await fetch(BASE + r)).arrayBuffer()) })));
  const panel = js.filter((x) => x.b.toString().includes(SHELL_KEY));
  const panelGz = panel.reduce((n, x) => n + gz(x.b), 0);
  const idx = Buffer.from(JSON.stringify(index));
  report.measures.chunk = { js: panel.map((x) => ({ chunk: x.r, gz: gz(x.b) })), css: css.map((x) => ({ chunk: x.r, gz: gz(x.b) })), indexGz: gz(idx) };
  check(`the panel arrives on its first open, ${CHUNK_BUDGET / 1000} KB gz at most (its CSS with it); /search-index.json only then, once, ≤ 60 KB gz`, beforeOpen === 0 && panel.length > 0 && panelGz <= CHUNK_BUDGET && requests.filter((r) => /search-index\.json/.test(r)).length === 1 && gz(idx) <= INDEX_BUDGET && index.version === 2, { beforeOpen, panelGz, ...report.measures.chunk });
  check("…and the page's console stays clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 2 · the panel: openers, the modal, geometry, power, caret ─────────────────────────────────
{
  const { ctx, page, logs } = await open();
  // never from a field: CONNECT's name field takes ~ and / as letters
  await jumpTo(page, await page.evaluate(() => document.getElementById("connect").getBoundingClientRect().top + scrollY));
  await page.waitForTimeout(400);
  await page.locator("#cx-name").click();
  await page.keyboard.type("a~b/c");
  const field = { open: await isOpen(page), value: await page.locator("#cx-name").inputValue() };
  await page.locator("#cx-name").fill("");
  // never with a modifier
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press("Control+/");
  const withCtrl = await isOpen(page);
  check("~ and / are letters in a text field, and not a shortcut with a modifier", !field.open && field.value === "a~b/c" && !withCtrl, { field, withCtrl });
  // "/" opens it, and isn't typed into it
  const c0 = await cues(page);
  await page.keyboard.press("/");
  await opened(page);
  const powerOn = await page.evaluate(() => document.querySelector("dialog[data-shell]").getAnimations().map((a) => a.effect.getTiming().duration));
  await ready(page);
  const geo = await page.evaluate(() => {
    const d = document.querySelector("dialog[data-shell]");
    const r = d.getBoundingClientRect();
    const scan = getComputedStyle(d, "::after");
    return { modal: d.matches(":modal"), label: d.getAttribute("aria-label"), left: Math.round(r.left), right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom), width: Math.round(r.width), height: Math.round(r.height), vh: innerHeight, radius: getComputedStyle(d).borderRadius, scan: Number(scan.opacity), focus: document.activeElement === d.querySelector("input"), typed: d.querySelector("input").value, log: d.querySelector('[role="log"]')?.getAttribute("aria-label"), inputName: d.querySelector("input").labels?.[0]?.textContent, close: d.querySelector("button")?.getAttribute("aria-label") };
  });
  const c1 = await cues(page);
  check("/ opens a native modal <dialog>, named, focus in its line (the / not typed), its output a named log", geo.modal && geo.label === L.label && geo.focus && geo.typed === "" && geo.log === L.output && geo.inputName === L.input && geo.close === L.close, geo);
  check(`bottom-anchored, ≤ ${PANEL.maxWidth} px wide and centred, 62 svh tall, --r-bezel corners, its own scanlines at α ${PANEL.scan}`, geo.width <= PANEL.maxWidth && Math.abs(geo.left - geo.right) <= 1 && geo.bottom >= 0 && geo.bottom < 40 && Math.abs(geo.height - geo.vh * PANEL.svh) <= 2 && geo.radius === PANEL.radius && Math.abs(geo.scan - PANEL.scan) < 1e-6, geo);
  check(`a panel-scoped POWER ON (${POWER.onMs} ms, on the panel alone) with SHELL's chirp`, powerOn.includes(POWER.onMs) && (c1.SHELL ?? 0) - (c0.SHELL ?? 0) >= 1, { powerOn, shell: (c1.SHELL ?? 0) - (c0.SHELL ?? 0) });
  const banner = (await lines(page)).slice(0, 4);
  check("the boot banner: the system, its version and commit, the tty, whose machine", banner.some((l) => l.includes(index.labels.os) && l.includes(index.build.version) && l.includes(L.tty)) && banner.some((l) => l.includes(index.profile.name)), banner);
  // the page behind is inert, and focus stays in the panel
  const inert = await page.evaluate(() => {
    const a = document.querySelector("#screen a[href]");
    a?.focus();
    return document.activeElement !== a;
  });
  // Shift+Tab walks the panel's own controls; it may step out to the browser's UI, never into the page
  const trail = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Shift+Tab");
    trail.push(await page.evaluate(() => (document.activeElement?.closest("dialog[data-shell]") ? "panel" : document.activeElement?.closest("#screen, #hud") ? "page" : "outside")));
  }
  check("the page behind is inert: focus can't go there, and Shift+Tab walks the panel (Tab is completion)", inert && trail.includes("panel") && !trail.includes("page"), { inert, trail });
  await page.locator("dialog[data-shell] input").focus();
  // the caret
  const caret = await page.evaluate(() => {
    const c = document.querySelector("dialog[data-shell] input + span");
    const s = getComputedStyle(c);
    return { name: s.animationName, dur: s.animationDuration, idle: c.hasAttribute("data-idle"), w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) };
  });
  check(`a blinking block caret (--blink, ${BLINK}), a cell wide`, /blink/.test(caret.name) && caret.dur === BLINK && !caret.idle && caret.w > 4 && caret.h > caret.w, caret);
  // the stream: help prints at 120 lines/s
  await page.keyboard.press("Control+L");
  await page.keyboard.type("help");
  const samples = await page.evaluate(() => {
    const log = document.querySelector('dialog[data-shell] [role="log"]');
    window.__stream = [];
    const t0 = performance.now();
    new MutationObserver(() => window.__stream.push([performance.now() - t0, log.children.length])).observe(log, { childList: true });
    return true;
  });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const stream = await page.evaluate(() => window.__stream);
  const first = stream.find(([, n]) => n >= 3);
  const last = stream.at(-1);
  const rate = first && last && last[0] > first[0] ? ((last[1] - first[1]) / (last[0] - first[0])) * 1000 : 0;
  report.measures.stream = { linesPerSec: Math.round(rate), lines: last?.[1] };
  check(`output streams at ${LINES_PER_SEC} lines/s`, samples && Math.abs(rate - LINES_PER_SEC) < LINES_PER_SEC * 0.15, report.measures.stream);
  // any key skips to the end; Ctrl alone doesn't, Ctrl+C drops the rest
  await page.keyboard.press("Control+L");
  await run(page, "help", 40);
  await page.keyboard.press("x");
  await page.waitForTimeout(40);
  const skipped = (await lines(page)).length;
  await page.locator("dialog[data-shell] input").fill("");
  await page.keyboard.press("Control+L");
  await run(page, "help", 40);
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(300);
  const cut = await lines(page);
  const total = report.measures.stream.lines;
  check("any key skips the stream to its end; Ctrl+C drops what's left and says ^C; Ctrl+L clears", skipped === total && cut.length < total / 2 && cut.at(-1)?.endsWith(L.interrupted), { skipped, total, afterCtrlC: cut.length, last: cut.at(-1) });
  // history, Tab, did you mean
  await page.keyboard.press("Control+L");
  await run(page, "whoami", 300);
  await run(page, "about", 300);
  await page.keyboard.type("dr");
  const val = () => page.evaluate(() => document.querySelector("dialog[data-shell] input").value);
  const walk = [];
  for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown"]) {
    await page.keyboard.press(k);
    walk.push(await val());
  }
  await page.locator("dialog[data-shell] input").fill("neo");
  await page.keyboard.press("Tab");
  const tab1 = await val();
  await page.locator("dialog[data-shell] input").fill("ls ");
  await page.keyboard.press("Tab");
  const tab2 = (await lines(page)).at(-1);
  await page.locator("dialog[data-shell] input").fill("");
  await run(page, "hepl", 300);
  const dym = (await output(page, "hepl")).slice(0, 2);
  check("history walks back and forth (the draft kept); Tab completes and lists; a typo gets \"did you mean\"", walk.join("|") === "about|whoami|about|dr" && tab1 === "neofetch " && /awards\s+certs\s+experience\s+papers\s+projects\s+skills/.test(tab2 ?? "") && dym[0] === fill(L.notFound, { command: "hepl" }) && dym[1] === fill(L.didYouMean, { suggestions: "help" }), { walk, tab1, tab2, dym });
  // Esc: the panel's POWER OFF, then the dialog closes and focus goes back
  const c2 = await cues(page);
  await page.keyboard.press("Escape");
  const off = await page.evaluate(() => document.querySelector("dialog[data-shell]").getAnimations().map((a) => a.effect.getTiming().duration));
  await page.waitForTimeout(POWER.offMs + 200);
  const closed = { open: await isOpen(page), focusBody: await page.evaluate(() => !document.activeElement?.closest("dialog")) };
  const c3 = await cues(page);
  check(`Esc: the panel's POWER OFF (${POWER.offMs} ms) with SHELL's chirp, then it's closed`, off.includes(POWER.offMs) && !closed.open && closed.focusBody && (c3.SHELL ?? 0) - (c2.SHELL ?? 0) >= 1, { off, ...closed });
  // the HUD's key: no longer aria-disabled; it opens the panel, the scrollback kept
  const key = await page.evaluate(() => {
    const b = document.querySelector(".hud-nav__key");
    return { disabled: b.getAttribute("aria-disabled"), popup: b.getAttribute("aria-haspopup") };
  });
  await page.locator(".hud-nav__key").click();
  await opened(page);
  await page.waitForTimeout(POWER.onMs);
  const viaKey = { expanded: await page.locator(".hud-nav__key").getAttribute("aria-expanded"), kept: (await lines(page)).length > 4 };
  check("the HUD's ~ key opens it (aria-haspopup=dialog, aria-expanded), the session's scrollback kept", key.disabled === null && key.popup === "dialog" && viaKey.expanded === "true" && viaKey.kept, { ...key, ...viaKey });
  const cls = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }));
  check("opening and closing the panel moves nothing (CLS 0); console clean", cls.cls < 0.001 && logs.length === 0, { ...cls, logs: logs.slice(0, 3) });
  await ctx.close();
}

// ── 3 · the commands, against the data ───────────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open("/", { clipboard: true });
  await page.keyboard.press("~");
  await opened(page);
  await ready(page);
  const p = index.profile;
  const docs = (k) => index.docs.filter((d) => d.kind === k);
  await run(page, "whoami");
  const who = await output(page, "whoami");
  await run(page, "about");
  const about = (await output(page, "about")).join("\n");
  await run(page, "scholar");
  const scholar = (await output(page, "scholar")).join("\n");
  const r = index.metrics.research;
  check("whoami, about and scholar print the index's own facts (citations with their source and date)", who[0] === fill(L.whoami, { user: L.user, name: p.name, role: p.role }) && about.includes(p.bio.slice(0, 40)) && about.includes(p.availability.note.slice(0, 20)) && scholar.includes(`${r.total} (`) && scholar.includes(r.provenance.sources.join(", ")) && (!r.provenance.asOf || scholar.includes(r.provenance.asOf)), { who, scholar: scholar.slice(0, 200) });
  await run(page, "ls papers");
  const papers = (await output(page, "ls papers")).join("\n");
  await run(page, "ls certs");
  const certs = await output(page, "ls certs");
  await run(page, "verify");
  const verify = await output(page, "verify");
  check("ls lists each record by slug; no certificates is said once — never 0 — by ls certs and verify (§10 #46)", docs("paper").every((d) => papers.includes(d.slug)) && (index.metrics.credentials.total === 0 ? certs.length === 1 && certs[0] === L.ls.noCerts && verify[0] === L.ls.noCerts : true), { certs, verify });
  const paper = docs("paper")[0];
  await run(page, `cat ${paper.slug}`);
  const cat = (await output(page, `cat ${paper.slug}`)).join(" ").replace(/\s+/g, " ");
  await run(page, `cite ${paper.slug}`, 900);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check("cat prints the record's own fields; cite prints its BibTeX and puts it on the clipboard", cat.includes(paper.title) && cat.includes(paper.tldr.split(" ").slice(0, 6).join(" ")) && clip === paper.bibtex, { clip: clip.slice(0, 40) });
  await run(page, "email", 600);
  const mail = await page.evaluate(() => navigator.clipboard.readText());
  await run(page, "resume");
  const resume = await output(page, "resume");
  await run(page, "social");
  const social = await page.evaluate(() => [...document.querySelectorAll('dialog[data-shell] [role="log"] a')].filter((a) => /^https:/.test(a.href)).map((a) => ({ href: a.getAttribute("href"), blank: a.target === "_blank", rel: a.rel })));
  check("email copies the address; resume says there's none yet and where to ask (§10 #49); social links each profile, in a new tab", mail === p.email && (p.resumeUrl ? true : resume[0] === fill(L.resume.none, { email: p.email })) && p.socials.every((s) => social.some((x) => x.href === s.url && x.blank && /noopener/.test(x.rel))), { resume, social });
  const term = "interpretable";
  await run(page, `grep ${term}`);
  const grep = await output(page, `grep ${term}`);
  const truth = index.docs.filter((d) => [d.title, d.slug, d.meta, d.text].some((t) => fold(t).includes(term))).length;
  check("grep counts every record that says it, each hit with its section", grep[0] === fill(truth === 1 ? L.grep.hit : L.grep.hits, { count: truth, term }) && grep.slice(1).filter((l) => /^\[[A-Z]+\]/.test(l)).length === Math.min(truth, 12), { first: grep[0], truth });
  // decode, against LOG's deck's own data
  const decoded = [];
  for (const card of stage.log.cards) {
    await run(page, `decode ${card.slug}`, 300);
    const out = await output(page, `decode ${card.slug}`);
    decoded.push([card.slug, out.at(-1)?.replace(fill(L.decode.reads, { text: "" }), ""), card.text]);
  }
  check("decode reads every LOG card's holes back into the text LOG's deck prints (/data/stage.json)", decoded.length > 0 && decoded.every(([, got, want]) => got === want), decoded);
  await run(page, "man retrograde");
  const man = (await output(page, "man retrograde")).join("\n");
  await run(page, "neofetch");
  const neo = (await output(page, "neofetch")).join("\n");
  // the owner's credentials since v2.8: neofetch counts them (before, it said there were none yet)
  const certCount = index.docs.filter((d) => d.kind === "cert").length;
  check("man retrograde explains the name and the camera's retrograde loop; neofetch: the portrait beside the spec sheet, the credentials counted", L.man.retrograde.blocks.every((b) => man.includes(b.heading)) && /retrograde loop/.test(man) && index.portrait.length > 0 && neo.includes(index.portrait.find((l) => l.trim()).trim()) && neo.includes(p.name) && (certCount ? neo.split("\n").some((l) => l.includes(L.neofetch.certs) && l.includes(String(certCount))) : neo.includes(L.neofetch.noCerts)), { manLines: man.split("\n").length, certCount });
  await run(page, "date");
  const date = await output(page, "date");
  await run(page, "uptime");
  const up = await output(page, "uptime");
  const age = await page.evaluate(() => performance.now());
  const upMin = Number(/(\d+) min/.exec(up[0] ?? "")?.[1] ?? 0);
  check("date gives your time and mine (named IST, as the HUD does); uptime is this page's age", date.length === 2 && /IST/.test(date[1] ?? "") && Math.abs(upMin - Math.floor(age / 60000)) <= 1, { date, up });
  // the switches
  await run(page, "theme amber", 1200);
  const amber = await page.evaluate(() => document.documentElement.dataset.theme);
  await run(page, "theme phosphor", 1200);
  const gridShown = () => page.evaluate(() => !!document.querySelector(".grid-overlay:not([data-flash])"));
  await run(page, "grid", 400);
  const grid = [await gridShown()];
  await run(page, "grid", 400);
  grid.push(await gridShown());
  await run(page, "gfx low", 400);
  const gfx = await page.evaluate(() => JSON.parse(localStorage.getItem("retrograde:ui")).state.gfx);
  await run(page, "gfx auto", 400);
  await run(page, "sound on", 600);
  const sound = await page.evaluate(() => JSON.parse(localStorage.getItem("retrograde:ui")).state.sound);
  await run(page, "sound off", 400);
  await run(page, "debug", 800);
  const overlay = await page.evaluate(() => !!document.querySelector(".stage-debug"));
  await run(page, "debug", 800);
  const overlayAfter = await page.evaluate(() => !!document.querySelector(".stage-debug"));
  check("theme, grid, gfx and sound flip the HUD's own switches (the theme with its POWER CYCLE); debug hides and shows the dev overlay", amber === "amber" && grid[0] === true && grid[1] === false && gfx === "low" && sound === true && overlay === false && overlayAfter === true, { amber, grid, gfx, sound, overlay: [overlay, overlayAfter] });
  // goto: the panel powers off, the page tears to the section
  const t0 = await cues(page);
  await run(page, "goto archive", 2200);
  const t1 = await cues(page);
  const g = { open: await isOpen(page), section: await page.evaluate(() => window.__retrograde?.scroll?.store.getState().section), tear: (t1.TEAR ?? 0) - (t0.TEAR ?? 0) };
  check("goto: the panel powers off, then a TRACKING TEAR to the section", !g.open && g.section === "archive" && g.tear === 1, g);
  // contact: off to CONNECT, in its first field (which brings the form's behaviour)
  await page.keyboard.press("~");
  await opened(page);
  await page.waitForTimeout(POWER.onMs);
  await run(page, "contact", 2400);
  const contact = { open: await isOpen(page), focus: await page.evaluate(() => document.activeElement?.id), copy: await page.evaluate(() => !document.querySelector("[data-connect-copy]")?.hasAttribute("data-pending")) };
  // sudo hire-me: the pitch; CONNECT behind the panel; Esc lands in the form
  await page.evaluate(() => document.activeElement.blur());
  await jumpTo(page, 0);
  await page.waitForTimeout(500);
  await page.keyboard.press("~");
  await opened(page);
  await page.waitForTimeout(POWER.onMs);
  await run(page, "sudo hire-me", 2400);
  const pitch = (await output(page, "sudo hire-me")).join("\n");
  const hire = { open: await isOpen(page), section: await page.evaluate(() => window.__retrograde?.scroll?.store.getState().section), pitch: pitch.includes(p.name) && pitch.includes(`${index.metrics.projects}`) };
  await page.keyboard.press("Escape");
  await page.waitForTimeout(POWER.offMs + 400);
  hire.focus = await page.evaluate(() => document.activeElement?.id);
  check("contact closes the panel and lands in CONNECT's first field; sudo hire-me pitches, opens CONNECT behind, and Esc lands in the form", !contact.open && contact.focus === "cx-name" && contact.copy && hire.open && hire.section === "connect" && hire.pitch && hire.focus === "cx-name", { contact, hire });
  check("the commands: console clean", logs.length === 0, logs.slice(0, 4));
  await ctx.close();
}
{
  // open: a project's case study and a paper's dossier, each with a tear
  const { ctx, page, logs } = await open("/");
  await page.keyboard.press("~");
  await opened(page);
  await ready(page);
  const project = index.docs.find((d) => d.kind === "project");
  const c0 = await cues(page);
  await run(page, `open ${project.slug}`, 2800);
  const c1 = await cues(page);
  const atProject = { path: await page.evaluate(() => location.pathname), open: await isOpen(page), tear: (c1.TEAR ?? 0) - (c0.TEAR ?? 0) };
  await page.keyboard.press("~");
  await opened(page);
  await page.waitForTimeout(POWER.onMs);
  const paper = index.docs.find((d) => d.kind === "paper");
  await run(page, `open ${paper.slug}`, 2800);
  const atPaper = { path: await page.evaluate(() => location.pathname), dossier: await page.evaluate(() => !!document.querySelector("dialog:modal:not([data-shell])") || !!document.querySelector("article, main")) };
  check("open goes to the record's page with a TRACKING TEAR, from any page: a case study, a paper", atProject.path === `/work/${project.slug}` && !atProject.open && atProject.tear === 1 && atPaper.path === `/research/${paper.slug}` && atPaper.dossier, { atProject, atPaper });
  // over a dialog (the dossier), ~ is the dialog's, not the terminal's
  const overDossier = await page.evaluate(() => !!document.querySelector("dialog:modal:not([data-shell])"));
  if (overDossier) {
    await page.keyboard.press("~");
    await page.waitForTimeout(600);
  }
  check("…and over another dialog ~ doesn't stack a terminal on it; console clean", !overDossier || !(await isOpen(page)), { overDossier, logs: logs.slice(0, 3) });
  await ctx.close();
}

// ── 4 · rain: thirty seconds at most, any key ends it ────────────────────────────────────────
{
  const { ctx, page, logs } = await open("/");
  await page.keyboard.press("~");
  await opened(page);
  await ready(page);
  await run(page, "rain", 900);
  const lit = await page.evaluate(() => {
    const c = document.querySelector("dialog[data-shell] canvas");
    if (!c) return null;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  await page.keyboard.press("q");
  await page.waitForTimeout(200);
  const stopped = { canvas: await page.evaluate(() => !!document.querySelector("dialog[data-shell] canvas")), typed: await page.evaluate(() => document.querySelector("dialog[data-shell] input").value), said: (await lines(page)).at(-1) };
  // left alone, it ends by itself at 30 s
  await run(page, "rain", 0);
  const t0 = Date.now();
  await page.waitForFunction(() => !document.querySelector("dialog[data-shell] canvas"), null, { timeout: RAIN_MS + 5000, polling: 250 }).catch(() => {});
  const ranMs = Date.now() - t0;
  report.measures.rain = { lit, ranMs };
  check("rain falls on the panel (cells lit), a key ends it without being typed, and alone it stops at 30 s", lit > 0 && !stopped.canvas && stopped.typed === "" && stopped.said === L.rain.stop && ranMs > RAIN_MS - 1000 && ranMs < RAIN_MS + 2500, { lit, ...stopped, ranMs });
  check("rain: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}

// ── 5 · when things fail: no index, no chunk ─────────────────────────────────────────────────
{
  const { ctx, page, logs } = await open("/", { block: "**/search-index.json" });
  await page.keyboard.press("~");
  await opened(page);
  await page.waitForTimeout(1200);
  const first = await lines(page);
  await run(page, "help", 900);
  const after = await lines(page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const page_ = await page.evaluate(() => ({ scroll: (window.scrollTo(0, 400), scrollY > 0) }));
  check("no index: the panel still opens and says so in the content's words, retries with each command, and the page is untouched", first.some((l) => l === index.labels.shell.offline) && after.filter((l) => l === index.labels.shell.offline).length >= 2 && !(await isOpen(page)) && page_.scroll && logs.length === 0, { first, after: after.slice(-2), logs: logs.slice(0, 3) });
  await ctx.close();
}
{
  // no chunk: ~ does nothing visible and breaks nothing
  const { ctx, page, logs, requests } = await open("/");
  await page.waitForTimeout(800);
  const before = new Set(requests);
  await page.route(/\/_next\/static\/chunks\/.+\.js/, (r) => (before.has(r.request().url().replace(BASE, "")) ? r.continue() : r.abort("failed")));
  await page.keyboard.press("~");
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => ({ dialog: !!document.querySelector("dialog[data-shell][open]"), open: JSON.stringify(document.querySelector(".hud-nav__key")?.getAttribute("aria-expanded")) }));
  await page.unroute(/\/_next\/static\/chunks\/.+\.js/);
  await page.keyboard.press("~");
  await page.waitForTimeout(1500);
  const retry = await isOpen(page);
  const errors = logs.filter((l) => !/requestfailed|Failed to load resource|ChunkLoadError|Loading chunk/i.test(l));
  check("no chunk: ~ opens nothing and breaks nothing (no page error), and the next ~ tries again and opens it", !state.dialog && state.open === '"false"' && retry && errors.length === 0, { ...state, retry, errors: errors.slice(0, 3) });
  await ctx.close();
}

// ── 6 · the Konami code ──────────────────────────────────────────────────────────────────────
for (const [theme, reduced] of [["phosphor", false], ["paper", false], ["phosphor", true]]) {
  const { ctx, page, logs, requests } = await open("/", { theme, reduced });
  const c0 = await cues(page);
  const before = requests.length;
  for (const k of KONAMI) await page.keyboard.press(k);
  await page.waitForTimeout(150);
  const fx = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => ["screen", "hud"].includes(a.effect?.target?.id) || a.effect?.target?.classList?.contains("fx-degauss"))
      .map((a) => [a.effect.target.id || "veil", a.effect.getTiming().duration]),
  );
  const c1 = await cues(page);
  const loaded = requests.slice(before).filter((r) => /\.js/.test(r)).length;
  await page.mouse.move(20, 20);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(80);
  const ended = await page.evaluate(() => !document.querySelector(".fx-degauss") && !document.getAnimations().some((a) => ["screen", "hud"].includes(a.effect?.target?.id)));
  const want = reduced ? [["veil", POWER.reducedMs * 2]] : theme === "paper" ? [["screen", DEGAUSS.ms], ["hud", DEGAUSS.ms]] : [["screen", DEGAUSS.ms], ["hud", DEGAUSS.ms], ["veil", DEGAUSS.sweepMs]];
  check(`Konami (${theme}${reduced ? ", reduced motion" : ""}): ${reduced ? "the tint comes and goes, no motion" : theme === "paper" ? "the sheet shakes 1.2 s, no fringe" : "the raster rings down 1.2 s under a 900 ms hue sweep"}, the hum, its chunk on demand; any input ends it`, JSON.stringify(fx) === JSON.stringify(want) && (c1.DEGAUSS ?? 0) - (c0.DEGAUSS ?? 0) === 1 && loaded >= 1 && ended && logs.length === 0, { fx, loaded, ended, logs: logs.slice(0, 2) });
  await ctx.close();
}
{
  // Konami typed into a field is just typing
  const { ctx, page } = await open("/");
  await jumpTo(page, await page.evaluate(() => document.getElementById("connect").getBoundingClientRect().top + scrollY));
  await page.locator("#cx-message").click();
  const c0 = await cues(page);
  for (const k of KONAMI) await page.keyboard.press(k);
  await page.waitForTimeout(200);
  const c1 = await cues(page);
  check("…and in a text field it's just typing", (c1.DEGAUSS ?? 0) === (c0.DEGAUSS ?? 0), { degauss: (c1.DEGAUSS ?? 0) - (c0.DEGAUSS ?? 0) });
  await ctx.close();
}

// ── 7 · the editions ─────────────────────────────────────────────────────────────────────────
{
  // reduced motion: no stream, no blink, a crossfade, rain as one still frame
  const { ctx, page, logs } = await open("/", { reduced: true });
  await page.keyboard.press("~");
  await opened(page);
  const anim = await page.evaluate(() => document.querySelector("dialog[data-shell]").getAnimations().map((a) => a.effect.getTiming().duration));
  await ready(page);
  await page.keyboard.press("Control+L");
  await run(page, "help", 60);
  const atOnce = (await lines(page)).length;
  const blink = await page.evaluate(() => getComputedStyle(document.querySelector("dialog[data-shell] input + span")).animationName);
  await page.keyboard.press("Control+L");
  await run(page, "rain", 400);
  const rain = { canvas: await page.evaluate(() => !!document.querySelector("dialog[data-shell] canvas")), lines: (await lines(page)).length };
  check("reduced motion: the panel crossfades (200 ms), output prints whole, the caret doesn't blink, rain is one still frame", anim.includes(POWER.reducedMs) && atOnce > 20 && blink === "none" && !rain.canvas && rain.lines > 4 && logs.length === 0, { anim, atOnce, blink, rain });
  await ctx.close();
}
{
  // a phone: the panel fits, the line works, the close key is a real target; neofetch stacks
  const { ctx, page, logs } = await open("/", { viewport: { width: 390, height: 844 }, mobile: true });
  await page.locator(".hud-nav__key").tap();
  await opened(page);
  await ready(page);
  await page.locator("dialog[data-shell] input").fill("neofetch");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  const ph = await page.evaluate(() => {
    const d = document.querySelector("dialog[data-shell]");
    const r = d.getBoundingClientRect();
    const b = d.querySelector("button").getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(innerWidth - r.right), height: Math.round(r.height), vh: innerHeight, close: [Math.round(b.width), Math.round(b.height)], overflow: document.documentElement.scrollWidth - innerWidth };
  });
  const neo = await lines(page);
  const stacked = index.portrait.length > 0 && neo.some((l) => l.trim() === index.portrait.find((x) => x.trim()).trim());
  await page.locator("dialog[data-shell] button").tap();
  await page.waitForTimeout(POWER.offMs + 300);
  check("a phone: the HUD key opens it, it fits the screen, 62 svh, a 32 px close key that closes it; neofetch stacks", ph.left > 0 && ph.right > 0 && Math.abs(ph.height - ph.vh * PANEL.svh) <= 2 && ph.close.every((x) => x >= 24) && ph.overflow <= 0 && stacked && !(await isOpen(page)) && logs.length === 0, { ...ph, stacked });
  await ctx.close();
}
// contrast and the materials: tubes glow behind scanlines; Paper is ink, no scanlines, a SCAN
for (const theme of ["phosphor", "amber", "paper"]) {
  const { ctx, page, logs } = await open("/", { theme });
  await page.keyboard.press("~");
  await opened(page);
  const anim = await page.evaluate(() => document.querySelector("dialog[data-shell]").getAnimations().map((a) => [a.effect.getTiming().duration, Object.keys(a.effect.getKeyframes()[1] ?? {}).filter((k) => !["offset", "easing", "composite", "computedOffset"].includes(k))]));
  await ready(page);
  await run(page, "frobnicate", 400);
  await run(page, "ls", 600);
  const c = await page.evaluate(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const x = cv.getContext("2d", { willReadFrequently: true });
    const rgb = (col) => {
      x.clearRect(0, 0, 1, 1);
      x.fillStyle = "#000";
      x.fillStyle = col;
      x.fillRect(0, 0, 1, 1);
      return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const d = document.querySelector("dialog[data-shell]");
    const bg = lum(rgb(getComputedStyle(d).backgroundColor));
    const ratio = (el) => {
      const a = lum(rgb(getComputedStyle(el).color));
      return +((Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05)).toFixed(2);
    };
    const log = d.querySelector('[role="log"]');
    const pick = (cls) => [...log.querySelectorAll("span")].find((s) => s.className.split(" ").some((c) => c.endsWith(cls)) || s.className.includes(cls));
    const plainSpan = [...log.querySelectorAll("span")].find((s) => !s.className);
    return { base: plainSpan ? ratio(plainSpan) : null, dim: pick("dim") ? ratio(pick("dim")) : null, hot: pick("hot") ? ratio(pick("hot")) : null, scan: Number(getComputedStyle(d, "::after").opacity), scanShown: getComputedStyle(d, "::after").display !== "none", glow: getComputedStyle(log.firstElementChild).textShadow };
  });
  const paper = theme === "paper";
  const okMaterial = paper ? !c.scanShown && c.glow === "none" && anim.some(([ms, props]) => ms === POWER.scanMs && props.includes("clipPath")) : c.scanShown && Math.abs(c.scan - PANEL.scan) < 1e-6 && c.glow !== "none" && anim.some(([ms]) => ms === POWER.onMs);
  check(`${theme}: ${paper ? "ink on the sheet — no scanlines, no glow, the panel's SCAN" : "phosphor behind its own scanlines, the panel's POWER ON"}; text, dim and errors at ≥ 4.5:1`, okMaterial && [c.base, c.dim, c.hot].every((v) => v !== null && v >= 4.5) && logs.length === 0, { ...c, anim, logs: logs.slice(0, 2) });
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, "shell-gate.json"), JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed · report: .artifacts/shell-gate.json`);
process.exit(failed.length ? 1 : 0);
