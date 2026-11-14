import { HERO, type LatticeSpec, type StageData } from "./hero";
import { rng } from "./motion";
import { earthVector } from "./sun";

export { earthVector };

/**
 * The hero's morph targets (DESIGN.md §4.3 A1), generated — never downloaded. Pure functions over
 * plain inputs, so the worker runs them and tests/hero-gen.test.ts checks them. Each writes `n`
 * points as normalized Int16 xyz (±32767 = ±1) into its own array: 6 B per particle per target.
 *
 * Every particle is an independent random draw, so any prefix of a target is itself a fair sample
 * of its shape: a tier that renders fewer particles uses the first n.
 */
export const INT16 = 32767;

type Random = () => number;

const q = (v: number): number => Math.max(-INT16, Math.min(INT16, Math.round(v * INT16)));

function put(out: Int16Array, i: number, x: number, y: number, z: number): void {
  out[i * 3] = q(x);
  out[i * 3 + 1] = q(y);
  out[i * 3 + 2] = q(z);
}

/** A standard normal draw (Box–Muller). */
export function gauss(random: Random): number {
  const u = Math.max(Number.EPSILON, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** Splits n into whole counts in proportion to `shares` (largest remainder; the sum is exactly n). */
export function apportion(n: number, shares: readonly number[]): number[] {
  const total = shares.reduce((a, b) => a + b, 0);
  const exact = shares.map((s) => (n * s) / total);
  const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts;
}

/** Index sampling proportional to weights: a cumulative table and binary search. */
export function weightedPicker(weights: ArrayLike<number>): (u: number) => number {
  const cdf = new Float64Array(weights.length);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += Math.max(0, weights[i] ?? 0);
    cdf[i] = acc;
  }
  return (u) => {
    const x = u * acc;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cdf[mid] ?? 0) < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
}

// ── 1 · INITIALS ─────────────────────────────────────────────────────────────────────────

export interface AlphaRaster {
  width: number;
  height: number;
  /** one byte per pixel: the glyphs' coverage */
  alpha: Uint8Array | Uint8ClampedArray;
}

/**
 * Points inside the glyphs, uniform over their area, plus a share on their edges (so the letters
 * read crisp at any density), in a thin slab for parallax depth. Normalized to the glyphs' own
 * bounding box: the longer half-extent is 1. Returns the box's aspect (width / height).
 */
export function initialsTarget(n: number, raster: AlphaRaster, seed: number, out = new Int16Array(n * 3)): { out: Int16Array; aspect: number } {
  const { width: W, height: H, alpha } = raster;
  const { alphaFloor, edgeShare, depth } = HERO.initials;
  const interior = new Float32Array(W * H);
  const edge = new Float32Array(W * H);
  let x0 = W;
  let x1 = 0;
  let y0 = H;
  let y1 = 0;
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : (alpha[y * W + x] ?? 0));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = a(x, y);
      if (v < alphaFloor) continue;
      interior[y * W + x] = v;
      // an edge pixel: inside, with an outside neighbour (4-connected)
      if (a(x - 1, y) < alphaFloor || a(x + 1, y) < alphaFloor || a(x, y - 1) < alphaFloor || a(x, y + 1) < alphaFloor) edge[y * W + x] = 1;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < x0) {
    // nothing drawn (no font, no text): a flat disc, so the morph still has somewhere to go
    const random = rng(seed);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(random());
      const t = random() * Math.PI * 2;
      put(out, i, r * Math.cos(t), r * Math.sin(t), (random() - 0.5) * 2 * depth);
    }
    return { out, aspect: 1 };
  }
  const cx = (x0 + x1 + 1) / 2;
  const cy = (y0 + y1 + 1) / 2;
  const half = Math.max(x1 + 1 - x0, y1 + 1 - y0) / 2;
  const pickInterior = weightedPicker(interior);
  const pickEdge = weightedPicker(edge);
  const random = rng(seed);
  for (let i = 0; i < n; i++) {
    const onEdge = random() < edgeShare;
    const p = (onEdge ? pickEdge : pickInterior)(random());
    const px = (p % W) + random();
    const py = Math.floor(p / W) + random();
    // edge points sit on the outline; interior points get the slab's full depth
    const z = (random() - 0.5) * 2 * depth * (onEdge ? 0.35 : 1);
    put(out, i, (px - cx) / half, -(py - cy) / half, z);
  }
  return { out, aspect: (x1 + 1 - x0) / (y1 + 1 - y0) };
}

// ── 2 · CONSTELLATION ────────────────────────────────────────────────────────────────────

/**
 * The real graph (content/graph.json via /data/stage.json, TOPIC layout): every paper a blob
 * weighted by its citations, every edge a dotted line, and a sparse field of stars. Normalized
 * so the farthest node sits at 0.9.
 */
export function constellationTarget(n: number, graph: StageData["graph"], seed: number, out = new Int16Array(n * 3)): Int16Array {
  const C = HERO.constellation;
  const random = rng(seed);
  const nodes = graph.nodes;
  if (nodes.length === 0) {
    for (let i = 0; i < n; i++) put(out, i, gauss(random) * 0.4, gauss(random) * 0.4, gauss(random) * 0.4);
    return out;
  }
  let far = 1e-6;
  for (const nd of nodes) far = Math.max(far, Math.hypot(...nd.topic));
  const k = C.radius / far;
  const pos = nodes.map((nd) => nd.topic.map((v) => v * k) as [number, number, number]);
  // my papers are the stars; a work they cite is a faint one, however often the world cites it
  const weight = nodes.map((nd) => (nd.kind === 1 ? C.citedWeight : 1 + Math.sqrt(nd.citations) + (nd.featured ? 2 : 0)));
  const maxW = Math.max(...weight);
  const edges = graph.edges.filter(([s, t]) => s !== t && pos[s] && pos[t]);
  const [nNodes, nEdges, nField] = apportion(n, edges.length ? [C.nodes, C.edges, C.field] : [C.nodes, 0, C.field + C.edges]) as [number, number, number];
  let i = 0;
  const pickNode = weightedPicker(weight);
  for (let j = 0; j < nNodes; j++, i++) {
    const nd = pickNode(random());
    const p = pos[nd] as [number, number, number];
    const s = C.nodeSigma + C.nodeSigmaPerWeight * ((weight[nd] ?? 1) / maxW);
    // a dense core and a soft halo: a third of each blob is twice as tight
    const tight = random() < 1 / 3 ? 0.45 : 1;
    put(out, i, p[0] + gauss(random) * s * tight, p[1] + gauss(random) * s * tight, p[2] + gauss(random) * s * tight);
  }
  if (nEdges > 0) {
    const lengths = edges.map(([s, t, w]) => {
      const a = pos[s] as [number, number, number];
      const b = pos[t] as [number, number, number];
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * Math.sqrt(w);
    });
    const pickEdge = weightedPicker(lengths);
    for (let j = 0; j < nEdges; j++, i++) {
      const [s, t] = edges[pickEdge(random())] as [number, number, number, number];
      const a = pos[s] as [number, number, number];
      const b = pos[t] as [number, number, number];
      const u = random();
      const jt = C.edgeJitter;
      put(out, i, a[0] + (b[0] - a[0]) * u + gauss(random) * jt, a[1] + (b[1] - a[1]) * u + gauss(random) * jt, a[2] + (b[2] - a[2]) * u + gauss(random) * jt);
    }
  }
  for (let j = 0; j < nField; j++, i++) {
    // the sky behind the chart: a thin disc of faint stars, set back, thinning toward its rim
    const r = Math.sqrt(random());
    const t = random() * Math.PI * 2;
    put(out, i, r * Math.cos(t), r * Math.sin(t) * 0.72, -0.55 + gauss(random) * 0.12);
  }
  return shuffle(out, n, random);
}

// ── 3 · GLOBE ────────────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

/** The land mask (scripts/bake/landmask.ts): 1 bit per cell, rows north → south from 180° W. */
export function isLand(mask: Uint8Array, latDeg: number, lonDeg: number): boolean {
  const { width: W, height: H } = HERO.globe.landmask;
  const j = Math.min(H - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * H)));
  const i = (((Math.floor(((lonDeg + 180) / 360) * W) % W) + W) % W) as number;
  const n = j * W + i;
  return ((mask[n >> 3] ?? 0) & (0x80 >> (n & 7))) !== 0;
}

/** The globe's radius inside the normalized range, leaving the city's lift room under ±1. */
export const GLOBE_RADIUS = 0.96;

/**
 * The Earth, Earth-fixed (the scene turns it and lights it): land dense, the oceans sparse, a 15°
 * graticule, and a bright knot at the owner's city. Radius GLOBE_RADIUS.
 */
export function globeTarget(n: number, mask: Uint8Array, city: { lat: number; lon: number }, seed: number, out = new Int16Array(n * 3)): Int16Array {
  const G = HERO.globe;
  const random = rng(seed);
  const [nLand, nOcean, nGrat, nCity] = apportion(n, [G.land, G.ocean, G.graticule, G.city]) as [number, number, number, number];
  let i = 0;
  const R = GLOBE_RADIUS;
  const at = (lat: number, lon: number, lift = 1) => {
    const [x, y, z] = earthVector(lat, lon);
    put(out, i, x * R * lift, y * R * lift, z * R * lift);
  };
  const surface = (): [number, number] => {
    const z = random() * 2 - 1; // area-uniform: sin(lat) uniform
    return [Math.asin(z) / DEG, random() * 360 - 180];
  };
  for (let j = 0; j < nLand; j++, i++) {
    let lat = 0;
    let lon = 0;
    for (let tries = 0; tries < 64; tries++) {
      [lat, lon] = surface();
      if (isLand(mask, lat, lon)) break;
    }
    at(lat, lon);
  }
  for (let j = 0; j < nOcean; j++, i++) {
    let lat = 0;
    let lon = 0;
    for (let tries = 0; tries < 64; tries++) {
      [lat, lon] = surface();
      if (!isLand(mask, lat, lon)) break;
    }
    at(lat, lon);
  }
  // graticule: parallels weighted by their length (cos lat), meridians by half a great circle
  const step = G.graticuleDeg;
  const parallels: number[] = [];
  for (let lat = -90 + step; lat < 90; lat += step) parallels.push(lat);
  const meridians = 360 / step;
  const lengths = [...parallels.map((lat) => Math.cos(lat * DEG) * 2 * Math.PI), ...Array.from({ length: meridians }, () => Math.PI)];
  const pickLine = weightedPicker(lengths);
  for (let j = 0; j < nGrat; j++, i++) {
    const line = pickLine(random());
    if (line < parallels.length) at(parallels[line] ?? 0, random() * 360 - 180);
    else at(random() * 180 - 90, (line - parallels.length) * step - 180);
  }
  for (let j = 0; j < nCity; j++, i++) {
    const lat = city.lat + gauss(random) * G.citySigmaDeg;
    const lon = city.lon + (gauss(random) * G.citySigmaDeg) / Math.max(0.2, Math.cos(city.lat * DEG));
    at(lat, lon, 1 + Math.abs(gauss(random)) * 0.012);
  }
  return shuffle(out, n, random);
}

// ── 4 · GRID LATTICE ─────────────────────────────────────────────────────────────────────

/**
 * The site's own grid, in the hero slot's screen space (NDC xy; z = 1 on the About layout's
 * blocks and lines, 0 elsewhere): the 12 column rules, dots on the 8 px baseline inside the
 * columns, and the About layout as it will stand — its portrait block and its text lines.
 */
export function latticeTarget(n: number, spec: LatticeSpec, seed: number, out = new Int16Array(n * 3)): Int16Array {
  const L = HERO.lattice;
  const random = rng(seed);
  const { width: W, height: H } = spec;
  const ndc = (x: number, y: number, z: number, i: number) => put(out, i, (x / W) * 2 - 1, 1 - (y / H) * 2, z);
  const hasBlocks = spec.blocks.length + spec.lines.length > 0;
  const [nRules, nBase, nBlocks] = apportion(n, hasBlocks ? [L.rules, L.baseline, L.blocks] : [L.rules, L.baseline + L.blocks, 0]) as [number, number, number];
  let i = 0;
  const cols = spec.columns.length ? spec.columns : [[0, W] as [number, number]];
  // rules: both edges of every column, full height, dotted at the rule pitch
  for (let j = 0; j < nRules; j++, i++) {
    const c = cols[Math.floor(random() * cols.length)] as [number, number];
    const x = random() < 0.5 ? c[0] : c[1];
    const y = Math.floor((random() * H) / L.rulePitchPx) * L.rulePitchPx;
    ndc(x, y, 0, i);
  }
  // the bare grid: a sparse dot every gridPitchPx on every gridRows-th baseline, inside the columns
  const rowStep = spec.baseline * L.gridRows;
  const rows = Math.max(1, Math.floor(H / rowStep));
  const colWidths = cols.map(([a, b]) => Math.max(0, b - a));
  const pickCol = weightedPicker(colWidths);
  for (let j = 0; j < nBase; j++, i++) {
    const c = cols[pickCol(random())] as [number, number];
    const x = c[0] + Math.round((random() * (c[1] - c[0])) / L.gridPitchPx) * L.gridPitchPx;
    const y = (1 + Math.floor(random() * rows)) * rowStep;
    ndc(Math.min(c[1], x), Math.min(H, y), 0, i);
  }
  if (nBlocks > 0) {
    // the About layout: block outlines (a third) and fills, and text lines as dotted runs
    const shapes = [...spec.blocks.map((b) => ({ kind: "block" as const, b, w: (b.w + b.h) * 2 + b.w * b.h * 0.02 })), ...spec.lines.map((l) => ({ kind: "line" as const, l, w: l.w }))];
    const pickShape = weightedPicker(shapes.map((s) => s.w));
    for (let j = 0; j < nBlocks; j++, i++) {
      const s = shapes[pickShape(random())];
      if (!s) continue;
      if (s.kind === "line") {
        ndc(s.l.x + Math.floor((random() * s.l.w) / L.rulePitchPx) * L.rulePitchPx, s.l.y, 1, i);
        continue;
      }
      const { x, y, w, h } = s.b;
      if (random() < L.blockOutline) {
        // the outline, at the rule pitch
        const t = random() * 2 * (w + h);
        const p = Math.floor(t / L.rulePitchPx) * L.rulePitchPx;
        if (p < w) ndc(x + p, y, 1, i);
        else if (p < w + h) ndc(x + w, y + p - w, 1, i);
        else if (p < 2 * w + h) ndc(x + w - (p - w - h), y + h, 1, i);
        else ndc(x, y + h - (p - 2 * w - h), 1, i);
      } else {
        // the fill: on the baseline lattice, so it reads as the grid, not as noise
        const gx = Math.floor((random() * w) / L.blockPitchPx) * L.blockPitchPx;
        const gy = Math.floor((random() * h) / spec.baseline) * spec.baseline;
        ndc(x + gx, y + gy, 1, i);
      }
    }
  }
  return shuffle(out, n, random);
}

/**
 * Fisher–Yates over whole points, so a prefix of any length samples every part of the shape.
 * (Generators fill part by part; without this, a 35k prefix of a 250k target would be all land.)
 */
function shuffle(out: Int16Array, n: number, random: Random): Int16Array {
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    for (let k = 0; k < 3; k++) {
      const a = out[i * 3 + k] ?? 0;
      out[i * 3 + k] = out[j * 3 + k] ?? 0;
      out[j * 3 + k] = a;
    }
  }
  return out;
}
