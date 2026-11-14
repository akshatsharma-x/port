import { gsap } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import type { SplitText as SplitTextType } from "gsap/SplitText";
import { bezier, duration, ease, EASE_NAMES, sec } from "./motion";

/**
 * GSAP owns time (gsap.ticker runs the one RAF) and tweens. Importing this module (client only)
 * registers the DESIGN.md easing tokens once — as plain functions through gsap.registerEase, so
 * `ease: "settle"` works everywhere without the CustomEase plugin.
 *
 * First-load JS carries GSAP core only (DESIGN.md §8.3). The scroll layer tracks sections and
 * pins natively (lib/scroll.ts); ScrollTrigger is a lazy chunk for scrubbed timelines, and
 * SplitText streams in on first use.
 */
let ready = false;

export function setupGsap(): void {
  if (ready || typeof window === "undefined") return;
  for (const name of EASE_NAMES) gsap.registerEase(name, bezier(ease[name]));
  gsap.ticker.lagSmoothing(0);
  gsap.defaults({ ease: "settle", duration: sec(duration.element.in) });
  ready = true;
}

setupGsap();

let splitText: Promise<typeof SplitTextType> | null = null;

/** Lazily loads and registers SplitText (cached). */
export function loadSplitText(): Promise<typeof SplitTextType> {
  splitText ??= import("gsap/SplitText").then(({ SplitText }) => {
    gsap.registerPlugin(SplitText);
    return SplitText;
  });
  return splitText;
}

type ScrollTriggerReady = (st: typeof ScrollTriggerType) => void;
let scrollTrigger: Promise<typeof ScrollTriggerType> | null = null;
const onScrollTrigger = new Set<ScrollTriggerReady>();

/** The scroll layer hooks in here, so a ScrollTrigger loaded later updates on the one RAF. */
export function whenScrollTrigger(cb: ScrollTriggerReady): () => void {
  onScrollTrigger.add(cb);
  return () => onScrollTrigger.delete(cb);
}

/** Lazily loads and registers ScrollTrigger (cached) — for scrubbed timelines in later parts. */
export function loadScrollTrigger(): Promise<typeof ScrollTriggerType> {
  scrollTrigger ??= import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
    gsap.registerPlugin(ScrollTrigger);
    for (const cb of onScrollTrigger) cb(ScrollTrigger);
    return ScrollTrigger;
  });
  return scrollTrigger;
}

export { gsap };
