/**
 * Hollerith punched-card code, as the IBM 029 keypunch wrote it (DESIGN.md §4.3 A2, §2.11): the
 * LOG cards' holes are a real encoding of the text printed along their top edge, and the
 * terminal's `decode <card>` (Part 13) reads them back with decode().
 *
 * A card has 80 columns and 12 punch rows. From the top edge down they are 12, 11, then 0–9; rows
 * 12, 11 and 0 are the zone punches. A column is stored as a 12-bit mask, bit 0 = row 12 … bit 11
 * = row 9 — the order the rows sit on the card.
 *
 * Plus the card's physical layout (inches), shared by the atlas bake, the shader and the phone edition.
 */
export const CARD = {
  columns: 80,
  rows: 12,
  /** IBM 5081: 7⅜ × 3¼ in */
  width: 7.375,
  height: 3.25,
  /** column centers: 0.087 in apart, the first 0.251 in from the left edge */
  columnPitch: 0.087,
  firstColumn: 0.251,
  /** row centers: 0.25 in apart, row 12's 0.25 in from the top edge */
  rowPitch: 0.25,
  firstRow: 0.25,
  /** a rectangular hole */
  hole: { width: 0.055, height: 0.125 },
  /** the corner cut, upper left: its run along the top and its drop down the side — outside the print */
  cornerCut: { top: 0.25, side: 0.2 },
} as const;

/** The punch rows in card order (top to bottom). */
export const PUNCH_ROWS = [12, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type PunchRow = (typeof PUNCH_ROWS)[number];

const bit = (row: PunchRow) => 1 << PUNCH_ROWS.indexOf(row);
const mask = (...rows: PunchRow[]) => rows.reduce<number>((m, r) => m | bit(r), 0);

/** IBM 029 character codes: each character → its punched rows. */
const CODE: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>([[" ", 0]]);
  for (let d = 0; d <= 9; d++) m.set(String(d), mask(d as PunchRow));
  "ABCDEFGHI".split("").forEach((c, i) => m.set(c, mask(12, (i + 1) as PunchRow)));
  "JKLMNOPQR".split("").forEach((c, i) => m.set(c, mask(11, (i + 1) as PunchRow)));
  "STUVWXYZ".split("").forEach((c, i) => m.set(c, mask(0, (i + 2) as PunchRow)));
  const specials: [string, PunchRow[]][] = [
    ["&", [12]],
    ["-", [11]],
    ["/", [0, 1]],
    [":", [2, 8]],
    ["#", [3, 8]],
    ["@", [4, 8]],
    ["'", [5, 8]],
    ["=", [6, 8]],
    ['"', [7, 8]],
    [".", [12, 3, 8]],
    ["<", [12, 4, 8]],
    ["(", [12, 5, 8]],
    ["+", [12, 6, 8]],
    ["|", [12, 7, 8]],
    ["!", [11, 2, 8]],
    ["$", [11, 3, 8]],
    ["*", [11, 4, 8]],
    [")", [11, 5, 8]],
    [";", [11, 6, 8]],
    [",", [0, 3, 8]],
    ["%", [0, 4, 8]],
    ["_", [0, 5, 8]],
    [">", [0, 6, 8]],
    ["?", [0, 7, 8]],
  ];
  for (const [c, rows] of specials) m.set(c, mask(...rows));
  return m;
})();
const DECODE: ReadonlyMap<number, string> = new Map([...CODE].map(([c, m]) => [m, c]));

/** Characters the keypunch can't write become this (a 029 had no lowercase or curly punctuation). */
export const UNPUNCHABLE = "?";

/** What the card can say: uppercase, typographic punctuation folded to the 029's, ≤ 80 columns. */
export function punchable(text: string): string {
  return [
    ...text
      .toUpperCase()
      .replace(/[–—]/g, "-")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  ]
    .map((c) => (CODE.has(c) ? c : UNPUNCHABLE))
    .join("")
    .slice(0, CARD.columns);
}

/** Text → 80 column masks (blank columns after the text). */
export function encode(text: string): number[] {
  const t = punchable(text);
  return Array.from({ length: CARD.columns }, (_, i) => CODE.get(t[i] ?? " ") ?? 0);
}

/** 80 column masks → the text they punch (trailing blanks trimmed); unknown patterns read as "?". */
export function decode(columns: readonly number[]): string {
  return columns
    .map((m) => DECODE.get(m) ?? UNPUNCHABLE)
    .join("")
    .replace(/\s+$/, "");
}

/** Every hole on the card: [column 0–79, row index 0–11 in card order]. */
export function holes(columns: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  columns.forEach((m, c) => {
    for (let r = 0; r < CARD.rows; r++) if (m & (1 << r)) out.push([c, r]);
  });
  return out;
}

/** A hole's center on the card, inches from its top-left corner. */
export const holeCenter = (column: number, row: number): [number, number] => [CARD.firstColumn + column * CARD.columnPitch, CARD.firstRow + row * CARD.rowPitch];
