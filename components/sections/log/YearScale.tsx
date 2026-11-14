"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { pinProgress, scrollToStep } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";

export interface ScaleRole {
  slug: string;
  /** "United Airlines, Jun 2026 – Present": the role's button's name */
  label: string;
  /** its span on the scale, 0 (top, newest) – 1 (bottom, oldest) */
  from: number;
  to: number;
  /** where the playhead rests while it's the active card */
  stop: number;
}

export interface ScaleYear {
  year: number;
  at: number;
  /** the deck index it flies to: the newest role that ran that year */
  role: number;
}

/**
 * LOG's year scale (DESIGN.md §7.4): the left edge of the pinned frame, newest at the top. The
 * playhead scrubs with the camera — between the active role's stop and the next, by the pin's
 * progress — and the pin's soft detents snap it to roles. A year (or a role's span) is a button:
 * it glides the page to that role's node, so the camera, on its heavy spring, flies there.
 */
export function YearScale({ label, roles, years, ticks }: { label: string; roles: readonly ScaleRole[]; years: readonly ScaleYear[]; ticks: readonly number[] }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || roles.length === 0) return;
    const bars = [...el.querySelectorAll<HTMLElement>(".year-scale__role")];
    let last = -1;
    let active = -1;
    let off: (() => void) | null = null;
    const tick = () => {
      const a = pinProgress("log") * Math.max(0, roles.length - 1);
      const i = Math.min(roles.length - 1, Math.floor(a));
      const s0 = roles[i]?.stop ?? 0;
      const s1 = roles[Math.min(roles.length - 1, i + 1)]?.stop ?? s0;
      const y = s0 + (s1 - s0) * (a - i);
      if (Math.abs(y - last) > 1e-4) {
        el.style.setProperty("--playhead", String(y));
        last = y;
      }
      const now = Math.round(a);
      if (now !== active) {
        bars.forEach((b, k) => {
          if (k === now) b.dataset.active = "";
          else delete b.dataset.active;
        });
        active = now;
      }
    };
    // only while it's on screen
    const io = new IntersectionObserver((entries) => {
      const on = entries.some((e) => e.isIntersecting);
      if (on && !off) off = onTick(tick);
      if (!on && off) {
        off();
        off = null;
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      off?.();
    };
  }, [roles]);

  return (
    <nav ref={ref} className="year-scale" aria-label={label} style={{ "--playhead": roles[0]?.stop ?? 0 } as CSSProperties}>
      <div className="year-scale__rule" aria-hidden="true">
        {ticks.map((t) => (
          <i key={t} className="year-scale__tick" style={{ "--at": t } as CSSProperties} />
        ))}
      </div>
      {roles.map((r, i) => (
        <button key={r.slug} type="button" className="year-scale__role" data-role={i} aria-label={r.label} style={{ "--from": r.from, "--to": r.to } as CSSProperties} onClick={() => scrollToStep("log", i)} />
      ))}
      {years.map((y) => (
        <button key={y.year} type="button" className="year-scale__year t-micro" data-role={y.role} style={{ "--at": y.at } as CSSProperties} onClick={() => scrollToStep("log", y.role)}>
          {y.year}
        </button>
      ))}
      <i className="year-scale__playhead" aria-hidden="true" />
    </nav>
  );
}
