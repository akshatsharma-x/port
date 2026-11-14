import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { COVER } from "@/lib/covers";
import { titleSize } from "@/lib/og-size";
import { shareHost } from "@/lib/site";

/**
 * The share cards (PROMPTS.md Part 15; DESIGN.md §7.6): 1200 × 630 PNGs from next/og's
 * ImageResponse, rendered by the bake (scripts/bake/og.ts → public/og/), in the screen's own art
 * direction — Phosphor's tokens, read from styles/tokens.css so the cards can't drift from the
 * site; JetBrains Mono (static instances, app/fonts/og: Satori reads no WOFF2 and no variable
 * axes); the HUD's readout over a bracket frame. Not app routes (opengraph-image.tsx): next/og's
 * WebAssembly in the app's graph put Turbopack's async-module runtime in every page's first-load
 * JS, 0.45 KB gz (measured, Part 15).
 */

export const OG_SIZE = COVER.og;
export const OG_TYPE = "image/png";

const ROOT = process.cwd();

/** Phosphor's tokens (styles/tokens.css, :root / [data-theme="phosphor"]) — the cards' only colors. */
function phosphor(): Record<string, string> {
  const css = readFileSync(join(ROOT, "styles/tokens.css"), "utf8");
  const start = css.indexOf('[data-theme="phosphor"] {');
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}
const T = phosphor();
const color = (name: string): string => {
  const c = T[name];
  if (!c) throw new Error(`og: ${name} is not a hex token in styles/tokens.css's phosphor block`);
  return c;
};
/** A token at an alpha, as rgba (the glow, the scanlines). */
const alpha = (name: string, a: number): string => {
  const h = color(name);
  return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${a})`;
};
export const OG = {
  bg: color("--bg"),
  raised: color("--bg-raised"),
  fg1: color("--fg-1"),
  fg2: color("--fg-2"),
  fg3: color("--fg-3"),
  line1: color("--line-1"),
  line2: color("--line-2"),
  accent: color("--accent"),
  glow: alpha("--accent", 0.45),
  scan: alpha("--fg-1", 0.035),
} as const;

const FONTS = [400, 700].map((weight) => ({
  name: "JetBrains Mono",
  data: readFileSync(join(ROOT, `app/fonts/og/JetBrainsMono-${weight}.ttf`)),
  weight: weight as 400 | 700,
  style: "normal" as const,
}));


const PAD_X = 72;
const PAD_Y = 56;
const CORNER = 44;
const RULE = 3;

function Corner({ x, y }: { x: "left" | "right"; y: "top" | "bottom" }) {
  return (
    <div
      style={{
        position: "absolute",
        [x]: 28,
        [y]: 28,
        width: CORNER,
        height: CORNER,
        display: "flex",
        [`border${y === "top" ? "Top" : "Bottom"}`]: `${RULE}px solid ${OG.accent}`,
        [`border${x === "left" ? "Left" : "Right"}`]: `${RULE}px solid ${OG.accent}`,
      }}
    />
  );
}

/**
 * The frame every card shares: the screen's ground with its scanlines, the bezel's four brackets,
 * the HUD readout (RETROGRADE/OS · 04 ARCHIVE) and its right-hand status, the card's own body, and
 * a footer of facts with the site's host (none on a local build).
 */
export function OgFrame({ readout, status, children, facts, path }: { readout: string; status?: string; children: ReactNode; facts: string; path: string }) {
  const host = shareHost();
  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        padding: `${PAD_Y}px ${PAD_X}px`,
        background: OG.bg,
        backgroundImage: `repeating-linear-gradient(0deg, ${OG.scan} 0px, ${OG.scan} 1px, transparent 1px, transparent 4px)`,
        color: OG.fg1,
        fontFamily: "JetBrains Mono",
      }}
    >
      <Corner x="left" y="top" />
      <Corner x="right" y="top" />
      <Corner x="left" y="bottom" />
      <Corner x="right" y="bottom" />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: OG.fg2 }}>
        <span>{readout}</span>
        {status ? <span style={{ color: OG.accent }}>{status}</span> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 20, borderTop: `1px solid ${OG.line2}`, fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: OG.fg3 }}>
        <span>{facts}</span>
        {host ? <span style={{ color: OG.fg2, textTransform: "none" }}>{`${host}${path === "/" ? "" : path}`}</span> : null}
      </div>
    </div>
  );
}

/** A card's eyebrow: the accent line above the title. */
export const eyebrow = (text: string) => (
  <span style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: OG.accent, textShadow: `0 0 18px ${OG.glow}`, marginBottom: 20 }}>{text}</span>
);

/** A card's title: the record's own words, sized to fit. */
export const title = (text: string, upper = false) => (
  <span style={{ fontSize: titleSize(text), fontWeight: 700, lineHeight: 1.12, color: OG.fg1, textTransform: upper ? "uppercase" : "none", letterSpacing: upper ? 2 : 0 }}>{text}</span>
);

/** A card as PNG bytes. */
export async function renderPng(node: ReactNode): Promise<Buffer> {
  const res = new ImageResponse(<>{node}</>, { ...OG_SIZE, fonts: FONTS });
  return Buffer.from(await res.arrayBuffer());
}
