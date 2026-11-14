"use client";

import { lazy, Suspense, useEffect, type ReactNode } from "react";
import type { NoSignalLabels } from "@/components/no-signal/NoSignal";
import { noSignal } from "@/content/no-signal";
import { hubotSans, jetbrainsMono, monaSans } from "./typefaces";
import "./globals.css";

/**
 * NO SIGNAL for anything that throws (DESIGN.md §7.4) — a page or the root layout itself. There is no
 * segment error.tsx: it cost 4.4 KB gz of first-load JS, measured (itself, NoSignal and a second copy
 * of Button with its hooks), so every error lands here, the 500 said only for a server error (it
 * carries a digest). This replaces the root layout, so it brings its own <html>, faces and styles —
 * and the few words it needs, from content/no-signal.ts (nothing else can reach it). Phosphor, the
 * default tube; the motion edition from the preference (the module's media query). retry()
 * re-renders from the root (Next 16).
 *
 * The screen itself comes when it's needed: imported here, its CSS module was a second render-
 * blocking stylesheet on every page (1.3 KB gz, +35–49 ms of LCP on Slow 4G, Part 14). Until it
 * lands — or if it can't, the network being what broke — the words alone, and the retry.
 */
const Screen = lazy(() =>
  import("@/components/no-signal/NoSignal").then(
    (m) => ({ default: m.NoSignal }),
    () => ({ default: Bare }),
  ),
);

function Bare({ labels, code, action }: { labels: NoSignalLabels; code: number | null; kind: "notFound" | "error"; action?: ReactNode }) {
  return (
    <main id="main" tabIndex={-1}>
      <h1>{labels.title}</h1>
      <p>{code === null ? labels.error : `${code} ${labels.error}`}</p>
      {action}
    </main>
  );
}

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const server = typeof error === "object" && error !== null && "digest" in error && typeof (error as { digest?: unknown }).digest === "string";
  const props = {
    labels: noSignal,
    code: server ? 500 : null,
    kind: "error" as const,
    action: (
      <button type="button" className="btn bracket btn--secondary" onClick={() => retry()}>
        <span className="btn__label">
          <span>{noSignal.retry}</span>
        </span>
      </button>
    ),
  };
  return (
    <html lang="en" data-theme="phosphor" className={`${hubotSans.variable} ${monaSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Suspense fallback={<Bare {...props} />}>
          <Screen {...props} />
        </Suspense>
      </body>
    </html>
  );
}
