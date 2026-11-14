import { bootHead, bootManifest, bootStore, registerBootTask, type BootTaskHandle } from "./boot";
import { HERO, STAGE_DATA_URL, type HeroLatticeRequest, type HeroTargets, type HeroTargetsRequest, type LatticeSpec, type StageData } from "./hero";
import { hashSeed } from "./motion";

/**
 * Starts the hero's morph targets (DESIGN.md §4.3 A1) — first-load, tiny: it fetches the two data
 * files (counted as real bytes when the boot is running), reads the page's own grid and the About
 * layout from the live DOM, and hands it all to the worker. The scene's prime() awaits the result.
 * A run for n particles serves any tier that needs n or fewer (each target's prefix is a fair sample).
 */
const SEED = hashSeed("hero:targets");
let job: { count: number; promise: Promise<HeroTargets> } | null = null;
let worker: Worker | null = null;
let seq = 0;

export function heroTargets(count: number): Promise<HeroTargets> {
  if (job && job.count >= count) return job.promise;
  job = { count, promise: generate(count) };
  return job.promise;
}

/** The lattice again (resize, fonts in): only that target changes. */
export async function relattice(count: number): Promise<Int16Array> {
  const lattice = readLattice();
  const w = worker;
  if (!w) {
    const { latticeTarget } = await import("./hero-gen");
    return latticeTarget(count, lattice, SEED + 3);
  }
  const id = ++seq;
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent<{ kind: string; lattice?: Int16Array }>) => {
      if (e.data.kind !== "lattice" || id !== seq || !e.data.lattice) return;
      w.removeEventListener("message", onMessage);
      resolve(e.data.lattice);
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ kind: "lattice", count, lattice, seed: SEED } satisfies HeroLatticeRequest);
  });
}

async function generate(count: number): Promise<HeroTargets> {
  // during the boot, the targets are one of the things it waits for (and counts)
  let settle: () => void = () => undefined;
  const booting = bootHead().mode === "run" && bootStore.getState().phase !== "done";
  const task = booting ? registerBootTask("hero", new Promise((resolve) => (settle = () => resolve(null)))) : null;
  try {
    const [dataBytes, land] = (await fetchAll([STAGE_DATA_URL, HERO.globe.landmask.url], task)) as [ArrayBuffer, ArrayBuffer];
    const data = JSON.parse(new TextDecoder().decode(dataBytes)) as StageData;
    const request: HeroTargetsRequest = { kind: "targets", count, data, land, font: displayFont(), lattice: readLattice(), seed: SEED };
    try {
      return await inWorker(request);
    } catch {
      // no module workers or OffscreenCanvas: the same generators, here (the initials on a DOM canvas)
      return await onMainThread(request);
    }
  } finally {
    settle();
  }
}

function inWorker(request: HeroTargetsRequest): Promise<HeroTargets> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("../components/stage/hero/targets.worker.ts", import.meta.url), { type: "module" });
    worker = w;
    const onMessage = (e: MessageEvent<{ kind: string; result?: HeroTargets }>) => {
      if (e.data.kind !== "targets" || !e.data.result) return;
      w.removeEventListener("message", onMessage);
      resolve(e.data.result);
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", (e) => {
      worker = null;
      w.terminate();
      reject(e);
    });
    w.postMessage(request); // copied, not transferred: the main-thread fallback may still need the mask
  });
}

async function onMainThread(request: HeroTargetsRequest): Promise<HeroTargets> {
  const gen = await import("./hero-gen");
  const t0 = performance.now();
  const n = request.count;
  const H = HERO.initials.rasterHeight;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const family = getComputedStyle(document.documentElement).getPropertyValue("--ff-display-face").trim() || "sans-serif";
  const size = Math.round(H * 0.82);
  let raster: { width: number; height: number; alpha: Uint8Array } = { width: 0, height: 0, alpha: new Uint8Array(0) };
  let face: HeroTargets["initialsFace"] = "system";
  if (ctx) {
    // the display face at the mega step's width too, as the worker draws it (resizing the canvas
    // resets the context, so it's set again after)
    const setFont = () => {
      ctx.font = `${request.font?.weight ?? 800} ${size}px ${family}`;
      if (request.font && "fontStretch" in ctx) ctx.fontStretch = request.font.stretch as CanvasFontStretch;
    };
    setFont();
    canvas.width = Math.max(8, Math.ceil(ctx.measureText(request.data.hero.initials).width + size * 0.3));
    canvas.height = H;
    setFont();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(request.data.hero.initials, canvas.width / 2, H / 2);
    if (family !== "sans-serif" && document.fonts.check(ctx.font, request.data.hero.initials)) face = "display";
    const rgba = ctx.getImageData(0, 0, canvas.width, H).data;
    const alpha = new Uint8Array(canvas.width * H);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;
    raster = { width: canvas.width, height: H, alpha };
  }
  const initials = gen.initialsTarget(n, raster, request.seed);
  const [cx, cy, cz] = gen.earthVector(request.data.hero.city.lat, request.data.hero.city.lon);
  return {
    count: n,
    targets: [initials.out, gen.constellationTarget(n, request.data.graph, request.seed + 1), gen.globeTarget(n, new Uint8Array(request.land), request.data.hero.city, request.seed + 2), gen.latticeTarget(n, request.lattice, request.seed + 3)],
    initialsAspect: initials.aspect,
    initialsFace: face,
    city: [cx * gen.GLOBE_RADIUS, cy * gen.GLOBE_RADIUS, cz * gen.GLOBE_RADIUS],
    ms: performance.now() - t0,
  };
}

/**
 * Fetches every URL, counting real bytes into the boot's task as they arrive. A file's size is
 * declared by the boot manifest (decoded bytes, measured at build); without one, by a
 * Content-Length that isn't an encoded body's (a gzip length isn't what the reader counts); at the
 * latest, by its last byte. While booting it also waits for the manifest, so the count the task
 * settles on is the whole.
 */
async function fetchAll(urls: string[], task: BootTaskHandle | null): Promise<ArrayBuffer[]> {
  const totals = urls.map(() => 0);
  const loaded = urls.map(() => 0);
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const declare = (k: number, bytes: number) => {
    if (!task || bytes <= (totals[k] ?? 0)) return;
    totals[k] = bytes;
    task.setTotal(sum(totals));
    task.progress(sum(loaded));
  };
  const manifest = task ? bootManifest().then((m) => urls.forEach((url, k) => declare(k, m?.data.find((d) => d.url === url)?.bytes ?? 0))) : null;
  const bodies = Promise.all(
    urls.map(async (url, k) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      if (!res.headers.has("content-encoding")) declare(k, Number(res.headers.get("content-length")) || 0);
      const parts: Uint8Array[] = [];
      const reader = res.body?.getReader();
      if (!reader) parts.push(new Uint8Array(await res.arrayBuffer()));
      else
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          loaded[k] = (loaded[k] ?? 0) + value.byteLength;
          task?.progress(sum(loaded));
        }
      const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
      let at = 0;
      for (const p of parts) {
        out.set(p, at);
        at += p.byteLength;
      }
      loaded[k] = out.byteLength;
      declare(k, out.byteLength);
      return out.buffer;
    }),
  );
  const [out] = await Promise.all([bodies, manifest]);
  return out;
}

/** The display face's file (its @font-face src), at the mega step's weight and width. */
function displayFont(): HeroTargetsRequest["font"] {
  const root = getComputedStyle(document.documentElement);
  const family = root.getPropertyValue("--ff-display-face").trim().replace(/^["']|["']$/g, "");
  const weight = Number.parseFloat(root.getPropertyValue("--wght-mega")) || 800;
  const stretch = STRETCH_KEYWORDS[Number.parseFloat(root.getPropertyValue("--wdth-mega"))] ?? "normal";
  if (!family) return null;
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // another origin's sheet
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      if (rule.style.getPropertyValue("font-family").trim().replace(/^["']|["']$/g, "") !== family) continue;
      const url = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue("src"))?.[1];
      // a url() in a stylesheet is relative to the sheet: next/font writes ../media/… from
      // /_next/static/chunks/, which against the document was /media/… — a 404, so the worker
      // drew the initials in the system's sans (Parts 6–7, until Part 7's request probe)
      if (url) return { url: new URL(url, rule.parentStyleSheet?.href ?? document.baseURI).href, weight, stretch };
    }
  }
  return null;
}
/** canvas fontStretch takes keywords only (CSS Fonts 4 §2.5) */
const STRETCH_KEYWORDS: Record<number, string> = { 50: "ultra-condensed", 62.5: "extra-condensed", 75: "condensed", 87.5: "semi-condensed", 100: "normal", 112.5: "semi-expanded", 125: "expanded", 150: "extra-expanded", 200: "ultra-expanded" };

/**
 * The page's own grid in the hero slot's screen space: every layout column's edges, the baseline
 * token, and the About section as it will stand once it reaches the top of the screen — its
 * blocks (data-lattice="block") and its text, line by line (data-lattice="lines").
 */
export function readLattice(): LatticeSpec {
  const width = document.documentElement.clientWidth;
  const slot = document.querySelector<HTMLElement>('[data-stage-slot="system"]');
  const height = slot?.offsetHeight || window.innerHeight;
  const baseline = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--baseline")) || 8;
  const about = document.getElementById("identity");
  const grid = about?.querySelector<HTMLElement>(".layout-grid") ?? document.querySelector<HTMLElement>(".layout-grid");
  const columns: [number, number][] = [];
  if (grid) {
    const cs = getComputedStyle(grid);
    const gap = Number.parseFloat(cs.columnGap) || 0;
    let x = grid.getBoundingClientRect().left + (Number.parseFloat(cs.paddingLeft) || 0);
    for (const track of cs.gridTemplateColumns.split(" ")) {
      const w = Number.parseFloat(track);
      if (!Number.isFinite(w)) continue;
      columns.push([x, x + w]);
      x += w + gap;
    }
  }
  const blocks: LatticeSpec["blocks"] = [];
  const lines: LatticeSpec["lines"] = [];
  if (about) {
    const top = about.getBoundingClientRect().top;
    for (const el of about.querySelectorAll<HTMLElement>('[data-lattice="block"]')) {
      const r = el.getBoundingClientRect();
      const y = r.top - top;
      if (y < height && r.width > 0) blocks.push({ x: r.left, y, w: r.width, h: Math.min(r.height, height - y) });
    }
    const range = document.createRange();
    for (const el of about.querySelectorAll<HTMLElement>('[data-lattice="lines"]')) {
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) {
        const y = r.top - top + r.height * 0.55;
        if (y > 0 && y < height && r.width > 1) lines.push({ x: r.left, y, w: r.width });
      }
    }
  }
  return { width, height, columns, baseline, blocks, lines };
}
