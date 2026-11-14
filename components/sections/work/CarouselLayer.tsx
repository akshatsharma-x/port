"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useStage } from "@/components/stage/useStage";
import { navigate } from "@/lib/navigation";
import { projector } from "@/lib/projection";
import { onTick } from "@/lib/ticker";
import { useWork, WORK, workInput, workView } from "@/lib/work";

export interface LayerSlide {
  slug: string;
  href: string;
  number: string;
  title: string;
  category: string;
  year: number | null;
}

export interface LayerLabels {
  label: string;
  stage: string;
  keys: string;
  gate: string;
  pending: string;
}

/**
 * The carousel's HTML layer (DESIGN.md §7.4 WORK; the stage is aria-hidden and only augmentative):
 * every slide a real link over its window, placed by the stage's projection (lib/work.ts workView)
 * and moved by transform; one tab stop — the slide in the gate — with ← → Home End to move the rail
 * and Enter to open it; the gate announced as it changes. It owns the pointer (a drag with
 * inertia; a click brings a slide to the gate, and on the gate opens it), touch (sideways — a
 * vertical swipe scrolls the page) and the wheel: sideways or with Shift moves the rail, a vertical
 * wheel is always the page's. Opening is a PROJECTION when the stage can project it, else a tear.
 */
export default function CarouselLayer({ slides, labels }: { slides: LayerSlide[]; labels: LayerLabels }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const gate = useWork((s) => s.gate);
  const live = useStage((s) => s.scenes.work.state === "LIVE" && s.scenes.work.drawable);
  const [focusWithin, setFocusWithin] = useState(false);
  const press = useRef<{ id: number; moved: boolean; x: number } | null>(null);

  // the links follow the slides' windows (transform only; a size only when it changes)
  useEffect(() => {
    let version = -1;
    const sizes = slides.map(() => ({ w: -1, h: -1 }));
    return onTick(() => {
      if (workView.version === version) return;
      version = workView.version;
      const r = workView.rects;
      slides.forEach((_, i) => {
        const a = links.current[i];
        if (!a) return;
        const [x = 0, y = 0, w = 0, h = 0] = r.subarray(i * 4, i * 4 + 4);
        a.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        const size = sizes[i] as { w: number; h: number };
        if (Math.abs(size.w - w) > 0.5 || Math.abs(size.h - h) > 0.5) {
          size.w = w;
          size.h = h;
          a.style.width = `${w.toFixed(1)}px`;
          a.style.height = `${h.toFixed(1)}px`;
        }
        a.style.visibility = w > 1 ? "" : "hidden";
      });
    });
  }, [slides]);

  // the gate's case study is the likely next page
  useEffect(() => {
    const s = slides[gate];
    if (s) router.prefetch(s.href);
  }, [gate, slides, router]);

  // the keyboard follows the gate: focus moves with the rail it moved
  useEffect(() => {
    if (focusWithin) links.current[gate]?.focus({ preventScroll: true });
  }, [gate, focusWithin]);

  // the wheel: sideways (or with Shift) is the rail's and is kept from the page; vertical never is
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!workInput.sink?.wheel(e.deltaX, e.deltaY, e.shiftKey, performance.now())) return;
      // the rail's: not the page's — and not Lenis's, which reads deltaY and ignores a prevented event
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const open = async (i: number) => {
    const s = slides[i];
    if (!s) return;
    const p = projector();
    if (p && (await p.forward(s.slug, s.href))) return;
    void navigate(s.href);
  };

  const g = slides[gate];
  const gateText = g ? `${labels.gate}: ${[g.number, g.title, g.category].join(" · ")}` : "";

  return (
    <div
      ref={rootRef}
      className="work-layer"
      data-live={live || undefined}
      data-cursor="drag"
      role="group"
      aria-roledescription="carousel"
      aria-label={labels.label}
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !workInput.sink) return;
        press.current = { id: e.pointerId, moved: false, x: e.clientX };
        workInput.sink.down(e.clientX, performance.now());
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        // captured only once it's a drag: a captured press sends its click to the layer, not the link
        if (!p.moved && Math.abs(e.clientX - p.x) > WORK.input.clickSlopPx) {
          p.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        workInput.sink?.move(e.clientX, performance.now());
      }}
      onPointerUp={(e) => {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        press.current = null;
        const click = workInput.sink?.up(performance.now()) ?? false;
        if (!click) p.moved = true;
        // a click lands as the link's own click event; a drag must not open anything
        if (p.moved) {
          const swallow = (ev: Event) => {
            ev.preventDefault();
            ev.stopPropagation();
          };
          window.addEventListener("click", swallow, { capture: true, once: true });
          window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
        }
      }}
      onPointerCancel={() => {
        press.current = null;
        workInput.sink?.up(performance.now());
      }}
      onKeyDown={(e) => {
        const sink = workInput.sink;
        if (!sink) return;
        const moves: Record<string, () => void> = {
          ArrowLeft: () => sink.step(-1),
          ArrowRight: () => sink.step(1),
          Home: () => sink.to(0),
          End: () => sink.to(slides.length - 1),
        };
        const move = moves[e.key];
        if (!move) return;
        e.preventDefault();
        move();
      }}
    >
      <ol className="work-layer__slides">
        {slides.map((s, i) => (
          <li key={s.slug}>
            <a
              ref={(el) => {
                links.current[i] = el;
              }}
              href={s.href}
              className="work-layer__slide"
              data-transition="continuity"
              data-cursor={i === gate ? "open" : "view"}
              tabIndex={i === gate ? 0 : -1}
              aria-current={i === gate ? "true" : undefined}
              draggable={false}
              style={{ "--i": i } as CSSProperties}
              onFocus={(e) => {
                // the keyboard's focus brings its slide to the gate (a press's focus is the drag's)
                if (e.currentTarget.matches(":focus-visible") && i !== useWork.getState().gate) useWork.getState().bring(i);
              }}
              onClick={(e) => {
                e.preventDefault();
                if (i === useWork.getState().gate) void open(i);
                else workInput.sink?.to(i);
              }}
            >
              <span className="sr-only">{[s.number, s.title, s.category, s.year === null ? null : String(s.year)].filter(Boolean).join(" · ")}</span>
            </a>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {gateText}
      </p>
      <p className="sr-only">{labels.keys}</p>
    </div>
  );
}
