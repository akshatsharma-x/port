"use client";

import { useEffect, useRef, type ElementType } from "react";
import { bootStore } from "@/lib/boot";
import { cx } from "@/lib/cx";
import { charDelays, springs } from "@/lib/motion";
import { Spring } from "@/lib/spring";
import { onTick } from "@/lib/ticker";

/** where a character starts: below its line by this many line boxes (clipped by its word) */
const FROM = 1.1;
const SETTLED = 1e-3;

/**
 * The hero name's per-character rise (DESIGN.md §7.4): on `overshoot`, 28 ms apart — first boot
 * only, starting on the exact frame POWER ON's beam opens. Every other load (deep links, later
 * visits, reduced motion) renders it settled.
 *
 * At rest the name is one kerned text node: painted from the first frame under the boot overlay
 * (so LCP is the first paint) and never split. Only for the rise is a per-character copy laid
 * over it (inline-blocks can't kern across each other); the copy leaves when the last character
 * settles, and the kerned text shows again.
 */
export function NameRise({ text, as: Tag = "span", className }: { text: string; as?: ElementType; className?: string }) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const html = document.documentElement;
    if (!root || html.dataset.boot !== "run" || html.dataset.motion === "reduce") return;
    let off: (() => void) | null = null;
    let layer: HTMLElement | null = null;
    const restore = () => {
      off?.();
      off = null;
      layer?.remove();
      layer = null;
      delete root.dataset.rising;
    };
    const rise = () => {
      // split, for the rise only, in a layer over the (hidden, still kerned) text: words clip their
      // characters, characters move; React's own text node is never touched
      const chars: HTMLElement[] = [];
      layer = document.createElement("span");
      layer.className = "name-rise__layer";
      layer.setAttribute("aria-hidden", "true");
      text.split(" ").forEach((word, wi) => {
        if (wi > 0) layer?.append(" ");
        const w = document.createElement("span");
        w.className = "name-rise__word";
        for (const ch of word) {
          const c = document.createElement("span");
          c.className = "name-rise__char";
          c.textContent = ch;
          c.style.transform = `translateY(${FROM * 100}%)`;
          w.append(c);
          chars.push(c);
        }
        layer?.append(w);
      });
      root.dataset.rising = "";
      root.append(layer);
      const delays = charDelays(chars.length, text);
      const motion = chars.map(() => new Spring(springs.overshoot, 0).setTarget(1));
      let elapsed = 0;
      off = onTick((dt) => {
        elapsed += dt * 1000;
        let moving = false;
        chars.forEach((c, i) => {
          const s = motion[i];
          if (!s) return;
          if (elapsed < (delays[i] ?? 0)) {
            moving = true;
            return;
          }
          const v = s.step(dt);
          if (s.isSettled(SETTLED)) {
            c.style.transform = "";
            return;
          }
          moving = true;
          c.style.transform = `translateY(${((1 - v) * FROM * 100).toFixed(2)}%)`;
        });
        if (!moving) restore();
      });
    };
    const unsubscribe = bootStore.subscribe((s, prev) => {
      if (s.beamOpenAt !== null && prev.beamOpenAt === null && !s.skipped) rise();
    });
    return () => {
      unsubscribe();
      if (off) restore();
    };
  }, [text]);

  return (
    <Tag ref={rootRef} className={cx("name-rise", className)}>
      <span className="name-rise__text">{text}</span>
    </Tag>
  );
}
