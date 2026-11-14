"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";

/**
 * A dossier's abstract (DESIGN.md §7.4): a per-line reveal (RAIL REVEAL, never a scramble),
 * collapsed after four lines; the toggle appears only when there's more to read.
 */
export function Abstract({ text, more, less }: { text: string; more: string; less: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const p = ref.current?.querySelector("p");
    if (p) setLong(p.scrollHeight > p.clientHeight + 2);
  }, []);
  return (
    <div ref={ref} className="dossier__abstract-body" data-open={open || undefined}>
      <Reveal as="p" mode="lines" className="dossier__abstract-text t-body">
        {text}
      </Reveal>
      {long && (
        <button type="button" className="dossier__more t-micro" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? less : more}
        </button>
      )}
    </div>
  );
}
