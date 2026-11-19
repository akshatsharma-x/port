import { damp } from "./damp";
import { followers } from "./motion";
import { onTick } from "./ticker";

/**
 * The reticle's behaviour (DESIGN.md §7.3), loaded after idle or at the pointer's first move
 * (components/chrome/Cursor.tsx draws its markup). Out of first-load JS since Part 16: until it runs
 * the native cursor shows (data-reticle is off), so loading it late is never "no cursor" — and
 * first load had 0.03 KB left on this machine and none on CI's, which builds 0.27 KB larger.
 */
export interface CursorLabels {
  view: string;
  drag: string;
  flip: string;
  open: string;
}

const NOOP = () => {};

/** brackets sit this far outside a snapped element */
const SNAP_PAD = 4;
/** the reticle's size at rest, CSS px */
const RETICLE = 10;
/** a bracket's arm, CSS px (styles/chrome.css: a corner's box) */
const ARM = 5;
/** what the ring snaps to as brackets (media — data-cursor — gets the chip, not brackets) */
const INTERACTIVE = "a[href], button, [role='button'], [role='switch'], [role='tab'], summary, label, select, input[type='radio'], input[type='checkbox']";
/** never bracket something that is most of the screen (a full-bleed link): the reticle stays */
const MAX_SNAP = 0.6;
const TEXT_FIELD = "input:not([type='radio']):not([type='checkbox']):not([type='button']):not([type='submit']), textarea, [contenteditable='true'], [contenteditable='']";

/**
 * Starts the reticle on its markup; returns the stop. `at`: the position of the move that loaded it.
 */
export function startCursor(
  { dot, ring, chip }: { dot: HTMLElement; ring: HTMLElement; chip: HTMLElement },
  labels: CursorLabels,
  at?: { x: number; y: number },
): () => void {
  const html = document.documentElement;
  // the brackets: each corner anchored at the ring's top-left and placed by transform, so a ring that
  // grows to a control never moves a corner in layout (Part 16: anchored right and bottom, they were
  // a layout shift every frame of a snap, 0.0000018 once the reticle showed)
  const [, tr, bl, br] = [...ring.children] as (HTMLElement | undefined)[];
  if (!tr || !bl || !br) return NOOP;
  const fine = matchMedia("(pointer: fine)");
  const forced = matchMedia("(forced-colors: active)");
  if (!fine.matches || forced.matches) return NOOP;
  // data-reticle on <html> while the reticle is drawn: the one flag both cursors read
  // (styles/chrome.css), so the reticle shows and the native cursor hides together, and one of the
  // two is always on screen. It's off until the pointer first moves (a pointer that hasn't moved
  // since the load keeps the native cursor), over a text field or a modal dialog, and off the
  // window (Part 16: a second flag, data-hidden, hid the reticle without bringing the native cursor
  // back, so a stale one — a dossier closed under a still pointer — left no cursor at all)
  // The flag is written after the next paint, never in the event: it restyles the whole page (its
  // rule reaches every element), and in the event it landed inside the click that followed — the
  // visit's first click waited 31 ms at 4× CPU (5 without it; scripts/audit/inp.mjs). Waiting is
  // safe: whichever state is on screen meanwhile shows a cursor (off, the native one; on, the
  // reticle drawn), so a late flag is never neither.
  let drawn = false;
  let want = false;
  let pending: (() => void) | null = null;
  let timer = 0;
  const apply = () => {
    timer = 0;
    if (want === drawn) return;
    drawn = want;
    if (drawn) html.dataset.reticle = "on";
    else delete html.dataset.reticle;
  };
  const draw = (on: boolean) => {
    want = on && fine.matches && !forced.matches;
    if (want === drawn || pending || timer) return;
    // one tick (the frame), then a task: the paint lands between them
    pending = onTick(() => {
      pending?.();
      pending = null;
      timer = window.setTimeout(apply, 0);
    });
  };

  const p = { x: -100, y: -100, seen: false };
  // the ring's state: center and size, damped toward its target
  const r = { x: -100, y: -100, w: RETICLE, h: RETICLE };
  const target = { x: -100, y: -100, w: RETICLE, h: RETICLE };
  let snapped: Element | null = null;
  let chipShown = 0;
  let chipTarget = 0;

  const retarget = () => {
    if (snapped && snapped.isConnected) {
      const b = snapped.getBoundingClientRect();
      target.x = b.left + b.width / 2;
      target.y = b.top + b.height / 2;
      target.w = b.width + SNAP_PAD * 2;
      target.h = b.height + SNAP_PAD * 2;
    } else {
      snapped = null;
      target.x = p.x;
      target.y = p.y;
      target.w = RETICLE;
      target.h = RETICLE;
    }
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    p.x = e.clientX;
    p.y = e.clientY;
    // the hotspot: written here, in the event — the one part that never lags
    dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    if (!p.seen) {
      p.seen = true;
      r.x = p.x;
      r.y = p.y;
      // drawn where it is from its first frame (the tick would place it a frame later, at 0,0)
      ring.style.transform = `translate3d(${p.x - r.w / 2}px, ${p.y - r.h / 2}px, 0)`;
    }
    look(e.target instanceof Element ? e.target : null);
  };
  // what's under the pointer decides who draws it: inside a text field or over a modal dialog (in the
  // top layer, above the reticle) the native cursor shows and the reticle steps aside
  const look = (under: Element | null) => {
    const inText = !!under?.closest(TEXT_FIELD);
    const inModal = !!under?.closest("dialog:modal");
    draw(!inText && !inModal);
    const hit = inText || inModal ? null : (under?.closest(INTERACTIVE) ?? null);
    const box = hit?.getBoundingClientRect();
    const huge = !!box && box.width > window.innerWidth * MAX_SNAP && box.height > window.innerHeight * MAX_SNAP;
    snapped = hit && !huge && !hit.closest("[data-cursor-snap='off']") ? hit : null;
    const kind = (under?.closest("[data-cursor]") as HTMLElement | null)?.dataset.cursor;
    const label = kind === "view" || kind === "drag" || kind === "flip" || kind === "open" ? labels[kind] : "";
    if (label && chip.textContent !== label) chip.textContent = label;
    chipTarget = label ? 1 : 0;
    retarget();
  };
  // a dialog opened or closed (a record's dossier, the terminal — by a key, CLOSE, Esc) under a pointer
  // that hasn't moved: no pointermove comes, so look again at what's under it — the native cursor in
  // the dialog, the reticle back on the page at once (until then the native cursor shows: the flag
  // was off)
  let relook: (() => void) | null = null;
  const lookAgain = () => {
    if (!p.seen || relook) return;
    // the next frame (one tick, the site's one rAF): the dialog has entered or left the top layer
    relook = onTick(() => {
      relook?.();
      relook = null;
      look(document.elementFromPoint(p.x, p.y));
    });
  };
  const onLeave = () => draw(false);
  const onScroll = () => retarget();

  const reduced = () => html.dataset.motion === "reduce";
  const offTick = onTick((dt) => {
    if (!p.seen) return;
    const instant = reduced();
    r.x = instant ? target.x : damp(r.x, target.x, followers.cursorRing, dt);
    r.y = instant ? target.y : damp(r.y, target.y, followers.cursorRing, dt);
    r.w = instant ? target.w : damp(r.w, target.w, followers.cursorRing, dt);
    r.h = instant ? target.h : damp(r.h, target.h, followers.cursorRing, dt);
    ring.style.transform = `translate3d(${(r.x - r.w / 2).toFixed(2)}px, ${(r.y - r.h / 2).toFixed(2)}px, 0)`;
    ring.style.width = `${r.w.toFixed(2)}px`;
    ring.style.height = `${r.h.toFixed(2)}px`;
    const dx = (r.w - Math.min(ARM, r.w / 2)).toFixed(2);
    const dy = (r.h - Math.min(ARM, r.h / 2)).toFixed(2);
    tr.style.transform = `translate3d(${dx}px, 0, 0)`;
    bl.style.transform = `translate3d(0, ${dy}px, 0)`;
    br.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    chipShown = instant ? chipTarget : damp(chipShown, chipTarget, followers.cursorLabel, dt);
    chip.style.transform = `translate3d(${(r.x + r.w / 2 + 4).toFixed(2)}px, ${(r.y + r.h / 2 + 4).toFixed(2)}px, 0) scale(${chipShown.toFixed(3)})`;
    chip.style.opacity = chipShown.toFixed(3);
  });

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  // over: the element under a still pointer changed (a scroll, a dialog removed with its route)
  window.addEventListener("pointerover", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("scroll", onScroll, { passive: true });
  // a dialog's `toggle` and `close` don't bubble: caught on their way down
  document.addEventListener("toggle", lookAgain, true);
  document.addEventListener("close", lookAgain, true);
  const onMedia = () => {
    if (!fine.matches || forced.matches) draw(false);
    else if (p.seen) look(document.elementFromPoint(p.x, p.y));
  };
  fine.addEventListener("change", onMedia);
  forced.addEventListener("change", onMedia);
  // the move that loaded this module (Cursor.tsx), replayed: a pointer that stopped there is drawn
  if (at) {
    p.x = at.x;
    p.y = at.y;
    dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    p.seen = true;
    r.x = p.x;
    r.y = p.y;
    ring.style.transform = `translate3d(${p.x - r.w / 2}px, ${p.y - r.h / 2}px, 0)`;
    look(document.elementFromPoint(p.x, p.y));
  }
  return () => {
    offTick();
    relook?.();
    pending?.();
    window.clearTimeout(timer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onMove);
    window.removeEventListener("pointerover", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("toggle", lookAgain, true);
    document.removeEventListener("close", lookAgain, true);
    fine.removeEventListener("change", onMedia);
    forced.removeEventListener("change", onMedia);
    delete html.dataset.reticle;
  };
}
