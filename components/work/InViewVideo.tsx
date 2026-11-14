"use client";

import { useEffect, useRef } from "react";

/**
 * A case study's video (DESIGN.md §7.4): muted, inline, looping, playing only while it's in view,
 * with its poster until then. Reduced motion: it never plays by itself — the poster and the
 * controls, so playing is the reader's choice. No JS: the controls.
 */
export function InViewVideo({ src, poster, label, width, height }: { src: string; poster: string; label: string; width: number; height: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (document.documentElement.dataset.motion === "reduce") return;
    v.controls = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} className="case__video" src={src} poster={poster} aria-label={label} width={width} height={height} muted playsInline loop preload="none" controls />;
}
