import { cue } from "./cues";
import { degauss as D } from "./motion";
import { POWER } from "./timelines";

/**
 * The Konami code (DESIGN.md §3.6): a full-screen degauss — the one ungrammatical motion, allowed
 * because it's hidden. The raster (the page and the chrome) twists and shears as the coil's field
 * rings down, a band of hue crosses the screen turning a full circle, and the hum runs under both.
 * Any input ends it at once. Paper has no shadow mask to magnetize (§5.4): the sheet only shakes.
 * Reduced motion: no wobble and no sweep — the tint comes and goes where it is. A lazy chunk: the
 * launcher imports it when the code completes.
 */
let running: (() => void) | null = null;

const ringDown = (): Keyframe[] =>
  Array.from({ length: D.samples + 1 }, (_, i) => {
    const t = i / D.samples;
    const a = Math.exp((-t * D.ms) / D.tauMs) * Math.sin(t * D.wobbleCycles * 2 * Math.PI);
    return { offset: t, transform: `rotate(${(a * D.rotateDeg).toFixed(3)}deg) skewX(${(a * D.skewDeg).toFixed(3)}deg) scale(${(1 + a * D.scale).toFixed(4)})` };
  });

const INPUTS = ["keydown", "pointerdown", "wheel", "touchstart"] as const;

export function degauss(): void {
  running?.();
  const html = document.documentElement;
  const reduced = html.dataset.motion === "reduce";
  const paper = html.dataset.theme === "paper";
  cue("DEGAUSS");
  const anims: Animation[] = [];
  if (!reduced) {
    for (const el of [document.getElementById("screen"), document.getElementById("hud")]) if (el) anims.push(el.animate(ringDown(), { duration: D.ms, easing: "linear" }));
  }
  let veil: HTMLElement | null = null;
  if (!paper) {
    veil = document.createElement("div");
    veil.className = "fx-degauss";
    veil.setAttribute("aria-hidden", "true");
    document.body.append(veil);
    const hue = (deg: number, sat = 1) => `hue-rotate(${deg}deg) saturate(${sat})`;
    anims.push(
      reduced
        ? veil.animate([{ backdropFilter: hue(0), maskPosition: "50% 0", opacity: 0 }, { backdropFilter: hue(180, D.saturate), maskPosition: "50% 0", opacity: 1 }, { backdropFilter: hue(180, D.saturate), maskPosition: "50% 0", opacity: 0 }], { duration: POWER.reducedMs * 2, easing: "linear" })
        : veil.animate([{ backdropFilter: hue(0), maskPosition: "-60% 0" }, { backdropFilter: hue(360, D.saturate), maskPosition: "160% 0" }], { duration: D.sweepMs, easing: "linear" }),
    );
  }
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    for (const a of anims) a.cancel();
    veil?.remove();
    for (const t of INPUTS) window.removeEventListener(t, end, true);
    running = null;
  };
  // input interrupts (law 7): anything the visitor does ends it at once
  for (const t of INPUTS) window.addEventListener(t, end, { capture: true, passive: true });
  void Promise.all(anims.map((a) => a.finished)).then(end, end);
  if (!anims.length) end();
  running = end;
}
