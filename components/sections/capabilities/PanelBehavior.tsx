"use client";

import { useEffect } from "react";
import { KEYS, useKeys } from "@/lib/capabilities";
import { cue } from "@/lib/cues";

/**
 * The panel's behaviour (DESIGN.md §7.4 CAPABILITIES), loaded on idle: the key last pressed or
 * typed — on the stage or in the CSS grid — lights its row for a moment; a tap on a grid key presses
 * it (the clack, the row). The rows are the server's.
 */
export default function PanelBehavior({ slugs }: { slugs: string[] }) {
  // a lit key's row
  useEffect(() => {
    let timer = 0;
    let row: HTMLElement | null = null;
    const off = useKeys.subscribe((s, prev) => {
      if (s.lit === prev.lit || !s.lit) return;
      row?.removeAttribute("data-lit");
      window.clearTimeout(timer);
      const slug = slugs[s.lit.index];
      row = slug ? document.querySelector<HTMLElement>(`.skill-row[data-skill="${slug}"]`) : null;
      if (!row) return;
      row.setAttribute("data-lit", "");
      const lit = row;
      timer = window.setTimeout(() => lit.removeAttribute("data-lit"), KEYS.litMs);
    });
    return () => {
      off();
      window.clearTimeout(timer);
      row?.removeAttribute("data-lit");
    };
  }, [slugs]);

  // the CSS grid: a tap presses a key
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>(".keygrid");
    if (!grid) return;
    const onDown = (e: PointerEvent) => {
      const key = (e.target as Element | null)?.closest<HTMLElement>(".keycap");
      if (!key) return;
      cue("KEYCAP", { intensity: 0.8 });
      useKeys.getState().light(Number(key.dataset.key));
    };
    grid.addEventListener("pointerdown", onDown);
    return () => grid.removeEventListener("pointerdown", onDown);
  }, []);

  return null;
}
