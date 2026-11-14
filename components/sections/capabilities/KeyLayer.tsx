"use client";

import { useEffect, useRef, useState } from "react";
import { useStage } from "@/components/stage/useStage";
import { KEYS, keysInput, keysView, matchTyped, useKeys } from "@/lib/capabilities";
import { onTick } from "@/lib/ticker";
import { TIERS } from "@/lib/tier";

export interface KeyLayerProps {
  keys: { slug: string; name: string; terms: string[]; years: string; level: string }[];
  categories: string[];
  labels: { keys: string; cluster: string; all: string };
}

/**
 * The keycap pile's HTML layer (DESIGN.md §7.4 CAPABILITIES; the stage is aria-hidden, the panel
 * canonical): one focus target — while it has focus, typing a skill's name presses its key
 * (lib/capabilities.ts matchTyped) and the page's single-key shortcuts stand aside (data-keys:
 * lib/keys.ts); Esc leaves — the pointer (a click presses a key; on HIGH a drag grabs and throws
 * it), the one tooltip (name · years · level) over the hovered key, and the category chips that
 * gather the pile.
 */
export default function KeyLayer({ keys, categories, labels }: KeyLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLParagraphElement>(null);
  const cluster = useKeys((s) => s.cluster);
  const hovered = useKeys((s) => s.hovered);
  const throws = useStage((s) => !!s.tier && TIERS[s.tier].keycaps === "micro-physics");
  const typed = useRef({ run: "", at: 0, last: -1 });
  const rect = useRef<DOMRect | null>(null);
  const [focus, setFocus] = useState(false);

  // the tooltip follows the hovered key (transform only)
  useEffect(() => {
    let version = -1;
    return onTick(() => {
      const tip = tipRef.current;
      if (!tip || keysView.version === version) return;
      version = keysView.version;
      if (keysView.hovered < 0) return;
      tip.style.transform = `translate(${keysView.x.toFixed(1)}px, ${(keysView.y - keysView.r).toFixed(1)}px)`;
    });
  }, []);

  const at = (e: React.PointerEvent) => {
    const r = rect.current ?? e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const hot = hovered !== null ? keys[hovered] : undefined;

  return (
    <div
      ref={rootRef}
      className="keys-layer"
      tabIndex={0}
      role="group"
      aria-roledescription="keyboard"
      aria-label={labels.keys}
      data-keys="capture"
      data-cursor={throws ? "drag" : undefined}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onPointerDown={(e) => {
        if (e.button !== 0 || !keysInput.sink) return;
        if ((e.target as Element).closest(".keys-chips")) return;
        rect.current = e.currentTarget.getBoundingClientRect();
        const { x, y } = at(e);
        const key = keysInput.sink.down(x, y, performance.now());
        if (key !== null) e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!keysInput.sink || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const { x, y } = at(e);
        keysInput.sink.move(x, y, performance.now());
      }}
      onPointerUp={(e) => {
        if (!keysInput.sink || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
        keysInput.sink.up(performance.now());
        rect.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.blur();
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
        // typing: no page scroll on space, no shortcut — the run names a key
        e.preventDefault();
        const t = typed.current;
        const now = performance.now();
        if (now - t.at > KEYS.typeResetMs) {
          t.run = "";
          t.last = -1;
        }
        t.at = now;
        t.run = (t.run + e.key).slice(-32);
        const i = matchTyped(
          t.run,
          keys.map((k) => k.terms),
        );
        if (i !== null && i !== t.last) {
          t.last = i;
          keysInput.sink?.press(i, 1);
        }
      }}
    >
      <fieldset className="keys-chips">
        <legend className="t-micro">{labels.cluster}</legend>
        {[null, ...categories.map((_, i) => i)].map((c) => (
          <label key={c ?? "all"} className="chip chip--toggle t-micro keys-chips__chip">
            <input type="radio" name="keys-cluster" className="sr-only" checked={cluster === c} onChange={() => useKeys.getState().gather(c)} />
            <span aria-hidden="true">{cluster === c ? "■" : "□"}</span>
            {c === null ? labels.all : categories[c]}
          </label>
        ))}
      </fieldset>
      {/* while the keys have focus, say what typing does there (the screen reader hears the label) */}
      <p className="keys-hint t-micro" data-shown={focus || undefined} aria-hidden="true">
        {labels.keys}
      </p>
      <p ref={tipRef} className="keys-tip" data-shown={hot ? "" : undefined} aria-hidden="true">
        {hot && (
          <>
            <span className="keys-tip__name">{hot.name}</span>
            <span className="keys-tip__meta">{`${hot.years} · ${hot.level}`}</span>
          </>
        )}
      </p>
    </div>
  );
}
