"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { whenIdle } from "@/lib/idle";

// back to top's glide and the power-off on the last pixel: on idle, never in first-load JS (§8.3)
const HaltBehavior = lazy(() => import("./HaltBehavior"));

export function HaltEnhance({ halted }: { halted: string }) {
  const [load, setLoad] = useState(false);
  useEffect(() => whenIdle(() => setLoad(true)), []);
  return load ? (
    <Suspense fallback={null}>
      <HaltBehavior halted={halted} />
    </Suspense>
  ) : null;
}
