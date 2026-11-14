"use client";

import { useEffect, useRef } from "react";
import { duration } from "@/lib/motion";
import { onTick } from "@/lib/ticker";

const PAD = 4;

/**
 * Focus = brackets (DESIGN.md §2.9): one bracket set follows keyboard focus, snapping between
 * elements on the micro tier. The 2 px outline comes from :focus-visible in base.css. Opt a
 * subtree out with data-focus-brackets="off".
 */
export function FocusBrackets() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let target: HTMLElement | null = null;
    let stop: (() => void) | null = null;
    let snapTimer = 0;
    let last = "";

    const hide = () => {
      target = null;
      last = "";
      box.dataset.visible = "false";
      stop?.();
      stop = null;
    };

    const place = () => {
      if (!target || !target.isConnected) {
        hide();
        return;
      }
      const r = target.getBoundingClientRect();
      const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
      if (key === last) return; // only write when something moved (keeps the snap transition clean)
      last = key;
      box.style.transform = `translate3d(${r.left - PAD}px, ${r.top - PAD}px, 0)`;
      box.style.width = `${r.width + PAD * 2}px`;
      box.style.height = `${r.height + PAD * 2}px`;
    };

    const show = (el: HTMLElement) => {
      if (box.dataset.visible === "true") {
        box.classList.add("is-snapping");
        window.clearTimeout(snapTimer);
        snapTimer = window.setTimeout(() => box.classList.remove("is-snapping"), duration.micro.in);
      }
      target = el;
      place();
      box.dataset.visible = "true";
      stop ??= onTick(place);
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el === document.body || !el.matches(":focus-visible")) return hide();
      if (el.closest("[data-focus-brackets='off']")) return hide();
      show(el);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!e.relatedTarget) hide();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.clearTimeout(snapTimer);
      stop?.();
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="bracket focus-brackets" data-drawn="" data-active="" data-visible="false" />;
}
