import { ditherGrid, ditherSprite } from "@/lib/dither";
import { signature } from "@/lib/motion";
import { onCommit, routeTo } from "@/lib/navigation";
import { projection, traceProjection as trace, type Projector } from "@/lib/projection";
import { governor } from "@/lib/sceneManager";
import { teleport } from "@/lib/scroll";
import { onTick } from "@/lib/ticker";
import { WORK } from "@/lib/work";
import type { Carousel } from "./carousel";

type Rect = { top: number; height: number };

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** The carousel's slot on the page now (one layout read, at a transition's start). */
function bandRect(): Rect | null {
  const el = document.querySelector<HTMLElement>('[data-stage-slot="work"]');
  const r = el?.getBoundingClientRect();
  return r && r.height > 0 ? { top: r.top, height: r.height } : null;
}

/**
 * While the stage holds the viewport, the page still shows outside the union of the carousel's
 * band and the flying window: the takeover layer is clipped to it, a style write per frame.
 */
function clipTo(el: HTMLElement, band: Rect | null, fly: { x: number; y: number; w: number; h: number } | null): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = band ? band.top : 0;
  let bottom = band ? band.top + band.height : vh;
  let left = 0;
  let right = vw;
  if (fly) {
    top = Math.min(top, fly.y);
    bottom = Math.max(bottom, fly.y + fly.h);
    left = Math.min(left, fly.x);
    right = Math.max(right, fly.x + fly.w);
  }
  el.style.clipPath = `inset(${Math.max(0, top)}px ${Math.max(0, vw - right)}px ${Math.max(0, vh - bottom)}px ${Math.max(0, left)}px)`;
}

/**
 * The stage lets go (§3.6: continuity resolves): the takeover layer leaves cell by cell through the
 * element tier's Bayer sprite, run backwards, uncovering the DOM hero — the same picture, sharper.
 */
async function letGo(el: HTMLElement): Promise<void> {
  const E = signature.resolve.element;
  const grid = ditherGrid(window.innerWidth, window.innerHeight);
  let url: string;
  try {
    url = await ditherSprite(grid, { x: 0.5, y: 0.5 });
  } catch {
    return;
  }
  const frameW = grid.cols * grid.cell;
  const size = `${frameW * (E.steps + 1)}px ${grid.rows * grid.cell}px`;
  const all = `${-frameW * E.steps}px 0px`;
  Object.assign(el.style, { maskImage: `url(${url})`, maskSize: size, maskRepeat: "no-repeat", maskPosition: all, webkitMaskImage: `url(${url})`, webkitMaskSize: size, webkitMaskRepeat: "no-repeat", webkitMaskPosition: all });
  const anim = el.animate([{ maskPosition: all, webkitMaskPosition: all }, { maskPosition: "0px 0px", webkitMaskPosition: "0px 0px" }] as Keyframe[], { duration: E.ms, easing: `steps(${E.steps}, end)`, fill: "forwards" });
  await anim.finished.catch(() => undefined);
  anim.cancel();
  for (const p of ["maskImage", "maskSize", "maskRepeat", "maskPosition", "webkitMaskImage", "webkitMaskSize", "webkitMaskRepeat", "webkitMaskPosition"] as const) el.style[p] = "";
}

/**
 * PROJECTION (DESIGN.md §7.4 WORK), the stage's half. Out: the stage takes the viewport (the
 * governor's takeover; the page shows around the band and the growing window), the slide in the
 * gate flies until its window covers the viewport, the route swaps under it and scrolls to the
 * top, the case study's DOM hero decodes, and the stage lets go. The scene stays resident (a hold)
 * while you read. Back: the stage takes the viewport with the slide still covering it, the route
 * and the scroll go back under it, and the slide flies home to the gate.
 */
export function createProjector(carousel: Carousel, wake: () => void): Projector & { dispose(): void } {
  const layer = () => document.getElementById("stage-takeover");
  let hold: (() => void) | null = null;
  let projected: string | null = null;
  let busy = false;
  // leaving the case studies by any other way: nothing to fly home to, so the scene needn't stay
  const offCommit = onCommit((path) => {
    trace(`commit ${path} busy=${busy} held=${!!hold}`);
    if (busy || path.startsWith("/work/")) return;
    hold?.();
    hold = null;
    projected = null;
  });

  const finish = (el: HTMLElement, release: () => void) => {
    el.hidden = true;
    el.style.clipPath = "";
    release();
    carousel.setBand(null);
    busy = false;
    projection.active = false;
    wake();
  };

  return {
    async forward(slug, href) {
      const i = carousel.slides.findIndex((s) => s.slug === slug);
      const el = layer();
      const band = bandRect();
      if (busy || i < 0 || !el || !band) return false;
      const release = governor.takeover("work", el);
      trace(`forward ${slug} takeover=${!!release}`);
      if (!release) return false;
      busy = true;
      projection.active = true;
      hold?.();
      hold = governor.hold("work");
      carousel.setBand(band);
      clipTo(el, band, null);
      el.hidden = false;
      wake();
      const offClip = onTick(() => clipTo(el, band, carousel.flyRect()));
      // a flight is frames the stage must draw: wake it as it starts (its first frame may have been at rest)
      const out = carousel.fly(i, 1);
      wake();
      await out;
      trace("flown");
      offClip();
      el.style.clipPath = "";
      await routeTo(href);
      teleport(0);
      // the hand-off waits for the DOM hero (or gives up after holdMaxMs), then lets go
      const img = document.querySelector<HTMLImageElement>("[data-projection-hero] img");
      await Promise.race([img ? img.decode().catch(() => undefined) : Promise.resolve(), sleep(WORK.projection.holdMaxMs)]);
      await letGo(el);
      projected = slug;
      // the rail rests with this slide in the gate: Back flies it out again (hold) and home; any
      // other way back finds the rail at rest, not a picture stuck over it
      carousel.settle(i);
      finish(el, release);
      return true;
    },

    canReverse(slug) {
      const ok = !busy && projected === slug && !!layer() && governor.snapshot.scenes.work.drawable;
      trace(`canReverse ${slug} → ${ok} (busy=${busy} projected=${projected} state=${governor.snapshot.scenes.work.state} drawable=${governor.snapshot.scenes.work.drawable})`);
      return ok;
    },

    async reverse(slug, restore) {
      const i = carousel.slides.findIndex((s) => s.slug === slug);
      const el = layer();
      const release = el && i >= 0 ? governor.takeover("work", el) : null;
      trace(`reverse ${slug} takeover=${!!release}`);
      if (!el || !release) {
        await restore();
        return;
      }
      busy = true;
      projection.active = true;
      carousel.setBand(null);
      carousel.hold(i);
      el.style.clipPath = "";
      el.hidden = false;
      wake();
      await restore();
      const band = bandRect();
      trace(`restored y=${Math.round(window.scrollY)} band=${band ? Math.round(band.top) : null}`);
      carousel.setBand(band);
      const offClip = onTick(() => clipTo(el, band, carousel.flyRect()));
      const home = carousel.fly(i, 0);
      wake();
      await home;
      trace("home");
      offClip();
      projected = null;
      hold?.();
      hold = null;
      finish(el, release);
    },

    dispose() {
      offCommit();
      hold?.();
      hold = null;
    },
  };
}
