import { describe, expect, it } from "vitest";
import { skewFor, SKEW } from "@/hooks/useVelocitySkew";
import { DETENT, detentTarget, LENIS_OPTIONS, PINS } from "@/lib/scroll";

/** DESIGN.md §3.7–§3.8 — scroll physics, pins, detents and skew. */
describe("scroll layer", () => {
  it("Lenis: lerp 0.1, 1× wheel, native touch", () => {
    expect(LENIS_OPTIONS).toEqual({ lerp: 0.1, wheelMultiplier: 1, syncTouch: false });
  });

  it("pins: hero 100 svh, LOG ≤ 200, ARCHIVE ≤ 150 — nothing else, 450 svh in all", () => {
    expect(PINS).toEqual({ system: 100, log: 200, archive: 150 });
    expect(Object.values(PINS).reduce((a, b) => a + b, 0)).toBe(450);
  });

  it("soft detents: only below 0.2 px/ms, within 8% of a node, after input has gone quiet", () => {
    expect(DETENT.maxVelocityPxPerS).toBe(200);
    expect(DETENT.within).toBe(0.08);
    const quiet = DETENT.quietMs + 1;
    expect(detentTarget(0.36, 4, 50, quiet)).toBeCloseTo(1 / 3); // 2.7% from ⅓: eases there
    expect(detentTarget(0.45, 4, 50, quiet)).toBeNull(); // 11.7% from ⅓: free
    expect(detentTarget(0.36, 4, 250, quiet)).toBeNull(); // too fast
    expect(detentTarget(0.36, 4, -199, quiet)).toBeCloseTo(1 / 3); // either direction
    expect(detentTarget(0.36, 4, 50, DETENT.quietMs - 1)).toBeNull(); // never against live input
    expect(detentTarget(1 / 3, 4, 0, quiet)).toBeNull(); // already there
    expect(detentTarget(0.5, 1, 0, quiet)).toBeNull(); // no nodes
  });

  it("velocity skew ≤ 3°, signed, saturating", () => {
    expect(SKEW.maxDeg).toBe(3);
    expect(skewFor(0)).toBe(0);
    expect(skewFor(1e6)).toBe(3);
    expect(skewFor(-1e6)).toBe(-3);
    expect(Math.abs(skewFor(SKEW.saturatePxPerS / 2))).toBeCloseTo(1.5);
  });
});
