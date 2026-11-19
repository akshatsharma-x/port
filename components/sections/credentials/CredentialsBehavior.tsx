"use client";

import { useEffect, useRef } from "react";
import { CRED, lampAt, lampFromTilt } from "@/lib/credentials";
import { cue } from "@/lib/cues";
import { cssEase, duration, itemDelays, springLinear, springs } from "@/lib/motion";
import { Spring } from "@/lib/spring";
import { onTick } from "@/lib/ticker";

export interface BehaviorLabels {
  of: string;
  shown: string;
  tilt: { ask: string; on: string; denied: string };
  total: number;
}

const reduced = () => document.documentElement.dataset.motion === "reduce";
const fine = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const LAMP_VARS = ["--mx", "--my", "--cred-rx", "--cred-ry", "--tilt-mag", "--shadow-x", "--shadow-y", "--shadow-blur"] as const;

/** The lamp on an element: one write of its variables (the frame's only style write for it). */
function writeLamp(el: HTMLElement, mx: number, my: number, rx: number, ry: number, max: number): void {
  const mag = Math.min(1, Math.hypot(rx, ry) / max);
  const T = CRED.tilt;
  el.style.setProperty("--mx", mx.toFixed(4));
  el.style.setProperty("--my", my.toFixed(4));
  el.style.setProperty("--cred-rx", `${rx.toFixed(3)}deg`);
  el.style.setProperty("--cred-ry", `${ry.toFixed(3)}deg`);
  el.style.setProperty("--tilt-mag", mag.toFixed(4));
  el.style.setProperty("--shadow-x", `${((0.5 - mx) * T.shadow).toFixed(2)}px`);
  el.style.setProperty("--shadow-y", `${((0.5 - my) * T.shadow + T.lift).toFixed(2)}px`);
  el.style.setProperty("--shadow-blur", `${(T.blur + T.blurPerTilt * mag).toFixed(2)}px`);
}
const restLamp = (el: HTMLElement) => {
  for (const v of LAMP_VARS) el.style.removeProperty(v);
};

/**
 * The one lamp over a set of cards (§4.4): the pointer's place over a card tilts it on `tilt`
 * springs (rotateX/Y to `max`), moves its foil and its shadow. Pointer events only set targets; the
 * single tick writes. At most CRED.liveFoil cards are live — the hovered one and the one settling —
 * and a third snaps the oldest settling one to rest; will-change only while live, and 300 ms after.
 */
function tiltEngine(container: HTMLElement, selector: string, max: number): () => void {
  interface Live {
    el: HTMLElement;
    mx: Spring;
    my: Spring;
    rx: Spring;
    ry: Spring;
    over: boolean;
  }
  const lives = new Map<HTMLElement, Live>();
  const linger = new Map<HTMLElement, number>();
  let stop: (() => void) | null = null;
  const retire = (l: Live) => {
    lives.delete(l.el);
    restLamp(l.el);
    l.el.removeAttribute("data-live");
    window.clearTimeout(linger.get(l.el));
    linger.set(
      l.el,
      window.setTimeout(() => {
        l.el.style.willChange = "";
      }, CRED.willChangeLingerMs),
    );
  };
  const tick = (dt: number) => {
    for (const l of lives.values()) {
      l.mx.step(dt);
      l.my.step(dt);
      l.rx.step(dt);
      l.ry.step(dt);
      if (!l.over && l.rx.isSettled(0.01) && l.ry.isSettled(0.01) && l.mx.isSettled(1e-4) && l.my.isSettled(1e-4)) retire(l);
      else writeLamp(l.el, l.mx.value, l.my.value, l.rx.value, l.ry.value, max);
    }
    if (!lives.size) {
      stop?.();
      stop = null;
    }
  };
  const aim = (l: Live, e: PointerEvent) => {
    const r = l.el.getBoundingClientRect();
    const p = lampAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, max);
    l.mx.setTarget(p.mx);
    l.my.setTarget(p.my);
    l.rx.setTarget(p.rx);
    l.ry.setTarget(p.ry);
    stop ??= onTick(tick);
  };
  const live = (el: HTMLElement): Live => {
    let l = lives.get(el);
    if (l) return l;
    if (lives.size >= CRED.liveFoil) {
      const oldest = [...lives.values()].find((x) => !x.over) ?? [...lives.values()][0];
      if (oldest) retire(oldest);
    }
    l = { el, mx: new Spring(springs.tilt, CRED.rest.mx), my: new Spring(springs.tilt, CRED.rest.my), rx: new Spring(springs.tilt, 0), ry: new Spring(springs.tilt, 0), over: true };
    lives.set(el, l);
    window.clearTimeout(linger.get(el));
    el.style.willChange = "transform";
    el.setAttribute("data-live", "");
    return l;
  };
  const target = (e: PointerEvent) => (e.pointerType === "mouse" ? ((e.target as Element | null)?.closest<HTMLElement>(selector) ?? null) : null);
  let current: HTMLElement | null = null;
  const onMove = (e: PointerEvent) => {
    const el = target(e);
    if (el !== current && current) {
      const was = lives.get(current);
      if (was) {
        was.over = false;
        was.mx.setTarget(CRED.rest.mx);
        was.my.setTarget(CRED.rest.my);
        was.rx.setTarget(0);
        was.ry.setTarget(0);
      }
    }
    current = el;
    if (el) {
      const l = live(el);
      l.over = true;
      aim(l, e);
    } else stop ??= onTick(tick);
  };
  const onLeave = () => onMove(new PointerEvent("pointermove", { pointerType: "mouse" }));
  container.addEventListener("pointermove", onMove);
  container.addEventListener("pointerleave", onLeave);
  return () => {
    container.removeEventListener("pointermove", onMove);
    container.removeEventListener("pointerleave", onLeave);
    stop?.();
    for (const l of lives.values()) restLamp(l.el);
    for (const t of linger.values()) window.clearTimeout(t);
  };
}

/**
 * CREDENTIALS' behaviour (DESIGN.md §4.4 B1/B2, §7.4), loaded on idle over the server's wall and
 * records: the lamp, the turn (click or Enter; Escape turns back), the chips' hand-rolled FLIP (§10
 * #37), the deal (once, from the wall's bottom-right in an arc, the stamps landing with it), the
 * phones' TILT TO INSPECT, and the records' 6° tilt. Reduced motion: no tilt, the foil at rest,
 * turns at once, no deal.
 */
export default function CredentialsBehavior({ labels }: { labels: BehaviorLabels }) {
  const mark = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const scope = mark.current?.parentElement;
    if (!scope) return;
    const root = scope.querySelector<HTMLElement>("[data-cred-root]");
    const records = scope.querySelector<HTMLElement>(".records");
    const offs: (() => void)[] = [];
    const still = reduced();
    const turnEase = springLinear(springs.tilt);
    const deal = springLinear(springs.overshoot);

    if (root) {
      const wall = root.querySelector<HTMLElement>(".cred-wall");
      const cards = [...root.querySelectorAll<HTMLElement>(".cred")];
      root.style.setProperty("--turn-ms", `${turnEase.ms}ms`);
      root.style.setProperty("--turn-ease", turnEase.easing);

      // ── the turn ─────────────────────────────────────────────────────────────────────────
      const backLinks = (li: HTMLElement) => li.querySelectorAll<HTMLElement>(".cred-back a");
      for (const li of cards) for (const a of backLinks(li)) a.tabIndex = -1;
      const turn = (li: HTMLElement, on: boolean) => {
        if (li.hasAttribute("data-flipped") === on) return;
        li.toggleAttribute("data-flipped", on);
        li.querySelector(".cred-flip")?.setAttribute("aria-pressed", String(on));
        for (const a of backLinks(li)) a.tabIndex = on ? 0 : -1;
        cue("FLIP");
      };
      // the button over the card turns it; turned, the back takes the pointer (its links above all),
      // and a click anywhere on it but a link turns it back — a face on another 3D plane can't be
      // lifted over the button by z-index
      const onClick = (e: MouseEvent) => {
        const t = e.target as Element | null;
        if (t?.closest("a")) return;
        const li = t?.closest<HTMLElement>(".cred-flip, .cred[data-flipped] .cred-back")?.closest<HTMLElement>(".cred");
        if (li) turn(li, !li.hasAttribute("data-flipped"));
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        const li = (e.target as Element | null)?.closest<HTMLElement>(".cred[data-flipped]");
        if (!li) return;
        turn(li, false);
        li.querySelector<HTMLElement>(".cred-flip")?.focus();
      };
      root.addEventListener("click", onClick);
      root.addEventListener("keydown", onKey);
      offs.push(() => {
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onKey);
      });

      // ── the chips: one value per group; the cards that stay FLIP to their places ───────────
      const bar = root.querySelector<HTMLElement>(".cred-filters");
      const count = root.querySelector<HTMLElement>("[data-cred-count]");
      const none = root.querySelector<HTMLElement>("[data-cred-none]");
      const chosen: Record<string, string> = { issuer: "", domain: "", level: "" };
      const apply = () => {
        const before = new Map(cards.filter((c) => !c.hidden).map((c) => [c, c.getBoundingClientRect()]));
        let shown = 0;
        for (const c of cards) {
          const ok = Object.entries(chosen).every(([k, v]) => !v || c.dataset[k] === v);
          c.hidden = !ok;
          if (ok) shown++;
        }
        if (count) count.textContent = shown === labels.total ? "" : `${shown} ${labels.of} ${labels.total} ${labels.shown}`;
        if (none) none.hidden = shown > 0;
        if (reduced()) return;
        const ms = duration.element.in;
        for (const c of cards) {
          if (c.hidden) continue;
          const was = before.get(c);
          if (!was) {
            c.animate([{ opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1 }], { duration: ms, easing: cssEase("settle") });
            continue;
          }
          const now = c.getBoundingClientRect();
          const dx = was.left - now.left;
          const dy = was.top - now.top;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) c.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: ms, easing: cssEase("settle") });
        }
      };
      const onChip = (e: MouseEvent) => {
        const b = (e.target as Element | null)?.closest<HTMLButtonElement>("button[data-filter]");
        if (!b) return;
        const key = b.dataset.filter ?? "";
        chosen[key] = b.dataset.value ?? "";
        for (const c of bar?.querySelectorAll<HTMLButtonElement>(`button[data-filter="${key}"]`) ?? []) {
          const on = (c.dataset.value ?? "") === chosen[key];
          c.setAttribute("aria-pressed", String(on));
          const m = c.querySelector("[aria-hidden]");
          if (m) m.textContent = on ? "■" : "□";
        }
        apply();
      };
      bar?.addEventListener("click", onChip);
      offs.push(() => bar?.removeEventListener("click", onChip));

      // ── the lamp: the pointer's, or on a phone the device's once asked for ─────────────────
      if (!still && fine()) offs.push(tiltEngine(root, ".cred", CRED.tilt.max));
      const chip = root.querySelector<HTMLButtonElement>("[data-cred-tilt]");
      const Orientation = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (chip && !still && !fine() && Orientation) {
        chip.hidden = false;
        const seen = new Map<HTMLElement, number>();
        const io = new IntersectionObserver((es) => es.forEach((en) => seen.set(en.target as HTMLElement, en.intersectionRatio)), { threshold: [0, 0.25, 0.5, 0.75, 1] });
        for (const c of cards) io.observe(c);
        let base: number | null = null;
        let lamp: { mx: number; my: number } = { mx: CRED.rest.mx, my: CRED.rest.my };
        let lit: HTMLElement[] = [];
        let stopTick: (() => void) | null = null;
        const onOrient = (e: DeviceOrientationEvent) => {
          if (e.beta === null || e.gamma === null) return;
          base ??= e.beta;
          lamp = lampFromTilt(e.beta - base, e.gamma);
          stopTick ??= onTick(() => {
            // the (at most two) cards most in view catch the light; the rest stay at rest
            const next = [...seen.entries()].filter(([, r]) => r > 0).sort((a, b) => b[1] - a[1]).slice(0, CRED.liveFoil).map(([el]) => el);
            for (const el of lit) if (!next.includes(el)) restLamp(el);
            lit = next;
            for (const el of lit) writeLamp(el, lamp.mx, lamp.my, 0, 0, CRED.tilt.max);
            stopTick?.();
            stopTick = null;
          });
        };
        const ask = async () => {
          let ok = true;
          if (typeof Orientation.requestPermission === "function") ok = (await Orientation.requestPermission().catch(() => "denied")) === "granted";
          if (!ok) {
            chip.textContent = labels.tilt.denied;
            chip.disabled = true;
            return;
          }
          chip.textContent = labels.tilt.on;
          chip.setAttribute("aria-pressed", "true");
          chip.disabled = true;
          window.addEventListener("deviceorientation", onOrient);
        };
        chip.addEventListener("click", ask, { once: true });
        offs.push(() => {
          chip.removeEventListener("click", ask);
          io.disconnect();
          window.removeEventListener("deviceorientation", onOrient);
          stopTick?.();
          for (const el of lit) restLamp(el);
        });
      }

      // ── the deal: once, as the wall comes into view; never if it's already there ──────────
      if (wall && !still && wall.getBoundingClientRect().top > window.innerHeight) {
        wall.setAttribute("data-deal", "armed");
        const io = new IntersectionObserver(
          (es) => {
            if (!es.some((en) => en.isIntersecting)) return;
            io.disconnect();
            const shown = cards.filter((c) => !c.hidden);
            const W = wall.getBoundingClientRect();
            const dealer = { x: W.left + W.width * CRED.deal.from.x, y: W.top + W.height * CRED.deal.from.y };
            const rects = shown.map((c) => c.getBoundingClientRect());
            const delays = itemDelays(
              rects.map((r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })),
              dealer,
              "deal",
            );
            const settle = cssEase("settle");
            wall.removeAttribute("data-deal");
            shown.forEach((li, i) => {
              const r = rects[i] as DOMRect;
              const delay = delays[i] ?? 0;
              const card = li.querySelector<HTMLElement>(".cred-card");
              const stamp = li.querySelector<HTMLElement>(".cred-stamp");
              // x on the overshoot spring and y on settle — the two eases make the arc — the turn on overshoot
              li.animate([{ translate: `${dealer.x - (r.left + r.width / 2)}px 0` }, { translate: "0 0" }], { duration: deal.ms, delay, easing: deal.easing, fill: "backwards" });
              li.animate([{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1 }], { duration: deal.ms, delay, fill: "backwards" });
              card?.animate([{ translate: `0 ${dealer.y - (r.top + r.height / 2)}px` }, { translate: "0 0" }], { duration: deal.ms, delay, easing: settle, fill: "backwards" });
              card?.animate([{ rotate: `${CRED.deal.turnDeg}deg` }, { rotate: "0deg" }], { duration: deal.ms, delay, easing: deal.easing, fill: "backwards" });
              if (!stamp) return;
              const at = delay + deal.ms * CRED.deal.stampAt;
              stamp.animate([{ scale: CRED.deal.stampScale, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: deal.ms, delay: at, easing: deal.easing, fill: "backwards" });
              // the thud on the audio clock, from the same moment the stamp's animation starts on the
              // compositor's: a timer would land late by however long the main thread was busy
              if (li.dataset.stamp === "verified" || li.dataset.stamp === "expired") cue("STAMP", { delayMs: at + deal.reachMs });
            });
          },
          { threshold: 0.15 },
        );
        io.observe(wall);
        offs.push(() => io.disconnect());
      }
    }

    // ── the records: the lamp at 6°, no foil ──────────────────────────────────────────────────
    if (records && !still && fine()) offs.push(tiltEngine(records, ".record", CRED.tilt.record));

    return () => {
      for (const off of offs) off();
    };
  }, [labels]);

  return <span ref={mark} hidden />;
}
