import type { CSSProperties, ReactNode } from "react";
import { noSignal as drift } from "@/lib/motion";
import css from "./no-signal.module.css";

export interface NoSignalLabels {
  title: string;
  notFound: string;
  error: string;
  hint: string;
  home: string;
  terminal: string;
  retry: string;
}

/**
 * 404 / 500 — NO SIGNAL (DESIGN.md §7.4): POWER ON into an empty tube (the boot's POWER ON-fast, as
 * on any page but the first visit to /), with an on-screen box drifting like an idle set's and the
 * hint `goto system` — a link home, and the terminal's command (~ works here too). Server HTML: it
 * drifts without JavaScript, and stands still under reduced motion. The code is said only when it's
 * known (a client-side error is no HTTP status).
 */
export function NoSignal({ labels, code, kind, action }: { labels: NoSignalLabels; code: number | null; kind: "notFound" | "error"; action?: ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className={css.tube} style={{ "--drift-x": `${drift.driftXMs}ms`, "--drift-y": `${drift.driftYMs}ms` } as CSSProperties}>
      <div className={css.field}>
        <div className={css.x}>
          <div className={css.y}>
            <section className={css.osd} aria-labelledby="no-signal-title">
              <h1 id="no-signal-title" className={css.title}>
                {labels.title}
              </h1>
              <p className={css.line}>
                {code !== null && <span className={css.code}>{code}</span>}
                {kind === "notFound" ? labels.notFound : labels.error}
              </p>
              <p className={css.hint}>
                {/* a plain link: from the 404 the layout's navigation takes it (a route change, as any link home);
                    from global-error, where the layout is gone, it's a full load — the system started again */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className={css.link}>
                  {labels.hint}
                </a>
              </p>
              <p className={css.note}>{`${labels.home} — ${labels.terminal}`}</p>
              {action}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
