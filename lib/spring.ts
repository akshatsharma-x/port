import type { SpringConfig } from "./motion";

/**
 * Damped spring integrated with RK4 at a fixed 1/240 s sub-step (DESIGN.md §3.1, v1.2).
 * Same ODE and constants as Motion's analytic DOM springs: m·x'' + c·x' + k·(x − target) = 0.
 * RK4 tracks the analytic step response within 0.01 pp of overshoot (semi-implicit Euler was
 * off by up to 0.76 pp), and any frame rate whose dt is a multiple of 1/240 s (60, 120, 240 Hz)
 * produces bit-identical motion.
 */
export const SUBSTEP = 1 / 240;
/** dt is clamped so a tab switch or a breakpoint never launches a spring. */
export const MAX_DT = 1 / 10;

export class Spring {
  value: number;
  velocity = 0;
  target: number;
  config: SpringConfig;

  constructor(config: SpringConfig, initial = 0) {
    this.config = config;
    this.value = initial;
    this.target = initial;
  }

  /** Retargets from the current position and velocity (input wins — DESIGN.md §3.1). */
  setTarget(target: number): this {
    this.target = target;
    return this;
  }

  /** Teleports to a value at rest. */
  snap(value: number): this {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    return this;
  }

  step(dt: number): number {
    let remaining = Math.min(Math.max(dt, 0), MAX_DT);
    while (remaining > 1e-12) {
      const h = remaining < SUBSTEP ? remaining : SUBSTEP;
      this.integrate(h);
      remaining -= h;
    }
    return this.value;
  }

  isSettled(epsilon = 1e-3): boolean {
    return Math.abs(this.target - this.value) < epsilon && Math.abs(this.velocity) < epsilon * 10;
  }

  private integrate(h: number): void {
    const { stiffness: k, damping: c, mass: m } = this.config;
    const target = this.target;
    const acc = (x: number, v: number) => (-k * (x - target) - c * v) / m;
    const x0 = this.value;
    const v0 = this.velocity;
    const k1x = v0;
    const k1v = acc(x0, v0);
    const k2x = v0 + 0.5 * h * k1v;
    const k2v = acc(x0 + 0.5 * h * k1x, v0 + 0.5 * h * k1v);
    const k3x = v0 + 0.5 * h * k2v;
    const k3v = acc(x0 + 0.5 * h * k2x, v0 + 0.5 * h * k2v);
    const k4x = v0 + h * k3v;
    const k4v = acc(x0 + h * k3x, v0 + h * k3v);
    this.value = x0 + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    this.velocity = v0 + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
}

/** Measures a spring's 0 → 1 step response (used by tests and dev tooling). */
export function stepResponse(config: SpringConfig, dt = SUBSTEP, seconds = 5): { overshoot: number; settle: number } {
  const s = new Spring(config, 0).setTarget(1);
  let peak = 0;
  let lastOutside = 0;
  for (let t = dt; t <= seconds + 1e-9; t += dt) {
    const x = s.step(dt);
    peak = Math.max(peak, x);
    if (Math.abs(x - 1) > 0.02) lastOutside = t;
  }
  return { overshoot: Math.max(0, peak - 1), settle: lastOutside };
}
