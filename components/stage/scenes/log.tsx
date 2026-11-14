"use client";

import { useLayoutEffect, useState } from "react";
import { LinearFilter, LinearMipmapLinearFilter, NoColorSpace, Texture } from "three";
import { STAGE_DATA_URL, type StageData } from "@/lib/hero";
import { LOG } from "@/lib/log";
import { pointer } from "@/lib/pointer";
import { governor } from "@/lib/sceneManager";
import { pinProgress } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";
import { LogDeck, type DeckCard } from "../log/deck";
import { onThemeChange, useSceneFrame, useSceneHandle, useStagePost, type SceneProps } from "../scene-api";

/**
 * A2 · EXPERIENCE "LOG" (DESIGN.md §4.3, §7.4): the punch-card rail. The deck and its light are
 * components/stage/log/deck.ts; this mounts it through the governor (no render loop of its own)
 * and keeps it on demand: it declares itself animating only while the camera or a card is still
 * moving, and a ticker watch wakes it when the pin's progress or the cursor changes.
 */
interface Data {
  atlas: ImageBitmap;
  cards: DeckCard[];
}

export async function prime(): Promise<Data> {
  const [stage, blob] = await Promise.all([fetch(STAGE_DATA_URL).then((r) => r.json() as Promise<StageData>), fetch(LOG.atlas.url).then((r) => r.blob())]);
  // the atlas is data (stock and ink masks), not color: decoded as is, alpha unpremultiplied
  const atlas = await createImageBitmap(blob, { premultiplyAlpha: "none", colorSpaceConversion: "none", imageOrientation: "none" });
  return { atlas, cards: stage.log.cards };
}

export default function LogScene({ data }: SceneProps<Data>) {
  const h = useSceneHandle();
  useStagePost();
  const [deck] = useState(() => {
    const tex = new Texture(data.atlas);
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.colorSpace = NoColorSpace;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return new LogDeck(tex, data.cards);
  });
  useLayoutEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    governor.dev.log = deck;
    return () => {
      if (governor.dev.log === deck) delete governor.dev.log;
    };
  }, [deck]);
  useLayoutEffect(() => () => deck.dispose(), [deck]);

  useLayoutEffect(() => {
    deck.applyTheme();
    return onThemeChange(() => {
      deck.applyTheme();
      h.invalidate();
    });
  }, [deck, h]);

  // ?debug=1&poster=1: the poster capture (scripts/posters.ts) — the first card, still
  const [still] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("debug") === "1" && q.get("poster") === "1";
  });

  // on demand: wake when the pin moves or the cursor does
  useLayoutEffect(() => {
    let p = -1;
    let x = -1;
    let y = -1;
    return onTick(() => {
      const np = pinProgress("log");
      if (np !== p || pointer.nx !== x || pointer.ny !== y) {
        p = np;
        x = pointer.nx;
        y = pointer.ny;
        h.setAnimating(true);
        h.invalidate();
      }
    });
  }, [h]);

  useSceneFrame((dt) => {
    h.setAnimating(deck.frame({ dt, camera: h.camera, still }));
  });

  return <primitive object={deck.group} />;
}
