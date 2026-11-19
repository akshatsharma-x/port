"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { feedback } from "@/lib/motion";
import { CheckGlyph } from "./CheckGlyph";

/** COPY BIBTEX, and a mono "COPIED ✓" that says so (the ✓ drawn: the mono font has none, §2.10). */
export function CopyBibtex({ bibtex, label, copied }: { bibtex: string; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), feedback.copiedMs);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <span className="copy-bibtex">
      <Button
        variant="secondary"
        icon={null}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(bibtex);
            setDone(true);
            track("bibtex_copy", { from: "dossier" });
          } catch {
            /* no clipboard (an insecure context or a denied permission): no toast, nothing copied */
          }
        }}
      >
        {label}
      </Button>
      <span className="copy-bibtex__toast t-micro" role="status">
        {done && (
          <>
            {copied} <CheckGlyph />
          </>
        )}
      </span>
    </span>
  );
}
