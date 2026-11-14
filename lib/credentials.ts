/**
 * 07 · CREDENTIALS (DESIGN.md §4.4 B1/B2, §7.4): the wall's constants and the words both the
 * server's cards and the lazy behaviour use. Small on purpose: the behaviour chunk imports it whole.
 */
export const CRED = {
  /** ISO/IEC 7810 ID-1: 85.60 × 53.98 mm */
  aspect: 85.6 / 53.98,
  /** the one lamp (§4.4): the tilt's reach, and the cast shadow's offset, lift and blur (px) */
  tilt: { max: 8, record: 6, shadow: 16, lift: 10, blur: 18, blurPerTilt: 12 },
  /** at most this many cards keep live foil (the hovered one and the one settling) */
  liveFoil: 2,
  /** will-change stays this long after a card settles (ms) */
  willChangeLingerMs: 300,
  /** where a card's lamp rests while it isn't live, and under reduced motion: the pleasing fixed angle */
  rest: { mx: 0.62, my: 0.38 },
  /** the deal (§7.4): each card flies in from the dealer at the wall's bottom-right, turned this much */
  deal: { turnDeg: -12, from: { x: 1.1, y: 1.15 }, stampScale: 1.6, stampAt: 0.7 },
  /** phones: the device's tilt either way maps to the lamp's 0…1 */
  gyro: { rangeDeg: 25 },
} as const;

/** "12 credentials / 5 issuers / 11 active" (shown in capitals). */
export function readout(c: { total: number; issuers: number; active: number }, L: { credential: string; credentials: string; issuer: string; issuers: string; active: string }): string {
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  return `${n(c.total, L.credential, L.credentials)} / ${n(c.issuers, L.issuer, L.issuers)} / ${c.active} ${L.active}`;
}

/** The lamp from a pointer over a card's box: its place (0…1) and the tilt it gives (deg), §4.4. */
export function lampAt(x: number, y: number, max: number = CRED.tilt.max): { mx: number; my: number; rx: number; ry: number } {
  const mx = Math.min(1, Math.max(0, x));
  const my = Math.min(1, Math.max(0, y));
  return { mx, my, rx: (0.5 - my) * 2 * max, ry: (mx - 0.5) * 2 * max };
}

/** A phone's tilt (β front–back from where it was held, γ side to side; degrees) as the lamp's place. */
export function lampFromTilt(beta: number, gamma: number): { mx: number; my: number } {
  const r = CRED.gyro.rangeDeg;
  const to01 = (deg: number) => Math.min(1, Math.max(0, 0.5 + deg / (2 * r)));
  return { mx: to01(gamma), my: to01(beta) };
}
