"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { useArchive } from "@/lib/archive";

/**
 * A dossier's keywords (DESIGN.md §7.4): each chip lights the records that carry it in the sky —
 * the rest recede — and goes back to the sky to show them (closing the dialog over home, or from
 * the full page, home to the archive).
 */
export function KeywordChips({ keywords, hint, mode }: { keywords: readonly { word: string; matches: number[] }[]; hint: string; mode: "dialog" | "page" }) {
  const router = useRouter();
  const id = useId();
  const active = useArchive((s) => s.keyword?.word ?? null);
  const setKeyword = useArchive((s) => s.setKeyword);
  return (
    <>
      <p id={id} className="sr-only">
        {hint}
      </p>
      <ul className="dossier__keywords">
        {keywords.map((k) => (
          <li key={k.word}>
            <ChipToggle
              pressed={active === k.word}
              aria-describedby={id}
              onPressedChange={(on) => {
                setKeyword(on ? { word: k.word, matches: k.matches } : null);
                if (!on) return;
                if (mode === "dialog") router.back();
                else router.push("/#archive");
              }}
            >
              {k.word}
            </ChipToggle>
          </li>
        ))}
      </ul>
    </>
  );
}
