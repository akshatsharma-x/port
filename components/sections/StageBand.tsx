"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";
import { useStage } from "@/components/stage/useStage";
import { liveAllowed } from "@/lib/tier";
import type { LayerLabels, LayerSlide } from "./work/CarouselLayer";
import type { KeyLayerProps } from "./capabilities/KeyLayer";

// each section's HTML layer comes with its scene, never in first-load JS (§8.3)
const CarouselLayer = lazy(() => import("./work/CarouselLayer"));
const KeyLayer = lazy(() => import("./capabilities/KeyLayer"));

type Layer = { id: "work"; props: { slides: LayerSlide[]; labels: LayerLabels } } | { id: "capabilities"; props: KeyLayerProps };

/**
 * A Tier-A band with an HTML layer (DESIGN.md §7.4 WORK, CAPABILITIES): the stage slot, the
 * stage-less edition and the layer in one box. A tier that can't run the scene marks the band, so
 * CSS shows the stage-less edition in the slot's place — the same box, no shift. The layer loads
 * once the scene starts warming, and stays.
 */
export function StageBand({ layer, className, children }: { layer: Layer; className: string; children: ReactNode }) {
  const off = useStage((s) => s.tierFinal && !liveAllowed(s.tier, layer.id));
  const near = useStage((s) => s.scenes[layer.id].state !== "COLD");
  const [load, setLoad] = useState(false);
  if (near && !load) setLoad(true);
  return (
    <div className={className} data-stage={off ? "off" : undefined}>
      {children}
      {load && !off && <Suspense fallback={null}>{layer.id === "work" ? <CarouselLayer {...layer.props} /> : <KeyLayer {...layer.props} />}</Suspense>}
    </div>
  );
}
