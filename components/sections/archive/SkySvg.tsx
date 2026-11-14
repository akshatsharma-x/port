import type { CSSProperties } from "react";
import { derived } from "@/content/derive";
import { stageData } from "@/content/stage-data";
import { ARCHIVE } from "@/lib/archive";
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
export function SkySvg({ label, topics, className }: { label: string; topics: readonly string[]; className?: string }) {
  const graph = stageData(derived).graph;
  const { wide, tall } = ARCHIVE.drawing;
  return (
    <PlotOnView className={cx("sky-svg", className)}>
      <Drawing sky={drawSky(graph, wide.width, wide.height)} label={label} topics={topics} className="sky-svg__figure--wide" />
      <Drawing sky={drawSky(graph, tall.width, tall.height)} label={label} topics={topics} className="sky-svg__figure--tall" />
    </PlotOnView>
  );
}

function Drawing({ sky, label, topics, className }: { sky: SkyDrawing; label: string; topics: readonly string[]; className: string }) {
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
    </div>
  );
}
