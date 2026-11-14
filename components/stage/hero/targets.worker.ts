import { constellationTarget, earthVector, GLOBE_RADIUS, globeTarget, initialsTarget, latticeTarget, type AlphaRaster } from "@/lib/hero-gen";
import { HERO, type HeroLatticeRequest, type HeroTargets, type HeroTargetsRequest } from "@/lib/hero";

/**
 * The hero's morph-target worker (DESIGN.md §4.3 A1): generates the four targets off the main
 * thread during the boot — the initials drawn in the display face on an OffscreenCanvas, the
 * constellation from the real graph, the globe from the 4 KB land mask, the lattice from the page's
 * own grid — and hands them back as transferred Int16 buffers. Re-asked for the lattice alone when
 * the layout changes.
 */
interface WorkerScope {
  onmessage: ((e: MessageEvent<HeroTargetsRequest | HeroLatticeRequest>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
  fonts?: FontFaceSet;
}
const scope = self as unknown as WorkerScope;
const FAMILY = "RetrogradeInitials";

async function rasterInitials(text: string, font: HeroTargetsRequest["font"]): Promise<AlphaRaster & { face: HeroTargets["initialsFace"] }> {
  let family = "sans-serif";
  if (font && scope.fonts && typeof FontFace !== "undefined") {
    try {
      // the page's own face, from the HTTP cache: any weight and width the axes allow
      const face = new FontFace(FAMILY, `url(${font.url})`, { weight: "100 1000", stretch: "50% 200%" });
      scope.fonts.add(face);
      await face.load();
      family = `"${FAMILY}"`;
    } catch {
      /* the system face draws them instead */
    }
  }
  const H = HERO.initials.rasterHeight;
  const size = Math.round(H * 0.82);
  const css = `${font?.weight ?? 800} ${size}px ${family}`;
  const setFont = (ctx: OffscreenCanvasRenderingContext2D) => {
    ctx.font = css;
    if (font && "fontStretch" in ctx) ctx.fontStretch = font.stretch as CanvasFontStretch;
  };
  const probe = new OffscreenCanvas(8, 8).getContext("2d");
  const face: HeroTargets["initialsFace"] = family === "sans-serif" ? "system" : "display";
  if (!probe) return { width: 0, height: 0, alpha: new Uint8Array(0), face };
  setFont(probe);
  const W = Math.max(8, Math.ceil(probe.measureText(text).width + size * 0.3));
  const ctx = new OffscreenCanvas(W, H).getContext("2d", { willReadFrequently: true });
  if (!ctx) return { width: 0, height: 0, alpha: new Uint8Array(0), face };
  setFont(ctx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, W / 2, H / 2);
  const rgba = ctx.getImageData(0, 0, W, H).data;
  const alpha = new Uint8Array(W * H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3] ?? 0;
  return { width: W, height: H, alpha, face };
}

scope.onmessage = (e) => {
  const msg = e.data;
  const t0 = performance.now();
  if (msg.kind === "lattice") {
    const out = latticeTarget(msg.count, msg.lattice, msg.seed + 3);
    scope.postMessage({ kind: "lattice", lattice: out, ms: performance.now() - t0 }, [out.buffer]);
    return;
  }
  void (async () => {
    const n = msg.count;
    const raster = await rasterInitials(msg.data.hero.initials, msg.font);
    const initials = initialsTarget(n, raster, msg.seed);
    const constellation = constellationTarget(n, msg.data.graph, msg.seed + 1);
    const globe = globeTarget(n, new Uint8Array(msg.land), msg.data.hero.city, msg.seed + 2);
    const lattice = latticeTarget(n, msg.lattice, msg.seed + 3);
    const [cx, cy, cz] = earthVector(msg.data.hero.city.lat, msg.data.hero.city.lon);
    const result: HeroTargets = {
      count: n,
      targets: [initials.out, constellation, globe, lattice],
      initialsAspect: initials.aspect,
      initialsFace: raster.face,
      city: [cx * GLOBE_RADIUS, cy * GLOBE_RADIUS, cz * GLOBE_RADIUS],
      ms: performance.now() - t0,
    };
    scope.postMessage({ kind: "targets", result }, result.targets.map((t) => t.buffer));
  })();
};
