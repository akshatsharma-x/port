import { BufferAttribute, BufferGeometry } from "three";
import { KEYS } from "@/lib/capabilities";

/**
 * A5's sculpted keycap (DESIGN.md §4.3 A5: ≤ 1.5k triangles): a squircle lofted from its base up
 * to a narrower top, its top edge rounded over, then a shallow spherical dish to the centre — one
 * lathe of the same angular samples throughout, so every ring stitches to the next. The legend face
 * (the top, `aTop` = 1) faces +z at z = 0; the cap's body runs back to −height. UVs on the top span
 * its square 0–1 for the legend atlas.
 */
const SQUIRCLE = 5;

/** A point on the squircle |x|^n + |y|^n = 1 at angle a. */
function squircle(a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [Math.sign(c) * Math.abs(c) ** (2 / SQUIRCLE), Math.sign(s) * Math.abs(s) ** (2 / SQUIRCLE)];
}

export function keycapGeometry(): BufferGeometry {
  const C = KEYS.cap;
  const M = 40; // angular samples
  const half = (t: number) => (C.base + (C.top - C.base) * t) / 2;
  // the rounded top edge's radius: the walls stop where it begins
  const r = C.topRadius * 0.45;
  const topHalf = C.top / 2;
  // the side, base to the top edge: [half-size, z]
  const sides: [number, number][] = [];
  for (let k = 0; k < C.rings; k++) {
    const t = k / (C.rings - 1);
    // the walls bow out a little near the base (a sculpted profile)
    const bow = Math.sin(t * Math.PI) * 0.012;
    sides.push([half(t) + bow, -r - (C.height - r) * (1 - t)]);
  }
  // the rounded top edge: a quarter turn of the edge radius from the wall onto the top
  for (let k = 1; k <= 3; k++) {
    const a = (k / 3) * (Math.PI / 2);
    sides.push([topHalf - r + Math.cos(a) * r, -r + Math.sin(a) * r]);
  }
  // the dish: concentric rings to the centre, sunk by the dish at the middle
  const inner = topHalf - r;
  const dish: [number, number][] = [];
  // (short of the centre: the fan below closes it, with no ring collapsed to a point)
  for (let k = 1; k < C.grid; k++) {
    const rho = 1 - k / C.grid; // 1 at the edge … just short of 0 at the centre
    dish.push([inner * rho, -C.dish * (1 - rho * rho)]);
  }
  const rings = [...sides, ...dish];
  const topStart = sides.length - 1; // the edge's last ring is the top surface's first

  const verts = rings.length * M + 1;
  const pos = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const top = new Float32Array(verts);
  const dir = Array.from({ length: M }, (_, j) => squircle((j / M) * Math.PI * 2));
  rings.forEach(([h, z], k) => {
    for (let j = 0; j < M; j++) {
      const [sx, sy] = dir[j] as [number, number];
      const v = k * M + j;
      pos.set([sx * h, sy * h, z], v * 3);
      const onTop = k >= topStart ? 1 : 0;
      top[v] = onTop;
      uv.set([(sx * h) / (2 * inner) + 0.5, (sy * h) / (2 * inner) + 0.5], v * 2);
    }
  });
  // the centre of the dish
  const centre = rings.length * M;
  pos.set([0, 0, -C.dish], centre * 3);
  uv.set([0.5, 0.5], centre * 2);
  top[centre] = 1;

  const index: number[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let j = 0; j < M; j++) {
      const a = k * M + j;
      const b = k * M + ((j + 1) % M);
      const c = (k + 1) * M + j;
      const d = (k + 1) * M + ((j + 1) % M);
      // outward-facing, counter-clockwise seen from outside
      index.push(a, b, d, a, d, c);
    }
  }
  const last = (rings.length - 1) * M;
  for (let j = 0; j < M; j++) index.push(last + j, last + ((j + 1) % M), centre);

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setAttribute("aTop", new BufferAttribute(top, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Triangles in a keycap (A5's budget: ≤ 1.5k). */
export const keycapTriangles = (g: BufferGeometry): number => (g.index?.count ?? 0) / 3;
