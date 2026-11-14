"use client";

import { useEffect, useRef, useState } from "react";
import { DitherFrame } from "@/components/ui/DitherFrame";
import { cssEase, duration } from "@/lib/motion";
import { pointer } from "@/lib/pointer";
import { onTick } from "@/lib/ticker";
import { useWork, WORK } from "@/lib/work";
import type { CoverImg } from "./Work";

const reduced = () => document.documentElement.dataset.motion === "reduce";
const canHover = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * The INDEX's behavior (DESIGN.md §7.4, §4.4 B4), loaded on idle over the server's table:
 *   - the chips filter the rows (one category, one shared stack); the rows that stay FLIP to their
 *     new places and the ones that return reveal (element tier, `settle`; instant under reduced
 *     motion) — a hand-rolled FLIP on the server's own rows (§10: the table stays crawlable HTML)
 *   - pointing at a row lights its slide on the rail and shows its cover under the cursor (B4):
 *     following it at λ 9, turned by its velocity, rotateZ = clamp(vx × 0.02, ±4°); it resolves
 *     on every change of row (DITHER RESOLVE). Hover-capable pointers only.
 */
export default function IndexFilters({ covers, labels, total }: { covers: Record<string, CoverImg>; labels: { of: string; shown: string }; total: number }) {
  const markRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // each row's cover stays loaded once seen (switching rows never refetches or cancels a load);
  // `n` counts its arrivals, so it resolves again every time it's pointed at
  const [seen, setSeen] = useState<Record<string, number>>({});
  const current = useRef<string | null>(null);

  // the chips: one choice per group; the rows FLIP
  useEffect(() => {
    const root = markRef.current?.closest<HTMLElement>("[data-work-index]");
    const bar = root?.querySelector<HTMLElement>(".work-filters");
    const body = root?.querySelector<HTMLElement>(".work-table tbody");
    if (!root || !bar || !body) return;
    const rows = [...body.querySelectorAll<HTMLTableRowElement>("tr[data-slug]")];
    const count = root.querySelector<HTMLElement>("[data-index-count]");
    const none = root.querySelector<HTMLElement>("[data-index-none]");
    const chosen = { category: "", stack: "" };
    const apply = () => {
      const before = new Map(rows.filter((r) => !r.hidden).map((r) => [r, r.getBoundingClientRect().top]));
      let shown = 0;
      for (const r of rows) {
        const ok = (!chosen.category || r.dataset.category === chosen.category) && (!chosen.stack || (r.dataset.stack ?? "").split("|").includes(chosen.stack));
        r.hidden = !ok;
        if (ok) shown++;
      }
      if (count) count.textContent = shown === total ? "" : `${shown} ${labels.of} ${total} ${labels.shown}`;
      if (none) none.hidden = shown > 0;
      if (reduced()) return;
      const ms = duration.element.in;
      for (const r of rows) {
        if (r.hidden) continue;
        const was = before.get(r);
        if (was === undefined) {
          r.animate([{ opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)" }], { duration: ms, easing: cssEase("settle") });
          continue;
        }
        const dy = was - r.getBoundingClientRect().top;
        if (Math.abs(dy) > 0.5) r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: ms, easing: cssEase("settle") });
      }
    };
    const onClick = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest<HTMLButtonElement>("button[data-filter]");
      if (!b) return;
      const key = b.dataset.filter as keyof typeof chosen;
      chosen[key] = b.dataset.value ?? "";
      for (const c of bar.querySelectorAll<HTMLButtonElement>(`button[data-filter="${key}"]`)) {
        const on = (c.dataset.value ?? "") === chosen[key];
        c.setAttribute("aria-pressed", String(on));
        const mark = c.querySelector("[aria-hidden]");
        if (mark) mark.textContent = on ? "■" : "□";
      }
      apply();
    };
    bar.addEventListener("click", onClick);
    return () => bar.removeEventListener("click", onClick);
  }, [labels, total]);

  // pointing at a row: its slide lights, its cover follows the cursor
  useEffect(() => {
    const root = markRef.current?.closest<HTMLElement>("[data-work-index]");
    const body = root?.querySelector<HTMLElement>(".work-table tbody");
    if (!body) return;
    const over = (e: PointerEvent) => {
      const r = (e.target as Element | null)?.closest<HTMLTableRowElement>("tr[data-slug]");
      const slide = Number(r?.dataset.slide ?? -1);
      useWork.getState().point(r && slide >= 0 ? slide : null);
      const next = r && e.pointerType === "mouse" && canHover() ? (r.dataset.slug ?? null) : null;
      if (next === current.current) return;
      current.current = next;
      if (next) setSeen((s) => ({ ...s, [next]: (s[next] ?? -1) + 1 }));
      setHovered(next);
    };
    const leave = () => {
      useWork.getState().point(null);
      current.current = null;
      setHovered(null);
    };
    body.addEventListener("pointerover", over);
    body.addEventListener("pointerleave", leave);
    return () => {
      body.removeEventListener("pointerover", over);
      body.removeEventListener("pointerleave", leave);
      useWork.getState().point(null);
    };
  }, []);

  // the preview follows at λ 9, turned by its velocity (one style write per frame while shown)
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !hovered) return;
    const P = WORK.preview;
    let x = pointer.x + P.offsetPx;
    let y = pointer.y + P.offsetPx;
    return onTick((dt) => {
      const k = reduced() ? 1 : 1 - Math.exp(-P.lambda * dt);
      const tx = pointer.x + P.offsetPx;
      const ty = pointer.y + P.offsetPx;
      const vx = dt > 0 ? ((tx - x) * k) / dt : 0;
      x += (tx - x) * k;
      y += (ty - y) * k;
      const rz = reduced() ? 0 : Math.max(-P.maxDeg, Math.min(P.maxDeg, vx * P.gain));
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rz.toFixed(2)}deg)`;
    });
  }, [hovered]);

  return (
    <>
      <span ref={markRef} hidden />
      <div ref={previewRef} className="work-preview" data-shown={hovered ? "" : undefined} aria-hidden="true">
        {Object.entries(seen).map(([slug, n]) => {
          const c = covers[slug];
          return c ? (
            <div key={slug} className="work-preview__frame" data-on={slug === hovered || undefined}>
              <DitherFrame img={{ src: c.src, srcSet: c.srcSet, sizes: c.sizes, alt: "", width: c.width, height: c.height, decoding: "async" }} resolveKey={n} />
            </div>
          ) : null;
        })}
      </div>
    </>
  );
}
