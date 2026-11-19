/**
 * A sparse sky's tags (PROMPTS.md Part 16; ARCHIVE.sparse in lib/archive.ts): where a record's title
 * and facts sit by its star. Its own module, so first-load JS (which holds lib/archive.ts's store)
 * doesn't carry it: only the sky's lazy HTML layer and the server-drawn SVG use it.
 */
export type TagSide = "left" | "right" | "above" | "below";
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Where a record's tag sits by its star: beside it, facing away from the nearest cluster label (the
 * label stands between a cluster's stars), else the other side, else above or below (slid along by
 * dx to stay inside) — the first box inside the view and clear of every label; failing that, the
 * first inside. One pixel space for all.
 */
export function tagSide(star: { x: number; y: number; r: number }, tag: { w: number; h: number }, labels: readonly Box[], view: { w: number; h: number }, gap: number): { side: TagSide; dx: number } {
  // above or below, the tag slides along to stay inside the view: dx from centred on the star
  const slide = (x: number) => Math.min(Math.max(x - tag.w / 2, 0), Math.max(0, view.w - tag.w)) - (x - tag.w / 2);
  const at = (side: TagSide): Box => {
    const { x, y, r } = star;
    if (side === "right") return { x0: x + r + gap, y0: y - tag.h / 2, x1: x + r + gap + tag.w, y1: y + tag.h / 2 };
    if (side === "left") return { x0: x - r - gap - tag.w, y0: y - tag.h / 2, x1: x - r - gap, y1: y + tag.h / 2 };
    const x0 = x - tag.w / 2 + slide(x);
    if (side === "above") return { x0, y0: y - r - gap - tag.h, x1: x0 + tag.w, y1: y - r - gap };
    return { x0, y0: y + r + gap, x1: x0 + tag.w, y1: y + r + gap + tag.h };
  };
  const inside = (b: Box) => b.x0 >= 0 && b.x1 <= view.w && b.y0 >= 0 && b.y1 <= view.h;
  const clear = (b: Box) => labels.every((l) => b.x1 <= l.x0 || b.x0 >= l.x1 || b.y1 <= l.y0 || b.y0 >= l.y1);
  const near = [...labels].sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - star.x, (a.y0 + a.y1) / 2 - star.y) - Math.hypot((b.x0 + b.x1) / 2 - star.x, (b.y0 + b.y1) / 2 - star.y))[0];
  const awayRight = !near || (near.x0 + near.x1) / 2 <= star.x;
  const awayBelow = !near || (near.y0 + near.y1) / 2 <= star.y;
  const order: TagSide[] = [awayRight ? "right" : "left", awayRight ? "left" : "right", awayBelow ? "below" : "above", awayBelow ? "above" : "below"];
  const side = order.find((s) => inside(at(s)) && clear(at(s))) ?? order.find((s) => inside(at(s))) ?? order[0] ?? "right";
  return { side, dx: side === "above" || side === "below" ? slide(star.x) : 0 };
}
