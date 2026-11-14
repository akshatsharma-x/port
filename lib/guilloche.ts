import { hashSeed, rng } from "./motion";

/**
 * The credential card's guilloche and seal (DESIGN.md §4.4 B1), as data for inline SVG. The
 * engraving is built from a few shared figures, drawn once per page: three rosettes (ellipses turned
 * about a centre, the lathe's classic figure) and a band of parallel waves. Each card places two
 * rosettes and the band by its own parameters, seeded from its credential ID: unique to the card,
 * the same on every build, and a couple of hundred bytes of markup where a card's own curves would
 * be kilobytes (the HTML budget, §8.3). Card units are tenths of a millimetre: ID-1 is 856 × 540.
 */
export const CARD_UNITS = { width: 856, height: 540 } as const;

export const GUILLOCHE = {
  /** the rosettes: ellipses (centre offset cx, radii rx, ry) turned n times about the origin */
  rings: [
    // centred ellipses close on a clean circle (radius ry): an open rosette. Off-centre ones
    // converged on a bright little ring at the middle that read as a stain
    { id: "cred-ring-a", n: 24, cx: 0, rx: 50, ry: 22 },
    { id: "cred-ring-b", n: 18, cx: 6, rx: 48, ry: 30 },
    { id: "cred-ring-c", n: 30, cx: 0, rx: 44, ry: 26 },
  ],
  /** the band: one wave across the card, repeated down it, each line shifted along */
  wave: { id: "cred-wave", periods: 8, amplitude: 10, lines: 7, gap: 7, shift: 13 },
  /** a card's placement ranges (card units, degrees) */
  place: {
    big: { x: [120, 470], y: [180, 430], scale: [2.6, 3.6] },
    /* round the seal (its middle in card units), its petals out past the seal's rim: a halo */
    small: { x: [612, 628], y: [158, 174], scale: [1.9, 2.3] },
    band: { y: [330, 470], turn: 7, stretch: [0.8, 1.3] },
  },
  /** the issuer seal: a scalloped rim and two rings (radius 40) */
  seal: { id: "cred-seal", scallops: 24, r: 40, depth: 3, rings: [33, 27] },
} as const;

const f = (n: number) => String(Math.round(n * 10) / 10);

/** A half sine as one cubic: its control points this far along (of the half period) and this high (of the amplitude). */
export const SINE_FIT = { reach: 0.4125, lift: 1.337 } as const;

export interface Ring {
  id: string;
  ellipses: { cx: number; rx: number; ry: number; turn: number }[];
}

/** The shared figures: what the page draws once. */
export function guillocheFigures(): { rings: Ring[]; wave: { id: string; d: string; lines: { dx: number; dy: number }[] }; seal: { id: string; d: string; rings: readonly number[] } } {
  const rings = GUILLOCHE.rings.map((r) => ({ id: r.id, ellipses: Array.from({ length: r.n }, (_, k) => ({ cx: r.cx, rx: r.rx, ry: r.ry, turn: Math.round((k * 3600) / r.n) / 10 })) }));
  // a sine across the card, a cubic per half period: control points 0.4125 of the way in, at 1.337×
  // the amplitude — the least-error fit, within 0.3% of the curve (measured)
  const W = GUILLOCHE.wave;
  const half = CARD_UNITS.width / (W.periods * 2);
  // a period past either end, so a line shifted along never leaves the card bare
  let d = `M${f(-2 * half)} 0`;
  for (let i = -2; i < W.periods * 2 + 2; i++) {
    const x0 = i * half;
    const y = (Math.abs(i) % 2 ? -1 : 1) * SINE_FIT.lift * W.amplitude;
    d += `C${f(x0 + half * SINE_FIT.reach)} ${f(y)} ${f(x0 + half * (1 - SINE_FIT.reach))} ${f(y)} ${f(x0 + half)} 0`;
  }
  const lines = Array.from({ length: W.lines }, (_, j) => ({ dx: -((j * W.shift) % (half * 2)), dy: j * W.gap }));
  // the seal's rim: scallops, an arc each
  const S = GUILLOCHE.seal;
  const pts = Array.from({ length: S.scallops }, (_, k) => {
    const a = (k / S.scallops) * Math.PI * 2;
    return [Math.cos(a) * S.r, Math.sin(a) * S.r] as const;
  });
  const rim = `M${f(pts[0]?.[0] ?? 0)} ${f(pts[0]?.[1] ?? 0)}${pts.map((_, k) => {
    const [x, y] = pts[(k + 1) % pts.length] as readonly [number, number];
    return `A${S.depth * 2} ${S.depth * 2} 0 0 1 ${f(x)} ${f(y)}`;
  }).join("")}Z`;
  return { rings, wave: { id: W.id, d, lines }, seal: { id: S.id, d: rim, rings: S.rings } };
}

/** One card's engraving: which figures go where, seeded from its credential ID. */
export function guillocheFor(credentialId: string): { href: string; transform: string }[] {
  const random = rng(hashSeed(`guilloche:${credentialId}`));
  const between = ([lo, hi]: readonly [number, number]) => lo + (hi - lo) * random();
  const P = GUILLOCHE.place;
  const ids = GUILLOCHE.rings.map((r) => r.id);
  const first = Math.floor(random() * ids.length);
  const second = (first + 1 + Math.floor(random() * (ids.length - 1))) % ids.length;
  const ring = (id: string, p: { x: readonly [number, number]; y: readonly [number, number]; scale: readonly [number, number] }) => ({
    href: `#${id}`,
    transform: `translate(${f(between(p.x))} ${f(between(p.y))}) rotate(${f(random() * 360)}) scale(${(Math.round(between(p.scale) * 100) / 100).toString()})`,
  });
  return [
    ring(ids[first] as string, P.big),
    { href: `#${GUILLOCHE.wave.id}`, transform: `translate(0 ${f(between(P.band.y))}) rotate(${f((random() * 2 - 1) * P.band.turn)} ${CARD_UNITS.width / 2} 0) scale(1 ${(Math.round(between(P.band.stretch) * 100) / 100).toString()})` },
    ring(ids[second] as string, P.small),
  ];
}
