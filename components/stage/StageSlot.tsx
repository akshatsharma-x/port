"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { governor } from "@/lib/sceneManager";
import { liveAllowed, type SceneId } from "@/lib/tier";
import { posterPortraitSrc, posterSrc, posterTabletSrc } from "./registry";
import { useStage } from "./useStage";

export interface StageSlotProps {
  id: SceneId;
  /** sizing comes from the section, e.g. "h-[100svh]" */
  className?: string;
  children?: ReactNode;
}

/**
 * The DOM placeholder a Tier-A section renders (DESIGN.md §4.1). When its scene is live, the one
 * stage canvas sits in the slot's dock, held by `position: sticky` (v1.5 docking: native scroll,
 * nothing per frame); `overflow: clip` crops it to slots shorter than the viewport.
 *
 * Gap protection: until its scene can draw — tier allows it, warmed, context healthy — the slot
 * shows the scene's 1-bit poster on an opaque ground (hiding any stale canvas frame). It hides in
 * the frame the scene can draw; if it was on screen, the stage DITHER-RESOLVEs from the same 1-bit
 * look (in-shader, §3.6), so there's no crossfade. Server-rendered with the poster on, so the no-JS,
 * reduced-motion and tier-OFF editions are complete.
 */
export function StageSlot({ id, className, children }: StageSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useStage((s) => s.tierFinal && liveAllowed(s.tier, id) && !s.scenes[id].poster && !s.contextLost);

  // a layout effect: on unmount it unregisters during the commit that removes the element, so the
  // governor never measures (or docks to) a detached slot
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const unregister = governor.registerSlot(id, el);
    const ro = new ResizeObserver(() => governor.measure());
    ro.observe(el);
    return () => {
      ro.disconnect();
      unregister();
    };
  }, [id]);

  return (
    <div ref={ref} data-stage-slot={id} className={cx("stage-slot", className)}>
      <div className="stage-dock" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="stage-poster"
        data-live={live || undefined}
        style={
          {
            "--poster": `url(${posterSrc(id)})`,
            ...(posterPortraitSrc(id) ? { "--poster-portrait": `url(${posterPortraitSrc(id)})` } : {}),
            ...(posterTabletSrc(id) ? { "--poster-tablet": `url(${posterTabletSrc(id)})` } : {}),
          } as CSSProperties
        }
      />
      {children}
    </div>
  );
}
