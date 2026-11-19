"use client";

import { useEffect, useRef } from "react";
import { whenIdle } from "@/lib/idle";
import type { CursorLabels } from "@/lib/cursor";

export type { CursorLabels };

/**
 * <Cursor> (DESIGN.md §7.3): a 10 px hollow-square reticle with an unlagged 2 px center dot (the
 * hotspot, moved in the pointer event itself — never a frame late) and a ring that trails at λ 24.
 * Over an interactive element the ring snaps to it as four brackets; over media (data-cursor) it
 * grows a label chip — VIEW / DRAG / FLIP / OPEN — at λ 12. Drawn with mix-blend-mode: difference,
 * above every layer the page draws (z62). Absent on coarse pointers and in forced-colors mode;
 * inside text fields and modal dialogs the native cursor shows instead — never neither (data-reticle).
 * Reduced motion: no lag (the ring is where the pointer is).
 *
 * This is its markup; its behaviour (lib/cursor.ts) loads after idle, or at the pointer's first move
 * if that comes sooner, and starts from that move. Until then the native cursor is the cursor.
 */
export function Cursor({ labels }: { labels: CursorLabels }) {
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const chip = chipRef.current;
    if (!dot || !ring || !chip || !matchMedia("(pointer: fine)").matches) return;
    let live = true;
    let loading = false;
    let stop: (() => void) | null = null;
    // where the pointer is until the behaviour starts (the move that asked for it, and any after)
    let at: { x: number; y: number } | undefined;
    const untrack = () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerover", track);
    };
    const load = () => {
      if (loading) return;
      loading = true;
      cancelIdle();
      void import("@/lib/cursor").then((m) => {
        untrack();
        if (live) stop = m.startCursor({ dot, ring, chip }, labels, at);
      });
    };
    const track = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      at = { x: e.clientX, y: e.clientY };
      load();
    };
    const cancelIdle = whenIdle(load);
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerover", track, { passive: true });
    return () => {
      live = false;
      cancelIdle();
      untrack();
      stop?.();
    };
  }, [labels]);

  return (
    <div id="cursor" aria-hidden="true">
      <span ref={ringRef} className="cursor__ring">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span ref={dotRef} className="cursor__dot" />
      <span ref={chipRef} className="cursor__chip t-micro" />
    </div>
  );
}
