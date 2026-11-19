"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { LayoutName } from "@/content/schema";
import { ARCHIVE, skyView, useArchive } from "@/lib/archive";
import { tagSide, type TagSide } from "@/lib/sky-tags";
import { scrollGeometry, teleport } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";

export interface SkyNode {
  /** the graph index (content/graph.ts's order, shared with the stage data) */
  i: number;
  kind: "record" | "cited";
  title: string;
  /** the tooltip's second line: venue · year · citations */
  meta: string;
  /** the whole record, as one sentence, for its button */
  label: string;
  /** a record's dossier; a cited work's DOI or page; or nothing */
  href: string | null;
}

export interface SkyLabel {
  /** its index in the stage data's labels for that layout */
  k: number;
  text: string;
}

const LAYOUTS: readonly LayoutName[] = ["topic", "year", "venue"];
const NODE_PX = 24; // a focused star's target: never under 24 px (WCAG 2.5.8)
const TAG_GAP_PX = 12; // a record's tag stands this far off its glyph
const LABEL_LIFT_PX = 8; // a cluster label stands this far over its point (.sky-label's translate)

/**
 * The constellation's HTML layer (DESIGN.md §7.4, A3: labels are HTML). The stage is augmentative
 * and aria-hidden; this is what a keyboard and a screen reader get, and what the eye reads:
 *   - a list of every star as a real link (a record's dossier, a cited work's DOI) or button, one
 *     tab stop with a roving index: arrow keys move to the nearest star that way on screen, Enter
 *     opens it; the focused one sits over its star, so the focus brackets frame it
 *   - the cluster / year / venue labels and the one tooltip, placed by the stage's projection
 * It moves by transform only, from what the stage publishes (lib/archive.ts skyView), and only
 * while it's on screen. A click on a record opens its dossier as a soft navigation, so the
 * intercepted route shows it over the sky.
 */
export function SkyOverlay({ nodes, labels, listLabel, hint }: { nodes: readonly SkyNode[]; labels: Record<LayoutName, readonly SkyLabel[]>; listLabel: string; hint: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => nodes.find((n) => n.kind === "record")?.i ?? 0);
  const point = useArchive((s) => s.point);
  // a sparse sky labels its records in place (lib/archive.ts ARCHIVE.sparse, Part 16)
  const records = nodes.filter((n) => n.kind === "record");
  const sparse = records.length <= ARCHIVE.sparse;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const byLayout = Object.fromEntries(LAYOUTS.map((l) => [l, [...root.querySelectorAll<HTMLElement>(`[data-sky-label="${l}"]`)]])) as Record<LayoutName, HTMLElement[]>;
    const tip = root.querySelector<HTMLElement>(".sky-tip");
    const tipTitle = tip?.querySelector<HTMLElement>(".sky-tip__title");
    const tipMeta = tip?.querySelector<HTMLElement>(".sky-tip__meta");
    const buttons = new Map([...root.querySelectorAll<HTMLElement>("[data-sky-node]")].map((b) => [Number(b.dataset.skyNode), b]));
    const tags = [...root.querySelectorAll<HTMLElement>("[data-sky-tag]")].map((el) => ({ el, i: Number(el.dataset.skyTag), side: "" as TagSide | "", on: "", w: 0, h: 0 }));
    const tagged = new Set(tags.map((t) => t.i));
    // sizes, read once (and again if the sky resizes): never a layout read per frame
    let sizedFor = -1;
    const labelSize = new WeakMap<HTMLElement, { w: number; h: number }>();
    const shown = new WeakMap<HTMLElement, string>();
    const show = (el: HTMLElement, on: boolean) => {
      const v = on ? "1" : "0";
      if (shown.get(el) !== v) {
        el.style.opacity = v;
        shown.set(el, v);
      }
    };
    let version = -1;
    let tipFor = -2;
    let off: (() => void) | null = null;

    const tick = () => {
      if (skyView.version === version) return;
      version = skyView.version;
      const { width, height } = skyView;
      for (const layout of LAYOUTS) {
        const els = byLayout[layout];
        const on = layout === skyView.layout;
        els.forEach((el) => {
          const k = Number(el.dataset.k);
          const x = skyView.labels[k * 3] ?? -1e5;
          const y = skyView.labels[k * 3 + 1] ?? -1e5;
          const visible = on && Number.isFinite(skyView.labels[k * 3 + 2] ?? Infinity) && x > 0 && x < width && y > 0 && y < height;
          if (visible) el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          show(el, visible);
        });
      }
      // a sparse sky's tags: each by its star, clear of the cluster labels and the view's edges
      // (lib/archive.ts tagSide); the tuned one lit
      if (tags.length) {
        if (sizedFor !== width) {
          sizedFor = width;
          for (const t of tags) [t.w, t.h] = [t.el.offsetWidth, t.el.offsetHeight];
          for (const el of byLayout[skyView.layout]) labelSize.set(el, { w: el.offsetWidth, h: el.offsetHeight });
        }
        const boxes = byLayout[skyView.layout].flatMap((el) => {
          const k = Number(el.dataset.k);
          const x = skyView.labels[k * 3] ?? -1e5;
          const y = skyView.labels[k * 3 + 1] ?? -1e5;
          const size = labelSize.get(el);
          if (!size || x < 0 || y < 0) return [];
          const lifted = skyView.layout === "topic" ? size.h + LABEL_LIFT_PX : 0;
          return [{ x0: x - size.w / 2, y0: y - lifted, x1: x + size.w / 2, y1: y - lifted + size.h }];
        });
        const tuned = useArchive.getState().focused ?? -1;
        for (const t of tags) {
          const tx = skyView.nodes[t.i * 4] ?? -1e5;
          const ty = skyView.nodes[t.i * 4 + 1] ?? -1e5;
          const tr = skyView.nodes[t.i * 4 + 3] ?? 0;
          const visible = tx > 0 && tx < width && ty > 0 && ty < height;
          if (visible) {
            const { side, dx } = tagSide({ x: tx, y: ty, r: tr }, { w: t.w, h: t.h }, boxes, { w: width, h: height }, TAG_GAP_PX);
            if (side !== t.side) t.el.dataset.side = t.side = side;
            const off = tr + TAG_GAP_PX;
            const [ax, ay] = side === "right" ? [tx + off, ty] : side === "left" ? [tx - off, ty] : side === "above" ? [tx + dx, ty - off] : [tx + dx, ty + off];
            t.el.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0)`;
          }
          const on = String(t.i === tuned);
          if (on !== t.on) t.el.dataset.on = t.on = on;
          show(t.el, visible);
        }
      }
      // the one tooltip: the star under the cursor, else the one the keyboard is on (a tagged record
      // already says what it is)
      const focusedButton = document.activeElement instanceof HTMLElement && document.activeElement.dataset.skyNode !== undefined ? Number(document.activeElement.dataset.skyNode) : -1;
      const at = skyView.hovered >= 0 ? skyView.hovered : focusedButton;
      const nx = skyView.nodes[at * 4] ?? -1e5;
      const ny = skyView.nodes[at * 4 + 1] ?? -1e5;
      const nr = skyView.nodes[at * 4 + 3] ?? 0;
      if (tip && tipTitle && tipMeta) {
        if (at !== tipFor) {
          tipFor = at;
          const n = nodes.find((x) => x.i === at);
          tipTitle.textContent = n?.title ?? "";
          tipMeta.textContent = n?.meta ?? "";
        }
        const on = at >= 0 && !tagged.has(at) && nx > 0 && nx < width && ny > 0 && ny < height;
        if (on) tip.style.transform = `translate3d(${nx.toFixed(1)}px, ${(ny - nr).toFixed(1)}px, 0)`;
        show(tip, on);
      }
      root.style.cursor = skyView.hovered >= 0 && nodes.find((x) => x.i === skyView.hovered)?.href ? "pointer" : "";
      // the keyboard's star: its button over the glyph, at least a 24 px target
      if (focusedButton >= 0) {
        const b = buttons.get(focusedButton);
        const side = Math.max(NODE_PX, nr * 2);
        if (b) {
          b.style.transform = `translate3d(${(nx - side / 2).toFixed(1)}px, ${(ny - side / 2).toFixed(1)}px, 0)`;
          b.style.width = b.style.height = `${side.toFixed(0)}px`;
        }
      }
    };

    const io = new IntersectionObserver((entries) => {
      const on = entries.some((e) => e.isIntersecting);
      if (on && !off) off = onTick(tick);
      if (!on && off) {
        off();
        off = null;
      }
    });
    io.observe(root);
    return () => {
      io.disconnect();
      off?.();
    };
  }, [nodes]);

  const open = (n: SkyNode | undefined) => {
    if (!n?.href) return;
    if (n.kind === "record") router.push(n.href, { scroll: false });
    else window.open(n.href, "_blank", "noopener,noreferrer");
  };

  // a click anywhere on the sky lands on the star under the cursor (the stage picked it)
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a, button, input, label")) return;
    open(nodes.find((n) => n.i === skyView.hovered));
  };

  // arrow keys: the nearest star in that direction on screen; Home / End: the first and last record
  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const from = active;
    const fx = skyView.nodes[from * 4] ?? 0;
    const fy = skyView.nodes[from * 4 + 1] ?? 0;
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key] as [number, number] | undefined;
    let next = -1;
    if (dir) {
      let best = Infinity;
      for (const n of nodes) {
        if (n.i === from) continue;
        const dx = (skyView.nodes[n.i * 4] ?? 0) - fx;
        const dy = (skyView.nodes[n.i * 4 + 1] ?? 0) - fy;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 0) continue;
        const across = Math.abs(dx * dir[1] - dy * dir[0]);
        const score = along + across * 2; // prefer what's straight ahead
        if (score < best) {
          best = score;
          next = n.i;
        }
      }
    } else if (e.key === "Home" || e.key === "End") {
      const records = nodes.filter((n) => n.kind === "record");
      next = (e.key === "Home" ? records[0] : records.at(-1))?.i ?? -1;
    }
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    ref.current?.querySelector<HTMLElement>(`[data-sky-node="${next}"]`)?.focus({ preventScroll: true });
  };

  return (
    <div ref={ref} className="sky-overlay" onClick={onClick}>
      <div className="sky-labels" aria-hidden="true">
        {LAYOUTS.map((layout) =>
          labels[layout].map((l) => (
            <span key={`${layout}:${l.k}`} className={`sky-label sky-label--${layout} t-micro`} data-sky-label={layout} data-k={l.k}>
              {l.text}
            </span>
          )),
        )}
      </div>
      {sparse && (
        <div className="sky-tags" aria-hidden="true">
          {records.map((n) => (
            <span key={n.i} className="sky-tag" data-sky-tag={n.i}>
              <span className="sky-tag__title">{n.title}</span>
              <span className="sky-tag__meta t-micro">{n.meta}</span>
            </span>
          ))}
        </div>
      )}
      <div className="sky-tip" aria-hidden="true">
        <span className="sky-tip__title" />
        <span className="sky-tip__meta t-micro" />
      </div>
      <ol className="sky-nodes" aria-label={listLabel} onKeyDown={onKeyDown}>
        {nodes.map((n) => {
          const common = {
            "data-sky-node": n.i,
            "aria-label": n.label,
            tabIndex: n.i === active ? 0 : -1,
            className: `sky-node sky-node--${n.kind}`,
            onFocus: () => {
              setActive(n.i);
              point(n.i);
              holdPin();
            },
            onBlur: () => point(null),
          };
          return (
            <li key={n.i}>
              {n.href ? (
                <a
                  href={n.href}
                  {...common}
                  {...(n.kind === "record" ? { "data-transition": "dossier" } : {})}
                  {...(n.kind === "cited" ? { target: "_blank", rel: "noreferrer" } : {})}
                  onClick={(e) => {
                    if (n.kind !== "record" || e.metaKey || e.ctrlKey || e.shiftKey) return;
                    e.preventDefault();
                    open(n);
                  }}
                />
              ) : (
                <button type="button" {...common} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="sky-hint t-micro">{hint}</p>
    </div>
  );
}

/**
 * Focus arriving from the page (Tab in, Shift+Tab back): the pinned frame comes into view whole, so
 * the stage can place the star on screen. A native focus scroll reveals only the button's box, before
 * the pin has stuck: the star landed below the fold, its tooltip under the HUD (Part 14).
 */
function holdPin(): void {
  const pin = scrollGeometry().pins.find((p) => p.id === "archive");
  if (!pin) return;
  const y = window.scrollY;
  if (y < pin.start) teleport(pin.start);
  else if (y > pin.start + pin.length) teleport(pin.start + pin.length);
}
