"use client";

import { useStore } from "zustand";
import { scrollStore } from "@/lib/scroll";
import { sectionLabel, type ChromeSection } from "./types";

/**
 * The section rail (DESIGN.md §7.3), right edge: one node per page section, labeled on hover and
 * focus. Current = filled --accent, visited = filled --line-2, unvisited = hollow. A node is a
 * plain #hash link, so the navigation rules (lib/navigation.ts) make each click a TRACKING TEAR
 * with a history entry the router owns. Only sections tracked on this page appear.
 */
export function SectionRail({ label, sections }: { label: string; sections: readonly ChromeSection[] }) {
  const current = useStore(scrollStore, (s) => s.section);
  const visited = useStore(scrollStore, (s) => s.visited);
  const tracked = useStore(scrollStore, (s) => s.tracked);
  const nodes = sections.filter((s) => tracked.includes(s.id));
  if (nodes.length === 0) return null;
  return (
    <nav className="section-rail" aria-label={label}>
      <ol className="section-rail__list">
        {nodes.map((s) => {
          const state = s.id === current ? "current" : visited.includes(s.id) ? "visited" : "unvisited";
          return (
            <li key={s.id}>
              <a href={`#${s.id}`} className="section-rail__link" data-state={state} aria-current={state === "current" ? "location" : undefined}>
                <span className="section-rail__label t-micro">
                  <span aria-hidden="true">{`${sectionLabel(s)} · `}</span>
                  {s.title}
                </span>
                <span className="section-rail__node" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
