"use client";

import { useEffect, useRef } from "react";
import { damp } from "@/lib/damp";
import { pointer, retainPointer } from "@/lib/pointer";
import { onTick } from "@/lib/ticker";

export interface DampedPointer {
  x: number;
  y: number;
  /** normalized 0–1 */
  nx: number;
  ny: number;
  active: boolean;
}

/**
 * Pointer position, normalized and damped (λ in 1/s, frame-rate independent). Returns a ref
 * updated on the ticker — read it in your own tick/handlers; it never triggers a re-render.
 * Pass `lambda = 0` for the raw (undamped) position.
 */
export function usePointer(lambda: number) {
  const ref = useRef<DampedPointer>({ x: 0, y: 0, nx: 0.5, ny: 0.5, active: false });
  useEffect(() => {
    const release = retainPointer();
    const stop = onTick((dt) => {
      const r = ref.current;
      r.active = pointer.active;
      if (lambda <= 0) {
        r.x = pointer.x;
        r.y = pointer.y;
        r.nx = pointer.nx;
        r.ny = pointer.ny;
        return;
      }
      r.x = damp(r.x, pointer.x, lambda, dt);
      r.y = damp(r.y, pointer.y, lambda, dt);
      r.nx = damp(r.nx, pointer.nx, lambda, dt);
      r.ny = damp(r.ny, pointer.ny, lambda, dt);
    });
    return () => {
      stop();
      release();
    };
  }, [lambda]);
  return ref;
}
