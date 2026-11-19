import { describe, expect, it } from "vitest";
import { tagSide } from "@/lib/sky-tags";

/**
 * A sparse sky's tags (lib/archive.ts tagSide, Part 16): each record's title and facts by its star,
 * clear of the cluster labels and inside the view. The walk found a tag across the cluster label at
 * the pin's start, and one squeezed against the phone's right edge.
 */
const view = { w: 800, h: 600 };
const tag = { w: 200, h: 50 };
const GAP = 12;
const box = (cx: number, cy: number, w = 160, h = 16) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });

describe("tagSide", () => {
  it("faces away from the nearest cluster label (the label stands between a cluster's stars)", () => {
    expect(tagSide({ x: 300, y: 300, r: 8 }, tag, [box(400, 300)], view, GAP).side).toBe("left");
    expect(tagSide({ x: 500, y: 300, r: 8 }, tag, [box(400, 300)], view, GAP).side).toBe("right");
  });

  it("takes the other side when the preferred one runs off the view", () => {
    // the label is to the left, so right is preferred, but the star is at the right edge
    expect(tagSide({ x: 760, y: 100, r: 8 }, tag, [box(400, 400)], view, GAP).side).toBe("left");
  });

  it("goes above or below when both sides are blocked — away from the label, slid inside the view", () => {
    // at the right edge with the label right where the left-hand tag would be
    const below = tagSide({ x: 760, y: 300, r: 8 }, tag, [box(620, 300, 200)], view, GAP);
    expect(below).toEqual({ side: "below", dx: -60 }); // centred it would end at 860: slid to end at 800
    expect(tagSide({ x: 760, y: 300, r: 8 }, tag, [box(620, 300, 200), box(700, 360, 300, 40)], view, GAP).side).toBe("above");
  });

  it("with no labels: right, else left at the right edge", () => {
    expect(tagSide({ x: 100, y: 300, r: 8 }, tag, [], view, GAP)).toEqual({ side: "right", dx: 0 });
    expect(tagSide({ x: 790, y: 300, r: 8 }, tag, [], view, GAP).side).toBe("left");
  });
});
