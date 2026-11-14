"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { whenIdle } from "@/lib/idle";

// the panel's behaviour (a pressed key lights its row; the CSS grid's keys clack): on idle
const PanelBehavior = lazy(() => import("./PanelBehavior"));

/** Loads the panel's behaviour once the page is idle; the panel itself is already HTML. */
export function PanelEnhance({ slugs }: { slugs: string[] }) {
  const [load, setLoad] = useState(false);
  useEffect(() => whenIdle(() => setLoad(true)), []);
  return load ? (
    <Suspense fallback={null}>
      <PanelBehavior slugs={slugs} />
    </Suspense>
  ) : null;
}
