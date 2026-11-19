import type { CSSProperties } from "react";
import { derived } from "@/content/derive";
import { stageData } from "@/content/stage-data";
import { ARCHIVE } from "@/lib/archive";
import { tagSide } from "@/lib/sky-tags";
import { drawSky, type SkyDrawing } from "@/lib/archive-svg";
import { cx } from "@/lib/cx";
import { PlotOnView } from "./PlotOnView";

/**
 * The constellation without a stage (DESIGN.md §7.4): the phone and reduced-motion editions'
 * header, drawn at build from the baked graph (lib/archive-svg.ts, which the slot's poster is drawn
 * from too). Two drawings, each shown about 1:1 so the glyphs keep their sizes: wide from 48rem,
 * tall below it. The TOPIC clusters are labelled in HTML over the drawing, as the stage's are. Its
 * edges plot in like the pen plotter when it comes into view, nearest first, inside 900 ms
 * (law 7); under reduced motion they're simply there.
 */
/** A record's words for its tag in a sparse sky (ARCHIVE.sparse): the stage layer's, as the HTML layer has them. */
export interface SkyTag {
  i: number;
  title: string;
  meta: string;
}

export function SkySvg({ label, topics, tags = [], className }: { label: string; topics: readonly string[]; tags?: readonly SkyTag[]; className?: string }) {
  const graph = stageData(derived).graph;
  const { wide, tall } = ARCHIVE.drawing;
  const byNode = new Map(tags.map((t) => [t.i, t]));
  return (
    <PlotOnView className={cx("sky-svg", className)}>
      <Drawing sky={drawSky(graph, wide.width, wide.height)} label={label} topics={topics} tags={byNode} className="sky-svg__figure--wide" />
      <Drawing sky={drawSky(graph, tall.width, tall.height)} label={label} topics={topics} tags={byNode} className="sky-svg__figure--tall" />
    </PlotOnView>
  );
}

/** A tag's and a label's size in the drawing's px, estimated: a tag is ≤ 30ch over three lines, a label its micro-mono characters. */
const TAG_EST = { w: 240, h: 60 };
const TAG_GAP_EST = 12;
const MICRO_CHAR_PX = 8;
function labelBoxes(sky: SkyDrawing, topics: readonly string[]) {
  return sky.labels.map((l) => {
    const w = (topics[l.k]?.length ?? 0) * MICRO_CHAR_PX + 12;
    const x = l.x * sky.width;
    const y = l.y * sky.height;
    // .sky-svg__label: anchored at its share of its width, lifted its height and 8 px over the point
    return { x0: x - l.x * w, y0: y - 16 - 8, x1: x - l.x * w + w, y1: y - 8 };
  });
}

function Drawing({ sky, label, topics, tags, className }: { sky: SkyDrawing; label: string; topics: readonly string[]; tags: ReadonlyMap<number, SkyTag>; className: string }) {
  return (
    <div className={cx("sky-svg__figure", className)} style={{ "--w": `${sky.width}px`, "--ar": (sky.width / sky.height).toFixed(4) } as CSSProperties}>
      <svg viewBox={`0 0 ${sky.width} ${sky.height}`} className="sky-svg__drawing" role="img" aria-label={label}>
        <g className="sky-svg__edges">
          {sky.edges.map((e, k) => (
            <path key={k} d={e.d} pathLength={1} className={cx("sky-svg__edge", e.cited && "sky-svg__edge--cited")} style={{ "--d": `${e.delay}ms` } as CSSProperties} />
          ))}
        </g>
        <g className="sky-svg__nodes">
          {sky.nodes.map((n, k) => (
            <path key={k} d={n.d} className={cx("sky-svg__node", n.kind === 1 && "sky-svg__node--cited", n.dashed && "sky-svg__node--dashed")} />
          ))}
        </g>
      </svg>
      {sky.labels.map((l) => (
        <span key={l.k} className="sky-svg__label t-micro" aria-hidden="true" style={{ "--x": l.x.toFixed(4), "--y": l.y.toFixed(4) } as CSSProperties}>
          {topics[l.k]}
        </span>
      ))}
      {sky.records.map((r) => {
        const t = tags.get(r.i);
        if (!t) return null;
        // the overlay's rule (lib/archive.ts tagSide), on estimated sizes: the drawing is shown about 1:1
        const { side, dx } = tagSide({ x: r.x * sky.width, y: r.y * sky.height, r: r.r }, TAG_EST, labelBoxes(sky, topics), { w: sky.width, h: sky.height }, TAG_GAP_EST);
        return (
          <span key={`tag-${r.i}`} className="sky-tag sky-tag--svg" aria-hidden="true" data-side={side} style={{ "--x": r.x.toFixed(4), "--y": r.y.toFixed(4), "--r": `${r.r.toFixed(1)}px`, "--dx": `${dx.toFixed(1)}px` } as CSSProperties}>
            <span className="sky-tag__title">{t.title}</span>
            <span className="sky-tag__meta t-micro">{t.meta}</span>
          </span>
        );
      })}
    </div>
  );
}
