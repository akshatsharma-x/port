import { describe, expect, it } from "vitest";
import { BAYER8 } from "@/lib/dither";
import { ditherInto, PORTRAIT, stepExposure } from "@/lib/identity";
import { duration, identity } from "@/lib/motion";
import { section } from "./helpers/design";

/** 02 · IDENTITY (DESIGN.md §7.4): the portrait's dither and exposure lamp, and the numbers in the bible. */
const N = PORTRAIT.cols * PORTRAIT.rows;
const centre = { x: PORTRAIT.cols / 2, y: PORTRAIT.rows / 2 };
const at = (x: number, y: number) => Math.floor(y) * PORTRAIT.cols + Math.floor(x);

describe("DESIGN.md §7.4 IDENTITY = lib/identity.ts + lib/motion.ts", () => {
  const text = section(/^### 7\.4 /);
  it("the cells, the lamp's radius and τ, the swap", () => {
    expect(text).toContain(`${PORTRAIT.cols} × ${PORTRAIT.rows} cells`);
    expect(text).toContain(`radius ${identity.lampRadius * 100}% of the portrait`);
    expect(text).toContain(`τ = ${identity.lampTauMs} ms`);
    expect(text).toContain(`every ${identity.currentlySwapMs / 1000} s`);
  });
});

describe("the exposure lamp", () => {
  it("develops the cells under it toward full, over duration.micro.in", () => {
    const E = new Float32Array(N).fill(PORTRAIT.rest);
    stepExposure(E, duration.micro.in, centre);
    const c = E[at(centre.x, centre.y)] ?? 0;
    // one time constant: 1 − 1/e of the way from rest to full
    expect(c - PORTRAIT.rest).toBeCloseTo((1 - PORTRAIT.rest) * (1 - Math.exp(-1)), 2);
    // outside its radius, nothing
    expect(E[at(centre.x + identity.lampRadius * PORTRAIT.cols + 2, centre.y)]).toBeCloseTo(PORTRAIT.rest, 6);
  });
  it("fades back toward rest with τ, like phosphor, and reports when it's settled", () => {
    const E = new Float32Array(N).fill(PORTRAIT.rest);
    E[0] = 1;
    stepExposure(E, identity.lampTauMs, null);
    expect((E[0] ?? 0) - PORTRAIT.rest).toBeCloseTo((1 - PORTRAIT.rest) * Math.exp(-1), 4);
    let moving = true;
    let t = 0;
    while (moving && t < 20_000) {
      moving = stepExposure(E, 16, null);
      t += 16;
    }
    expect(moving).toBe(false);
    // settled within ~7τ (1e-3 of a 0.7 excess): the loop stops instead of running forever
    expect(t).toBeLessThan(identity.lampTauMs * 7);
  });
});

describe("the dot-matrix dither", () => {
  it("is the canonical 8 × 8 Bayer", () => {
    expect(BAYER8.slice(0, 8)).toEqual([0, 32, 8, 40, 2, 34, 10, 42]);
    expect(new Set(BAYER8).size).toBe(64);
  });
  it("prints nothing under the black point, and more ink as the exposure rises", () => {
    const out = new Uint8ClampedArray(N * 4);
    const dark = new Uint8Array(N).fill(Math.floor(PORTRAIT.blackPoint * 255));
    expect(ditherInto(out, dark, new Float32Array(N).fill(1), [255, 255, 255])).toBe(0);
    const mid = new Uint8Array(N).fill(160);
    const atRest = ditherInto(out, mid, new Float32Array(N).fill(PORTRAIT.rest), [255, 255, 255]);
    const lit = ditherInto(out, mid, new Float32Array(N).fill(1), [255, 255, 255]);
    expect(atRest).toBeGreaterThan(0);
    expect(lit).toBeGreaterThan(atRest * 2.5);
  });
});
