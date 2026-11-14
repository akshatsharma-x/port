"use client";

import { lazy, Suspense, useState } from "react";
import { useStage } from "@/components/stage/useStage";
import type { LayoutName } from "@/content/schema";
import { liveAllowed } from "@/lib/tier";
import type { SkyLabel, SkyNode } from "./SkyOverlay";

// the constellation's HTML layer comes with its scene, never in first-load JS (§8.3) — as WORK's and
// CAPABILITIES' do (components/sections/StageBand.tsx). It was the exception until Part 14: 1.9 KB
const SkyOverlay = lazy(() => import("./SkyOverlay").then((m) => ({ default: m.SkyOverlay })));

/**
 * Loads A3's HTML layer once the scene starts warming, and keeps it. Where the stage can't run A3
 * (LOW and OFF on a desktop, a lost context) there's no layer — its stars can't be placed, so a tab
 * stop there sat 100,000 px off screen (Part 14) — and the ledger after it carries every record.
 */
export function SkyLayer(props: { nodes: readonly SkyNode[]; labels: Record<LayoutName, readonly SkyLabel[]>; listLabel: string; hint: string }) {
  const off = useStage((s) => s.contextLost || (s.tierFinal && !liveAllowed(s.tier, "archive")));
  const near = useStage((s) => s.scenes.archive.state !== "COLD");
  const [load, setLoad] = useState(false);
  if (near && !load) setLoad(true);
  return load && !off ? (
    <Suspense fallback={null}>
      <SkyOverlay {...props} />
    </Suspense>
  ) : null;
}
