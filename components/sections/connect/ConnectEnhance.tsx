"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { whenIdle } from "@/lib/idle";
import type { ConnectLabels } from "./ConnectBehavior";

// the form (react-hook-form, its resolver, the send and the log), COPY and the live availability:
// on the form's first focus or on idle, whichever comes first — never in first-load JS (§8.3)
const ConnectBehavior = lazy(() => import("./ConnectBehavior"));

export function ConnectEnhance({ labels, owner }: { labels: ConnectLabels; owner: { email: string } }) {
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("form[data-connect-form]");
    const go = () => setLoad(true);
    // the time-to-submit floor counts from the first touch of the form (lib/contact.ts minFillMs)
    const touched = () => {
      if (form && !form.dataset.startedAt) form.dataset.startedAt = String(Date.now());
      go();
    };
    form?.addEventListener("focusin", touched, { once: true });
    const cancel = whenIdle(go);
    return () => {
      form?.removeEventListener("focusin", touched);
      cancel();
    };
  }, []);
  return load ? (
    <Suspense fallback={null}>
      <ConnectBehavior labels={labels} owner={owner} />
    </Suspense>
  ) : null;
}
