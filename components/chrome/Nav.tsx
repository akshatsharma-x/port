"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useMagnetic } from "@/hooks/useMagnetic";
import { springs } from "@/lib/motion";
import { Spring } from "@/lib/spring";
import { scrollStore } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";

export interface NavItem {
  label: string;
  section: string;
}

const SETTLED = 0.05;

/**
 * <Nav> (DESIGN.md §7.3), top-right: WORK · RESEARCH · CREDENTIALS · CONTACT · ~ in mono labels,
 * magnetic, with one shared active indicator that travels between items on `settle` (§3.3) under
 * the section you're in. The indicator is a single bar measured against the list — the shared-
 * layout behaviour without Motion's layout bundle in first-load JS (§8.3). Each item is a plain
 * link (on / a #hash jump, elsewhere a route to it), so every click is a TRACKING TEAR. `~` is
 * the terminal's key (Part 13).
 */
export function Nav({ label, items, terminal }: { label: string; items: readonly NavItem[]; terminal: { glyph: string; label: string } }) {
  const current = useStore(scrollStore, (s) => s.section);
  const home = usePathname() === "/";
  const listRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const active = home && items.some((i) => i.section === current) ? current : null;

  // the one indicator: springs its x and width to the active item (snaps on first show, fades out)
  useEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    if (!list || !bar) return;
    const link = active ? list.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
    if (!link) {
      bar.dataset.on = "off";
      return;
    }
    const x = link.offsetLeft;
    const w = link.offsetWidth;
    const reduced = document.documentElement.dataset.motion === "reduce";
    const wasOn = bar.dataset.on === "on";
    bar.dataset.on = "on";
    const sx = new Spring(springs.settle, wasOn ? Number(bar.dataset.x) : x).setTarget(x);
    const sw = new Spring(springs.settle, wasOn ? Number(bar.dataset.w) : w).setTarget(w);
    const write = () => {
      bar.dataset.x = String(sx.value);
      bar.dataset.w = String(sw.value);
      bar.style.transform = `translate3d(${sx.value.toFixed(2)}px, 0, 0)`;
      bar.style.width = `${sw.value.toFixed(2)}px`;
    };
    if (!wasOn || reduced) {
      sx.snap(x);
      sw.snap(w);
      write();
      return;
    }
    const off = onTick((dt) => {
      sx.step(dt);
      sw.step(dt);
      write();
      if (sx.isSettled(SETTLED) && sw.isSettled(SETTLED)) off();
    });
    return off;
  }, [active]);

  return (
    <nav className="hud-nav" aria-label={label}>
      <ul ref={listRef} className="hud-nav__list">
        {items.map((item) => (
          <li key={item.section}>
            <NavLink href={home ? `#${item.section}` : `/#${item.section}`} label={item.label} section={item.section} active={active === item.section} />
          </li>
        ))}
        <li>
          {/* the terminal opens in Part 13 (lib/terminal.ts): present (its place is real), not yet operable */}
          <button type="button" className="hud-nav__link hud-nav__key" aria-label={terminal.label} aria-disabled="true">
            <span className="hud-nav__label">{terminal.glyph}</span>
          </button>
        </li>
      </ul>
      <span ref={barRef} className="hud-nav__active" aria-hidden="true" data-on="off" />
    </nav>
  );
}

function NavLink({ href, label, section, active }: { href: string; label: string; section: string; active: boolean }) {
  const ref = useMagnetic<HTMLAnchorElement>();
  return (
    <a ref={ref} href={href} className="hud-nav__link" data-section={section} aria-current={active ? "location" : undefined}>
      <span className="hud-nav__label">{label}</span>
    </a>
  );
}
