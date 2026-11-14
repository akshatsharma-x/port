import type { SearchIndex } from "@/content/search-index";

/**
 * `rain` (DESIGN.md §7.4 SHELL): phosphor rain made of this site's own data — the papers' titles,
 * their DOIs, the commits this build was made from, the projects' names — never a film's glyphs.
 * Each column drops one of those strings, a character per cell, a bright head and a fading trail.
 * Pure: the panel steps it on the ticker at lib/motion's rate and draws the cells.
 */
export function rainPool(ix: SearchIndex): string[] {
  const papers = ix.docs.filter((d) => d.kind === "paper");
  return [
    ...papers.map((p) => p.title),
    ...papers.flatMap((p) => (p.kind === "paper" && p.links.doi ? [p.links.doi] : [])),
    ...ix.commits,
    ...ix.docs.filter((d) => d.kind === "project").map((p) => p.title),
  ].filter((s) => s.trim().length > 0);
}

interface Drop {
  text: string;
  /** the head's row (it falls one row a step); negative: waiting above the top */
  head: number;
}

export interface Rain {
  columns: number;
  rows: number;
  drops: Drop[];
}

/** A drop's first wait above the top, as a share of the rows: the columns don't all start together. */
const STAGGER = 1.5;

const next = (pool: readonly string[], rows: number, random: () => number, stagger: number): Drop => ({
  text: pool[Math.floor(random() * pool.length)] ?? "",
  head: -Math.floor(random() * rows * stagger),
});

export function startRain(pool: readonly string[], columns: number, rows: number, random: () => number = Math.random): Rain {
  return { columns, rows, drops: Array.from({ length: columns }, () => next(pool, rows, random, STAGGER)) };
}

/** One step: every head falls a row; a drop whose tail has left the bottom starts over with a new string. */
export function stepRain(rain: Rain, pool: readonly string[], trail: number, random: () => number = Math.random): void {
  rain.drops.forEach((d, i) => {
    d.head += 1;
    if (d.head - Math.min(d.text.length, trail) > rain.rows) rain.drops[i] = next(pool, rain.rows, random, 1);
  });
}

/**
 * The cells lit now: [column, row, character, brightness 0–1]. A drop shows its string's characters
 * in order down the column, the newest at the head; the trail fades over `trail` cells.
 */
export function rainCells(rain: Rain, trail: number): [number, number, string, number][] {
  const out: [number, number, string, number][] = [];
  rain.drops.forEach((d, x) => {
    for (let k = 0; k < trail; k++) {
      const row = d.head - k;
      if (row < 0 || row >= rain.rows) continue;
      // the character the head is on: the string runs down the column from its first cell
      const ch = d.text[row % Math.max(1, d.text.length)] ?? "";
      if (!ch.trim()) continue;
      out.push([x, row, ch, 1 - k / trail]);
    }
  });
  return out;
}

/** The reduced-motion edition's rain: one still frame, each column a string set top to bottom. */
export function stillRain(pool: readonly string[], columns: number, rows: number, random: () => number = Math.random): string[] {
  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => " "));
  for (let x = 0; x < columns; x += 2) {
    const text = pool[Math.floor(random() * pool.length)] ?? "";
    const from = Math.floor(random() * rows);
    const length = Math.min(text.length, rows - from);
    for (let k = 0; k < length; k++) {
      const row = grid[from + k];
      if (row) row[x] = text[k] ?? " ";
    }
  }
  return grid.map((r) => r.join("").replace(/\s+$/, ""));
}
