import { describe, expect, it, vi } from "vitest";
import { RAF_FUNNEL_SCRIPT, type RafFunnelStats } from "@/lib/raf-funnel";

/**
 * The one-RAF funnel (DESIGN.md §4.1), run against a fake window with a controllable native
 * requestAnimationFrame: one native request per frame however many callers, platform semantics.
 */
type FrameCb = (t: number) => void;

function install() {
  let nativeQueue: FrameCb[] = [];
  let nativeCalls = 0;
  const nativeCancelled: number[] = [];
  const errors: unknown[] = [];
  const w: Record<string, unknown> = {
    requestAnimationFrame: (cb: FrameCb) => {
      nativeCalls++;
      nativeQueue.push(cb);
      return nativeQueue.length;
    },
    cancelAnimationFrame: (h: number) => nativeCancelled.push(h),
    reportError: (e: unknown) => errors.push(e),
  };
  new Function("window", RAF_FUNNEL_SCRIPT)(w);
  const raf = w.requestAnimationFrame as (cb: FrameCb) => number;
  const caf = w.cancelAnimationFrame as (h: number) => void;
  const frame = (t: number) => {
    const q = nativeQueue;
    nativeQueue = [];
    for (const cb of q) cb(t);
  };
  return { raf, caf, frame, stats: w.__rafFunnel as RafFunnelStats, nativeCalls: () => nativeCalls, nativeCancelled, errors };
}

describe("one RAF", () => {
  it("batches any number of callers into one native request per frame", () => {
    const f = install();
    const seen: string[] = [];
    f.raf(() => seen.push("gsap"));
    f.raf(() => seen.push("motion"));
    f.raf(() => seen.push("react"));
    expect(f.nativeCalls()).toBe(1);
    f.frame(16);
    expect(seen).toEqual(["gsap", "motion", "react"]);
    expect(f.stats).toMatchObject({ frames: 1, native: 1, last: 3 });
  });

  it("passes the frame timestamp; callbacks requested during a frame run in the next one", () => {
    const f = install();
    const log: [string, number][] = [];
    f.raf((t) => {
      log.push(["a", t]);
      f.raf((t2) => log.push(["a-next", t2]));
    });
    f.frame(100);
    expect(log).toEqual([["a", 100]]);
    f.frame(116);
    expect(log).toEqual([
      ["a", 100],
      ["a-next", 116],
    ]);
    expect(f.stats.native).toBe(f.stats.frames);
  });

  it("cancels before the frame and during it (a later callback in the same batch is skipped)", () => {
    const f = install();
    const ran: string[] = [];
    const early = f.raf(() => ran.push("early"));
    f.caf(early);
    let late = 0;
    f.raf(() => {
      ran.push("first");
      f.caf(late);
    });
    late = f.raf(() => ran.push("late"));
    f.frame(1);
    expect(ran).toEqual(["first"]);
  });

  it("a throwing callback doesn't stop the frame; its error is still reported", () => {
    const f = install();
    const ran: string[] = [];
    f.raf(() => {
      throw new Error("boom");
    });
    f.raf(() => ran.push("after"));
    f.frame(1);
    expect(ran).toEqual(["after"]);
    expect(String(f.errors[0])).toMatch(/boom/);
  });

  it("handles taken before the funnel are cancelled natively", () => {
    const f = install();
    f.caf(7);
    expect(f.nativeCancelled).toEqual([7]);
  });

  it("installs once", () => {
    const w: Record<string, unknown> = { requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn() };
    new Function("window", RAF_FUNNEL_SCRIPT)(w);
    const first = w.requestAnimationFrame;
    new Function("window", RAF_FUNNEL_SCRIPT)(w);
    expect(w.requestAnimationFrame).toBe(first);
  });
});
