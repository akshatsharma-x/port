import { BREAKPOINTS } from "./tokens";

/**
 * Device tiers — DESIGN.md §4.2, verbatim. Every graphics decision in the app reads this file
 * (Global Rules #2); tests/tier.test.ts re-reads the §4.2 table and fails if they drift.
 */
export const SCENE_IDS = ["system", "log", "archive", "work", "capabilities"] as const;
export type SceneId = (typeof SCENE_IDS)[number];
export const isSceneId = (v: unknown): v is SceneId => typeof v === "string" && (SCENE_IDS as readonly string[]).includes(v);

export const TIER_NAMES = ["HIGH", "MID", "LOW", "OFF"] as const;
export type Tier = (typeof TIER_NAMES)[number];

export interface TierSpec {
  /** hero particle count; 0 means the poster (OFF) */
  heroParticles: number;
  /** device-pixel-ratio cap; null when there's no canvas */
  dprCap: number | null;
  sceneTarget: "HalfFloat" | "RGBA8" | null;
  bloomMips: number;
  /** persistence trails, half-res buffer */
  trails: boolean;
  /** chromatic aberration at rest, px */
  restChromaticAberrationPx: number;
  /** stages that may go LIVE; the rest show posters / phone editions */
  liveStages: readonly SceneId[];
  keycaps: "micro-physics" | "sine-float" | "html";
  /** project cover size, or plain DOM images */
  covers: { width: number; height: number } | "dom";
}

export const TIERS: Record<Tier, TierSpec> = {
  HIGH: {
    heroParticles: 250_000,
    dprCap: 1.75,
    sceneTarget: "HalfFloat",
    bloomMips: 6,
    trails: true,
    restChromaticAberrationPx: 0.6,
    liveStages: SCENE_IDS,
    keycaps: "micro-physics",
    covers: { width: 1024, height: 683 },
  },
  MID: {
    heroParticles: 90_000,
    dprCap: 1.5,
    sceneTarget: "HalfFloat",
    bloomMips: 4,
    trails: false,
    restChromaticAberrationPx: 0,
    liveStages: SCENE_IDS,
    keycaps: "sine-float",
    covers: { width: 768, height: 512 },
  },
  LOW: {
    heroParticles: 35_000,
    dprCap: 1.25,
    sceneTarget: "RGBA8",
    bloomMips: 0,
    trails: false,
    restChromaticAberrationPx: 0,
    liveStages: ["system", "work"],
    keycaps: "html",
    covers: { width: 640, height: 427 },
  },
  OFF: {
    heroParticles: 0,
    dprCap: null,
    sceneTarget: null,
    bloomMips: 0,
    trails: false,
    restChromaticAberrationPx: 0,
    liveStages: [],
    keycaps: "html",
    covers: "dom",
  },
};

/** §4.2 "How a tier is chosen". */
export const TIER_RULES = {
  /** deviceMemory at or below this caps the tier at MID */
  midMemoryGb: 4,
  /** phone policy: a coarse pointer narrower than this is LOW, whatever the GPU */
  phoneMaxWidth: BREAKPOINTS.md,
  /** the boot probe renders this many frames of the hero load at the provisional tier… */
  probeFrames: 45,
  /** …after a few unmeasured frames, so pipeline warm-up isn't counted */
  probeWarmupFrames: 5,
  /** p90 frame time above this demotes HIGH → MID (ms) */
  demoteHighP90Ms: 9,
  /** p90 frame time above this demotes MID → LOW (ms) */
  demoteMidP90Ms: 14,
  /** refresh rate = median of this many rAF intervals */
  refreshSamples: 60,
} as const;

/** §4.2 runtime: drei PerformanceMonitor steps the DPR. */
export const DPR_RULES = { step: 0.25, floor: 1, badFrames: 30, goodFrames: 120 } as const;

const RANK: Record<Tier, number> = { HIGH: 0, MID: 1, LOW: 2, OFF: 3 };
/** The lower of two tiers. */
export const lowerTier = (a: Tier, b: Tier): Tier => (RANK[a] >= RANK[b] ? a : b);

export interface TierEnvironment {
  webgl2: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemoryGb: number | null;
  coarsePointer: boolean;
  viewportWidth: number;
  /** the HUD's GFX AUTO / LOW override (zustand) */
  gfx: "auto" | "low";
}

export interface TierDecision {
  tier: Tier;
  /** true when the phone policy applied */
  phone: boolean;
  /** why the tier is what it is, in rule order — shown in the boot log and the dev overlay */
  reasons: string[];
  /** whether the probe still has a say (HIGH or MID, not forced by an override) */
  probe: boolean;
}

/** Hard rules, then the phone policy, then the GFX override. Pure: tests drive it with fakes. */
export function provisionalTier(env: TierEnvironment): TierDecision {
  const phone = env.coarsePointer && env.viewportWidth < TIER_RULES.phoneMaxWidth;
  if (env.reducedMotion) return { tier: "OFF", phone, reasons: ["reduced motion"], probe: false };
  if (!env.webgl2) return { tier: "OFF", phone, reasons: ["no WebGL2"], probe: false };
  let tier: Tier = "HIGH";
  const reasons: string[] = [];
  const cap = (to: Tier, why: string) => {
    if (RANK[to] > RANK[tier]) tier = to;
    reasons.push(why);
  };
  if (env.saveData) cap("LOW", "Save-Data");
  if (env.deviceMemoryGb !== null && env.deviceMemoryGb <= TIER_RULES.midMemoryGb) cap("MID", `deviceMemory ${env.deviceMemoryGb} GB`);
  if (phone) cap("LOW", "phone policy");
  if (env.gfx === "low") cap("LOW", "GFX LOW");
  return { tier, phone, reasons, probe: tier === "HIGH" || tier === "MID" };
}

/** One probe result → the next tier (one step at most; the caller re-probes the new tier). */
export function tierAfterProbe(tier: Tier, p90Ms: number): Tier {
  if (tier === "HIGH" && p90Ms > TIER_RULES.demoteHighP90Ms) return "MID";
  if (tier === "MID" && p90Ms > TIER_RULES.demoteMidP90Ms) return "LOW";
  return tier;
}

/** The starting DPR: the device's, clamped to the tier cap with a floor of 1. */
export function initialDpr(tier: Tier, deviceDpr: number): number {
  const cap = TIERS[tier].dprCap;
  if (cap === null) return 0;
  return Math.min(cap, Math.max(DPR_RULES.floor, deviceDpr));
}

/** One PerformanceMonitor step, within [floor, min(cap, device)]. */
export function stepDpr(current: number, direction: -1 | 1, tier: Tier, deviceDpr: number): number {
  const cap = TIERS[tier].dprCap;
  if (cap === null) return 0;
  const ceiling = Math.min(cap, Math.max(DPR_RULES.floor, deviceDpr));
  const next = current + direction * DPR_RULES.step;
  return Math.round(Math.min(ceiling, Math.max(DPR_RULES.floor, next)) * 100) / 100;
}

export const liveAllowed = (tier: Tier | null, id: SceneId): boolean => tier !== null && TIERS[tier].liveStages.includes(id);

/**
 * Debug only (`?debug=1&tier=MID`): caps the tier, skipping the probe — so one machine can be
 * measured at every tier (scripts/hero-gate.mjs). Never set by the app.
 */
export function debugTierCap(search: string): Tier | null {
  const q = new URLSearchParams(search);
  const t = q.get("tier");
  return q.get("debug") === "1" && (TIER_NAMES as readonly string[]).includes(t ?? "") ? (t as Tier) : null;
}

/** Reads the browser side of TierEnvironment (client only). */
export function readTierEnvironment(gfx: "auto" | "low", reducedMotion: boolean): TierEnvironment {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return {
    webgl2: typeof WebGL2RenderingContext !== "undefined",
    reducedMotion,
    saveData: nav.connection?.saveData === true,
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    viewportWidth: window.innerWidth,
    gfx,
  };
}
