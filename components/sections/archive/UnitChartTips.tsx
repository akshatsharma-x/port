"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { useArchive } from "@/lib/archive";

/**
 * The unit chart's one tooltip (DESIGN.md §7.4): a cell under the cursor or the keyboard shows its
 * paper, and lights its star in the sky above. The cells are the server's SVG links; this only
 * listens to them (data-cell, data-tip, data-i).
 */
export function UnitChartTips({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const point = useArchive((s) => s.point);
  const router = useRouter();

  const show = (target: EventTarget | null) => {
    const cell = target instanceof Element ? target.closest<SVGElement>("[data-cell]") : null;
    const box = ref.current?.getBoundingClientRect();
    if (!cell || !box) return;
    const r = cell.getBoundingClientRect();
    setTip({ text: cell.dataset.tip ?? "", x: r.left + r.width / 2 - box.left, y: r.top - box.top });
    const i = Number(cell.dataset.i);
    point(Number.isInteger(i) ? i : null);
  };
  const hide = () => {
    setTip(null);
    point(null);
  };

  return (
    <div
      ref={ref}
      className="unit-chart__plot"
      onPointerOver={(e: PointerEvent<HTMLDivElement>) => show(e.target)}
      onPointerLeave={hide}
      onFocus={(e: FocusEvent<HTMLDivElement>) => show(e.target)}
      onBlur={hide}
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        // an SVG <a> is neither a <Link> nor a route link to lib/navigation: open the dossier softly
        const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
        const href = a?.getAttribute("href");
        if (!href || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.push(href, { scroll: false });
      }}
    >
      {children}
      {tip && (
        <span className="unit-chart__tip t-micro" style={{ transform: `translate(${tip.x}px, ${tip.y}px)` }} aria-hidden="true">
          {tip.text}
        </span>
      )}
    </div>
  );
}
