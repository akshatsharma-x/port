"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { FX_CSS, grainTile, scanPitch } from "@/lib/fx-css";
import { governor } from "@/lib/sceneManager";

/** One grain tile as an object URL: alpha only (the theme's ink colors it through a mask). */
function tileUrl(spec: { peak: number; mean: number }, seed: string): Promise<string | null> {
  const size = FX_CSS.grain.tile;
  const alpha = grainTile(size, spec, seed);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < alpha.length; i++) img.data[i * 4 + 3] = alpha[i] ?? 0;
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), "image/png"));
}

/**
 * #fx-css (z50, DESIGN.md §5): the glass over everything but the transitions. Grain (24 fps
 * stepped jitter; white speckle on the dark tubes, toner on Paper), scanlines (α 0.07 on the dark
 * tubes, none on Paper — paper is not a screen — at a pitch snapped to device pixels) and the
 * refresh roll (dark tubes, HIGH/MID). Off under prefers-contrast: more and forced-colors; static
 * under reduced motion. The grain tiles are made here (no download): seeded, two tiles, < 2 ms.
 */
export function FxCss() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let urls: string[] = [];
    void Promise.all([tileUrl(FX_CSS.grain.dark, "grain:dark"), tileUrl(FX_CSS.grain.paper, "grain:paper")]).then(([dark, paper]) => {
      urls = [dark, paper].filter((u): u is string => !!u);
      if (dark) el.style.setProperty("--grain-dark", `url(${dark})`);
      if (paper) el.style.setProperty("--grain-paper", `url(${paper})`);
      el.dataset.grain = "";
    });

    // §5.3: the pitch, snapped to device pixels — at boot and on every resolution change. On
    // #fx-css, which is all that reads it: on html, a custom property restyled every element, and
    // the hydration commit's next layout read paid for it (Part 7 trace)
    let mq: MediaQueryList | null = null;
    const writePitch = () => {
      const dpr = window.devicePixelRatio || 1;
      const { pitch, line } = scanPitch(dpr);
      el.style.setProperty("--scan-pitch", `${pitch}px`);
      el.style.setProperty("--scan-line", `${line}px`);
      mq?.removeEventListener("change", writePitch);
      mq = matchMedia(`(resolution: ${dpr}dppx)`);
      mq.addEventListener("change", writePitch);
    };
    writePitch();

    // the roll only on HIGH/MID (the tier is the governor's)
    const writeTier = () => {
      const tier = governor.store.getState().tier;
      el.dataset.roll = tier === "HIGH" || tier === "MID" ? "on" : "off";
    };
    writeTier();
    const offTier = governor.store.subscribe(writeTier);

    return () => {
      offTier();
      mq?.removeEventListener("change", writePitch);
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  const g = FX_CSS.grain;
  const style = {
    "--grain-tile": `${g.tile}px`,
    "--grain-cycle": `${(g.steps / g.fps) * 1000}ms`,
    "--grain-peak-dark": String(g.dark.peak),
    "--grain-peak-paper": String(g.paper.peak),
    "--scan-alpha": String(FX_CSS.scan.alpha),
    "--roll-lift": String(FX_CSS.roll.lift),
    "--roll-band": `${FX_CSS.roll.bandPx}px`,
    "--roll-period": `${FX_CSS.roll.periodMs}ms`,
  } as CSSProperties;

  return (
    <div ref={ref} id="fx-css" aria-hidden="true" style={style}>
      <i className="fx-grain" />
      <i className="fx-scan" />
      <i className="fx-roll" />
    </div>
  );
}
