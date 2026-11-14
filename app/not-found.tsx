import { NoSignal } from "@/components/no-signal/NoSignal";
import { derived } from "@/content/derive";

/** 404 — NO SIGNAL (DESIGN.md §7.4), for a missing record and for any URL that matches nothing. */
export default function NotFound() {
  return <NoSignal labels={derived.site.labels.noSignal} code={404} kind="notFound" />;
}
