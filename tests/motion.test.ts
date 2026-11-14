import { describe, expect, it } from "vitest";
import { damp } from "@/lib/damp";
import {
  bezier,
  charDelays,
  dampingRatio,
  ease,
  followers,
  itemDelays,
  lineDelays,
  relayout,
  springs,
  stagger,
} from "@/lib/motion";
import { Spring, stepResponse } from "@/lib/spring";
import { section, table, tables } from "./helpers/design";

/** DESIGN.md §3 — springs measured by simulation, followers, frame-rate independence, staggers. */

describe("springs — DESIGN.md §3.3, measured", () => {
  const rows = table(/^### 3\.3 /).filter((r) => (r[0] ?? "") in springs);

  it("lists the same constants lib/motion.ts exports", () => {
    expect(rows.map((r) => r[0]).sort()).toEqual(Object.keys(springs).sort());
    for (const [name, k, c, m, zeta] of rows) {
      const s = springs[name as keyof typeof springs];
      expect([s.stiffness, s.damping, s.mass], name).toEqual([Number(k), Number(c), Number(m)]);
      expect(dampingRatio(s).toFixed(2), `${name} ζ`).toBe(Number(zeta).toFixed(2));
    }
  });

  it("delivers the documented overshoot and 2 % settle time (RK4 at 1/240 s)", () => {
    for (const [name, , , , , overshoot, settle] of rows) {
      const { overshoot: os, settle: st } = stepResponse(springs[name as keyof typeof springs]);
      const doc = Number.parseFloat((overshoot ?? "").replace("≈", ""));
      if ((overshoot ?? "").includes("≈")) expect(os * 100, `${name} overshoot`).toBeLessThan(0.5);
      else expect(Math.abs(os * 100 - doc), `${name} overshoot ${(os * 100).toFixed(2)}%`).toBeLessThan(0.06);
      // sampled at 1/240 s (≈ 0.004 s) against a value documented to 2 decimals
      expect(Math.abs(st - Number.parseFloat(settle ?? "")), `${name} settle ${st.toFixed(3)}s`).toBeLessThan(0.01);
    }
  });

  it("matches the analytic step response (what Motion animates on the DOM)", () => {
    for (const [name, s] of Object.entries(springs)) {
      const z = dampingRatio(s);
      if (z >= 1) continue;
      const analytic = Math.exp((-z * Math.PI) / Math.sqrt(1 - z * z));
      expect(Math.abs(stepResponse(s).overshoot - analytic), name).toBeLessThan(2e-4);
    }
  });

  it("relayout keeps ζ ≈ 0.64 at every mass and settles in 0.55–0.77 s", () => {
    expect(dampingRatio(relayout(0)).toFixed(2)).toBe("0.64");
    expect(dampingRatio(relayout(1)).toFixed(2)).toBe("0.64");
    expect(stepResponse(relayout(0)).settle).toBeCloseTo(0.55, 1);
    expect(stepResponse(relayout(1)).settle).toBeCloseTo(0.77, 1);
    expect(relayout(5).mass).toBe(2); // clamped
  });
});

describe("followers — DESIGN.md §3.3", () => {
  it("lists the documented λ values", () => {
    const rows = tables(section(/^### 3\.3 /))[1] ?? [];
    const doc = Object.fromEntries(rows.map((r) => [r[0]?.split(" (")[0], Number(r[1])]));
    expect(doc["cursor ring"]).toBe(followers.cursorRing);
    expect(doc["cursor label"]).toBe(followers.cursorLabel);
    expect(doc["index preview panel"]).toBe(followers.indexPreview);
    expect(doc["hero camera parallax"]).toBe(followers.heroParallax);
    expect(doc["hero repel field"]).toBe(followers.heroRepel);
    expect(doc["HUD scroll %"]).toBe(followers.hudScroll);
    expect(doc["scroll-velocity signal"]).toBe(followers.scrollVelocity);
  });
});

describe("frame-rate independence — DESIGN.md §3.1", () => {
  const run = (hz: number, f: (dt: number) => void) => {
    const frames = Math.round(hz);
    for (let i = 0; i < frames; i++) f(1 / hz);
  };

  it("damp(): 60, 120 and 144 Hz land on the same value", () => {
    const at = (hz: number) => {
      let v = 0;
      run(hz, (dt) => (v = damp(v, 100, followers.cursorRing, dt)));
      return v;
    };
    expect(at(120)).toBeCloseTo(at(60), 9);
    expect(at(144)).toBeCloseTo(at(60), 9);
  });

  it("Spring: 60 and 120 Hz are identical; 144 Hz within 0.001", () => {
    const at = (hz: number) => {
      const s = new Spring(springs.overshoot, 0).setTarget(1);
      let peak = 0;
      run(hz, (dt) => (peak = Math.max(peak, s.step(dt))));
      return { end: s.value, peak };
    };
    expect(at(120).end).toBeCloseTo(at(60).end, 12);
    expect(Math.abs(at(144).end - at(60).end)).toBeLessThan(1e-3);
  });

  it("retargets from the current velocity (input wins)", () => {
    const s = new Spring(springs.snap, 0).setTarget(1);
    s.step(0.05);
    const v = s.velocity;
    s.setTarget(0);
    expect(s.velocity).toBe(v);
  });
});

describe("stagger — DESIGN.md §3.5", () => {
  it("per char: min(28 ms, 400 ms / n), spread ≤ 400 ms, ±15 % jitter", () => {
    const short = charDelays(5, "a");
    expect(short[0]).toBe(0);
    const step = short[1] ?? 0;
    expect(step).toBeGreaterThanOrEqual(stagger.charMs * 0.85);
    expect(step).toBeLessThanOrEqual(stagger.charMs * 1.15);
    expect(Math.max(...charDelays(80, "b"))).toBeLessThanOrEqual(400 + 1e-9);
  });

  it("per line: 60 ms for the first 6, then line 7+ arrives with line 6", () => {
    const d = lineDelays(10, "c");
    expect(d[6]).toBe(d[5]);
    expect(d[9]).toBe(d[5]);
    expect(d[5] ?? 0).toBeLessThanOrEqual(5 * 60 * 1.15);
  });

  it("per item: ordered by distance from the origin, capped at 600 ms", () => {
    const pts = [
      { x: 300, y: 0 },
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const d = itemDelays(pts, { x: 0, y: 0 }, "d");
    expect(d[1]).toBe(0);
    expect(d[2] ?? 0).toBeLessThan(d[0] ?? 0);
    const many = itemDelays(Array.from({ length: 60 }, (_, i) => ({ x: i, y: 0 })), { x: 0, y: 0 }, "e");
    expect(Math.max(...many)).toBeLessThanOrEqual(stagger.capMs + 1e-9);
  });

  it("is deterministic per seed", () => {
    expect(charDelays(12, "same")).toEqual(charDelays(12, "same"));
    expect(charDelays(12, "same")).not.toEqual(charDelays(12, "other"));
  });
});

describe("bezier evaluator", () => {
  it("hits the endpoints and stays monotonic for settle", () => {
    const f = bezier(ease.settle);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    let prev = 0;
    for (let x = 0.01; x < 1; x += 0.01) {
      const y = f(x);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
    expect(f(0.5)).toBeGreaterThan(0.85); // quint-out: most of the travel happens early
  });
});
