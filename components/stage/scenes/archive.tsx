"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { SKY_LIMITS, useArchive } from "@/lib/archive";
import { cue } from "@/lib/cues";
import { STAGE_DATA_URL, type StageData } from "@/lib/hero";
import { pointer } from "@/lib/pointer";
import { governor } from "@/lib/sceneManager";
import { pinProgress } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";
import { Sky } from "../archive/sky";
import { onThemeChange, useSceneFrame, useSceneHandle, useStagePost, type SceneProps } from "../scene-api";

/**
 * A3 · RESEARCH "ARCHIVE" (DESIGN.md §4.3, §7.4): the citation constellation. The sky itself is
 * components/stage/archive/sky.ts; this mounts it through the governor (no render loop of its
 * own), mirrors the page's state into it (lib/archive.ts's store: the layout chip, a keyword
 * filter, the open record, what the ledger points at) and wakes it on scroll, pointer or state.
 */
interface Data {
  graph: StageData["graph"];
}

export async function prime(): Promise<Data> {
  // ?debug=1&sky=stress: a synthetic sky at the budget's caps, for Gate C and tuning (never content)
  const q = new URLSearchParams(window.location.search);
  if (q.get("debug") === "1" && q.get("sky") === "stress") {
    const { stressSky } = await import("../archive/stress");
    return { graph: stressSky() };
  }
  const stage = (await fetch(STAGE_DATA_URL).then((r) => r.json())) as StageData;
  // A3's budget is the content schema's too; a sky past it would fail the build first
  const graph = stage.graph;
  if (graph.nodes.length > SKY_LIMITS.nodes || graph.edges.length > SKY_LIMITS.edges) {
    throw new Error(`ARCHIVE: ${graph.nodes.length} nodes / ${graph.edges.length} edges is over A3's ${SKY_LIMITS.nodes} / ${SKY_LIMITS.edges}`);
  }
  return { graph };
}

export default function ArchiveScene({ data }: SceneProps<Data>) {
  const h = useSceneHandle();
  useStagePost();
  const [sky] = useState(() => new Sky(data.graph));
  useLayoutEffect(() => () => sky.dispose(), [sky]);

  useLayoutEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    governor.dev.archive = sky;
    return () => {
      if (governor.dev.archive === sky) delete governor.dev.archive;
    };
  }, [sky]);

  useLayoutEffect(() => {
    sky.applyTheme();
    return onThemeChange(() => {
      sky.applyTheme();
      h.invalidate();
    });
  }, [sky, h]);

  // the page's state, into the sky: a chip re-plots (with the plotter's servo), a keyword recedes the
  // rest, the open dossier is HOT, a ledger row lights its node
  useLayoutEffect(() => {
    const apply = (s: ReturnType<typeof useArchive.getState>, prev?: ReturnType<typeof useArchive.getState>) => {
      if (sky.setLayout(s.layout) && prev) cue("REPLOT");
      if (!prev || s.keyword !== prev.keyword) sky.setKeyword(s.keyword?.matches ?? null);
      if (!prev || s.hot !== prev.hot) sky.setHot(s.hot);
      if (!prev || s.pointed !== prev.pointed) sky.setPointed(s.pointed);
      h.setAnimating(true);
      h.invalidate();
    };
    apply(useArchive.getState());
    return useArchive.subscribe((s, prev) => apply(s, prev));
  }, [sky, h]);

  // ?debug=1&poster=1: a still (the poster itself is the build-time SVG, scripts/posters.ts)
  const [still] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("debug") === "1" && q.get("poster") === "1";
  });

  // wake on scroll or the cursor
  useLayoutEffect(() => {
    let p = -1;
    let x = -1;
    let y = -1;
    return onTick(() => {
      const np = pinProgress("archive");
      if (np !== p || pointer.x !== x || pointer.y !== y) {
        p = np;
        x = pointer.x;
        y = pointer.y;
        h.setAnimating(true);
        h.invalidate();
      }
    });
  }, [h]);

  const focused = useRef(-1);
  useSceneFrame((dt, t) => {
    const top = governor.slotTop("archive");
    const local = pointer.active && pointer.type !== "touch" && top !== null ? { x: pointer.x, y: pointer.y - top } : null;
    const inside = local && local.y >= 0 && local.y <= h.size.height && local.x >= 0 && local.x <= h.size.width ? local : null;
    h.setAnimating(sky.frame({ dt, time: t, camera: h.camera, width: h.size.width, height: h.size.height, progress: pinProgress("archive"), pointer: inside, top: top ?? 0, still }));
    // the HTML readout follows the stage's focus (one store write per change, not per frame)
    if (sky.focused !== focused.current) {
      focused.current = sky.focused;
      useArchive.getState().setFocused(sky.focused >= 0 ? sky.focused : null);
    }
  });

  return <primitive object={sky.group} />;
}
