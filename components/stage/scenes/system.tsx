"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState } from "react";
import { HERO, type HeroTargets } from "@/lib/hero";
import { heroTargets, relattice } from "@/lib/hero-targets";
import { governor } from "@/lib/sceneManager";
import { onScrollRefresh, scrollGeometry } from "@/lib/scroll";
import { useUI } from "@/lib/store";
import { TIERS, type Tier } from "@/lib/tier";
import { HeroField } from "../hero/field";
import { onThemeChange, useSceneFrame, useSceneHandle, useStagePost, type SceneProps } from "../scene-api";

/** a resize settles this long before the lattice is re-measured and re-generated (it's a worker round trip) */
const RELATTICE_AFTER_MS = 150;

/**
 * A1 · HERO "SYSTEM" (DESIGN.md §4.3, §7.4): the phosphor morph. One Points draw of the tier's
 * particle count through four true states, owned by scroll (the hero pin's progress × 3). The
 * targets come from the worker the boot started (lib/hero-targets.ts); prime() only waits for
 * them. No render loop of its own: the governor draws it; this sets uniforms per LIVE frame.
 */
interface Data {
  targets: HeroTargets;
  count: number;
  tier: Tier;
}

export async function prime(): Promise<Data> {
  const tier = governor.snapshot.tier ?? "LOW";
  const want = TIERS[tier].heroParticles;
  const targets = await heroTargets(want);
  return { targets, count: Math.min(want, targets.count), tier };
}

/** the lattice's "G" flash: once per page view */
let flashed = false;

export default function SystemScene({ data }: SceneProps<Data>) {
  const h = useSceneHandle();
  const gl = useThree((s) => s.gl);
  useStagePost();
  const [field] = useState(() => new HeroField(data.targets, data.count, data.tier));
  useLayoutEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    governor.dev.hero = field;
    return () => {
      if (governor.dev.hero === field) delete governor.dev.hero;
    };
  }, [field]);

  useLayoutEffect(() => {
    field.applyTheme();
    return onThemeChange(() => {
      field.applyTheme();
      h.invalidate();
    });
  }, [field, h]);

  // the lattice follows the live layout (resize, fonts in, scroll refresh)
  useLayoutEffect(() => {
    let timer = 0;
    let cancelled = false;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void relattice(data.count).then((next) => {
          if (cancelled) return;
          field.setLattice(next);
          h.invalidate();
        });
      }, RELATTICE_AFTER_MS);
    };
    window.addEventListener("resize", refresh);
    void document.fonts?.ready.then(refresh);
    const offRefresh = onScrollRefresh(refresh);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", refresh);
      offRefresh();
    };
  }, [field, data.count, h]);

  // ?debug=1&poster=1: the poster capture (scripts/posters.ts) — a still, canonical frame
  const [still] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("debug") === "1" && q.get("poster") === "1";
  });

  // the hero pin's length, measured on refresh, never per frame
  const pinLength = useRef(0);
  useLayoutEffect(() => {
    const read = () => {
      pinLength.current = scrollGeometry().pins.find((p) => p.id === "system")?.length ?? 0;
    };
    read();
    return onScrollRefresh(read);
  }, []);

  useSceneFrame((dt, time) => {
    const progress = field.frame({ dt, time, camera: h.camera, slotHeight: h.size.height, dpr: gl.getPixelRatio(), pinLength: pinLength.current, still });
    // the lattice lands as the About layout: the "G" overlay flashes once
    if (progress >= 1 - 1e-3 && !flashed) {
      flashed = true;
      useUI.getState().flashGrid(HERO.gridFlashMs);
    }
  });

  return <primitive object={field.points} />;
}
