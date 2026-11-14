/**
 * posters (DESIGN.md §8.2; PROMPTS.md Part 6) — public/posters/<scene>.png, captured from the live
 * scene. For every scene registered in components/stage/posters.ts: the page in the installed
 * Chrome (Playwright) at the poster's size, the scene at its canonical state (?poster=1: the clock
 * at zero, no cursor, no stir; HIGH, unprobed), its frame read back and ordered-dithered (8×8 Bayer) into the same
 * 1-bit mask the bake writes for the placeholders — theme-agnostic, tinted by a CSS mask.
 *
 *   BASE_URL=http://localhost:3200 npx tsx scripts/posters.ts      (a production build with
 *   RETROGRADE_DEV_ROUTES=1, or the dev server)
 */
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { POSTER_CAPTURES, POSTER_DRAWINGS } from "../components/stage/posters";
import { derived } from "../content/derive";
import { stageData } from "../content/stage-data";
import { drawSky, skySvgDocument } from "../lib/archive-svg";
import { SCENE_IDS } from "../lib/tier";
import { ROOT, writeIfChanged } from "./bake/lib";
import { BAYER8, decodePng, encodeMaskPng } from "./bake/png";
import { POSTER_SIZE, POSTER_SIZE_PORTRAIT, POSTER_SIZE_TABLET } from "./bake/posters";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
/** after the scene can draw: its DITHER RESOLVE (900 ms) lands and the field settles */
const SETTLE_MS = 2500;
/** the brightest this share of pixels maps to full ink (keeps a few hot cores from flattening the rest) */
const WHITE_POINT = 0.995;
/**
 * Below this share of the white point there's no ink, and above it the tone rises on this curve.
 * Bloom's haze is broad and nearly flat: at a floor of 0.08 it dithered into a field of sparse
 * dots with a hard, rounded edge — a box around the subject. 0.2 keeps the glow that hugs the
 * glyphs, and γ 1.2 thins its outermost dots (chosen from a contact sheet of floor × γ).
 */
const INK_FLOOR = 0.2;
const INK_GAMMA = 1.2;

/**
 * A captured frame → the 1-bit poster: luma above the frame's own ground, normalized to its white
 * point, past the ink floor on the ink curve, against the 8×8 Bayer threshold.
 */
export function ditherFrame(rgb: { width: number; height: number; channels: number; data: Uint8Array }): { png: Buffer; coverage: number } {
  const { width: W, height: H, channels: C, data } = rgb;
  const luma = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) luma[i] = (0.2126 * (data[i * C] ?? 0) + 0.7152 * (data[i * C + 1] ?? 0) + 0.0722 * (data[i * C + 2] ?? 0)) / 255;
  // the ground: the median of the four corners' 12 × 12 patches
  const ground: number[] = [];
  for (const [x0, y0] of [[0, 0], [W - 12, 0], [0, H - 12], [W - 12, H - 12]] as const) {
    for (let y = y0; y < y0 + 12; y++) for (let x = x0; x < x0 + 12; x++) ground.push(luma[y * W + x] ?? 0);
  }
  ground.sort((a, b) => a - b);
  const bg = ground[Math.floor(ground.length / 2)] ?? 0;
  const sorted = Float32Array.from(luma).sort();
  const white = Math.max(bg + 1e-3, sorted[Math.floor(sorted.length * WHITE_POINT)] ?? 1);
  let ink = 0;
  const png = encodeMaskPng(W, H, (x, y) => {
    const v = (Math.min(1, Math.max(0, ((luma[y * W + x] ?? 0) - bg) / (white - bg) - INK_FLOOR) / (1 - INK_FLOOR))) ** INK_GAMMA;
    const on = v > (BAYER8[(y % 8) * 8 + (x % 8)] ?? 0.5);
    if (on) ink++;
    return on;
  });
  return { png, coverage: ink / (W * H) };
}

async function capture(id: string, route: string, hash: string | undefined, size: { width: number; height: number }, align?: "slot"): Promise<Buffer> {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      sessionStorage.setItem("retrograde:booted", "1");
      localStorage.setItem("retrograde:ui", JSON.stringify({ state: { theme: "phosphor", sound: false, gfx: "auto" }, version: 1 }));
    });
    const page = await ctx.newPage();
    // at the reference tier with no probe: a probe reading the GPU's clock changes could demote one
    // capture and not the next (measured: the portrait flipped between 3,262 and 3,410 B, run to run)
    await page.goto(`${BASE}${route}?debug=1&poster=1&tier=HIGH${hash ? `#${hash}` : ""}`, { waitUntil: "load" });
    if (align === "slot") {
      // the poster frames the slot, not the window: a slot shorter than the viewport (CAPABILITIES'
      // band is 80 svh) gets a viewport that makes the slot itself the poster's size, so the still
      // and the live scene meet where the poster covers the slot
      await page.waitForSelector(`[data-stage-slot="${id}"]`);
      const share = await page.evaluate((scene) => (document.querySelector(`[data-stage-slot="${scene}"]`)?.getBoundingClientRect().height ?? innerHeight) / innerHeight, id);
      if (Math.abs(share - 1) > 0.01) await page.setViewportSize({ width: size.width, height: Math.round(size.height / share) });
      // …and a slot below its section's head (PRIMARY STACK) is out of a short frame at the hash:
      // bring it in first, or its scene never goes LIVE
      await page.evaluate((scene) => {
        const el = document.querySelector(`[data-stage-slot="${scene}"]`);
        if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
      }, id);
    }
    await page.waitForFunction(
      (scene) => {
        const s = (window as unknown as { __retrograde?: { governor: { snapshot: { scenes: Record<string, { state: string; poster: boolean }> } } } }).__retrograde?.governor.snapshot;
        return s?.scenes[scene]?.state === "LIVE" && !s.scenes[scene]?.poster;
      },
      id,
      { timeout: 60_000, polling: 100 },
    );
    // only the stage: no chrome, no #fx-css glass, no debug panel (fixed layers: gone), and no DOM
    // type (hidden, so the slot keeps its geometry). Descendants too — the grain sets its own
    // `visibility: visible`, which beat an inherited hidden and dithered into every poster
    await page.addStyleTag({
      content: `#hud, #fx-css, .grid-overlay, .stage-debug, #cursor { display: none !important; }
        .section-strip, .section-strip *, [data-stage-slot] ~ *, [data-stage-slot] ~ * *, .sticky-stack__content, .sticky-stack__content *, .sticky-stack__frame, .sticky-stack__frame * { visibility: hidden !important; }`,
    });
    if (align === "slot") {
      await page.evaluate((scene) => {
        const el = document.querySelector(`[data-stage-slot="${scene}"]`);
        if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
      }, id);
    }
    await page.waitForTimeout(SETTLE_MS);
    return await page.screenshot({ clip: { x: 0, y: 0, ...size } });
  } finally {
    await browser.close();
  }
}

/**
 * A3's poster: the SVG constellation, light on black — my records full ink, the works they cite and
 * the edges fainter — rasterized and dithered by the same rule as a capture.
 */
const DRAWN_INK = { ground: "#000", record: "#fff", cited: "#9a9a9a", edge: "#7a7a7a", citedEdge: "#5c5c5c" } as const;

async function drawn(size: { width: number; height: number }): Promise<{ width: number; height: number; channels: number; data: Uint8Array }> {
  const sky = drawSky(stageData(derived).graph, size.width, size.height);
  const { data, info } = await sharp(Buffer.from(skySvgDocument(sky, DRAWN_INK))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, channels: info.channels, data };
}

async function main(): Promise<void> {
  for (const id of SCENE_IDS) {
    const art = POSTER_DRAWINGS[id];
    if (!art) continue;
    for (const [suffix, size] of [["", POSTER_SIZE], ["-portrait", POSTER_SIZE_PORTRAIT], ["-tablet", POSTER_SIZE_TABLET]] as const) {
      const { png, coverage } = ditherFrame(await drawn(size));
      const changed = await writeIfChanged(join(ROOT, "public/posters", `${id}${suffix}.png`), png);
      console.log(`posters: ${id}${suffix} · ${art.canonical} · ${size.width}×${size.height} 1-bit · ink ${(coverage * 100).toFixed(1)}% · ${png.length} B${changed ? "" : " · unchanged"}`);
    }
  }
  if (process.env.POSTERS_DRAWN_ONLY === "1") return;
  for (const id of SCENE_IDS) {
    const reg = POSTER_CAPTURES[id];
    if (!reg) continue;
    for (const [suffix, size] of [["", POSTER_SIZE], ["-portrait", POSTER_SIZE_PORTRAIT], ["-tablet", POSTER_SIZE_TABLET]] as const) {
      const frame = decodePng(await capture(id, reg.route, reg.hash, size, reg.align));
      const { png, coverage } = ditherFrame(frame);
      const changed = await writeIfChanged(join(ROOT, "public/posters", `${id}${suffix}.png`), png);
      console.log(`posters: ${id}${suffix} · ${reg.canonical} · ${frame.width}×${frame.height} 1-bit · ink ${(coverage * 100).toFixed(1)}% · ${png.length} B${changed ? "" : " · unchanged"}`);
    }
  }
}

if (process.argv[1]?.endsWith("posters.ts")) void main();
