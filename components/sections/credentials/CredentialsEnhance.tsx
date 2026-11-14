"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { whenIdle } from "@/lib/idle";
import type { BehaviorLabels } from "./CredentialsBehavior";

// the wall's and the records' behaviour: on idle, never in first-load JS (§8.3)
const CredentialsBehavior = lazy(() => import("./CredentialsBehavior"));

/** Loads CREDENTIALS' behaviour once the page is idle; the wall and the records are already HTML. */
export function CredentialsEnhance({ labels }: { labels: BehaviorLabels }) {
  const [load, setLoad] = useState(false);
  useEffect(() => whenIdle(() => setLoad(true)), []);
  return load ? (
    <Suspense fallback={null}>
      <CredentialsBehavior labels={labels} />
    </Suspense>
  ) : null;
}
