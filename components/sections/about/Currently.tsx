"use client";

import { useEffect, useRef, useState } from "react";
import { Typewriter } from "@/components/ui/Typewriter";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { identity } from "@/lib/motion";

export interface CurrentlyItem {
  kind: string;
  /** BUILDING / READING / RESEARCHING */
  label: string;
  title: string;
  detail?: string;
}

/**
 * CURRENTLY (DESIGN.md §7.4 IDENTITY): one line that types its next item every 6 s, held while the
 * block is hovered or focused, and only while it's on screen. All three items are always in the
 * DOM as a list for screen readers (the typed line is aria-hidden). The three lines share one grid
 * cell, so the box is always the tallest of them: a swap never moves the page. Reduced motion:
 * the list itself, static.
 */
export function Currently({ label, items }: { label: string; items: readonly CurrentlyItem[] }) {
  const [active, setActive] = useState(0);
  const held = useRef(false);
  const visible = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced || items.length < 2) return;
    const io = new IntersectionObserver((entries) => {
      visible.current = entries.some((e) => e.isIntersecting);
    });
    io.observe(root);
    const id = window.setInterval(() => {
      if (!held.current && visible.current) setActive((i) => (i + 1) % items.length);
    }, identity.currentlySwapMs);
    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [items.length, reduced]);

  const hold = () => {
    held.current = true;
  };
  const release = () => {
    held.current = false;
  };
  const now = items[active];
  return (
    <div
      ref={rootRef}
      className="currently"
      role="group"
      aria-label={label}
      tabIndex={0}
      onPointerEnter={hold}
      onPointerLeave={release}
      onFocus={hold}
      onBlur={release}
    >
      <p className="currently__label t-micro">{label}</p>
      <ul className="currently__list">
        {items.map((it) => (
          <li key={it.kind} className="currently__item t-small">
            <span className="currently__kind">{it.label}</span> {it.title}
            {it.detail ? <span className="currently__detail"> — {it.detail}</span> : null}
          </li>
        ))}
      </ul>
      <div className="currently__lines" aria-hidden="true">
        {items.map((it) => (
          <p key={it.kind} className="currently__line currently__line--reserve t-small">
            <span className="currently__kind">{it.label}</span> {it.title}
          </p>
        ))}
        {now ? (
          <p key={now.kind} className="currently__line t-small">
            <span className="currently__kind">{now.label}</span> <Typewriter text={now.title} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
