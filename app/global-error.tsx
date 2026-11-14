"use client";

import { useEffect } from "react";
import { NoSignal } from "@/components/no-signal/NoSignal";
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
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const server = typeof error === "object" && error !== null && "digest" in error && typeof (error as { digest?: unknown }).digest === "string";
  return (
    <html lang="en" data-theme="phosphor" className={`${hubotSans.variable} ${monaSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <NoSignal
          labels={noSignal}
          code={server ? 500 : null}
          kind="error"
          action={
            <button type="button" className="btn bracket btn--secondary" onClick={() => retry()}>
              <span className="btn__label">
                <span>{noSignal.retry}</span>
              </span>
            </button>
          }
        />
      </body>
    </html>
  );
}
