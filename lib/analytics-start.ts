import { track, type AnalyticsEvent } from "@/lib/analytics";
import { whenIdle } from "@/lib/idle";
import { onCommit } from "@/lib/navigation";

/**
 * The rest of the analytics (lib/analytics.ts has track()), imported after idle by
 * components/scroll/ScrollProvider: a record opened — a case study, a dossier, by any route — the
 * clicks a server-rendered element declares (data-track, with data-track-id), and the two Vercel
 * scripts, on a Vercel deployment only (anywhere else they're 404s).
 */
const ROUTES: readonly [RegExp, AnalyticsEvent][] = [
  [/^\/work\/([a-z0-9-]+)$/, "project_open"],
  [/^\/research\/([a-z0-9-]+)$/, "dossier_open"],
];
const routeEvent = (path: string) => {
  for (const [re, name] of ROUTES) {
    const m = re.exec(path);
    if (m?.[1]) track(name, { slug: m[1] });
  }
};

/** Starts it, once; returns its own stop. */
export function startAnalytics(env = process.env.NEXT_PUBLIC_VERCEL_ENV): () => void {
  routeEvent(location.pathname);
  const offCommit = onCommit(routeEvent);
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
    if (el?.dataset.track) track(el.dataset.track as AnalyticsEvent, el.dataset.trackId ? { id: el.dataset.trackId } : undefined);
  };
  document.addEventListener("click", onClick, { capture: true });
  const cancelIdle = env
    ? whenIdle(() => {
        void import("@vercel/analytics").then((m) => m.inject({ mode: "production", framework: "next" })).catch(() => undefined);
        void import("@vercel/speed-insights").then((m) => m.injectSpeedInsights({ framework: "next" })).catch(() => undefined);
      })
    : () => undefined;
  return () => {
    offCommit();
    document.removeEventListener("click", onClick, { capture: true });
    cancelIdle();
  };
}
