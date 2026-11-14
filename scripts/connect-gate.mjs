#!/usr/bin/env node
/**
 * The gate for Part 12 (PROMPTS.md): 08 CONNECT and 09 HALT in the installed Chrome, the pattern of
 * scripts/credentials-gate.mjs.
 *
 *   BASE_URL=http://localhost:3200 node scripts/connect-gate.mjs      (a production build)
 *
 * The endpoint over HTTP: every refusal (405 415 403 413 400 422), the honeypot's quiet 202, and
 * failing closed (503) with no limiter or sender — or, on a configured local server, one real send
 * (GATE_CONTACT_SEND=1 allows it elsewhere) — with no-store on every answer. The client: no secret
 * and no react-hook-form or zod in first-load JS. The page: SEND A SIGNAL's per-character reveal
 * (the only one after the hero), the email and COPY, the teletype's labels, order, caret, focus and
 * errors (aria-live, aria-invalid), the 2.5 s floor, the real transmission log, TRANSMISSION
 * RECEIVED with TRANSMIT, the mailto fallback (503, 429, no answer), availability recomputed here
 * for six time zones, the channels and the download. HALT: the LED marquee and its velocity, the
 * index, the build line, back to top (900 ms, quiet, interruptible), the last pixel's 450 ms power-
 * off with HALT, and every way back. The editions (reduced motion, a phone, Paper, no JS), contrast,
 * CLS and a clean console. Report: .artifacts/connect-gate.json
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const ROOT = new URL("../", import.meta.url).pathname;
const OUT = join(ROOT, ".artifacts");
mkdirSync(OUT, { recursive: true });
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);
const MIN_FILL_MS = 2500; // lib/contact.ts CONTACT.minFillMs
const MAX_BODY = 16_000; // CONTACT.maxBody
const VISITOR_DAY = ["09:00", "17:00"]; // CONTACT.visitorDay
const COPIED_MS = 1600; // ConnectBehavior's toast
const REARM_PX = 48; // HaltBehavior
const GLIDE_MS = 900; // duration.scene.in
const POWER_OFF_MS = 450; // DESIGN.md §7.4, lib/timelines.ts POWER.offMs
const MARQUEE = { base: 40, max: 4 }; // components/ui/Marquee.tsx
const TARGET_PX = 24; // WCAG 2.5.8
const MAX_TIMED_MS = 900; // lib/motion.ts

const checks = [];
const report = { base: BASE, checks, measures: {} };
function check(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

// ── the content, as the page states it (no TS import here: read back from the server's HTML) ──
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const nextMajor = JSON.parse(readFileSync(join(ROOT, "node_modules/next/package.json"), "utf8")).version.split(".")[0];
const threeRev = `r${JSON.parse(readFileSync(join(ROOT, "node_modules/three/package.json"), "utf8")).version.split(".")[1]}`;

// ── availability, worked out again here (Intl's longOffset — not lib/contact.ts's method) ──
function zoneOffset(zone, at) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}
const mins = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const clock = (m) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
function expectedOverlap(mine, zone, at) {
  const shift = zoneOffset(zone, at) - zoneOffset(mine.zone, at);
  const a = mins(mine.start) + shift;
  const b = mins(mine.end) + shift;
  const [c, d] = VISITOR_DAY.map(mins);
  let best = null;
  for (const k of [-1440, 0, 1440]) {
    const from = Math.max(a + k, c);
    const to = Math.min(b + k, d);
    if (to > from && (!best || to - from > best.m)) best = { m: to - from, from, to };
  }
  if (!best) return { start: clock(a) };
  const h = Math.floor(best.m / 60);
  const r = best.m % 60;
  return { span: h ? (r ? `${h}H ${String(r).padStart(2, "0")}M` : `${h}H`) : `${r}M`, from: clock(best.from), to: clock(best.to) };
}
/** the page's readout, its words set aside: OVERLAP <span> · <from>–<to> …, or … <start> … */
function readOverlap(text) {
  const o = / (\d+H(?: \d{2}M)?|\d+M) · (\d{2}:\d{2})–(\d{2}:\d{2}) /.exec(text);
  if (o) return { span: o[1], from: o[2], to: o[3] };
  const n = / (\d{2}:\d{2}) /.exec(text);
  return n ? { start: n[1] } : null;
}

// ── 1 · the endpoint, over HTTP ──────────────────────────────────────────────────────────────
{
  const person = { name: "Gate Check", email: "gate@example.com", intent: "other", message: "An automated check of the contact form." };
  const post = (json, headers = {}, body = undefined) => fetch(`${BASE}/api/contact`, { method: "POST", headers: { "content-type": "application/json", origin: BASE, ...headers }, body: body ?? JSON.stringify(json) });
  const answer = async (res) => ({ status: res.status, body: await res.json().catch(() => null), store: /no-store/.test(res.headers.get("cache-control") ?? ""), json: /application\/json/.test(res.headers.get("content-type") ?? ""), powered: res.headers.has("x-powered-by") });
  const get = await fetch(`${BASE}/api/contact`);
  check("the endpoint takes POST only: GET is 405", get.status === 405, get.status);
  const r = {
    plain: await answer(await post(null, { "content-type": "text/plain" }, "name=x")),
    cross: await answer(await post(person, { origin: "https://evil.example" })),
    nullOrigin: await answer(await post(person, { origin: "null" })),
    big: await answer(await post({ ...person, message: "x".repeat(MAX_BODY) })),
    wide: await answer(await post({ ...person, message: "€".repeat(Math.ceil(MAX_BODY / 3) + 100) })),
    broken: await answer(await post(null, {}, "{")),
    wrong: await answer(await post({ name: "", email: "x", intent: "sell", message: "hi", startedAt: Date.now() - 10_000 })),
    trap: await answer(await post({ ...person, email: "nope", website: "https://spam.example", startedAt: Date.now() })),
    fast: await answer(await post({ ...person, startedAt: Date.now() })),
  };
  check("JSON only (415), this site's origin only (403, a \"null\" origin too, never a 500)", r.plain.status === 415 && r.cross.status === 403 && r.nullOrigin.status === 403, [r.plain.status, r.cross.status, r.nullOrigin.status]);
  check(`at most ${MAX_BODY / 1000} KB, counted in bytes (413 for a 16 KB ASCII body and for ${Math.ceil(MAX_BODY / 3) + 100} € — fewer characters than the limit)`, r.big.status === 413 && r.wide.status === 413, [r.big.status, r.wide.status]);
  check("bad JSON is 400; wrong fields are 400 with a code per visible field", r.broken.status === 400 && r.wrong.status === 400 && JSON.stringify(r.wrong.body?.fields) === JSON.stringify({ name: "required", email: "email", intent: "required", message: "short" }), r.wrong.body);
  check("a filled honeypot is a quiet 202 with no id — before its other fields are judged", r.trap.status === 202 && r.trap.body?.id === null, r.trap);
  check(`faster than ${MIN_FILL_MS / 1000} s is 422 "fast"`, r.fast.status === 422 && r.fast.body?.error === "fast", r.fast.body);
  if (LOCAL || process.env.GATE_CONTACT_SEND === "1") {
    const sent = await answer(await post({ ...person, startedAt: Date.now() - MIN_FILL_MS - 500 }));
    report.measures.configured = sent.status === 202;
    check(
      sent.status === 202 ? "configured: a person's message is really sent (202 with Resend's id)" : "fails closed: with no limiter or sender configured, a person's message is a 503 and nothing is sent",
      (sent.status === 503 && sent.body?.error === "unavailable") || (sent.status === 202 && typeof sent.body?.id === "string"),
      sent.body,
    );
    r.sent = sent;
  }
  const all = Object.values(r);
  check("every answer is JSON, no-store, without x-powered-by", all.every((a) => a.store && a.json && !a.powered), all.map((a) => [a.status, a.store, a.json, a.powered]));
}

// ── 2 · the client bundle ──────────────────────────────────────────────────────────────────────
const html = await (await fetch(`${BASE}/`)).text();
// (a dev server's devtools bundle carries its own zod; it's never in a production page)
const firstLoad = [...new Set([...html.matchAll(/<script([^>]*)src="([^"]+)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))].filter((s) => !/next-devtools/.test(s));
{
  const bodies = await Promise.all(firstLoad.map(async (s) => (await fetch(BASE + s)).text()));
  check("first-load JS carries neither react-hook-form nor zod (they arrive with the form's first focus, or on idle)", bodies.every((b) => !/shouldUnregister/.test(b) && !/ZodError/.test(b)), { scripts: firstLoad.length, rhf: bodies.filter((b) => /shouldUnregister/.test(b)).length, zod: bodies.filter((b) => /ZodError/.test(b)).length });
  const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".js") ? [join(d, f)] : [])) : []);
  const chunks = walk(join(ROOT, ".next/static"));
  const NAMES = /RESEND_API_KEY|UPSTASH_REDIS_REST|api\.resend\.com|retrograde:contact|onboarding@resend\.dev/;
  // the secrets' values too, when there are any here (never printed: only their names are)
  const env = existsSync(join(ROOT, ".env.local")) ? readFileSync(join(ROOT, ".env.local"), "utf8") : "";
  const values = [...env.matchAll(/^(RESEND_API_KEY|UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN)=["']?([^"'\n]+)["']?$/gm)].filter((m) => m[2].length >= 8).map((m) => ({ name: m[1], value: m[2] }));
  const leaks = chunks.filter((f) => {
    const s = readFileSync(f, "utf8");
    return NAMES.test(s) || values.some((v) => s.includes(v.value));
  });
  check("nothing secret in any client chunk: no key's name, value or the send's endpoint", chunks.length > 0 && leaks.length === 0, { chunks: chunks.length, valuesChecked: values.map((v) => v.name), leaks: leaks.map((f) => f.slice(ROOT.length)) });
}

// ── the browser ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ channel: "chrome" });
const IGNORED = [/Download the React DevTools/];
const CLS_INIT = () => {
  window.__cls = 0;
  // every counted shift with what moved, from where to where (x y w h), for the report
  window.__shifts = [];
  const desc = (n) => {
    const el = n?.nodeType === 3 ? n.parentElement : n;
    return el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.split(" ").slice(0, 2).join(".")}` : ""}` : "?";
  };
  const rect = (r) => [r.x, r.y, r.width, r.height].map(Math.round);
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      const nodes = (e.sources ?? []).map((s) => s.node).filter(Boolean);
      const el = (n) => (n.nodeType === 3 ? n.parentElement : n);
      if (nodes.length && nodes.every((n) => el(n)?.closest?.(".stage-debug"))) continue;
      window.__cls += e.value;
      window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: (e.sources ?? []).map((s) => ({ n: desc(s.node), from: rect(s.previousRect), to: rect(s.currentRect) })) });
    }
  }).observe({ type: "layout-shift", buffered: true });
};
// every view transition's animations, for the power-off's 450 ms
const VT_SPY = () => {
  window.__vt = [];
  const start = document.startViewTransition?.bind(document);
  if (!start) return;
  document.startViewTransition = (arg) => {
    const vt = start(arg);
    const rec = { at: performance.now(), anims: null };
    window.__vt.push(rec);
    vt.ready
      .then(() => new Promise((r) => requestAnimationFrame(r))) // eslint-disable-line no-restricted-globals
      .then(() => {
        rec.anims = document.documentElement.getAnimations({ subtree: true }).filter((a) => a.effect?.pseudoElement?.startsWith("::view-transition")).map((a) => ({ pseudo: a.effect.pseudoElement, ms: a.effect.getTiming().duration }));
      })
      .catch(() => {});
    return vt;
  };
};

async function open(path, { viewport = { width: 1440, height: 900 }, dpr = 1, mobile = false, theme = "phosphor", reduced = false, js = true, tz = "Europe/London", clipboard = false, fixed = null, hash = "" } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: reduced ? "reduce" : "no-preference", javaScriptEnabled: js, timezoneId: tz });
  if (clipboard) await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await ctx.addInitScript(
    ({ theme }) => {
      sessionStorage.setItem("retrograde:booted", "1");
      localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme, sound: false, gfx: "auto" }, version: 1 }));
    },
    { theme },
  );
  await ctx.addInitScript(CLS_INIT);
  await ctx.addInitScript(VT_SPY);
  const page = await ctx.newPage();
  if (fixed) await page.clock.setFixedTime(fixed);
  const logs = [];
  const api = (u) => /\/api\/contact$/.test(u ?? "");
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (IGNORED.some((r) => r.test(m.text()))) return;
    // the endpoint's refusals are asserted on their own; the browser's resource line for them isn't noise
    if (/Failed to load resource/.test(m.text()) && api(m.location()?.url)) return;
    logs.push(`${m.type()}: ${m.text()}`.slice(0, 240));
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`.slice(0, 240)));
  ctx.on("requestfailed", (r) => !api(r.url()) && logs.push(`requestfailed: ${r.failure()?.errorText ?? "?"} ${r.url()}`.slice(0, 240)));
  ctx.on("response", (r) => r.status() >= 400 && !api(r.url()) && logs.push(`HTTP ${r.status()}: ${r.url()}`.slice(0, 240)));
  const js_ = [];
  ctx.on("response", (r) => /\.js(\?|$)/.test(r.url()) && js_.push(r.url().replace(BASE, "")));
  await page.goto(`${BASE}${path}${js ? `${path.includes("?") ? "&" : "?"}debug=1` : ""}${hash}`, { waitUntil: "load" });
  if (js) {
    await page.waitForTimeout(600);
    await page.addStyleTag({ content: ".stage-debug{display:none!important}" });
  }
  return { ctx, page, logs, scripts: js_ };
}
const cues = (page) => page.evaluate(() => Object.fromEntries(window.__retrograde?.cues?.played ?? []));
/** scroll to y (or "end"), through Lenis when it's there: a native scrollTo during its animation is undone on its next frame */
const jumpTo = (page, y) =>
  page.evaluate((y) => {
    const target = y === "end" ? document.documentElement.scrollHeight - innerHeight : y;
    const lenis = window.__retrograde?.lenis?.();
    if (lenis) {
      lenis.resize();
      lenis.scrollTo(target, { immediate: true, force: true });
    } else window.scrollTo(0, target);
  }, y);
const endOf = (page) => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
const toSection = async (page, id) => {
  await jumpTo(page, await page.evaluate((id) => document.getElementById(id).getBoundingClientRect().top + window.scrollY, id));
  await page.waitForTimeout(700);
};
const behaviourIn = (page) => page.waitForFunction(() => !!document.querySelector("[data-connect-copy]:not([data-pending])"), null, { timeout: 15_000 });
const fill = async (page, v) => {
  await page.locator("#cx-name").fill(v.name);
  await page.locator("#cx-email").fill(v.email);
  await page.locator("#cx-intent").selectOption(v.intent);
  await page.locator("#cx-message").fill(v.message);
};
const visitor = { name: "Ada Lovelace", email: "ada@example.com", intent: "collaborate", message: "Hello — interpretable models for logistics? Rates & dates #1" };
const formState = (page) =>
  page.evaluate(() => {
    const f = document.querySelector("form[data-connect-form]");
    return {
      state: f?.dataset.state ?? null,
      log: [...document.querySelectorAll(".teletype__logline")].map((l) => ({ text: l.textContent.trim(), glyph: !!l.querySelector(".pixel-glyph"), oneLine: l.getBoundingClientRect().height < parseFloat(getComputedStyle(l).lineHeight) * 1.5 })),
      note: document.querySelector("[data-connect-note]")?.textContent ?? "",
      fallback: !document.querySelector("[data-connect-fallback]")?.hidden,
      mailto: document.querySelector("[data-connect-mailto]")?.getAttribute("href") ?? null,
      received: !document.querySelector("[data-connect-received]")?.hidden,
      focus: document.activeElement?.id || document.activeElement?.className || null,
    };
  });

// labels, read back from the server's own HTML (the content's words)
let words = null;

// ── 3 · CONNECT on a desk: the reveal, the email, the form, availability, channels ──────────────
{
  const { ctx, page, logs, scripts } = await open("/", { clipboard: true });
  const reveals = await page.evaluate(() => [...document.querySelectorAll('[data-reveal="chars"]')].map((el) => ({ hero: !!el.closest("#system"), connect: !!el.closest("#connect"), text: el.textContent.trim() })));
  const invite = await page.evaluate(() => {
    const el = document.querySelector("#connect .connect-invite");
    // --step-5 is a clamp(): measured on a probe, not parsed
    const probe = document.createElement("span");
    probe.style.fontSize = "var(--step-5)";
    document.body.append(probe);
    const step5 = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return { text: el?.textContent.trim(), size: parseFloat(getComputedStyle(el).fontSize), step5, revealed: el?.hasAttribute("data-revealed") };
  });
  // watch the reveal play as the section arrives
  await page.evaluate(() => {
    const el = document.querySelector("#connect .connect-invite");
    window.__reveal = { chars: 0 };
    new MutationObserver(() => {
      if (el.hasAttribute("data-revealing") && !window.__reveal.start) {
        window.__reveal.start = performance.now();
        window.__reveal.chars = el.querySelectorAll("[style*='clip-path']").length;
      }
      if (el.hasAttribute("data-revealed") && !window.__reveal.end) window.__reveal.end = performance.now();
    }).observe(el, { attributes: true, subtree: true });
  });
  await toSection(page, "connect");
  await page.waitForFunction(() => !!window.__reveal.end, null, { timeout: 5000 }).catch(() => {});
  const reveal = await page.evaluate(() => ({ ...window.__reveal, ms: window.__reveal.end - window.__reveal.start }));
  report.measures.reveal = reveal;
  check(
    "SEND A SIGNAL at --step-5, revealed per character (the only per-character reveal after the hero), within 900 ms",
    reveals.filter((r) => !r.hero).length === 1 && reveals.find((r) => r.connect) && invite.revealed === false && Math.abs(invite.size - invite.step5) < 1 && reveal.chars >= invite.text.replace(/\s/g, "").length && reveal.ms <= MAX_TIMED_MS,
    { invite, reveal, others: reveals.filter((r) => !r.hero && !r.connect) },
  );

  const email = await page.evaluate(() => {
    const a = document.querySelector(".connect-email__link");
    return { href: a?.getAttribute("href"), text: a?.textContent, size: parseFloat(getComputedStyle(a).fontSize) };
  });
  check("the email is a giant mailto: link", email.href === `mailto:${email.text}` && email.size >= 40, email);

  // the form's behaviour isn't first-load: it comes with the first focus (or idle, whichever is first)
  await page.locator("#cx-name").focus();
  await behaviourIn(page);
  await page.waitForTimeout(300);
  const lazy = [...new Set(scripts.filter((s) => !firstLoad.includes(s)))];
  const lazyBodies = await Promise.all(lazy.map(async (s) => ({ s, b: Buffer.from(await (await fetch(BASE + s)).arrayBuffer()) })));
  const rhf = lazyBodies.filter((x) => /shouldUnregister/.test(x.b.toString()));
  const own = lazyBodies.filter((x) => /teletype__logline/.test(x.b.toString()));
  const halt = lazyBodies.filter((x) => /halt-screen__line/.test(x.b.toString()));
  report.measures.lazy = { form: rhf.map((x) => ({ chunk: x.s, gz: gz(x.b) })), behaviour: own.map((x) => ({ chunk: x.s, gz: gz(x.b) })), halt: halt.map((x) => ({ chunk: x.s, gz: gz(x.b) })) };
  check("react-hook-form, the form's behaviour and HALT's arrive lazily (sizes measured here, gz)", rhf.length > 0 && own.length > 0 && halt.length > 0, report.measures.lazy);

  // COPY and its toast
  await page.locator("[data-connect-copy]").click();
  await page.waitForTimeout(100);
  const copied = await page.evaluate(async () => {
    const s = document.querySelector("[data-connect-copied]");
    return { clip: await navigator.clipboard.readText(), shown: !s.hidden, text: s.textContent.trim(), glyph: !!s.querySelector(".pixel-glyph"), oneLine: s.getBoundingClientRect().height < parseFloat(getComputedStyle(s).lineHeight) * 1.5 };
  });
  await page.waitForTimeout(COPIED_MS + 200);
  const gone = await page.evaluate(() => document.querySelector("[data-connect-copied]").hidden);
  check(`COPY puts the email on the clipboard; "${copied.text} ✓" (the ✓ drawn, on the same line) for ${COPIED_MS} ms`, copied.clip === email.text && copied.shown && copied.glyph && copied.oneLine && gone, { ...copied, gone });

  // the teletype: prompts, names, order, caret, focus
  const form = await page.evaluate(() => {
    const f = document.querySelector("form[data-connect-form]");
    const fields = ["name", "email", "intent", "message"].map((k) => {
      const el = f.elements.namedItem(k);
      const err = document.getElementById(el.getAttribute("aria-describedby"));
      return { k, prompt: f.querySelector(`[data-field="${k}"] .teletype__prompt [aria-hidden]`)?.textContent, label: el.labels?.[0]?.querySelector(".sr-only")?.textContent, live: err?.getAttribute("aria-live"), required: el.required };
    });
    const trap = f.elements.namedItem("website");
    const rect = trap.getBoundingClientRect();
    return { fields, intents: [...f.querySelectorAll("#cx-intent option")].filter((o) => o.value).map((o) => o.value), trap: { tab: trap.tabIndex, hidden: !!trap.closest("[aria-hidden=true]"), offscreen: rect.right < 0 || rect.left > innerWidth }, noValidate: f.noValidate };
  });
  words = await page.evaluate(() => ({ labels: [...document.querySelectorAll("form[data-connect-form] .teletype__prompt .sr-only")].map((s) => s.textContent) }));
  check("the prompts NAME> EMAIL> INTENT> MESSAGE>, each field named by its label, errors on aria-live", form.fields.map((f) => f.prompt).join(" ") === "NAME> EMAIL> INTENT> MESSAGE>" && form.fields.every((f) => f.label && f.live === "polite" && f.required), form.fields);
  check("INTENT offers hire / collaborate / research / speak / other", form.intents.join(" ") === "hire collaborate research speak other", form.intents);
  check("the honeypot is out of the tab order, hidden from screen readers and off screen; JS takes validation over", form.trap.tab === -1 && form.trap.hidden && form.trap.offscreen && form.noValidate, { ...form.trap, noValidate: form.noValidate });
  const named = [];
  for (const [name, role] of [
    [words.labels[0], "textbox"],
    [words.labels[1], "textbox"],
    [words.labels[2], "combobox"],
    [words.labels[3], "textbox"],
  ])
    named.push([name, role, await page.getByRole(role, { name, exact: true }).count()]);
  check("a screen reader finds each field by its label's words (NAME> etc. are hidden from it)", named.every(([, , n]) => n === 1), named);
  await page.locator("#cx-name").focus();
  const order = [await page.evaluate(() => document.activeElement.id)];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    order.push(await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute("type")));
  }
  check("Tab walks NAME → EMAIL → INTENT → MESSAGE → TRANSMIT (the honeypot skipped)", order.join(" ") === "cx-name cx-email cx-intent cx-message submit", order);
  await page.locator("#cx-name").focus();
  const caret = await page.evaluate(() => {
    const line = document.querySelector('[data-field="name"]');
    const other = document.querySelector('[data-field="email"]');
    return { shown: getComputedStyle(line.querySelector(".teletype__caret")).visibility, ring: getComputedStyle(line).boxShadow, rest: getComputedStyle(other).boxShadow, blink: getComputedStyle(line.querySelector(".teletype__caret")).animationName };
  });
  await page.keyboard.type("A");
  const typed = await page.evaluate(() => getComputedStyle(document.querySelector('[data-field="name"] .teletype__caret')).visibility);
  check("a block caret blinks in an empty focused field and goes once there's a letter; the focused line is lit", caret.shown === "visible" && caret.blink !== "none" && typed === "hidden" && caret.ring !== caret.rest, { ...caret, typed });
  await page.locator("#cx-name").fill("");

  // errors
  await page.locator(".teletype button[type=submit]").click();
  await page.waitForTimeout(300);
  const errs = await page.evaluate(() => ({ text: [...document.querySelectorAll("[data-error-for]")].map((e) => e.textContent), invalid: ["name", "email", "intent", "message"].map((k) => document.querySelector(`form[data-connect-form]`).elements.namedItem(k).getAttribute("aria-invalid")), focus: document.activeElement.id }));
  check("an empty TRANSMIT: four errors in the content's words, aria-invalid on each, focus on the first", errs.text.every((t) => t.length > 3) && errs.invalid.every((v) => v === "true") && errs.focus === "cx-name", errs);
  await page.locator("#cx-name").fill(visitor.name);
  await page.locator("#cx-email").focus();
  await page.waitForTimeout(150);
  const cleared = await page.evaluate(() => ({ text: document.querySelector('[data-error-for="name"]').textContent, invalid: document.getElementById("cx-name").getAttribute("aria-invalid") }));
  check("…and an error clears as its field is put right", cleared.text === "" && cleared.invalid === null, cleared);

  // the real send: this server's answer (503 unconfigured), the log, the fallback
  await fill(page, visitor);
  await page.waitForTimeout(MIN_FILL_MS);
  await page.locator(".teletype button[type=submit]").click();
  await page.waitForFunction(() => document.querySelectorAll(".teletype__logline").length >= 3, null, { timeout: 15_000 });
  await page.waitForTimeout(700);
  const real = await formState(page);
  report.measures.realSend = real;
  const decoded = real.mailto ? decodeURIComponent(real.mailto.split("&body=")[1] ?? "") : "";
  if (report.measures.configured) check("the real send: VALIDATE ✓ · POST /api/contact · 202 ✓ · ID re_…, then TRANSMISSION RECEIVED", real.state === "received" && /^ID re_/.test(real.log[3]?.text ?? ""), real.log);
  else
    check(
      "the log is real: Validate ✓ · POST /api/contact · 503 SERVICE UNAVAILABLE — the ✓ drawn on its line; the line-down note; a mailto that keeps the visitor's words",
      real.log[0]?.glyph && real.log[0]?.oneLine && real.log[1]?.text === "POST /api/contact" && real.log[2]?.text === "503 SERVICE UNAVAILABLE" && real.note.length > 0 && real.fallback && decoded.startsWith(visitor.message) && decoded.includes(`— ${visitor.name} <${visitor.email}>`),
      { log: real.log, note: real.note, decoded },
    );

  // TRANSMISSION RECEIVED (202 answered here), and Send another
  await page.route("**/api/contact", (r) => r.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ status: 202, id: "re_gate_0001" }) }));
  const cuesBefore = await cues(page);
  await page.locator(".teletype button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("form[data-connect-form]")?.dataset.state === "received", null, { timeout: 10_000 });
  await page.waitForTimeout(500);
  const ok = await formState(page);
  const cuesAfter = await cues(page);
  const lines = await page.evaluate(() => [...document.querySelectorAll(".teletype__line")].every((l) => getComputedStyle(l).display === "none"));
  check("202: the log ends ID re_…, TRANSMISSION RECEIVED takes the form's place with focus, and TRANSMIT plays once", ok.received && ok.focus === "teletype__received" && ok.log.at(-1)?.text === "ID re_gate_0001" && ok.log.at(-2)?.glyph && lines && (cuesAfter.TRANSMIT ?? 0) - (cuesBefore.TRANSMIT ?? 0) === 1, { log: ok.log, focus: ok.focus, transmit: (cuesAfter.TRANSMIT ?? 0) - (cuesBefore.TRANSMIT ?? 0) });
  await page.locator("[data-connect-again]").click();
  await page.waitForTimeout(200);
  const again = await page.evaluate(() => ({ focus: document.activeElement.id, values: ["name", "email", "message"].map((k) => document.getElementById(`cx-${k}`).value), log: document.querySelector("[data-connect-log]").hidden, received: document.querySelector("[data-connect-received]").hidden }));
  check("SEND ANOTHER: an empty form, the log put away, focus on NAME>", again.focus === "cx-name" && again.values.every((v) => v === "") && again.log && again.received, again);

  // the refusals the visitor can meet: the rate limit and no answer at all
  await page.unroute("**/api/contact");
  await page.route("**/api/contact", (r) => r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ status: 429, error: "rate" }) }));
  await fill(page, visitor);
  await page.waitForTimeout(MIN_FILL_MS);
  await page.locator(".teletype button[type=submit]").click();
  await page.waitForTimeout(800);
  const rate = await formState(page);
  await page.unroute("**/api/contact");
  await page.route("**/api/contact", (r) => r.abort("connectionrefused"));
  await page.locator(".teletype button[type=submit]").click();
  await page.waitForTimeout(800);
  const none = await formState(page);
  await page.unroute("**/api/contact");
  check("429: the rate limit said in words, the mailto offered; no answer at all: NO RESPONSE, the line-down note, the mailto", rate.log.at(-1)?.text === "429 TOO MANY REQUESTS" && rate.note && rate.fallback && rate.note !== none.note && none.log.at(-1)?.text === "NO RESPONSE" && none.fallback, { rate: [rate.log.at(-1)?.text, rate.note], none: [none.log.at(-1)?.text, none.note] });

  // availability: the status, my time ticking, the overlap (recomputed below for six zones)
  const avail = await page.evaluate(async () => {
    const c = document.querySelector("[data-connect-clock]");
    const a = c.textContent;
    await new Promise((r) => setTimeout(r, 1300));
    const o = document.querySelector("[data-connect-overlap]");
    return { dot: document.querySelector(".availability__dot")?.dataset.status, a, b: c.textContent, zone: c.dataset.zone, mine: { zone: o.dataset.zone, start: o.dataset.start, end: o.dataset.end }, overlap: o.textContent };
  });
  const ist = new Intl.DateTimeFormat("en-GB", { timeZone: avail.zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date());
  const skew = Math.abs(mins(avail.b.slice(0, 5)) * 60 + Number(avail.b.slice(6, 8)) - (mins(ist.slice(0, 5)) * 60 + Number(ist.slice(6, 8))));
  check("availability: the status dot, my time ticking in my zone (IST), the owner's confirmed hours (10:00–18:00, Asia/Kolkata)", avail.dot === "limited" && /^\d{2}:\d{2}:\d{2} IST$/.test(avail.b) && avail.a !== avail.b && (skew <= 2 || skew >= 86_398) && JSON.stringify(avail.mine) === JSON.stringify({ zone: "Asia/Kolkata", start: "10:00", end: "18:00" }), { ...avail, ist, skew });
  report.measures.mine = avail.mine;

  // channels and downloads
  const ch = await page.evaluate(() => ({
    links: [...document.querySelectorAll(".channels a")].map((a) => ({ text: a.querySelector(".btn__label > span")?.textContent, href: a.getAttribute("href"), blank: a.target === "_blank", rel: a.rel })),
    ctas: [...document.querySelectorAll(".connect-ctas a")].map((a) => ({ href: a.getAttribute("href"), download: a.hasAttribute("download"), text: a.textContent })),
    resume: [...document.querySelectorAll("a .btn__label > span:first-child")].filter((s) => /^(download )?r[ée]sum[ée]$/i.test(s.textContent.trim())).length,
  }));
  const ext = ch.links.filter((l) => !l.href.startsWith("mailto:"));
  const pdf = ch.ctas[0] ? await fetch(BASE + ch.ctas[0].href) : null;
  const pdfHead = pdf ? Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString() : null;
  check("channels: only the ones the owner has (Email, LinkedIn, GitHub — no dead Scholar, ORCID or X), the others in a new tab", ch.links[0]?.href === `mailto:${email.text}` && ext.length >= 1 && ext.every((l) => l.blank && /noopener/.test(l.rel) && /^https:/.test(l.href)), ch.links);
  check("DOWNLOAD PUBLICATION LIST (PDF) downloads a real PDF; no résumé anywhere until a phone-free one exists", ch.ctas.length === 1 && ch.ctas[0].download && ch.ctas[0].href === "/media/publications.pdf" && pdf?.status === 200 && /application\/pdf/.test(pdf.headers.get("content-type") ?? "") && pdfHead === "%PDF-" && ch.resume === 0, { ctas: ch.ctas, status: pdf?.status, head: pdfHead, resume: ch.resume });
  const channel = page.locator(".channels a").nth(1);
  const at0 = await channel.evaluate((a) => ({ t: getComputedStyle(a).transform, icon: getComputedStyle(a.querySelector(".btn__icon")).translate }));
  const box = await channel.boundingBox();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2, { steps: 6 });
  await page.waitForTimeout(450);
  const at1 = await channel.evaluate((a) => ({ t: getComputedStyle(a).transform, icon: getComputedStyle(a.querySelector(".btn__icon")).translate }));
  check("a channel is magnetic (it leans to the pointer) and its arrow slides", at1.t !== at0.t && at1.t !== "none" && at1.icon === "2px -2px", { at0, at1 });
  await page.mouse.move(5, 450);

  const cls = await page.evaluate(() => window.__cls);
  check("CONNECT on a desk: CLS 0 and the console clean", cls < 0.001 && logs.length === 0, { cls, logs: logs.slice(0, 4) });
  await ctx.close();
}

// ── 4 · availability, recomputed here for six zones (today, and DESIGN's London winter) ─────────
{
  const mine = report.measures.mine;
  const zones = ["Europe/London", "America/New_York", "Asia/Kolkata", "Asia/Tokyo", "Pacific/Auckland", "America/Los_Angeles"];
  // landing on #connect, hands off: the behaviour arrives on idle with the section in view
  const seen = {};
  for (const [i, tz] of zones.entries()) {
    const { ctx, page, logs } = await open("/", { tz, hash: "#connect", ...(i % 2 ? { viewport: { width: 390, height: 844 }, mobile: true } : {}) });
    await behaviourIn(page);
    await page.waitForTimeout(400);
    const at = await page.evaluate(() => ({ text: document.querySelector("[data-connect-overlap]").textContent, inView: document.querySelector("[data-connect-overlap]").getBoundingClientRect().top < innerHeight, cls: window.__cls, shifts: window.__shifts }));
    seen[tz] = { ...at, desk: !(i % 2), logs: logs.slice(0, 2) };
    await ctx.close();
  }
  const now = new Date();
  const wrong = zones.filter((tz) => JSON.stringify(readOverlap(seen[tz].text)) !== JSON.stringify(expectedOverlap(mine, tz, now)));
  report.measures.overlaps = Object.fromEntries(zones.map((tz) => [tz, seen[tz].text]));
  check("the overlap, worked out here from Intl's own offsets for six zones, matches the page's to the minute", wrong.length === 0, { seen: report.measures.overlaps, wrong: wrong.map((tz) => [tz, expectedOverlap(mine, tz, now)]) });
  check("landing on #connect (desk and phone): COPY and the readout arrive on idle without moving anything (CLS 0), console clean", zones.every((tz) => (seen[tz].inView || !seen[tz].desk) && seen[tz].cls < 0.001 && seen[tz].logs.length === 0), Object.fromEntries(zones.map((tz) => [tz, [seen[tz].inView, +seen[tz].cls.toFixed(4), seen[tz].logs, ...(seen[tz].cls ? [seen[tz].shifts] : [])]])));
  const { ctx, page } = await open("/", { tz: "Europe/London", fixed: new Date("2026-01-15T12:00:00Z") });
  await toSection(page, "connect");
  await page.locator("#cx-name").focus();
  await behaviourIn(page);
  await page.waitForTimeout(200);
  const winter = await page.evaluate(() => document.querySelector("[data-connect-overlap]").textContent);
  check("DESIGN.md's example, on a London winter's day: OVERLAP 3H 30M · 09:00–12:30 YOUR TIME", winter.toUpperCase() === "OVERLAP 3H 30M · 09:00–12:30 YOUR TIME", winter);
  await ctx.close();
}

// ── 5 · HALT on a desk: the marquee, the index, the build line, back to top, the last pixel ────
{
  const { ctx, page, logs } = await open("/");
  await jumpTo(page, (await endOf(page)) - 3);
  await page.waitForTimeout(1500);
  const foot = await page.evaluate(() => {
    const m = document.querySelector(".halt-marquee");
    const copies = [...m.querySelectorAll(".marquee__copy")];
    return {
      label: m.getAttribute("aria-label"),
      readable: copies.filter((c) => !c.hasAttribute("aria-hidden")).length,
      text: copies[0]?.textContent,
      mask: getComputedStyle(m.querySelector(".halt-marquee__text")).maskImage,
      sections: [...document.querySelectorAll(".halt-index__group")][0] ? [...[...document.querySelectorAll(".halt-index__group")][0].querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href"), !!document.getElementById(a.getAttribute("href").slice(1))]) : [],
      groups: [...document.querySelectorAll(".halt-index__group")].map((g) => [...g.querySelectorAll("a")].map((a) => a.getAttribute("href"))),
      build: document.querySelector(".halt-build")?.textContent,
      top: document.querySelector("[data-halt-top]")?.getAttribute("href"),
    };
  });
  check("the marquee: name and role, one readable copy (the repeats aria-hidden), lit through an LED dot mask", foot.label === foot.text && foot.readable === 1 && /radial-gradient/.test(foot.mask), { label: foot.label, readable: foot.readable, mask: foot.mask.slice(0, 50) });
  const pages = [...foot.groups[1], ...foot.groups[2]];
  const statuses = await Promise.all(pages.map(async (h) => (await fetch(BASE + h)).status));
  check("the index: every section (01 SYSTEM … 09 HALT, each a target on the page), every project and publication (each a 200)", foot.sections.length === 9 && foot.sections.every(([, , there]) => there) && /^01 SYSTEM$/.test(foot.sections[0][0]) && /^09 HALT$/.test(foot.sections[8][0]) && statuses.every((s) => s === 200) && foot.groups[1].length > 0 && foot.groups[2].length > 0, { sections: foot.sections.map((s) => s[0]), projects: foot.groups[1].length, publications: foot.groups[2].length, statuses });
  const m = /^v(\S+) · ([0-9a-f]{7,})(\+?) · \S+ (\d{4}-\d{2}-\d{2}) · .+ NEXT (\d+) · THREE (r\d+)$/.exec(foot.build ?? "");
  let commit = false;
  try {
    execSync(`git cat-file -e ${m?.[2]}^{commit}`, { cwd: ROOT, stdio: "ignore" });
    commit = true;
  } catch {}
  check("the build line is true: package.json's version, a commit in this repository, the deploy date, NEXT and THREE as installed", m && m[1] === pkg.version && commit && m[4] <= new Date().toISOString().slice(0, 10) && m[5] === nextMajor && m[6] === threeRev, { build: foot.build, commit, version: pkg.version, next: nextMajor, three: threeRev });

  // the marquee's pace: 40 px/s at rest, faster with the scroll (≤ 4×)
  await page.mouse.move(720, 30);
  const pace = (ms) =>
    page.evaluate((ms) => {
      const track = document.querySelector(".halt-marquee .marquee__track");
      const width = track.querySelector(".marquee__copy").offsetWidth;
      const read = () => new DOMMatrix(getComputedStyle(track).transform).m41;
      return new Promise((res) => {
        let last = read();
        let moved = 0;
        const t0 = performance.now();
        const step = () => {
          const x = read();
          let dx = x - last;
          if (dx > width / 2) dx -= width;
          if (dx < -width / 2) dx += width;
          moved += Math.abs(dx);
          last = x;
          if (performance.now() - t0 < ms) requestAnimationFrame(step); // eslint-disable-line no-restricted-globals
          else res(moved / ((performance.now() - t0) / 1000));
        };
        requestAnimationFrame(step); // eslint-disable-line no-restricted-globals
      });
    }, ms);
  const rest = await pace(800);
  const fast = await Promise.all([
    pace(500),
    (async () => {
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, -160);
        await page.waitForTimeout(40);
      }
    })(),
  ]).then(([v]) => v);
  report.measures.marquee = { rest: Math.round(rest), scrolling: Math.round(fast) };
  check(`the marquee runs at ${MARQUEE.base} px/s at rest and faster with the scroll, never past ${MARQUEE.max}×`, Math.abs(rest - MARQUEE.base) < MARQUEE.base * 0.2 && fast > rest * 1.5 && fast <= MARQUEE.base * MARQUEE.max * 1.1, report.measures.marquee);

  // back to top: a quiet 900 ms glide, interruptible
  const linkAt = async () => {
    const y = await page.evaluate(() => {
      const a = document.querySelector("[data-halt-top]");
      return Math.min(document.documentElement.scrollHeight - innerHeight - 120, Math.round(a.getBoundingClientRect().top + scrollY - innerHeight / 2));
    });
    await jumpTo(page, y);
    await page.waitForTimeout(900);
    return page.locator("[data-halt-top]").boundingBox();
  };
  let b = await linkAt();
  let c0 = await cues(page);
  const t0 = Date.now();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const jumping = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(window.__retrograde.scroll.store.getState().jumping)))); // eslint-disable-line no-restricted-globals
  let took = null;
  await page
    .waitForFunction(() => scrollY < 1, null, { timeout: 4000, polling: 16 })
    .then(() => (took = Date.now() - t0))
    .catch(() => {});
  await page.waitForTimeout(300);
  let c1 = await cues(page);
  const landed = await page.evaluate(() => ({ y: scrollY, hash: location.hash, jumping: window.__retrograde.scroll.store.getState().jumping, section: window.__retrograde.scroll.store.getState().section }));
  report.measures.backToTop = { ms: took };
  check(`back to top: a ${GLIDE_MS} ms glide on transit to the top, quiet (no SECTION cue for the sections it passes), the hash cleared`, took !== null && took >= GLIDE_MS * 0.8 && took <= GLIDE_MS + 350 && jumping && !landed.jumping && landed.hash === "" && landed.section === "system" && (c1.SECTION ?? 0) === (c0.SECTION ?? 0), { took, jumpingDuring: jumping, ...landed, section: [c0.SECTION, c1.SECTION] });
  b = await linkAt();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(350);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  const caught = await page.evaluate(() => ({ y: Math.round(scrollY), jumping: window.__retrograde.scroll.store.getState().jumping }));
  await page.waitForTimeout(900);
  const stayed = await page.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash }));
  check("…and input takes it back: a wheel mid-glide stops it where it is, and the scroll is continuous again", caught.y > 2000 && !caught.jumping && stayed.y > 2000 && stayed.hash.length > 1, { caught, stayed });

  // the last pixel: POWER OFF in 450 ms with HALT's sweep, SYSTEM HALTED, and every way back
  c0 = await cues(page);
  await jumpTo(page, (await endOf(page)) - 400);
  await page.waitForTimeout(500);
  await page.mouse.move(720, 450);
  for (let i = 0; i < 30 && (await page.evaluate(() => document.documentElement.dataset.tube)) !== "off"; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(POWER_OFF_MS + 300);
  c1 = await cues(page);
  const off = await page.evaluate(() => ({
    tube: document.documentElement.dataset.tube,
    atEnd: Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 1,
    line: document.querySelector(".halt-screen__line")?.textContent ?? null,
    role: document.querySelector(".halt-screen")?.getAttribute("role"),
    screen: getComputedStyle(document.getElementById("screen")).visibility,
    vt: window.__vt.at(-1)?.anims ?? null,
  }));
  const offMs = off.vt?.filter((a) => a.pseudo.startsWith("::view-transition-old")).map((a) => a.ms) ?? [];
  report.measures.powerOff = { vt: off.vt };
  check(`the last pixel: POWER OFF (${POWER_OFF_MS} ms) with HALT's sweep, then SYSTEM HALTED. SCROLL UP TO RESUME. (role=status)`, off.tube === "off" && off.atEnd && off.line?.length > 10 && off.role === "status" && off.screen === "hidden" && offMs.includes(POWER_OFF_MS) && (c1.HALT ?? 0) - (c0.HALT ?? 0) === 1 && (c1.POWER ?? 0) === (c0.POWER ?? 0), { ...off, offMs, halt: (c1.HALT ?? 0) - (c0.HALT ?? 0) });
  // more wheel down: still off, nothing re-armed
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(200);
  const stillOff = await page.evaluate(() => document.documentElement.dataset.tube);
  const y0 = await page.evaluate(() => scrollY);
  const tUp = Date.now();
  await page.mouse.wheel(0, -200);
  await page.waitForFunction(() => document.documentElement.dataset.tube !== "off", null, { timeout: 2000 }).catch(() => {});
  const onIn = Date.now() - tUp;
  await page.waitForTimeout(500);
  const up = await page.evaluate(() => ({ tube: document.documentElement.dataset.tube ?? null, y: scrollY, line: document.querySelector(".halt-screen__line")?.textContent ?? null }));
  check("an upward scroll turns it back on at once — and scrolls (it never holds the page); a downward one doesn't", stillOff === "off" && up.tube !== "off" && onIn < 250 && y0 - up.y > 50 && up.line === null, { stillOff, onIn, scrolled: Math.round(y0 - up.y) });
  // not re-armed until scrolled back up REARM_PX; then a key turns it back on
  await jumpTo(page, (await endOf(page)) - REARM_PX - 40);
  await page.waitForTimeout(400);
  await jumpTo(page, "end");
  await page.waitForTimeout(POWER_OFF_MS + 300);
  const offAgain = await page.evaluate(() => document.documentElement.dataset.tube);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  const byKey = await page.evaluate(() => document.documentElement.dataset.tube ?? null);
  check("back down after a real scroll up, it halts again; a key press turns it back on", offAgain === "off" && byKey !== "off", { offAgain, byKey });
  // and with no input event at all — a scrollbar's drag, a script's scroll — leaving the end turns it on
  await jumpTo(page, (await endOf(page)) - REARM_PX - 40);
  await page.waitForTimeout(400);
  await jumpTo(page, "end");
  await page.waitForTimeout(POWER_OFF_MS + 300);
  const offThird = await page.evaluate(() => document.documentElement.dataset.tube);
  await jumpTo(page, (await endOf(page)) - 300);
  await page.waitForTimeout(250);
  const byScroll = await page.evaluate(() => document.documentElement.dataset.tube ?? null);
  check("…and leaving the end with no input event at all (a scrollbar's drag, a script) turns it back on too", offThird === "off" && byScroll !== "off", { offThird, byScroll });
  const cls = await page.evaluate(() => window.__cls);
  check("HALT on a desk: CLS 0 and the console clean", cls < 0.001 && logs.length === 0, { cls, logs: logs.slice(0, 4) });
  await ctx.close();
}

// ── 6 · the editions ───────────────────────────────────────────────────────────────────────────
{
  // reduced motion: no per-character reveal, no blinking, no typing, a still marquee, an instant top
  const { ctx, page, logs } = await open("/", { reduced: true });
  await toSection(page, "connect");
  await page.waitForTimeout(400);
  await page.locator("#cx-name").focus();
  await behaviourIn(page);
  const r = await page.evaluate(() => ({ chars: document.querySelectorAll("#connect .connect-invite [style*='clip-path']").length, caret: getComputedStyle(document.querySelector('[data-field="name"] .teletype__caret')).animationName, inviteOpacity: getComputedStyle(document.querySelector("#connect .connect-invite")).opacity }));
  await fill(page, visitor);
  await page.waitForTimeout(MIN_FILL_MS);
  await page.locator(".teletype button[type=submit]").click();
  await page.waitForFunction(() => document.querySelectorAll(".teletype__logline").length >= 3, null, { timeout: 15_000 });
  const typing = await page.evaluate(() => [...document.querySelectorAll(".teletype__logline")].map((l) => getComputedStyle(l).animationName));
  await page.waitForTimeout(400); // the log's height in, and the scroll layer's refresh after it
  await jumpTo(page, (await endOf(page)) - 3);
  await page.waitForTimeout(600);
  const t1 = await page.evaluate(() => getComputedStyle(document.querySelector(".halt-marquee .marquee__track")).transform);
  await page.waitForTimeout(500);
  const t2 = await page.evaluate(() => getComputedStyle(document.querySelector(".halt-marquee .marquee__track")).transform);
  await page.locator("[data-halt-top]").click();
  await page.waitForTimeout(150);
  const top = await page.evaluate(() => scrollY);
  await jumpTo(page, "end");
  await page.waitForTimeout(800);
  const off = await page.evaluate(() => ({ tube: document.documentElement.dataset.tube, line: document.querySelector(".halt-screen__line")?.textContent ?? null }));
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => document.documentElement.dataset.tube ?? null);
  check("reduced motion: the invitation whole at once, no blinking caret, the log untyped, a still marquee, back to top at once; the last pixel still halts and a key resumes", r.chars === 0 && r.inviteOpacity === "1" && r.caret === "none" && typing.every((a) => a === "none") && t1 === t2 && top < 2 && off.tube === "off" && off.line && back !== "off", { ...r, typing, still: t1 === t2, top, off, back });
  check("reduced motion: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
{
  // a phone
  const { ctx, page, logs } = await open("/", { viewport: { width: 390, height: 844 }, mobile: true, dpr: 3 });
  await toSection(page, "connect");
  await page.locator("#cx-name").focus();
  await behaviourIn(page);
  await page.waitForTimeout(300);
  const p = await page.evaluate((min) => {
    const small = [...document.querySelectorAll(".channels a, .connect-ctas a, [data-connect-copy], .halt-index a, .halt-top, #cx-name, #cx-email, #cx-intent, #cx-message")].map((el) => ({ el: el.id || el.className.split(" ")[0] || el.tagName, h: el.getBoundingClientRect().height })).filter((x) => x.h < min);
    const email = document.querySelector(".connect-email__link").getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth - innerWidth, email: Math.round(email.right), small };
  }, TARGET_PX);
  // a touch turns the halted tube back on
  await jumpTo(page, "end");
  await page.waitForTimeout(900);
  const off = await page.evaluate(() => document.documentElement.dataset.tube);
  await page.touchscreen.tap(6, 300);
  await page.waitForTimeout(200);
  const on = await page.evaluate(() => document.documentElement.dataset.tube ?? null);
  check(`a phone: nothing wider than the screen, the email wraps inside it, every target ≥ ${TARGET_PX} px tall; a touch turns the halted tube back on`, p.overflow <= 0 && p.email <= 390 && p.small.length === 0 && off === "off" && on !== "off", { ...p, off, on });
  check("a phone: console clean", logs.length === 0, logs.slice(0, 3));
  await ctx.close();
}
// contrast on both tubes and Paper: the prompts, the words, the micro type, an error
for (const theme of ["phosphor", "amber", "paper"]) {
  const { ctx, page, logs } = await open("/", { theme });
  await toSection(page, "connect");
  await page.locator("#cx-name").focus();
  await behaviourIn(page);
  await page.locator(".teletype button[type=submit]").click();
  await page.waitForTimeout(300);
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
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const b = getComputedStyle(e).backgroundColor;
        if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b;
      }
      return getComputedStyle(document.documentElement).backgroundColor;
    };
    const ratio = (sel) => {
      const el = document.querySelector(sel);
      const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(bgOf(el)))];
      return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2);
    };
    return { theme: document.documentElement.dataset.theme, prompt: ratio(".teletype__prompt"), error: ratio(".teletype__error:not(:empty)"), micro: ratio(".availability > p.t-micro"), build: ratio(".halt-build"), index: ratio(".halt-index__label") };
  });
  check(`${theme}: the teletype's prompts, an error, availability and the footer's micro type read at ≥ 4.5:1`, c.theme === theme && [c.prompt, c.error, c.micro, c.build, c.index].every((v) => v >= 4.5) && logs.length === 0, { ...c, logs: logs.slice(0, 2) });
  await ctx.close();
}
{
  // no JS: a form that posts to the visitor's own mail app, and everything else readable
  const { ctx, page } = await open("/", { js: false });
  const n = await page.evaluate(() => {
    const f = document.querySelector("form[data-connect-form]");
    return {
      action: f?.getAttribute("action"),
      method: f?.getAttribute("method"),
      enc: f?.getAttribute("enctype"),
      required: ["name", "email", "intent", "message"].every((k) => f.elements.namedItem(k).required),
      email: f?.elements.namedItem("email").type,
      copy: getComputedStyle(document.querySelector("[data-connect-copy]")).display === "none",
      hiddenBits: ["[data-connect-log]", "[data-connect-received]", "[data-connect-fallback]"].every((s) => document.querySelector(s)?.hidden),
      hours: document.querySelector("[data-connect-overlap]")?.textContent,
      index: document.querySelectorAll(".halt-index a").length,
      build: !!document.querySelector(".halt-build")?.textContent,
      top: document.querySelector("[data-halt-top]")?.getAttribute("href"),
      screen: !!document.querySelector(".halt-screen"),
    };
  });
  check("no JS: the form posts to mailto: as text with native validation, COPY and the live parts hidden, the hours as written, the footer whole", n.action?.startsWith("mailto:") && n.method === "post" && n.enc === "text/plain" && n.required && n.email === "email" && n.copy && n.hiddenBits && /10:00–18:00/.test(n.hours ?? "") && n.index > 10 && n.build && n.top === "#system" && !n.screen, n);
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, "connect-gate.json"), JSON.stringify(report, null, 2));
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} passed · report: .artifacts/connect-gate.json`);
process.exit(failed.length ? 1 : 0);
