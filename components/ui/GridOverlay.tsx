"use client";

import { useEffect } from "react";
import { useUI } from "@/lib/store";
import { isTextEntry } from "@/lib/keys";

/** True when a key press is text entry, not a shortcut (lib/keys.ts). */
export const isTypingTarget = isTextEntry;

/**
 * The "G" blueprint (DESIGN.md §2.9): the 12 layout columns as accent-wash fills, an 8 px
 * baseline and column numbers. Global shortcuts pause when focus is in a text field or when a
 * section claims the keyboard (data-shortcuts="off" on <html>, e.g. Skills type-to-press).
 */
export function GridOverlay() {
  const on = useUI((s) => s.grid);
  const flash = useUI((s) => s.gridFlash);
  const toggle = useUI((s) => s.toggleGrid);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "g" && e.key !== "G") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.defaultPrevented) return;
      if (isTypingTarget(e.target) || document.documentElement.dataset.shortcuts === "off") return;
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  if (!on && !flash) return null;
  return (
    <div className="grid-overlay" aria-hidden="true" data-flash={!on || undefined}>
      <div className="layout-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="grid-overlay__col">
            <span className="grid-overlay__num t-micro">{String(i + 1).padStart(2, "0")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
