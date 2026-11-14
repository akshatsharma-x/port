/**
 * Frame-rate-independent followers (DESIGN.md §3.1): exponential damping with λ in 1/s.
 * damp(…, dt) applied over any split of the same total time gives the same result, so
 * 60 Hz and 120 Hz look identical. Never use a per-frame lerp constant.
 */

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** Damps an angle in degrees along the shortest arc. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const delta = ((((target - current) % 360) + 540) % 360) - 180;
  return damp(current, current + delta, lambda, dt);
}

export interface Vec2 {
  x: number;
  y: number;
}

export function damp2(out: Vec2, target: Vec2, lambda: number, dt: number): Vec2 {
  out.x = damp(out.x, target.x, lambda, dt);
  out.y = damp(out.y, target.y, lambda, dt);
  return out;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
