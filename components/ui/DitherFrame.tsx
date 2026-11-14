"use client";

import { useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import { cx } from "@/lib/cx";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useVelocitySkew } from "@/hooks/useVelocitySkew";
import { DITHER, ditherGrid, ditherSprite, halftoneFullRadius, type Origin } from "@/lib/dither";
import { pointer, retainPointer } from "@/lib/pointer";
import { projection } from "@/lib/projection";

export type DitherImgProps = Pick<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes" | "loading" | "decoding" | "fetchPriority"> & {
  alt: string;
  width: number;
  height: number;
};

export interface DitherFrameProps {
  img: DitherImgProps;
  /** a baked 1-bit PNG (alpha = ink) shown until the resolve; otherwise a flat --bg-sunken ground */
  lo?: string;
  fit?: "cover" | "contain";
  /** change it to resolve again (an index preview swapping images, a dossier opening) */
  resolveKey?: string | number;
  /** a media frame: VELOCITY SKEW ≤ 3° with scroll (DESIGN.md §3.7 — never on text) */
  skew?: boolean;
  className?: string;
}

type State = "lo" | "resolving" | "hi";

const isReduced = () => document.documentElement.dataset.motion === "reduce";
/** Paper by the nearest theme scope (the kitchen sink's bands set their own), else the page's. */
const isPaper = (el: Element) => (el.closest<HTMLElement>("[data-theme]")?.dataset.theme ?? document.documentElement.dataset.theme) === "paper";

/** Where the visitor looked: the pointer projected into the box (clamped), else its center. */
function originFor(rect: DOMRect): Origin {
  const inView = pointer.active && pointer.x >= 0 && pointer.y >= 0 && pointer.x <= window.innerWidth && pointer.y <= window.innerHeight;
  if (!inView || rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
  return { x: (pointer.x - rect.left) / rect.width, y: (pointer.y - rect.top) / rect.height };
}

/**
 * The client half of <DitherImage>: DITHER RESOLVE on arrival (in view and decoded) and on every
 * `resolveKey` change. The no-JS edition shows the image plainly (the hide is under html.js); the
 * reduced-motion edition swaps instantly (CSS shows the image as soon as it loads).
 */
export function DitherFrame({ img, lo, fit = "cover", resolveKey, skew = false, className }: DitherFrameProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useVelocitySkew(rootRef, skew && !reduced);
  const hiRef = useRef<HTMLSpanElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<State>("lo");
  const [mode, setMode] = useState<"dither" | "halftone">("dither");

  useEffect(() => retainPointer(), []);

  useEffect(() => {
    const root = rootRef.current;
    const hi = hiRef.current;
    const image = imgRef.current;
    if (!root || !hi || !image) return;
    let cancelled = false;
    let animation: Animation | null = null;
    let inView = false;
    let started = false;
    setState("lo");

    const clearMask = () => {
      for (const p of ["maskImage", "maskSize", "maskPosition", "maskRepeat", "webkitMaskImage", "webkitMaskSize", "webkitMaskPosition", "webkitMaskRepeat"] as const) hi.style[p] = "";
      hi.style.removeProperty("--dot-r");
      hi.style.removeProperty("--dither-period");
    };

    const resolve = async () => {
      if (started || cancelled) return;
      started = true;
      try {
        await image.decode();
      } catch {
        /* broken or detached image: show what the browser has */
      }
      if (cancelled) return;
      // reduced motion: instant; under a PROJECTION the stage has just shown this picture in full
      if (isReduced() || projection.active) {
        setState("hi");
        return;
      }
      const rect = root.getBoundingClientRect();
      const origin = originFor(rect);
      if (isPaper(root)) {
        // HALFTONE: AM dots grow on a 45° screen (two offset square lattices), steps(16)
        setMode("halftone");
        hi.style.setProperty("--dither-period", `${DITHER.halftonePeriodPx}px`);
        hi.style.setProperty("--dot-r", "0px");
        setState("resolving");
        animation = hi.animate([{ "--dot-r": "0px" }, { "--dot-r": `${halftoneFullRadius()}px` }], { duration: DITHER.ms, easing: `steps(${DITHER.steps}, end)`, fill: "forwards" });
      } else {
        setMode("dither");
        const grid = ditherGrid(rect.width, rect.height);
        let url: string;
        try {
          url = await ditherSprite(grid, origin);
        } catch {
          setState("hi");
          return;
        }
        if (cancelled) return;
        const frameW = grid.cols * grid.cell;
        const size = `${frameW * (DITHER.steps + 1)}px ${grid.rows * grid.cell}px`;
        Object.assign(hi.style, { maskImage: `url(${url})`, maskSize: size, maskRepeat: "no-repeat", maskPosition: "0px 0px", webkitMaskImage: `url(${url})`, webkitMaskSize: size, webkitMaskRepeat: "no-repeat", webkitMaskPosition: "0px 0px" });
        setState("resolving");
        const to = `${-frameW * DITHER.steps}px 0px`;
        animation = hi.animate([{ maskPosition: "0px 0px", webkitMaskPosition: "0px 0px" }, { maskPosition: to, webkitMaskPosition: to }] as Keyframe[], { duration: DITHER.ms, easing: `steps(${DITHER.steps}, end)`, fill: "forwards" });
      }
      try {
        await animation.finished;
      } catch {
        return; // cancelled
      }
      if (cancelled) return;
      animation.cancel();
      clearMask();
      setState("hi");
    };

    const maybeStart = () => {
      if (inView && image.complete && image.naturalWidth > 0) void resolve();
    };
    const onLoad = () => maybeStart();
    image.addEventListener("load", onLoad);
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
        maybeStart();
      },
      { threshold: 0.2 },
    );
    io.observe(root);

    return () => {
      cancelled = true;
      io.disconnect();
      image.removeEventListener("load", onLoad);
      animation?.cancel();
      clearMask();
    };
  }, [img.src, resolveKey]);

  const { alt, width, height, ...rest } = img;
  return (
    <span
      ref={rootRef}
      className={cx("dither", className)}
      data-state={state}
      data-mode={mode}
      style={{ "--ratio": `${width} / ${height}`, "--fit": fit, ...(lo ? { "--lo": `url(${lo})` } : {}) } as CSSProperties}
    >
      <span className="dither__lo" data-ink={lo ? "" : undefined} aria-hidden="true" />
      <span ref={hiRef} className="dither__hi">
        {/* eslint-disable-next-line @next/next/no-img-element -- props come from next/image's getImageProps() */}
        <img ref={imgRef} alt={alt} width={width} height={height} {...rest} />
      </span>
    </span>
  );
}
