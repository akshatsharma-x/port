"use client";

import { useArchive } from "@/lib/archive";

/**
 * The query bar's first term (DESIGN.md §7.4): QUERY ALL, or, once a dossier's keyword chip has
 * narrowed the sky, the keyword, how many of my records carry it, and CLEAR, which lights the whole
 * sky again. The bar never says ALL while a keyword holds. Clearing hands focus to the bar itself,
 * so the keyboard isn't dropped on the page when the button goes.
 */
export function QueryScope({ all, scope, match, matches, clear }: { all: string; scope: string; match: string; matches: string; clear: string }) {
  const keyword = useArchive((s) => s.keyword);
  const setKeyword = useArchive((s) => s.setKeyword);
  const n = keyword?.matches.length ?? 0;
  return (
    <>
      <span aria-live="polite">{keyword ? `${scope} “${keyword.word}” · ${new Intl.NumberFormat("en-US").format(n)} ${n === 1 ? match : matches}` : all}</span>
      {keyword && (
        <button
          type="button"
          className="archive-query__clear t-micro"
          onClick={(e) => {
            const bar = e.currentTarget.closest<HTMLElement>(".archive-query");
            setKeyword(null);
            bar?.focus({ preventScroll: true });
          }}
        >
          {`${clear} ×`}
        </button>
      )}
    </>
  );
}
