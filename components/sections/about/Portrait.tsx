"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ditherInto, PORTRAIT, stepExposure, type Lamp } from "@/lib/identity";
import { useUI } from "@/lib/store";
import { onTick } from "@/lib/ticker";
import { tokenSrgb } from "@/lib/token-color";

export interface PortraitProps {
  src: string;
  alt: string;
  hint: { pointer: string; touch: string };
}

/**
 * The About portrait (DESIGN.md §7.4 IDENTITY): a Canvas2D dot-matrix — an ordered dither at 180 ×
 * 225 cells over the photo (the only canvas outside the two WebGL contexts). The canvas is the cell
 * grid itself, scaled up pixelated; a CSS mask turns each cell into a round dot, on the compositor.
 *
 * The cursor is a lamp that develops the photo where it shines; the exposure then fades back with
 * τ = 600 ms, like phosphor. On touch, press and hold. The loop runs only while the lamp is on or
 * the exposure is still decaying. Reduced motion: a static half exposure, no lamp. Before the
 * canvas draws (and without JS) the photo shows through the same dot mask, tinted by CSS.
 */
export function Portrait({ src, alt, hint }: PortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const theme = useUI((s) => s.theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { cols, rows } = PORTRAIT;
    const E = new Float32Array(cols * rows).fill(reduced ? PORTRAIT.reduced : PORTRAIT.rest);
    const image = ctx.createImageData(cols, rows);
    const ink = tokenSrgb("--fg-1").map((v) => Math.round(v * 255)) as [number, number, number];
    let luma: Uint8Array | null = null;
    let lamp: Lamp | null = null;
    let holding = false;
    let off: (() => void) | null = null;
    let cancelled = false;

    const draw = () => {
      if (!luma) return;
      ditherInto(image.data, luma, E, ink);
      ctx.putImageData(image, 0, 0);
      canvas.dataset.drawn = "";
    };
    const tick = (dt: number) => {
      const moving = stepExposure(E, dt * 1000, lamp);
      draw();
      if (!moving) {
        off?.();
        off = null;
      }
    };
    const wake = () => {
      off ??= onTick(tick);
    };

    const img = new Image();
    img.src = src;
    img
      .decode()
      .then(() => {
        if (cancelled) return;
        const read = document.createElement("canvas");
        read.width = cols;
        read.height = rows;
        const rc = read.getContext("2d", { willReadFrequently: true });
        if (!rc) return;
        rc.drawImage(img, 0, 0, cols, rows);
        const px = rc.getImageData(0, 0, cols, rows).data;
        luma = new Uint8Array(cols * rows);
        for (let i = 0; i < luma.length; i++) luma[i] = px[i * 4] ?? 0;
        draw();
      })
      .catch(() => undefined);

    if (reduced) {
      return () => {
        cancelled = true;
      };
    }
    const toCell = (e: PointerEvent): Lamp => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * cols, y: ((e.clientY - r.top) / r.height) * rows };
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !holding) return;
      lamp = toCell(e);
      wake();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      holding = true;
      lamp = toCell(e);
      wake();
    };
    const onRelease = () => {
      holding = false;
      lamp = null;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "touch") lamp = null;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onRelease);
    canvas.addEventListener("pointercancel", onRelease);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      cancelled = true;
      off?.();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onRelease);
      canvas.removeEventListener("pointercancel", onRelease);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [src, reduced, theme]);

  return (
    <figure className="portrait" style={{ "--cols": PORTRAIT.cols, "--rows": PORTRAIT.rows, "--portrait": `url(${src})` } as CSSProperties}>
      <div className="portrait__frame">
        <div className="portrait__rest" aria-hidden="true" />
        <canvas ref={canvasRef} className="portrait__dots" width={PORTRAIT.cols} height={PORTRAIT.rows} role="img" aria-label={alt} />
      </div>
      <figcaption className="portrait__hint t-micro">
        <span className="portrait__hint--pointer">{hint.pointer}</span>
        <span className="portrait__hint--touch">{hint.touch}</span>
      </figcaption>
    </figure>
  );
}
