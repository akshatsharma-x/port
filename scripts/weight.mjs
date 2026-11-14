#!/usr/bin/env node
/**
 * Page weight per route against DESIGN.md §8.3, measured from a running production server:
 * modern first-load JS (gzip -9 of every <script src> a modern browser downloads — noModule
 * legacy polyfills are excluded because modern browsers never fetch them), CSS and HTML.
 *
 *   npm run build && npm start        (in another terminal)
 *   npm run weight                    BASE_URL=http://localhost:3000 ROUTES=/,/work
 * Exits 1 if `/` exceeds the 230 KB gz first-load budget.
 */
import { gzipSync } from "node:zlib";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ROUTES = (process.env.ROUTES ?? "/").split(",");
const BUDGET_FIRST_LOAD = 230_000;
const BUDGET_HTML = 60_000;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1000).toFixed(1)} KB`;

// Another app on the same port would be measured silently: check it's RETROGRADE first (the
// inline theme script carries the store key).
const probe = await (await fetch(BASE + "/")).text();
if (!probe.includes("retrograde:ui")) {
  console.error(`${BASE} is not serving RETROGRADE — start it (npm run build && npm start -- -p 3200) and set BASE_URL.`);
  process.exit(2);
}

let failed = false;
for (const route of ROUTES) {
  const html = await (await fetch(BASE + route)).text();
  const scripts = [...html.matchAll(/<script([^>]*)src="([^"]+)"([^>]*)>/g)].map((m) => ({ src: m[2], legacy: /nomodule/i.test(m[1] + m[3]) }));
  const styles = [...new Set([...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]))];
  let js = 0;
  let legacy = 0;
  for (const s of new Map(scripts.map((x) => [x.src, x])).values()) {
    const size = gz(Buffer.from(await (await fetch(BASE + s.src)).arrayBuffer()));
    if (s.legacy) legacy += size;
    else js += size;
  }
  let css = 0;
  for (const href of styles) css += gz(Buffer.from(await (await fetch(BASE + href)).arrayBuffer()));
  const htmlSize = gz(Buffer.from(html));
  const over = route === "/" && js > BUDGET_FIRST_LOAD;
  failed ||= over || htmlSize > BUDGET_HTML;
  console.log(
    `${route.padEnd(20)} JS ${kb(js)} gz${route === "/" ? ` (budget ${kb(BUDGET_FIRST_LOAD)}${over ? " — OVER" : ""})` : ""} · CSS ${kb(css)} · HTML ${kb(htmlSize)} · noModule polyfills ${kb(legacy)} (not downloaded by modern browsers)`,
  );
}
process.exit(failed ? 1 : 0);
