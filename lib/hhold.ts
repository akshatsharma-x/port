import { springs } from "./motion";
import { Spring } from "./spring";
import { onTick } from "./ticker";

/**
 * H-HOLD (DESIGN.md §3.7): display type "loses horizontal hold". At a TRACKING TEAR's cut, wdth
 * jumps to 125, then springs back to its base on `overshoot`. Opt-in with `data-hhold` — only on
 * single-line display/mega headings in fixed-width boxes, so nothing around them reflows — and at
 * most three in view. (Mega already sits at wdth 125, so it jumps to 100 instead.)
 */
export const HHOLD = { maxInView: 3, peak: 125, megaPeak: 100, settleEpsilon: 0.05 } as const;

export function hhold(): number {
  if (typeof document === "undefined" || document.documentElement.dataset.motion === "reduce") return 0;
  const vh = window.innerHeight;
  const inView = [...document.querySelectorAll<HTMLElement>("[data-hhold]")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && r.width > 0;
    })
    .slice(0, HHOLD.maxInView);
  for (const el of inView) {
    el.style.removeProperty("--t-wdth");
    const base = Number.parseFloat(getComputedStyle(el).fontStretch) || 100;
    const peak = base < HHOLD.peak ? HHOLD.peak : HHOLD.megaPeak;
    const spring = new Spring(springs.overshoot, peak).setTarget(base);
    el.style.setProperty("--t-wdth", `${peak}%`);
    const off = onTick((dt) => {
      const v = spring.step(dt);
      if (spring.isSettled(HHOLD.settleEpsilon)) {
        el.style.removeProperty("--t-wdth");
        off();
        return;
      }
      el.style.setProperty("--t-wdth", `${v.toFixed(2)}%`);
    });
  }
  return inView.length;
}
