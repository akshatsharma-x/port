/**
 * Frame statistics. Pushes are O(1) and allocation-free (they run every frame); percentiles copy
 * and sort, so call them at HUD rates (≤ 10 Hz), never per frame.
 */

/** Nearest-rank percentile of an ascending-sorted list (p in 0–100). */
export function percentileSorted(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? 0;
}

export const percentile = (values: readonly number[], p: number): number => percentileSorted([...values].sort((a, b) => a - b), p);

export const median = (values: readonly number[]): number => percentile(values, 50);

/** A fixed-size ring of the most recent samples. */
export class RollingWindow {
  private readonly buf: Float64Array;
  private next = 0;
  private filled = 0;

  constructor(readonly size: number) {
    this.buf = new Float64Array(size);
  }

  push(value: number): void {
    this.buf[this.next] = value;
    this.next = (this.next + 1) % this.size;
    if (this.filled < this.size) this.filled++;
  }

  get count(): number {
    return this.filled;
  }

  values(): number[] {
    return Array.from(this.buf.subarray(0, this.filled));
  }

  percentile(p: number): number {
    return percentile(this.values(), p);
  }

  clear(): void {
    this.next = 0;
    this.filled = 0;
  }
}
