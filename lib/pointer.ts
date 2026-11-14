/**
 * One pointer listener for the whole app. Consumers retain/release it; the raw state is read on
 * the ticker (usePointer damps it), so moving the mouse never re-renders React.
 */
export interface PointerState {
  /** viewport px */
  x: number;
  y: number;
  /** normalized 0–1 */
  nx: number;
  ny: number;
  /** a pointer has moved over the document since load */
  active: boolean;
  type: string;
}

export const pointer: PointerState = { x: 0, y: 0, nx: 0.5, ny: 0.5, active: false, type: "mouse" };

type MoveListener = (p: PointerState) => void;
const listeners = new Set<MoveListener>();
let retained = 0;

function onMove(e: PointerEvent) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.nx = window.innerWidth > 0 ? e.clientX / window.innerWidth : 0.5;
  pointer.ny = window.innerHeight > 0 ? e.clientY / window.innerHeight : 0.5;
  pointer.active = true;
  pointer.type = e.pointerType;
  for (const l of listeners) l(pointer);
}

function onLeave() {
  pointer.active = false;
  for (const l of listeners) l(pointer);
}

export function retainPointer(): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (retained++ === 0) {
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--retained === 0) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    }
  };
}

export function onPointerMove(listener: MoveListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
