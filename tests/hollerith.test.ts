import { describe, expect, it } from "vitest";
import { CARD, decode, encode, holes, punchable, PUNCH_ROWS } from "@/lib/hollerith";

/** The LOG cards' holes (DESIGN.md §4.3 A2): real IBM 029 Hollerith, round-trippable for `decode`. */
const rows = (m: number) => PUNCH_ROWS.filter((_, i) => m & (1 << i));

describe("Hollerith (IBM 029)", () => {
  it("punches the zone + digit codes", () => {
    expect(rows(encode("A")[0] ?? 0)).toEqual([12, 1]);
    expect(rows(encode("I")[0] ?? 0)).toEqual([12, 9]);
    expect(rows(encode("J")[0] ?? 0)).toEqual([11, 1]);
    expect(rows(encode("R")[0] ?? 0)).toEqual([11, 9]);
    expect(rows(encode("S")[0] ?? 0)).toEqual([0, 2]);
    expect(rows(encode("Z")[0] ?? 0)).toEqual([0, 9]);
    expect(rows(encode("0")[0] ?? 0)).toEqual([0]);
    expect(rows(encode("7")[0] ?? 0)).toEqual([7]);
  });
  it("punches the 029's specials", () => {
    expect(rows(encode("&")[0] ?? 0)).toEqual([12]);
    expect(rows(encode("-")[0] ?? 0)).toEqual([11]);
    expect(rows(encode("/")[0] ?? 0)).toEqual([0, 1]);
    expect(rows(encode(".")[0] ?? 0)).toEqual([12, 3, 8]);
    expect(rows(encode("(")[0] ?? 0)).toEqual([12, 5, 8]);
    expect(rows(encode(")")[0] ?? 0)).toEqual([11, 5, 8]);
    expect(rows(encode(",")[0] ?? 0)).toEqual([0, 3, 8]);
    expect(encode(" ")[0]).toBe(0);
  });
  it("encodes 80 columns and decodes back to the same text", () => {
    for (const t of ["UNITED AIRLINES 2026-PRESENT", "ERNST & YOUNG (EY) 2026", "TRUECHIP SOLUTIONS 2025-2026", "WALKINGTREE TECHNOLOGIES 2025"]) {
      const c = encode(t);
      expect(c).toHaveLength(CARD.columns);
      expect(decode(c)).toBe(t);
    }
  });
  it("folds what a keypunch can't write: case, dashes, accents; ? for the rest; 80 columns at most", () => {
    expect(punchable("Ernst & Young – 2026")).toBe("ERNST & YOUNG - 2026");
    expect(punchable("Café")).toBe("CAFE");
    expect(punchable("a~b")).toBe("A?B");
    expect(punchable("X".repeat(90))).toHaveLength(80);
  });
  it("lists every hole by column and row", () => {
    expect(holes(encode("A1"))).toEqual([
      [0, 0],
      [0, 3],
      [1, 3],
    ]);
  });
});
