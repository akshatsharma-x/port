import type { Metadata } from "next";
import { NoSignal } from "@/components/no-signal/NoSignal";
import { derived } from "@/content/derive";

// a dead channel is never a search result
export const metadata: Metadata = { title: derived.site.labels.noSignal.title, robots: { index: false, follow: true } };

/** 404 — NO SIGNAL (DESIGN.md §7.4), for a missing record and for any URL that matches nothing. */
export default function NotFound() {
  return <NoSignal labels={derived.site.labels.noSignal} code={404} kind="notFound" />;
}
