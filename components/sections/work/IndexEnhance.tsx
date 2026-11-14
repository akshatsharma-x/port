"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { whenIdle } from "@/lib/idle";
import type { CoverImg } from "./Work";

// the filters' behavior, the rows' FLIP and the cover preview: on idle, never in first-load JS
const IndexFilters = lazy(() => import("./IndexFilters"));

/** Loads the INDEX's behavior once the page is idle; the table and its chips are already HTML. */
export function IndexEnhance(props: { covers: Record<string, CoverImg>; labels: { of: string; shown: string }; total: number }) {
  const [load, setLoad] = useState(false);
  useEffect(() => whenIdle(() => setLoad(true)), []);
  return load ? (
    <Suspense fallback={null}>
      <IndexFilters {...props} />
    </Suspense>
  ) : null;
}
