"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useArchive } from "@/lib/archive";
import { getLenis } from "@/lib/lenis";
import { setOverlay } from "@/lib/navigation";

/**
 * A record's dossier over home (DESIGN.md §7.4): the intercepted /research/[slug] in a native
 * <dialog>, held by the intercepted segment's layout so it stays open while prev / next step
 * through the records (their SLIDE ADVANCE is a view transition in the page: DossierPush).
 *
 * The open record is HOT in the sky behind (lib/archive.ts's store), and the camera dollies to it.
 * Esc, the close button or a click on the backdrop go back (the URL closes it, as it opened it);
 * focus returns to whatever opened it. While it's open the page behind holds still: native scroll
 * is locked on html, and Lenis, which drives the wheel, is paused.
 */
export function DossierDialog({ graph, close, children }: { graph: Record<string, number>; close: string; children: ReactNode }) {
  const router = useRouter();
  const slug = useSelectedLayoutSegment() ?? "";
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dlg.open) dlg.showModal();
    setOverlay(true);
    const lenis = getLenis();
    lenis?.stop();
    // the page behind holds still; a write to html, but the visitor asked for it (and only once).
    // Not `html:has(dialog[open])` in CSS: :has() on html restyles it on every insertion anywhere.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = overflow;
      setOverlay(false);
      lenis?.start();
      useArchive.getState().setHot(null);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    useArchive.getState().setHot(graph[slug] ?? null);
  }, [slug, graph]);

  return (
    <dialog
      ref={ref}
      className="dossier-dialog"
      aria-labelledby={`dossier-title-${slug}`}
      data-lenis-prevent
      onCancel={(e) => {
        e.preventDefault();
        router.back();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div className="dossier-dialog__sheet">
        <button type="button" className="dossier-dialog__close t-micro" onClick={() => router.back()}>
          {close} <span aria-hidden="true">✕</span>
        </button>
        {children}
      </div>
    </dialog>
  );
}
