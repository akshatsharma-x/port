"use client";

import { useLayoutEffect, useState } from "react";
import { KEYS, keysInput, useKeys } from "@/lib/capabilities";
import { STAGE_DATA_URL, type StageData } from "@/lib/hero";
import { pointer } from "@/lib/pointer";
import { governor } from "@/lib/sceneManager";
import { TIERS } from "@/lib/tier";
import { onTick } from "@/lib/ticker";
import { STAGE_EVENT, type StageEventDetail } from "../events";
import { Pile, type PileData } from "../keycaps/pile";
import { onThemeChange, useSceneFrame, useSceneHandle, useStagePost, type SceneProps } from "../scene-api";
import { loadImages } from "../shared/load-images";

/**
 * A5 · SKILLS "CAPABILITIES" (DESIGN.md §4.3 A5, §7.4): the keycap pile. The pile itself is
 * components/stage/keycaps/pile.ts; this primes it (the keys from the stage data, the legend atlas
 * as one channel and the three matcaps as one array, decoded off the main thread), runs it as the
 * tier says (HIGH the micro-sim, MID the float), takes the page's input (lib/capabilities.ts
 * keysInput), mirrors the page's state into it (a category gathers the pile) and wakes it on the
 * cursor.
 */
interface Data extends PileData {
  mode: "sim" | "float";
}

export async function prime(): Promise<Data> {
  const stage = (await fetch(STAGE_DATA_URL).then((r) => r.json())) as StageData;
  const K = stage.keys;
  let keys = K.keys.slice(0, KEYS.maxKeys);
  // ?debug=1&keys=40: the pile at A5's cap, the real keys repeated — for Gate C (never content)
  const q = new URLSearchParams(window.location.search);
  const cap = q.get("debug") === "1" ? Number(q.get("keys")) : 0;
  if (cap > keys.length && cap <= KEYS.maxKeys && keys.length) keys = Array.from({ length: cap }, (_, i) => ({ ...(keys[i % keys.length] as (typeof keys)[number]), slug: `${(keys[i % keys.length] as (typeof keys)[number]).slug}~${i}` }));
  const tier = governor.snapshot.tier;
  const mode = tier && TIERS[tier].keycaps === "micro-physics" ? "sim" : "float";
  const [legends, matcaps] = await Promise.all([
    loadImages({ urls: [K.legends], width: KEYS.atlas.size, height: KEYS.atlas.size, channel: "a" }),
    loadImages({ urls: [K.matcaps.phosphor, K.matcaps.amber, K.matcaps.paper], width: KEYS.matcap.size, height: KEYS.matcap.size }),
  ]);
  return { keys, categories: K.categories, legends, matcaps, mode };
}

export default function CapabilitiesScene({ data }: SceneProps<Data>) {
  const h = useSceneHandle();
  useStagePost();
  const [pile] = useState(() => new Pile(data, data.mode));
  useLayoutEffect(() => () => pile.dispose(), [pile]);

  useLayoutEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    governor.dev.capabilities = pile;
    return () => {
      if (governor.dev.capabilities === pile) delete governor.dev.capabilities;
    };
  }, [pile]);

  useLayoutEffect(() => {
    pile.applyTheme();
    return onThemeChange(() => {
      pile.applyTheme();
      h.invalidate();
    });
  }, [pile, h]);

  // the page's input and state into the pile; each wakes the stage for the frames it needs
  useLayoutEffect(() => {
    const wake = () => {
      pile.wake();
      h.setAnimating(true);
      h.invalidate();
    };
    keysInput.sink = {
      down: (x, y, t) => {
        wake();
        const k = pile.pointerDown(x, y, t);
        return k >= 0 ? k : null;
      },
      move: (x, y) => {
        pile.pointerMove(x, y, h.camera);
        wake();
      },
      up: () => {
        const k = pile.pointerUp();
        if (k >= 0) pile.pressKey(k);
        wake();
        return k >= 0;
      },
      press: (i, strength) => {
        pile.pressKey(i, strength);
        wake();
      },
    };
    const off = useKeys.subscribe((s, prev) => {
      if (s.cluster !== prev.cluster) {
        pile.setCluster(s.cluster);
        wake();
      }
      if (s.lit !== prev.lit) wake();
    });
    pile.setCluster(useKeys.getState().cluster);
    // the stage harness (/dev/stage): "next" presses the next key
    let n = 0;
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<Partial<StageEventDetail>>).detail;
      if (d?.id !== "capabilities" || d.action !== "next") return;
      pile.pressKey(n++ % pile.count);
      wake();
    };
    window.addEventListener(STAGE_EVENT, onEvent);
    // the cursor wakes it (hover is picked in the frame)
    let px = -1;
    let py = -1;
    const offTick = onTick(() => {
      if (pointer.x !== px || pointer.y !== py) {
        px = pointer.x;
        py = pointer.y;
        h.setAnimating(true);
        h.invalidate();
      }
    });
    return () => {
      if (keysInput.sink) keysInput.sink = null;
      off();
      offTick();
      window.removeEventListener(STAGE_EVENT, onEvent);
    };
  }, [pile, h]);

  // ?debug=1&poster=1: the canonical still for scripts/posters.ts (the pile at rest, nothing hovered)
  const [still] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("debug") === "1" && q.get("poster") === "1";
  });

  useSceneFrame((dt, t) => {
    const top = governor.slotTop("capabilities");
    const local = !still && pointer.active && pointer.type !== "touch" && top !== null ? { x: pointer.x, y: pointer.y - top } : null;
    const inside = local && local.y >= 0 && local.y <= h.size.height && local.x >= 0 && local.x <= h.size.width ? local : null;
    h.setAnimating(pile.frame({ dt, time: t, camera: h.camera, width: h.size.width, height: h.size.height, pointer: inside, still }));
  });

  return <primitive object={pile.group} />;
}
