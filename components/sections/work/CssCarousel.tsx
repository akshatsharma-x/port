import Link from "next/link";
import { ViewTransition } from "react";
import type { SlideItem } from "./Work";

/**
 * A4's stage-less edition (DESIGN.md §4.3 A4 "cost to cut", §4.4 B5): a CSS curved carousel — a
 * scroll-snap row of the same slides, each turned on its way past by a scroll-driven rotateY, so
 * the row bends like the stage's arc — for tier OFF, reduced motion (flat: no scroll-linked turn)
 * and no JS (plain links). Opening one is a DOM FLIP: its cover and the case study's hero share a
 * view-transition name, so the picture travels into the page (reduced motion: no travel).
 */
export function CssCarousel({ slides, label }: { slides: SlideItem[]; label: string }) {
  return (
    <div className="work-css">
      <ol className="work-css__rail" aria-label={label}>
        {slides.map((s) => (
          <li key={s.slug} className="work-css__slide">
            <Link href={s.href} className="work-css__link" data-transition="continuity" transitionTypes={["projection"]}>
              <span className="work-css__print t-micro">
                <span>{s.number}</span>
                <span>{s.category}</span>
              </span>
              <span className="work-css__window">
                <ViewTransition name={`cover-${s.slug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- next/image's props, no component */}
                  <img className="work-css__img" src={s.cover.src} srcSet={s.cover.srcSet} sizes={s.cover.sizes} width={s.cover.width} height={s.cover.height} alt={s.cover.alt} loading="lazy" decoding="async" />
                </ViewTransition>
              </span>
              <span className="work-css__print t-micro">
                <span className="work-css__title">{s.title}</span>
                {s.year !== null && <span>{String(s.year)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
