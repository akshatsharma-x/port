#!/usr/bin/env node
/**
 * The launch checklist's social preview check (PROMPTS.md Part 15), before the platforms' own
 * debuggers can see a public URL: what Open Graph (Facebook, LinkedIn, Slack, Discord, iMessage)
 * and X's large card need, on every page the sitemap names.
 *   - og:title, og:description, og:type, og:url (absolute, the page's canonical), og:site_name;
 *   - og:image: absolute, its declared width/height/type/alt, and the file itself — a 200, the type it
 *     says, a PNG truly 1200 × 630 (Open Graph's 1.91:1; X's large card is 2:1 within its bounds),
 *     under 5 MB (X's limit, the strictest);
 *   - twitter:card summary_large_image, twitter:title, twitter:description, twitter:image (+ alt).
 *
 *   BASE_URL=http://localhost:3200 node scripts/audit/social.mjs      Exits 1 on a miss.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const local = (u) => {
  const url = new URL(u);
  return BASE + url.pathname + url.search;
};
let misses = 0;
for (const path of pages) {
  const html = await (await fetch(BASE + path)).text();
  const head = html.slice(0, html.indexOf("</head>"));
  const meta = (key, attr = "property") => [...head.matchAll(new RegExp(`<meta ${attr}="${key.replace(/[:.]/g, "\\$&")}" content="([^"]*)"`, "g"))].map((m) => m[1].replace(/&amp;/g, "&"));
  const one = (k, a) => meta(k, a)[0] ?? null;
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(head)?.[1] ?? null;
  const problems = [];
  for (const k of ["og:title", "og:description", "og:type", "og:url", "og:site_name", "og:image", "og:image:width", "og:image:height", "og:image:type", "og:image:alt"]) if (!one(k)) problems.push(`no ${k}`);
  for (const k of ["twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) if (!one(k, "name")) problems.push(`no ${k}`);
  if (one("twitter:card", "name") !== "summary_large_image") problems.push("twitter:card isn't summary_large_image");
  if (one("og:url") && canonical && one("og:url") !== canonical) problems.push(`og:url ${one("og:url")} ≠ canonical ${canonical}`);
  const img = one("og:image");
  let file = null;
  if (img) {
    if (!/^https?:\/\//.test(img)) problems.push("og:image isn't absolute");
    const res = await fetch(local(img));
    const buf = Buffer.from(await res.arrayBuffer());
    const png = buf.length > 24 && buf.toString("latin1", 1, 4) === "PNG";
    file = { status: res.status, type: res.headers.get("content-type"), bytes: buf.length, size: png ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null };
    if (res.status !== 200) problems.push(`og:image answers ${res.status}`);
    if (file.type !== one("og:image:type")) problems.push(`og:image is ${file.type}, says ${one("og:image:type")}`);
    if (!png || file.size[0] !== 1200 || file.size[1] !== 630) problems.push(`og:image is ${file.size?.join("×") ?? "not a PNG"}`);
    if (`${file.size?.[0]}` !== one("og:image:width") || `${file.size?.[1]}` !== one("og:image:height")) problems.push("og:image's declared size isn't its own");
    if (buf.length >= 5 * 1024 * 1024) problems.push("og:image ≥ 5 MB");
    if (one("twitter:image", "name") !== img) problems.push("twitter:image ≠ og:image");
  }
  misses += problems.length;
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${path.padEnd(44)} ${one("og:type") ?? "?"} · "${(one("og:title") ?? "").slice(0, 48)}" · ${file ? `${file.size?.join("×")} ${(file.bytes / 1024).toFixed(1)} KB` : "no image"}${problems.length ? `  — ${problems.join("; ")}` : ""}`);
}
console.log(`\n${pages.length} pages · ${misses} problems`);
process.exit(misses ? 1 : 0);
