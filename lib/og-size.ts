/**
 * A share card's title size by the title's length (lib/og.tsx), so the longest a record has still
 * sits on ≤ 4 lines; the bake checks every record against it (scripts/bake/og.ts). Pure, so both
 * the cards (server) and the bake (Node) read the same rule.
 */
export function titleSize(text: string): number {
  const n = text.length;
  if (n <= 18) return 104;
  if (n <= 32) return 80;
  if (n <= 60) return 60;
  if (n <= 90) return 52;
  return 46;
}
