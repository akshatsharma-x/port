/**
 * content/name-fit.json — the hero name's width model (DESIGN.md §7.4 SYSTEM: the name at
 * --step-5, fitted to 12 columns by solving the wdth axis, 75–125; two lines only below 75).
 *
 * Measured in the installed Chrome with the baked Hubot Sans at the mega step's weight and
 * tracking: the uppercase name's width in em at nine wdth values, as one line and as the longer of
 * its two lines. The page then solves wdth from this model (no DOM measuring, so it's right before
 * the face has loaded), and the server knows below which viewport the name takes two lines — the
 * line count is fixed in CSS from the first paint, so fitting never moves anything (no CLS).
 *
 *   npx tsx scripts/fonts/name-fit.ts      (scripts/fonts/run.sh runs it after the font bake)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { content } from "../../content/index";
import { nameFitInputHash, nameLines, solveWdth } from "../../content/name-fit";

const ROOT = new URL("../..", import.meta.url).pathname;
const tokens = readFileSync(`${ROOT}styles/tokens.css`, "utf8");
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens);
  if (!m?.[1]) throw new Error(`no --${name} in tokens.css`);
  return m[1].trim();
};
/** clamp(a rem, b rem + c vw, d rem) → px at a viewport width */
function fluid(expr: string): (vw: number) => number {
  const m = /clamp\(\s*([\d.]+)rem,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw,\s*([\d.]+)rem\s*\)/.exec(expr);
  if (!m) throw new Error(`not a fluid clamp(): ${expr}`);
  const [lo, base, slope, hi] = [m[1], m[2], m[3], m[4]].map(Number) as [number, number, number, number];
  return (vw) => Math.min(hi * 16, Math.max(lo * 16, base * 16 + (slope / 100) * vw));
}

const WDTH = [75, 81.25, 87.5, 93.75, 100, 106.25, 112.5, 118.75, 125];
/** one line must fit at wdth 75 with this much to spare, or the name takes two lines */
const SPARE = 0.96;

const name = content.profile.name.toUpperCase();
const [first, second] = nameLines(name);
const weight = Number(token("wght-mega"));
const trackingEm = Number.parseFloat(token("tr-5"));
const fontFile = readFileSync(`${ROOT}app/fonts/HubotSans-Variable.woff2`);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setContent(
  `<style>@font-face{font-family:Probe;src:url(data:font/woff2;base64,${fontFile.toString("base64")}) format("woff2");font-weight:200 900;font-stretch:75% 125%}</style><span id=s style="position:absolute;white-space:nowrap;font-family:Probe;font-size:100px">x</span>`,
);
await page.evaluate(() => document.fonts.load("700 100px Probe"));
const measure = (text: string) =>
  page.evaluate(
    ({ text, weight, trackingEm, wdths }) => {
      const s = document.getElementById("s") as HTMLElement;
      s.textContent = text;
      s.style.fontWeight = String(weight);
      s.style.letterSpacing = `${trackingEm}em`;
      return wdths.map((w) => {
        s.style.fontStretch = `${w}%`;
        return [w, Math.round((s.getBoundingClientRect().width / 100) * 1e4) / 1e4] as [number, number];
      });
    },
    { text, weight, trackingEm, wdths: WDTH },
  );
const oneLine = await measure(name);
const twoLine = second ? (await Promise.all([measure(first), measure(second)])).reduce((a, b) => a.map(([w, e], i) => [w, Math.max(e, b[i]?.[1] ?? 0)] as [number, number])) : oneLine;
await browser.close();

// the narrowest viewport at which one line fits at wdth 75 (with the spare): the step and margins are fluid
const fontPx = fluid(token("step-5"));
const marginPx = fluid(token("margin"));
const widthAt75 = oneLine[0]?.[1] ?? 0;
let oneLineMinViewport = 0;
for (let vw = 2400; vw >= 240; vw--) {
  if (widthAt75 * fontPx(vw) > (vw - 2 * marginPx(vw)) * SPARE) {
    oneLineMinViewport = vw + 1;
    break;
  }
}

// first-paint bands: from each 16 px viewport step up, the wdth that fits at the step's lower
// edge — a touch narrow inside the band, never too wide; the page refines it exactly once it runs
const BAND_PX = 16;
const bands: [number, number][] = [];
for (let vw = 240; vw <= 2400; vw += BAND_PX) {
  const samples = vw >= oneLineMinViewport ? oneLine : twoLine;
  const w = Math.floor(solveWdth(samples, vw - 2 * marginPx(vw), fontPx(vw)) * 10) / 10;
  if (bands.at(-1)?.[1] !== w) bands.push([vw, w]);
}

const fontHash = createHash("sha256").update(fontFile).digest("hex").slice(0, 16);
const out = {
  version: 1,
  inputHash: nameFitInputHash({ text: name, fontHash, weight, trackingEm, step5: token("step-5"), margin: token("margin") }),
  text: name,
  weight,
  trackingEm,
  lines: second ? [first, second] : [first],
  oneLine,
  twoLine,
  oneLineMinViewport,
  bands,
};
writeFileSync(`${ROOT}content/name-fit.json`, `${JSON.stringify(out, null, 2)}\n`);
console.log(`name-fit: "${name}" · one line ≥ ${oneLineMinViewport}px · ${oneLine[0]?.[1]}–${oneLine.at(-1)?.[1]} em (wdth 75–125)`);
