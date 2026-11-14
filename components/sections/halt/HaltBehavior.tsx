"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { duration } from "@/lib/motion";
import { glideTo, onScrollRefresh } from "@/lib/scroll";
import { powerOff, powerOn } from "@/lib/signatures";
import { onTick } from "@/lib/ticker";

/** the last pixel arms again once the page is scrolled this far back up from the end (px) */
const REARM_PX = 48;

/**
 * HALT's behaviour (DESIGN.md §7.4), loaded on idle:
 *   - back to top: Lenis on `transit`, 900 ms, a quiet glide — the eight sections it passes don't
 *     each cue a crossing (lib/scroll.ts glideTo). The link opts out of the jump-with-a-tear that
 *     every other #hash link gets (lib/navigation.ts); before this loads it's that jump.
 *   - the last pixel: POWER OFF (450 ms, the tube to a line, then a dot) with HALT's sweep, then
 *     SYSTEM HALTED. SCROLL UP TO RESUME. Any upward scroll, touch, click or key turns it back on at
 *     once (lib/transitions.ts resumeOnInput) — nothing here holds the scroll — and so does the page
 *     leaving the end by any other way (a scrollbar's drag, a script). It arms again only once the
 *     page has been scrolled back up from the end.
 * The message lives outside #screen, which the tube's off state hides.
 */
export default function HaltBehavior({ halted }: { halted: string }) {
  const [off, setOff] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const top = document.querySelector<HTMLAnchorElement>("[data-halt-top]");
    const toTop = (e: MouseEvent) => {
      e.preventDefault();
      glideTo(0, duration.scene.in, { quiet: true });
    };
    top?.addEventListener("click", toTop);

    // the end of the page, cached where layout is read anyway (resize, scroll refresh)
    let end = 0;
    const measure = () => {
      end = html.scrollHeight - window.innerHeight;
    };
    measure();
    const offRefresh = onScrollRefresh(measure);
    window.addEventListener("resize", measure);
    let armed = window.scrollY < end - REARM_PX;
    // this halt's own power-off, and where it happened: leaving that spot upward by any way turns
    // it back on (input does it first, in lib/transitions.ts; a scrollbar's drag has no input event)
    let ours = false;
    let haltedAt: number | null = null;
    const offTick = onTick(() => {
      const y = window.scrollY;
      if (haltedAt !== null) {
        if (y < haltedAt - 1) {
          haltedAt = null;
          void powerOn({ fast: true });
        }
        return;
      }
      if (y < end - REARM_PX) armed = true;
      if (!armed || y < end - 1 || html.dataset.tube === "off") return;
      // the cached end is only a candidate: the page may have grown since the last refresh (CONNECT's
      // log, say), and 3 px above the true end isn't the last pixel. Read it now — once, here at the
      // end of the page, never every frame.
      measure();
      if (end <= 0 || y < end - 1) return;
      armed = false;
      ours = true;
      void powerOff({ cue: "HALT" });
    });
    // the message follows the tube, whoever turned it off or on
    const watch = new MutationObserver(() => {
      const isOff = html.dataset.tube === "off";
      setOff(isOff);
      haltedAt = isOff && ours ? window.scrollY : null;
      if (!isOff) ours = false;
    });
    watch.observe(html, { attributes: true, attributeFilter: ["data-tube"] });
    return () => {
      top?.removeEventListener("click", toTop);
      offRefresh();
      window.removeEventListener("resize", measure);
      offTick();
      watch.disconnect();
    };
  }, []);

  return createPortal(
    <div className="halt-screen" role="status">
      {off && <p className="halt-screen__line">{halted}</p>}
    </div>,
    document.body,
  );
}
