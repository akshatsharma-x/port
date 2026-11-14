import { describe, expect, it } from "vitest";
import { GOVERNOR } from "@/lib/sceneManager";
import { DPR_RULES, initialDpr, provisionalTier, SCENE_IDS, stepDpr, TIER_NAMES, TIER_RULES, TIERS, tierAfterProbe, type TierEnvironment } from "@/lib/tier";
import { section, table } from "./helpers/design";

/** lib/tier.ts is DESIGN.md §4.2 verbatim — re-read from the bible, cell by cell. */
const rows = table(/^\*\*Device tiers/);
const row = (label: string) => {
  const r = rows.find((x) => x[0] === label);
  if (!r) throw new Error(`§4.2 tier table has no "${label}" row`);
  return r.slice(1) as [string, string, string, string];
};
const num = (cell: string) => Number(cell.replace(/[^\d.]/g, ""));

describe("the §4.2 tier table", () => {
  it("hero particles", () => {
    const [h, m, l, o] = row("Hero particles");
    expect([TIERS.HIGH.heroParticles, TIERS.MID.heroParticles, TIERS.LOW.heroParticles]).toEqual([num(h), num(m), num(l)]);
    expect(o).toBe("poster");
    expect(TIERS.OFF.heroParticles).toBe(0);
  });

  it("DPR cap", () => {
    const [h, m, l] = row("DPR cap");
    expect([TIERS.HIGH.dprCap, TIERS.MID.dprCap, TIERS.LOW.dprCap, TIERS.OFF.dprCap]).toEqual([num(h), num(m), num(l), null]);
  });

  it("scene render target and bloom", () => {
    const targets = row("Scene render target").map((c) => /^(HalfFloat|RGBA8)/.exec(c)?.[1] ?? null);
    expect(TIER_NAMES.map((t) => TIERS[t].sceneTarget)).toEqual(targets);
    expect(TIER_NAMES.map((t) => TIERS[t].bloomMips)).toEqual(row("Bloom mip levels").map((c) => (c === "—" ? 0 : num(c))));
  });

  it("trails and rest chromatic aberration", () => {
    expect(TIER_NAMES.map((t) => TIERS[t].trails)).toEqual(row("Persistence trails").map((c) => c.startsWith("on")));
    expect(TIER_NAMES.map((t) => TIERS[t].restChromaticAberrationPx)).toEqual(row("Rest chromatic aberration").map((c) => (c === "—" ? 0 : num(c))));
  });

  it("live stages: all five · all five · Hero + Projects · none", () => {
    expect(row("Live stages")).toEqual(["all five", "all five", "Hero + Projects", "none"]);
    expect(TIERS.HIGH.liveStages).toEqual(SCENE_IDS);
    expect(TIERS.MID.liveStages).toEqual(SCENE_IDS);
    expect([...TIERS.LOW.liveStages].sort()).toEqual(["system", "work"]);
    expect(TIERS.OFF.liveStages).toEqual([]);
  });

  it("project covers", () => {
    const covers = row("Project covers").map((c) => /(\d+)×(\d+)/.exec(c));
    TIER_NAMES.forEach((t, i) => {
      const m = covers[i];
      expect(TIERS[t].covers).toEqual(m ? { width: Number(m[1]), height: Number(m[2]) } : "dom");
    });
  });
});

describe("how a tier is chosen (§4.2)", () => {
  const text = section(/^### 4\.2/);
  it("the thresholds are the document's", () => {
    expect(text).toMatch(new RegExp(`\`deviceMemory\` ≤ ${TIER_RULES.midMemoryGb} → at most MID`));
    expect(text).toMatch(new RegExp(`width < ${TIER_RULES.phoneMaxWidth} → LOW`));
    expect(text).toMatch(new RegExp(`render ${TIER_RULES.probeFrames} frames of the hero`));
    expect(text).toMatch(new RegExp(`p90 frame time > ${TIER_RULES.demoteHighP90Ms} ms demotes HIGH → MID; > ${TIER_RULES.demoteMidP90Ms} ms demotes MID → LOW`));
    expect(text).toMatch(new RegExp(`median of ${TIER_RULES.refreshSamples} rAF intervals`));
    expect(text).toMatch(new RegExp(`steps DPR down by ${DPR_RULES.step} \\(floor ${DPR_RULES.floor.toFixed(1)}\\) after ${DPR_RULES.badFrames} bad frames, and back up after ${DPR_RULES.goodFrames} good ones`));
  });

  it("the governor's constants are the document's", () => {
    expect(text).toMatch(new RegExp(`COOLING:\\*\\* a ${GOVERNOR.coolingGraceMs / 1000} s grace period`));
    expect(text).toMatch(/At most one LIVE scene and at most two scenes resident in VRAM/);
    expect(text).toMatch(new RegExp(`No input or camera motion for ${GOVERNOR.idleAfterMs / 1000} s ⇒ ${GOVERNOR.idleFps} fps`));
    expect(text).toMatch(new RegExp(`at least \\*\\*${GOVERNOR.interlockSvh * 100} svh of DOM-only content\\*\\*`));
    expect(text).toMatch(new RegExp(`≥ ${GOVERNOR.warmAheadViewports} viewports ahead`));
    expect(section(/^### 8\.3/)).toMatch(new RegExp(`Stages run at 120 when p95 ≤ ${GOVERNOR.highRefreshP95Ms} ms`));
    expect(section(/^### 8\.3/)).toMatch(new RegExp(`p95 rAF interval over ${GOVERNOR.missedFrameIntervals} refresh intervals`));
    expect(section(/^### 8\.3/)).toMatch(new RegExp(`holds ${GOVERNOR.highRefreshFallbackFps} for ${GOVERNOR.highRefreshHoldMs / 1000} s`));
  });

  const env = (over: Partial<TierEnvironment> = {}): TierEnvironment => ({
    webgl2: true,
    reducedMotion: false,
    saveData: false,
    deviceMemoryGb: 8,
    coarsePointer: false,
    viewportWidth: 1440,
    gfx: "auto",
    ...over,
  });

  it("hard rules, then the phone policy, then the GFX override", () => {
    expect(provisionalTier(env())).toMatchObject({ tier: "HIGH", probe: true });
    expect(provisionalTier(env({ reducedMotion: true })).tier).toBe("OFF");
    expect(provisionalTier(env({ webgl2: false })).tier).toBe("OFF");
    expect(provisionalTier(env({ saveData: true }))).toMatchObject({ tier: "LOW", probe: false });
    expect(provisionalTier(env({ deviceMemoryGb: 4 }))).toMatchObject({ tier: "MID", probe: true });
    expect(provisionalTier(env({ deviceMemoryGb: 8, coarsePointer: true, viewportWidth: 412 }))).toMatchObject({ tier: "LOW", phone: true });
    expect(provisionalTier(env({ coarsePointer: true, viewportWidth: 1024 })).tier).toBe("HIGH"); // a tablet is not a phone
    expect(provisionalTier(env({ gfx: "low" })).tier).toBe("LOW");
    expect(provisionalTier(env({ gfx: "low", reducedMotion: true })).tier).toBe("OFF");
  });

  it("the probe demotes one step at a time", () => {
    expect(tierAfterProbe("HIGH", 8.9)).toBe("HIGH");
    expect(tierAfterProbe("HIGH", 9.1)).toBe("MID");
    expect(tierAfterProbe("HIGH", 30)).toBe("MID"); // the caller re-probes MID
    expect(tierAfterProbe("MID", 13.9)).toBe("MID");
    expect(tierAfterProbe("MID", 14.1)).toBe("LOW");
    expect(tierAfterProbe("LOW", 40)).toBe("LOW");
    expect(tierAfterProbe("HIGH", Number.NaN)).toBe("HIGH"); // no measurement, no verdict
  });

  it("DPR: capped per tier, floor 1, steps of 0.25", () => {
    expect(initialDpr("HIGH", 2)).toBe(1.75);
    expect(initialDpr("MID", 2)).toBe(1.5);
    expect(initialDpr("LOW", 3)).toBe(1.25);
    expect(initialDpr("HIGH", 1)).toBe(1);
    expect(stepDpr(1.75, -1, "HIGH", 2)).toBe(1.5);
    expect(stepDpr(1, -1, "HIGH", 2)).toBe(1);
    expect(stepDpr(1.5, 1, "HIGH", 2)).toBe(1.75);
    expect(stepDpr(1.75, 1, "HIGH", 2)).toBe(1.75);
    expect(stepDpr(1, 1, "HIGH", 1.25)).toBe(1.25); // never above the device
  });
});
