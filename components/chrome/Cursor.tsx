"use client";

import { useEffect, useRef } from "react";
import { damp } from "@/lib/damp";
import { followers } from "@/lib/motion";
import { onTick } from "@/lib/ticker";

export interface CursorLabels {
  view: string;
  drag: string;
  flip: string;
  open: string;
}

/** brackets sit this far outside a snapped element */
const SNAP_PAD = 4;
/** the reticle's size at rest, CSS px */
const RETICLE = 10;
/** what the ring snaps to as brackets (media — data-cursor — gets the chip, not brackets) */
const INTERACTIVE = "a[href], button, [role='button'], [role='switch'], [role='tab'], summary, label, select, input[type='radio'], input[type='checkbox']";
/** never bracket something that is most of the screen (a full-bleed link): the reticle stays */
const MAX_SNAP = 0.6;
const TEXT_FIELD = "input:not([type='radio']):not([type='checkbox']):not([type='button']):not([type='submit']), textarea, [contenteditable='true'], [contenteditable='']";

/**
 * <Cursor> (DESIGN.md §7.3): a 10 px hollow-square reticle with an unlagged 2 px center dot (the
 * hotspot, moved in the pointer event itself — never a frame late) and a ring that trails at λ 24.
 * Over an interactive element the ring snaps to it as four brackets; over media (data-cursor) it
 * grows a label chip — VIEW / DRAG / FLIP / OPEN — at λ 12. Drawn with mix-blend-mode: difference.
 * Absent on coarse pointers and in forced-colors mode; inside text fields the native I-beam
 * shows instead. Reduced motion: no lag (the ring is where the pointer is).
 */
export function Cursor({ labels }: { labels: CursorLabels }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const chip = chipRef.current;
    if (!root || !dot || !ring || !chip) return;
    const html = document.documentElement;
    const fine = matchMedia("(pointer: fine)");
    const forced = matchMedia("(forced-colors: active)");
    if (!fine.matches || forced.matches) return;
    html.dataset.reticle = "on";

    const p = { x: -100, y: -100, seen: false };
    // the ring's state: center and size, damped toward its target
    const r = { x: -100, y: -100, w: RETICLE, h: RETICLE };
    const target = { x: -100, y: -100, w: RETICLE, h: RETICLE };
    let snapped: Element | null = null;
    let chipShown = 0;
    let chipTarget = 0;
    let hidden = true;

    const setHidden = (h: boolean) => {
      if (h === hidden) return;
      hidden = h;
      if (h) root.dataset.hidden = "";
      else delete root.dataset.hidden;
    };

    const retarget = () => {
      if (snapped && snapped.isConnected) {
        const b = snapped.getBoundingClientRect();
        target.x = b.left + b.width / 2;
        target.y = b.top + b.height / 2;
        target.w = b.width + SNAP_PAD * 2;
        target.h = b.height + SNAP_PAD * 2;
      } else {
        snapped = null;
        target.x = p.x;
        target.y = p.y;
        target.w = RETICLE;
        target.h = RETICLE;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      p.x = e.clientX;
      p.y = e.clientY;
      // the hotspot: written here, in the event — the one part that never lags
      dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      if (!p.seen) {
        p.seen = true;
        r.x = p.x;
        r.y = p.y;
      }
      const under = e.target instanceof Element ? e.target : null;
      const inText = !!under?.closest(TEXT_FIELD);
      // a modal dialog is in the top layer, above the reticle: over it (or its backdrop) the native cursor shows instead
      const inModal = !!under?.closest("dialog:modal");
      setHidden(inText || inModal);
      const hit = inText || inModal ? null : (under?.closest(INTERACTIVE) ?? null);
      const box = hit?.getBoundingClientRect();
      const huge = !!box && box.width > window.innerWidth * MAX_SNAP && box.height > window.innerHeight * MAX_SNAP;
      snapped = hit && !huge && !hit.closest("[data-cursor-snap='off']") ? hit : null;
      const kind = (under?.closest("[data-cursor]") as HTMLElement | null)?.dataset.cursor;
      const label = kind === "view" || kind === "drag" || kind === "flip" || kind === "open" ? labels[kind] : "";
      if (label && chip.textContent !== label) chip.textContent = label;
      chipTarget = label ? 1 : 0;
      retarget();
    };
    const onLeave = () => setHidden(true);
    const onScroll = () => retarget();

    const reduced = () => html.dataset.motion === "reduce";
    const offTick = onTick((dt) => {
      if (!p.seen) return;
      const instant = reduced();
      r.x = instant ? target.x : damp(r.x, target.x, followers.cursorRing, dt);
      r.y = instant ? target.y : damp(r.y, target.y, followers.cursorRing, dt);
      r.w = instant ? target.w : damp(r.w, target.w, followers.cursorRing, dt);
      r.h = instant ? target.h : damp(r.h, target.h, followers.cursorRing, dt);
      ring.style.transform = `translate3d(${(r.x - r.w / 2).toFixed(2)}px, ${(r.y - r.h / 2).toFixed(2)}px, 0)`;
      ring.style.width = `${r.w.toFixed(2)}px`;
      ring.style.height = `${r.h.toFixed(2)}px`;
      chipShown = instant ? chipTarget : damp(chipShown, chipTarget, followers.cursorLabel, dt);
      chip.style.transform = `translate3d(${(r.x + r.w / 2 + 4).toFixed(2)}px, ${(r.y + r.h / 2 + 4).toFixed(2)}px, 0) scale(${chipShown.toFixed(3)})`;
      chip.style.opacity = chipShown.toFixed(3);
    });

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onMedia = () => {
      if (!fine.matches || forced.matches) {
        setHidden(true);
        delete html.dataset.reticle;
      } else html.dataset.reticle = "on";
    };
    fine.addEventListener("change", onMedia);
    forced.addEventListener("change", onMedia);
    return () => {
      offTick();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      fine.removeEventListener("change", onMedia);
      forced.removeEventListener("change", onMedia);
      delete html.dataset.reticle;
    };
  }, [labels]);

  return (
    <div ref={rootRef} id="cursor" aria-hidden="true" data-hidden="">
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
