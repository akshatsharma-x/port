import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashSeed, rng } from "@/lib/motion";
import { docBottom, Governor, GOVERNOR, interlockGaps, pickCurrent, viewTop, visibleHeight, warmCandidates, type FrameOverlay, type SceneLoaders, type Slot, type StageRuntime } from "@/lib/sceneManager";
import { SCENE_IDS, type SceneId, type Tier } from "@/lib/tier";

/**
 * The governor (DESIGN.md §4.2) driven frame by frame with a fake clock, a fake runtime and slots
 * without a DOM. Invariants are checked on every frame, including under seeded random abuse.
 */
const VH = 800;
const FRAME = 1000 / 60;

/** Five slots, top to bottom, each followed by `gap` px of DOM-only content. */
function layout(gap = VH * 1.2): Record<SceneId, { top: number; height: number }> {
  const heights: Record<SceneId, number> = { system: VH, log: VH * 1.6, archive: VH, work: VH * 0.7, capabilities: VH };
  let y = 0;
  const out = {} as Record<SceneId, { top: number; height: number }>;
  for (const id of SCENE_IDS) {
    out[id] = { top: y, height: heights[id] };
    y += heights[id] + gap;
  }
  return out;
}

interface Harness {
  g: Governor;
  docks: (string | null)[];
  setScroll: (y: number) => void;
  /** advance one frame (or `n`), letting async loads/warms resolve in between */
  frames: (n?: number) => Promise<void>;
  t: () => number;
  renders: SceneId[];
  violations: string[];
  rt: StageRuntime & { animatingFlag: Record<SceneId, boolean> };
}

async function harness(options: { tier?: Tier; gap?: number; overlay?: FrameOverlay } = {}): Promise<Harness> {
  let now = 1000;
  let scroll = 0;
  const g = new Governor({ now: () => now });
  const loaders = Object.fromEntries(SCENE_IDS.map((id) => [id, async () => ({ default: null, prime: () => ({ id }) })])) as SceneLoaders;
  const renders: SceneId[] = [];
  const violations: string[] = [];
  const animatingFlag = Object.fromEntries(SCENE_IDS.map((id) => [id, true])) as Record<SceneId, boolean>;
  const rt: Harness["rt"] = {
    animatingFlag,
    warm: async () => ({ ms: 3, vramBytes: 1024 }),
    render: (job) => {
      renders.push(job.id);
      return { calls: 2, triangles: 100, points: 0, lines: 0 };
    },
    animating: (id) => animatingFlag[id],
    memory: () => ({ geometries: 0, textures: 0, programs: 0 }),
    framebufferBytes: () => 0,
  };
  const docks: (string | null)[] = [];
  g.configure({ loaders, readScroll: () => scroll, dockSink: (el) => docks.push(el ? "slot" : null) });
  g.setViewport({ width: 1200, height: VH, canvasHeight: VH, svh: VH });
  for (const [id, rect] of Object.entries(layout(options.gap))) g.registerSlot(id as SceneId, null, rect);
  g.setTier({ tier: options.tier ?? "HIGH", phone: false, reasons: [], probe: false }, true);
  g.attachRuntime(rt);
  if (options.overlay) g.setOverlay(options.overlay);
  // the "React" side: resident scenes mount (portal commit) a microtask after they're published
  let mounted = new Set<SceneId>();
  g.store.subscribe((s) => {
    const next = new Set(s.resident);
    for (const id of next) if (!mounted.has(id)) queueMicrotask(() => g.sceneMounted(id));
    mounted = next;
  });

  const check = () => {
    const states = SCENE_IDS.map((id) => g.snapshot.scenes[id]);
    const live = states.filter((s) => s.state === "LIVE").length;
    const resident = states.filter((s) => s.mounted).length;
    if (live > GOVERNOR.maxLive) violations.push(`frame ${g.stats.frame}: ${live} LIVE`);
    if (resident > GOVERNOR.maxResident) violations.push(`frame ${g.stats.frame}: ${resident} resident`);
    if (g.stats.drewThisFrame === "stage" && !g.stats.visible) violations.push(`frame ${g.stats.frame}: drew offscreen`);
  };
  const flush = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };
  return {
    g,
    docks,
    rt,
    renders,
    violations,
    t: () => now,
    setScroll: (y) => {
      scroll = y;
    },
    frames: async (n = 1) => {
      for (let i = 0; i < n; i++) {
        now += FRAME;
        g.noteActivity(now);
        g.update(now);
        check();
        await flush();
      }
    },
  };
}

const state = (h: Harness, id: SceneId) => h.g.snapshot.scenes[id].state;

describe("geometry", () => {
  it("visibleHeight / pickCurrent pick the most-visible allowed slot", () => {
    const slots: Slot[] = [
      { key: 1, id: "system", el: null, top: 0, height: 800, pin: null },
      { key: 2, id: "log", el: null, top: 1000, height: 800, pin: null },
    ];
    expect(visibleHeight(slots[0] as Slot, 0, 800)).toBe(800);
    expect(visibleHeight(slots[0] as Slot, 900, 800)).toBe(0);
    expect(pickCurrent(slots, 500, 800, () => true)?.id).toBe("system"); // 300 px each: a tie keeps the first
    expect(pickCurrent(slots, 600, 800, () => true)?.id).toBe("log");
    expect(pickCurrent(slots, 600, 800, (id) => id !== "log")?.id).toBe("system");
    expect(pickCurrent(slots, 1900, 800, () => true)).toBeNull();
  });

  it("a pinned slot holds still for its pin's length, then scrolls on", () => {
    const pinned = { top: 1000, height: 800, pin: { start: 1000, length: 1600 } };
    expect(viewTop(pinned, 500)).toBe(500); // before the pin: natural
    expect(viewTop(pinned, 1000)).toBe(0); // pin starts
    expect(viewTop(pinned, 2200)).toBe(0); // held
    expect(viewTop(pinned, 2600)).toBe(0); // pin ends
    expect(viewTop(pinned, 3000)).toBe(-400); // after: natural, shifted by the pin
    expect(visibleHeight(pinned, 2000, 800)).toBe(800);
    expect(docBottom(pinned)).toBe(3400);
  });

  it("the interlock counts a pin's scroll as part of its stage", () => {
    const a: Slot = { key: 1, id: "system", el: null, top: 0, height: 800, pin: { start: 0, length: 800 } };
    // the next slot sits 900 px after a's natural bottom — but a is held for 800 px of that
    const b: Slot = { key: 2, id: "log", el: null, top: 1700, height: 800, pin: null };
    expect(interlockGaps([a, b], 800)).toEqual([{ from: "system", to: "log", gapSvh: 0.13 }]);
    expect(interlockGaps([a, { ...b, top: 2400 }], 800)).toEqual([]);
  });

  it("warm-ahead takes slots ahead in the scroll direction, nearest first, within 1.5 viewports", () => {
    const slots: Slot[] = [
      { key: 1, id: "system", el: null, top: 0, height: 800, pin: null },
      { key: 2, id: "log", el: null, top: 1800, height: 800, pin: null },
      { key: 3, id: "archive", el: null, top: 3600, height: 800, pin: null },
    ];
    expect(warmCandidates(slots, 1000, 800, 1, () => true, null)).toEqual(["log"]); // system is behind: it cools
    expect(warmCandidates(slots, 1000, 800, -1, () => true, null)).toEqual(["system"]);
    expect(warmCandidates(slots, 0, 800, 1, () => true, "system")).toEqual(["log"]); // 1000 px past the edge, within 1.5 vh = 1200
    expect(warmCandidates(slots, 0, 800, 1, () => true, "system").includes("archive")).toBe(false); // 2800 px: too far
  });

  it("the interlock flags slots closer than 100 svh", () => {
    const slots: Slot[] = [
      { key: 1, id: "system", el: null, top: 0, height: 800, pin: null },
      { key: 2, id: "log", el: null, top: 800 + 480, height: 800, pin: null },
    ];
    expect(interlockGaps(slots, 800)).toEqual([{ from: "system", to: "log", gapSvh: 0.6 }]);
    expect(interlockGaps([{ ...(slots[0] as Slot) }, { ...(slots[1] as Slot), top: 1600 }], 800)).toEqual([]);
  });
});

describe("the state machine", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it("COLD → PRIMED → WARM → LIVE on screen, then COOLING → COLD after the 2 s grace", async () => {
    const h = await harness();
    await h.frames(1);
    expect(["PRIMED", "COLD"]).toContain(state(h, "system"));
    await h.frames(4);
    expect(state(h, "system")).toBe("LIVE");
    expect(h.renders.at(-1)).toBe("system");
    // scroll into the DOM-only zone after the hero: system cools, log (next) warms
    h.setScroll(VH + 100);
    await h.frames(3);
    expect(state(h, "system")).toBe("COOLING");
    expect(state(h, "log")).toBe("WARM");
    const rendersBefore = h.renders.length;
    await h.frames(Math.ceil(GOVERNOR.coolingGraceMs / FRAME) + 2);
    expect(state(h, "system")).toBe("COLD");
    expect(h.renders.length).toBe(rendersBefore); // offscreen ⇒ no render calls
    expect(h.violations).toEqual([]);
  });

  it("a scene re-entered within the grace goes straight back to LIVE (no re-warm)", async () => {
    const h = await harness();
    await h.frames(5);
    const warm = vi.spyOn(h.rt, "warm");
    h.setScroll(VH * 1.3);
    await h.frames(10);
    expect(state(h, "system")).toBe("COOLING");
    h.setScroll(0);
    await h.frames(1);
    expect(state(h, "system")).toBe("LIVE");
    expect(warm).not.toHaveBeenCalledWith("system");
  });

  it("never more than one LIVE or two resident — scrolling through every stage both ways", async () => {
    const h = await harness();
    const end = layout().capabilities.top + VH;
    for (let y = 0; y <= end; y += 90) {
      h.setScroll(y);
      await h.frames(1);
    }
    for (let y = end; y >= 0; y -= 140) {
      h.setScroll(y);
      await h.frames(1);
    }
    expect(h.violations).toEqual([]);
    expect(h.g.stats.maxLive).toBe(1);
    expect(h.g.stats.maxResident).toBe(2);
    expect(new Set(h.renders)).toEqual(new Set(SCENE_IDS)); // every stage went live on the way
  });

  it("docks by moving the canvas only when the live slot changes — never per frame", async () => {
    const h = await harness();
    await h.frames(5);
    expect(h.docks).toHaveLength(1); // into the hero slot, once
    for (let y = 0; y < VH * 0.5; y += 20) {
      h.setScroll(y);
      await h.frames(1);
    }
    expect(h.docks).toHaveLength(1); // scrolling within the slot moves nothing (native sticky does)
    h.setScroll(layout().log.top);
    await h.frames(6);
    expect(h.docks).toHaveLength(2); // into the log slot
  });

  it("a cold jump resolves from the poster; a warm arrival doesn't", async () => {
    const resolves: (SceneId | null)[] = [];
    const h = await harness();
    const render = h.rt.render;
    h.rt.render = (job) => {
      resolves.push(job.resolve ? job.id : null);
      return render(job);
    };
    await h.frames(5); // the hero was on screen as a poster while it warmed → resolve
    expect(resolves[0]).toBe("system");
    expect(h.g.snapshot.scenes.system.poster).toBe(false);
    h.setScroll(VH + 100); // log warms ahead, off screen
    await h.frames(6);
    resolves.length = 0;
    h.setScroll(layout().log.top);
    await h.frames(2);
    expect(resolves[0]).toBe(null); // warm arrival: straight to live
  });

  it("anchor jumps: the target shows its poster until warm, evicting COOLING scenes early", async () => {
    const h = await harness();
    await h.frames(5);
    const L = layout();
    h.setScroll(L.archive.top); // jump
    await h.frames(1);
    expect(h.g.snapshot.scenes.archive.drawable).toBe(false); // gap protection: poster
    await h.frames(4);
    expect(state(h, "archive")).toBe("LIVE");
    h.setScroll(L.capabilities.top); // jump again before system's grace ran out
    await h.frames(6);
    expect(state(h, "capabilities")).toBe("LIVE");
    expect(h.violations).toEqual([]);
  });

  it("survives seeded random abuse: jumps, flings and pauses", async () => {
    const h = await harness();
    const random = rng(hashSeed("governor-abuse"));
    const max = layout().capabilities.top + VH;
    let y = 0;
    for (let i = 0; i < 1500; i++) {
      const r = random();
      if (r < 0.1) y = Math.floor(random() * max); // anchor jump
      else if (r < 0.6) y = Math.min(max, Math.max(0, y + (random() - 0.5) * 900)); // fling
      h.setScroll(y);
      await h.frames(r > 0.97 ? 150 : 1); // occasional 2.5 s pause
    }
    expect(h.violations).toEqual([]);
    expect(h.g.stats.maxLive).toBeLessThanOrEqual(1);
    expect(h.g.stats.maxResident).toBeLessThanOrEqual(2);
    expect(h.g.stats.offscreenDraws).toBe(0);
  });
});

describe("render policy", () => {
  it("2 s without input ⇒ 30 fps; not animating ⇒ on demand only", async () => {
    const h = await harness();
    await h.frames(5);
    // stop noting activity: drive update() directly
    let now = h.t();
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        now += FRAME;
        h.g.update(now);
      }
    };
    step(Math.ceil(GOVERNOR.idleAfterMs / FRAME) + 1);
    const before = h.renders.length;
    step(60); // one second at 60 Hz
    const idleRenders = h.renders.length - before;
    expect(idleRenders).toBeGreaterThanOrEqual(29);
    expect(idleRenders).toBeLessThanOrEqual(31);
    expect(h.g.snapshot.mode).toBe("idle");

    h.rt.animatingFlag.system = false;
    const b2 = h.renders.length;
    step(60);
    expect(h.renders.length - b2).toBe(0);
    expect(h.g.snapshot.mode).toBe("demand");
    h.g.invalidate("system");
    step(2);
    expect(h.renders.length - b2).toBe(1);
  });

  it("the freeze handshake: while #fx-gl has frames the stage never draws", async () => {
    let active = false;
    const fxFrames: number[] = [];
    const h = await harness({
      overlay: {
        wantsFrame: () => active,
        draw: () => {
          fxFrames.push(h.g.stats.frame);
        },
      },
    });
    await h.frames(5);
    const stageBefore = h.renders.length;
    active = true;
    await h.frames(20);
    active = false;
    await h.frames(2);
    expect(fxFrames).toHaveLength(20);
    expect(h.renders.length - stageBefore).toBe(2); // resumed after, not during
    expect(h.g.stats.bothDrew).toBe(0);
    expect(h.g.stats.framesFrozen).toBe(20);
  });

  it("the hidden tab draws nothing", async () => {
    const h = await harness();
    let hidden = false;
    h.g.configure({ isHidden: () => hidden });
    await h.frames(5);
    hidden = true;
    const before = h.renders.length;
    await h.frames(30);
    expect(h.renders.length).toBe(before);
    expect(h.g.snapshot.mode).toBe("off");
  });
});

describe("PROJECTION: takeover and hold (DESIGN.md §7.4 WORK)", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it("a takeover keeps its scene LIVE and drawing full-viewport wherever the page scrolls, then hands back", async () => {
    const h = await harness();
    h.setScroll(layout().work.top);
    await h.frames(8);
    expect(state(h, "work")).toBe("LIVE");
    const docks = h.docks.length;
    const release = h.g.takeover("work", null);
    expect(release).not.toBeNull();
    await h.frames(1);
    expect(h.docks.length).toBe(docks + 1); // into the takeover layer
    expect(h.g.slotTop("work")).toBe(0);
    // the page behind changes route: its slots go (here, scrolled far away), the scene stays LIVE and drawing
    h.setScroll(layout().capabilities.top + VH * 3);
    const renders = h.renders.length;
    await h.frames(6);
    expect(state(h, "work")).toBe("LIVE");
    expect(h.renders.slice(renders).every((id) => id === "work")).toBe(true);
    expect(h.renders.length).toBeGreaterThan(renders);
    expect(h.violations).toEqual([]);
    release?.();
    await h.frames(1);
    expect(h.docks.at(-1)).toBeNull(); // back to the parking bay
    expect(h.g.takenOver).toBeNull();
  });

  it("no takeover for a scene that can't draw: not resident, or a tier without it", async () => {
    const h = await harness();
    await h.frames(5);
    expect(h.g.takeover("work", null)).toBeNull(); // COLD: nothing to project
    const low = await harness({ tier: "LOW" });
    await low.frames(5);
    expect(low.g.takeover("archive", null)).toBeNull(); // LOW has no ARCHIVE stage
  });

  it("a hold keeps a scene resident with no slot on screen, within the budget, until released", async () => {
    const h = await harness();
    h.setScroll(layout().work.top);
    await h.frames(8);
    const release = h.g.hold("work");
    h.setScroll(layout().work.top + VH * 3); // a page with no WORK slot (the case study)
    await h.frames(Math.ceil(GOVERNOR.coolingGraceMs / FRAME) + 6);
    expect(h.g.snapshot.scenes.work.mounted).toBe(true);
    expect(state(h, "work")).toBe("WARM");
    expect(h.violations).toEqual([]);
    release();
    release(); // released once
    await h.frames(Math.ceil(GOVERNOR.coolingGraceMs / FRAME) + 6);
    expect(state(h, "work")).toBe("COLD");
  });
});

describe("tiers and context loss", () => {
  it("LOW: only Hero + Projects ever mount", async () => {
    const h = await harness({ tier: "LOW" });
    const end = layout().capabilities.top + VH;
    for (let y = 0; y <= end; y += 120) {
      h.setScroll(y);
      await h.frames(2);
    }
    expect(new Set(h.renders)).toEqual(new Set(["system", "work"]));
    for (const id of ["log", "archive", "capabilities"] as const) expect(h.g.snapshot.scenes[id].mounted).toBe(false);
  });

  it("context loss → posters everywhere, no draws; restore → only the current slot re-warms", async () => {
    const h = await harness();
    h.setScroll(VH * 0.2);
    await h.frames(5);
    h.setScroll(VH * 0.4); // system on screen, log warming ahead
    await h.frames(4);
    expect(h.g.snapshot.scenes.log.mounted).toBe(true);
    h.g.contextLost();
    expect(Object.values(h.g.snapshot.scenes).every((s) => !s.drawable)).toBe(true);
    const before = h.renders.length;
    await h.frames(10);
    expect(h.renders.length).toBe(before);
    const warm = vi.spyOn(h.rt, "warm");
    h.g.contextRestored();
    await h.frames(6);
    expect(warm.mock.calls[0]?.[0]).toBe("system"); // the current slot first; warm-ahead resumes after
    expect(state(h, "system")).toBe("LIVE");
    expect(h.violations).toEqual([]);
  });

  it("warns when the interlock is violated", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const h = await harness({ gap: VH * 0.5 });
    expect(h.g.snapshot.interlock.length).toBe(4);
    expect(warn.mock.calls.flat().join(" ")).toMatch(/interlock: only 0\.5 svh/);
    warn.mockRestore();
  });
});
