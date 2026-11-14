import { hash, KEYS, type KeySpec } from "./capabilities";

/**
 * A5 · CAPABILITIES (DESIGN.md §4.3 A5): the pile's layout — where every key's home is, arranged
 * and gathered, and how deep the cloud floats in a band — pure, for the stage (components/stage/
 * keycaps/pile.ts) and the tests. Apart from lib/capabilities.ts so the page's lazy layers (the keys'
 * HTML layer, the panel's behaviour) don't carry it.
 */
export type Point = { x: number; y: number; z: number };

/** How the pile is seen (cloudFit's): its clusters per row, the cloud's depth, the band's aspect and its half-size there (keycaps). */
export interface View {
  columns?: number;
  depth?: number;
  aspect?: number;
  half?: { w: number; h: number };
}

/** The hexagonal lattice's points, nearest the centre first (ties by angle): a cluster is its first n. */
const LATTICE: { x: number; y: number }[] = (() => {
  const pts: { x: number; y: number; d: number; a: number }[] = [];
  const R = 4; // 61 points: enough for one category holding all KEYS.maxKeys
  for (let q = -R; q <= R; q++) {
    for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
      const x = q + r / 2;
      const y = (r * Math.sqrt(3)) / 2;
      pts.push({ x, y, d: Math.round(Math.hypot(x, y) * 1e6), a: (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI) });
    }
  }
  return pts.sort((p, o) => p.d - o.d || p.a - o.a).map(({ x, y }) => ({ x, y }));
})();

/**
 * Every key's home, keycap units, about the camera's axis at z = 0 (the pile pushes the cloud back).
 * Each category is a cluster: a hexagonal lattice turned by a seeded angle, its first key at the
 * middle, every home nudged a seeded little in each axis — loose to the eye, but no two homes ever
 * nearer than two of the sim's sphere radii, so it can come to rest. The clusters stand in loose
 * rows of `view.columns`, as far apart as they are wide. `focus` (a category's index) gathers that
 * one forward to the middle and parts the rest, back and smaller, to either side of it — or above
 * and below, as the band's aspect has room — placed as they look from the camera (the cloud
 * `view.depth` away, from cloudFit), so none stands behind it on screen.
 */
export function homes(keys: readonly KeySpec[], categories: number, focus: number | null = null, view: View = {}): Point[] {
  const C = KEYS.cloud;
  const columns = view.columns ?? categories;
  const depth = view.depth ?? 0;
  const members = Array.from({ length: categories }, (_, c) => keys.map((k, i) => ({ k, i })).filter((m) => m.k.category === c));
  // each cluster about its own middle
  const local: Point[] = new Array(keys.length);
  const radius = members.map((list, c) => {
    const turn = (hash(`cluster:${c}`) - 0.5) * 2 * C.turn;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    let r = 0;
    list.forEach(({ k, i }, n) => {
      const p = LATTICE[n] ?? { x: 0, y: 0 };
      const x = (p.x * cos - p.y * sin) * C.spacing + (hash(`${k.slug}:jx`) - 0.5) * 2 * C.jitter;
      const y = (p.x * sin + p.y * cos) * C.spacing + (hash(`${k.slug}:jy`) - 0.5) * 2 * C.jitter;
      local[i] = { x, y, z: (hash(k.slug) - 0.5) * 2 * C.depthJitter };
      r = Math.max(r, Math.hypot(x, y));
    });
    return r;
  });
  const reach = (c: number) => radius[c] ?? 0;
  // rows of clusters, each next one a gap past the last's reach and stepping up or down; each row a
  // gap (and the steps) below the last; the whole centred
  const grid = (cs: number[]): Map<number, { x: number; y: number }> => {
    const at = new Map<number, { x: number; y: number }>();
    const cols = Math.max(1, Math.min(columns, cs.length));
    let y = 0;
    let above = 0;
    for (let r0 = 0; r0 < cs.length; r0 += cols) {
      const row = cs.slice(r0, r0 + cols);
      const tall = Math.max(...row.map(reach));
      if (r0 > 0) y -= above + C.gap + 2 * C.stagger + tall;
      above = tall;
      let x = 0;
      row.forEach((c, n) => {
        if (n > 0) x += reach(row[n - 1] as number) + C.gap + reach(c);
        at.set(c, { x, y: y + (n % 2 ? -1 : 1) * C.stagger });
      });
      // the row's middle: from the first cluster's reach to the last's
      const mid = (x + reach(row[row.length - 1] as number) - reach(row[0] as number)) / 2;
      for (const c of row) (at.get(c) as { x: number }).x -= mid;
    }
    const pos = (c: number) => at.get(c) as { x: number; y: number };
    const middle = (v: (c: number) => number) => (Math.min(...cs.map((c) => v(c) - reach(c))) + Math.max(...cs.map((c) => v(c) + reach(c)))) / 2;
    const cx = middle((c) => pos(c).x);
    const cy = middle((c) => pos(c).y);
    for (const p of at.values()) {
      p.x -= cx;
      p.y -= cy;
    }
    return at;
  };
  const all = Array.from({ length: categories }, (_, c) => c).filter((c) => (members[c]?.length ?? 0) > 0);
  if (focus === null || !all.includes(focus)) {
    const place = grid(all);
    return keys.map((k, i) => {
      const p = local[i] as Point;
      const o = place.get(k.category) ?? { x: 0, y: 0 };
      return { x: o.x + p.x, y: o.y + p.y, z: p.z };
    });
  }
  // gathered: laid out as it looks from the camera, `depth` away — the category forward at the middle
  // (it looks `near` times larger), the rest `far` times smaller to either side of it — in a row or a
  // column a side — or above and below, whichever leaves the band the most room, in category order,
  // the two sides as even as it allows
  const G = KEYS.gather;
  if (!(depth > 0)) throw new Error(`homes: a gathered pile needs the cloud's depth (got ${depth})`);
  const near = 1 / (1 - G.front);
  const far = 1 / (1 + G.back);
  const rest = all.filter((c) => c !== focus);
  const span = (cs: number[]) => cs.reduce((w, c, n) => w + 2 * reach(c) * far + (n ? C.gap * far : 0), 0);
  let split = 0;
  for (let k = 0; k <= rest.length; k++) if (Math.max(span(rest.slice(0, k)), span(rest.slice(k))) < Math.max(span(rest.slice(0, split)), span(rest.slice(split)))) split = k;
  const inner = reach(focus) * near + C.gap * far;
  // to the left and right: outward from the middle, each cluster's reach a gap past the last one's
  const sideways = () => {
    const at = new Map<number, { x: number; y: number }>();
    for (const [side, cs] of [
      [-1, rest.slice(0, split).reverse()],
      [1, rest.slice(split)],
    ] as const) {
      let edge = inner;
      cs.forEach((c, n) => {
        const centre = edge + reach(c) * far;
        at.set(c, { x: side * centre, y: (n % 2 ? 1 : -1) * side * C.stagger });
        edge = centre + reach(c) * far + C.gap * far;
      });
    }
    return at;
  };
  // to the left and right, each side a column: its clusters one above the next, centred on the middle
  const columned = () => {
    const at = new Map<number, { x: number; y: number }>();
    for (const [side, cs] of [
      [-1, rest.slice(0, split)],
      [1, rest.slice(split)],
    ] as const) {
      const x = side * (inner + Math.max(0, ...cs.map(reach)) * far);
      let y = (cs.reduce((h, c, n) => h + 2 * reach(c) * far + (n ? C.gap * far : 0), 0)) / 2;
      cs.forEach((c) => {
        at.set(c, { x, y: y - reach(c) * far });
        y -= 2 * reach(c) * far + C.gap * far;
      });
    }
    return at;
  };
  // above and below: a row each (the first categories above), centred, clear of the middle by a gap
  const stacked = () => {
    const at = new Map<number, { x: number; y: number }>();
    for (const [side, cs] of [
      [1, rest.slice(0, split)],
      [-1, rest.slice(split)],
    ] as const) {
      const y = side * (inner + Math.max(0, ...cs.map(reach)) * far);
      let x = -span(cs) / 2;
      cs.forEach((c) => {
        at.set(c, { x: x + reach(c) * far, y });
        x += 2 * reach(c) * far + C.gap * far;
      });
    }
    return at;
  };
  // how much of what the pile may fill it takes: its reach on screen against the band's share for it
  const half = view.half ?? { w: view.aspect ?? 2, h: 1 };
  const room = (at: Map<number, { x: number; y: number }>) => {
    let ex = (reach(focus) + KEYS.sim.radius) * near;
    let ey = ex;
    for (const [c, o] of at) {
      const r = (reach(c) + KEYS.sim.radius) * far;
      ex = Math.max(ex, Math.abs(o.x) + r);
      ey = Math.max(ey, Math.abs(o.y) + r);
    }
    return Math.max(ex / (half.w * C.fill), ey / (half.h * C.fillHeight));
  };
  // the first that leaves the most room (ties keep the row: the pile's own shape)
  const seen = [sideways(), columned(), stacked()].reduce((best, at) => (room(at) < room(best) - 1e-9 ? at : best));
  return keys.map((k, i) => {
    const p = local[i] as Point;
    if (k.category === focus) return { x: p.x, y: p.y, z: p.z + G.front * depth };
    // where it's seen, at its depth: the world spreads by 1 / far back there
    const o = seen.get(k.category) ?? { x: 0, y: 0 };
    return { x: o.x / far + p.x, y: o.y / far + p.y, z: p.z - G.back * depth };
  });
}

/** The pile's half-extents (keycaps), each home's sphere included. */
export function extents(h: readonly Point[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const o of h) {
    x = Math.max(x, Math.abs(o.x) + KEYS.sim.radius);
    y = Math.max(y, Math.abs(o.y) + KEYS.sim.radius);
  }
  return { x, y };
}

/**
 * The pile in a band of this aspect, seen through a camera of this vertical field of view: the
 * clusters' arrangement that shows them largest (a row across a wide band, a block in a tall one),
 * the depth at which the whole pile fills its share of the band, and the sim's walls: the band's
 * edges (a margin in), widening with depth as the view does, and a front and a back wall.
 */
export function cloudFit(keys: readonly KeySpec[], categories: number, aspect: number, fovDeg: number) {
  const tan = Math.tan((fovDeg / 2) * (Math.PI / 180));
  const C = KEYS.cloud;
  const depthFor = (e: { x: number; y: number }) => Math.max(e.x / (C.fill * tan * aspect), e.y / (C.fillHeight * tan));
  let best = { columns: Math.max(1, categories), depth: Infinity };
  for (let columns = Math.max(1, categories); columns >= 1; columns--) {
    const depth = depthFor(extents(homes(keys, categories, null, { columns })));
    if (depth < best.depth - 1e-9) best = { columns, depth };
  }
  const { columns, depth } = best;
  const halfW = tan * aspect * depth;
  const halfH = tan * depth;
  // the walls: the frustum's sides at the cloud's depth (they widen with it: Pile.step), front and
  // back — past a gathered pile's keys either way
  const G = KEYS.gather;
  const zNear = -depth + Math.max(C.depth, G.front * depth + C.depthJitter + G.wall);
  const zFar = -depth - (G.back * depth + C.depthJitter + G.wall);
  return { columns, depth, aspect, half: { w: halfW, h: halfH }, bounds: { x: halfW * 0.96, y: halfH * 0.92, zNear, zFar } };
}
