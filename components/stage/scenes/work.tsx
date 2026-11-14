"use client";

import { useLayoutEffect, useState } from "react";
import { STAGE_DATA_URL, type StageData } from "@/lib/hero";
import { projection, setProjector } from "@/lib/projection";
import { governor } from "@/lib/sceneManager";
import { TIERS } from "@/lib/tier";
import { useWork, workInput, WORK } from "@/lib/work";
import { STAGE_EVENT, type StageEventDetail } from "../events";
import { onThemeChange, useSceneFrame, useSceneHandle, useStagePost, type SceneProps } from "../scene-api";
import { Carousel, type CarouselData } from "../work/carousel";
import { loadImages } from "../shared/load-images";
import { drawPrint } from "../work/print";
import { createProjector } from "../work/projector";

/**
 * A4 · PROJECTS "WORK" (DESIGN.md §4.3 A4, §7.4): the slide carousel. The carousel itself is
 * components/stage/work/carousel.ts; this primes it (the slides from the stage data, every cover
 * decoded off the main thread at the tier's size, the mounts' print), mounts it through the
 * governor, takes the page's input (lib/work.ts workInput), mirrors the page's state into it (an
 * INDEX row points at a slide; the HTML layer brings one to the gate) and installs the PROJECTION.
 */
export async function prime(): Promise<CarouselData> {
  const stage = (await fetch(STAGE_DATA_URL).then((r) => r.json())) as StageData;
  let slides = stage.work.slides.slice(0, WORK.maxSlides);
  // ?debug=1&slides=8: the rail at A4's cap, the real slides repeated — for Gate C (never content)
  const q = new URLSearchParams(window.location.search);
  const cap = q.get("debug") === "1" ? Number(q.get("slides")) : 0;
  if (cap > slides.length && cap <= WORK.maxSlides && slides.length) slides = Array.from({ length: cap }, (_, i) => ({ ...(slides[i % slides.length] as (typeof slides)[number]), number: `${String(i + 1).padStart(2, "0")}/${String(cap).padStart(2, "0")}` }));
  const tier = governor.snapshot.tier;
  const size = tier ? TIERS[tier].covers : "dom";
  if (size === "dom") throw new Error("WORK: this tier draws no covers");
  const key = String(size.width) as keyof (typeof slides)[number]["covers"];
  const [pixels, print] = await Promise.all([loadImages({ urls: slides.map((s) => s.covers[key]), width: size.width, height: size.height }), drawPrint(slides, size.width)]);
  return { slides, pixels, width: size.width, height: size.height, print };
}

export default function WorkScene({ data }: SceneProps<CarouselData>) {
  const h = useSceneHandle();
  useStagePost();
  const [carousel] = useState(() => new Carousel(data));
  useLayoutEffect(() => () => carousel.dispose(), [carousel]);

  useLayoutEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    governor.dev.work = carousel;
    projection.trace ??= [];
    return () => {
      if (governor.dev.work === carousel) delete governor.dev.work;
    };
  }, [carousel]);

  useLayoutEffect(() => {
    carousel.applyTheme();
    return onThemeChange(() => {
      carousel.applyTheme();
      h.invalidate();
    });
  }, [carousel, h]);

  // the page's input and state into the rail; each wakes the stage for the frames it needs
  useLayoutEffect(() => {
    const wake = () => {
      h.setAnimating(true);
      h.invalidate();
    };
    workInput.sink = {
      down: (x, t) => (carousel.down(x, t), wake()),
      move: (x, t) => (carousel.move(x, t), wake()),
      up: (t) => {
        const click = carousel.up(t);
        wake();
        return click;
      },
      wheel: (dx, dy, shift, t) => {
        const moved = carousel.wheel(dx, dy, shift, t);
        if (moved) {
          // the layer keeps this wheel from the page (and the window's listeners): it's input all the same
          governor.noteActivity();
          wake();
        }
        return moved;
      },
      step: (dir) => (carousel.step(dir), wake()),
      to: (i) => (carousel.to(i), wake()),
    };
    const offStore = useWork.subscribe((s, prev) => {
      if (s.pointed !== prev.pointed) carousel.point(s.pointed);
      if (s.request && s.request !== prev.request) carousel.to(s.request.index);
      wake();
    });
    carousel.point(useWork.getState().pointed);
    // the stage harness (/dev/stage): "next" steps the rail
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<Partial<StageEventDetail>>).detail;
      if (d?.id !== "work" || d.action !== "next") return;
      carousel.to((carousel.gate + 1) % carousel.count);
      wake();
    };
    window.addEventListener(STAGE_EVENT, onEvent);
    const projector = createProjector(carousel, wake);
    setProjector(projector);
    return () => {
      if (workInput.sink) workInput.sink = null;
      offStore();
      window.removeEventListener(STAGE_EVENT, onEvent);
      setProjector(null);
      projector.dispose();
    };
  }, [carousel, h]);

  // ?debug=1&poster=1: the canonical still for scripts/posters.ts (slide 01 in the gate, at rest)
  const [still] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("debug") === "1" && q.get("poster") === "1";
  });

  useSceneFrame((dt, t) => {
    h.setFling(carousel.fling);
    h.setAnimating(carousel.frame({ dt, time: t, camera: h.camera, width: h.size.width, height: h.size.height, dpr: governor.snapshot.dpr, still }));
  });

  return <primitive object={carousel.group} />;
}
