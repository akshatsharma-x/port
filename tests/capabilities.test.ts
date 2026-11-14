import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import * as simpleIcons from "simple-icons";
import { PerspectiveCamera } from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { keycapGeometry, keycapTriangles } from "@/components/stage/keycaps/geometry";
import { Pile, type PileFrame } from "@/components/stage/keycaps/pile";
import { derived } from "@/content/derive";
import { SKILL_RUBRIC, type SkillLevel } from "@/content/schema";
import { stageData } from "@/content/stage-data";
import { clackIntensity, evidenceLine, KEYS, levelLabel, matchTyped, typeKey, useKeys, yearsLabel } from "@/lib/capabilities";
import { cloudFit, extents, homes } from "@/lib/capabilities-layout";
import { cueLog, resetCues } from "@/lib/cues";
import { TIERS } from "@/lib/tier";
import { KEYCAPS_JSON, keycapsInputHash, legendSpecs, LEGENDS_OUT, MATCAP_THEMES, matcapOut } from "../scripts/bake/keycaps";

/** A5 · CAPABILITIES (DESIGN.md §4.3 A5, §7.4): the keycap, the pile's layout and its sim, type-to-press, the panel's words, the bake. */
const ROOT = resolve(__dirname, "..");
const DESIGN = readFileSync(resolve(ROOT, "DESIGN.md"), "utf8");
const K = stageData(derived).keys;
const FOV = 35;
const R2 = 2 * KEYS.sim.radius;

const minPair = (h: { x: number; y: number; z: number }[]) => {
  let min = Infinity;
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) min = Math.min(min, Math.hypot((h[i]?.x ?? 0) - (h[j]?.x ?? 0), (h[i]?.y ?? 0) - (h[j]?.y ?? 0), (h[i]?.z ?? 0) - (h[j]?.z ?? 0)));
  return min;
};
const focuses = [null, ...Array.from({ length: K.categories }, (_, c) => c)];

describe("the sculpted keycap", () => {
  const g = keycapGeometry();

  it("stays within A5's 1.5k triangles", () => {
    expect(keycapTriangles(g)).toBeLessThanOrEqual(1500);
  });

  it("faces its legend to the camera: the dish on top, its UVs across the cell, its normals toward +z", () => {
    const pos = g.getAttribute("position");
    const top = g.getAttribute("aTop");
    const uv = g.getAttribute("uv");
    const n = g.getAttribute("normal");
    let count = 0;
    let nz = 0;
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getZ(i)).toBeGreaterThanOrEqual(-KEYS.cap.height - 1e-6);
      expect(pos.getZ(i)).toBeLessThanOrEqual(1e-6);
      if (top.getX(i) < 0.5) continue;
      count++;
      nz += n.getZ(i);
      expect(pos.getZ(i)).toBeGreaterThanOrEqual(-KEYS.cap.dish - 1e-6);
      for (const c of [uv.getX(i), uv.getY(i)]) {
        expect(c).toBeGreaterThanOrEqual(-1e-6);
        expect(c).toBeLessThanOrEqual(1 + 1e-6);
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(nz / count).toBeGreaterThan(0.9);
  });

  it("stands on its 1u base", () => {
    g.computeBoundingBox();
    const b = g.boundingBox;
    expect((b?.max.x ?? 0) - (b?.min.x ?? 0)).toBeCloseTo(KEYS.cap.base, 1);
    expect((b?.max.y ?? 0) - (b?.min.y ?? 0)).toBeCloseTo(KEYS.cap.base, 1);
  });
});

describe("the pile's layout: a cluster per category, homes the sim can rest at", () => {
  const ASPECTS = [0.75, 1, 1.33, 1.6, 2, 2.4, 3.5];
  const fits = ASPECTS.map((aspect) => cloudFit(K.keys, K.categories, aspect, FOV));
  /** where a home looks from the camera, in the cloud's own units (its middle `depth` away), and how big its sphere looks */
  const seen = (p: { x: number; y: number; z: number }, depth: number) => {
    const s = depth / (depth - p.z);
    return { x: p.x * s, y: p.y * s, r: KEYS.sim.radius * s };
  };

  it("is the same every load", () => {
    expect(homes(K.keys, K.categories)).toEqual(homes(K.keys, K.categories));
    const view = { columns: 2, depth: 18, aspect: 2 };
    expect(homes(K.keys, K.categories, 1, view)).toEqual(homes(K.keys, K.categories, 1, view));
  });

  it("never puts two homes nearer than two sphere radii, however it's arranged or gathered", () => {
    for (let columns = 1; columns <= K.categories; columns++) expect(minPair(homes(K.keys, K.categories, null, { columns }))).toBeGreaterThanOrEqual(R2);
    for (const f of fits) for (const focus of focuses) expect(minPair(homes(K.keys, K.categories, focus, f)), `aspect ${f.aspect}, gathered ${focus}`).toBeGreaterThanOrEqual(R2);
  });

  it("keeps the categories apart by the gap: no two keys of different categories nearer", () => {
    for (let columns = 1; columns <= K.categories; columns++) {
      const h = homes(K.keys, K.categories, null, { columns });
      for (let i = 0; i < h.length; i++) {
        for (let j = i + 1; j < h.length; j++) {
          if (K.keys[i]?.category === K.keys[j]?.category) continue;
          expect(Math.hypot((h[i]?.x ?? 0) - (h[j]?.x ?? 0), (h[i]?.y ?? 0) - (h[j]?.y ?? 0))).toBeGreaterThanOrEqual(KEYS.cloud.gap - 1e-9);
        }
      }
    }
  });

  it("gathers a category forward to the middle and parts the rest to either side: on screen, nothing behind it", () => {
    for (const f of fits) {
      for (let c = 0; c < K.categories; c++) {
        const h = homes(K.keys, K.categories, c, f);
        const mine = h.filter((_, i) => K.keys[i]?.category === c);
        const rest = h.filter((_, i) => K.keys[i]?.category !== c);
        const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
        expect(Math.abs(mean(mine.map((p) => p.x)))).toBeLessThan(KEYS.cloud.spacing);
        expect(Math.abs(mean(mine.map((p) => p.y)))).toBeLessThan(KEYS.cloud.spacing);
        expect(Math.min(...mine.map((p) => p.z)) - Math.max(...rest.map((p) => p.z))).toBeGreaterThanOrEqual(R2);
        for (const m of mine) {
          const a = seen(m, f.depth);
          for (const o of rest) {
            const b = seen(o, f.depth);
            expect(Math.hypot(a.x - b.x, a.y - b.y), `aspect ${f.aspect}, gathered ${c}`).toBeGreaterThanOrEqual(a.r + b.r);
          }
        }
        // the rest keep their order as you read them: left to right — parted above and below, the row above first
        const at = (k: number, axis: "x" | "y") => mean(h.filter((_, i) => K.keys[i]?.category === k).map((o) => o[axis]));
        const order = Array.from({ length: K.categories }, (_, k) => k)
          .filter((k) => k !== c)
          .sort((p, q) => (Math.abs(at(q, "y") - at(p, "y")) > KEYS.cloud.spacing * 2 ? at(q, "y") - at(p, "y") : at(p, "x") - at(q, "x")));
        expect(order, `aspect ${f.aspect}, gathered ${c}`).toEqual([...order].sort((p, q) => p - q));
      }
    }
    expect(() => homes(K.keys, K.categories, 1)).toThrow(/depth/);
  });

  it("fits the band: a row across a laptop's, a block in a tall one, at its share, inside the walls however it's gathered", () => {
    const tan = Math.tan((FOV / 2) * (Math.PI / 180));
    for (const f of fits) {
      const e = extents(homes(K.keys, K.categories, null, { columns: f.columns }));
      const w = e.x / (tan * f.aspect * f.depth);
      const hh = e.y / (tan * f.depth);
      expect(w).toBeLessThanOrEqual(KEYS.cloud.fill + 1e-9);
      expect(hh).toBeLessThanOrEqual(KEYS.cloud.fillHeight + 1e-9);
      expect(Math.max(w / KEYS.cloud.fill, hh / KEYS.cloud.fillHeight)).toBeCloseTo(1, 9);
      for (const focus of focuses) {
        for (const p of homes(K.keys, K.categories, focus, f)) {
          // the side walls widen with depth, as the view does
          const wide = (f.depth - p.z) / f.depth;
          expect(Math.abs(p.x) + KEYS.sim.radius * wide, `aspect ${f.aspect}, gathered ${focus}`).toBeLessThanOrEqual(f.bounds.x * wide);
          expect(Math.abs(p.y) + KEYS.sim.radius * wide, `aspect ${f.aspect}, gathered ${focus}`).toBeLessThanOrEqual(f.bounds.y * wide);
          expect(p.z - f.depth).toBeGreaterThanOrEqual(f.bounds.zFar);
          expect(p.z - f.depth).toBeLessThanOrEqual(f.bounds.zNear);
        }
      }
    }
    expect(cloudFit(K.keys, K.categories, 2, FOV).columns).toBe(K.categories);
    expect(cloudFit(K.keys, K.categories, 0.8, FOV).columns).toBeLessThan(K.categories);
  });
});

describe("the micro-sim (HIGH) and the float (MID), headless", () => {
  const W = 1440;
  const H = 720;
  const camera = new PerspectiveCamera(FOV, W / H, 0.1, 100);
  const data = { keys: K.keys, categories: K.categories, legends: new Uint8Array(KEYS.atlas.size ** 2), matcaps: new Uint8Array(KEYS.matcap.size ** 2 * 4 * 3) };
  let clock = 0;
  const frame = (pile: Pile, pointer: PileFrame["pointer"] = null) => pile.frame({ dt: 1 / 60, time: (clock += 1 / 60), camera, width: W, height: H, pointer, still: false });
  /** frames until the pile asks for none; the seconds it took */
  const settle = (pile: Pile, maxS = 8) => {
    for (let n = 1; n <= maxS * 60; n++) if (!frame(pile)) return n / 60;
    return Infinity;
  };
  const offHome = (pile: Pile) => {
    const s = pile.debugState();
    return Math.max(...Array.from({ length: s.count }, (_, i) => Math.hypot((s.positions[i * 3] ?? 0) - (s.homes[i * 3] ?? 0), (s.positions[i * 3 + 1] ?? 0) - (s.homes[i * 3 + 1] ?? 0), (s.positions[i * 3 + 2] ?? 0) - (s.homes[i * 3 + 2] ?? 0))));
  };
  const screenOf = (pile: Pile, i: number) => {
    const s = pile.debugState().screen;
    return { x: s[i * 3] ?? 0, y: s[i * 3 + 1] ?? 0 };
  };

  beforeEach(() => {
    resetCues();
    useKeys.setState({ hovered: null, lit: null, cluster: null });
  });

  it("comes to rest at its homes and sleeps", () => {
    const pile = new Pile(data, "sim");
    expect(settle(pile)).toBeLessThanOrEqual(KEYS.sim.sleepAfter + 0.5);
    expect(pile.debugState().asleep).toBe(true);
    expect(offHome(pile)).toBeLessThan(0.01);
  });

  it("throws a grabbed key: it flies, clacks, and drifts home to sleep", () => {
    const pile = new Pile(data, "sim");
    settle(pile);
    const i = K.keys.findIndex((k) => k.slug === "python");
    const at = screenOf(pile, i);
    expect(pile.pointerDown(at.x, at.y, 0)).toBe(i);
    for (let n = 1; n <= 8; n++) {
      pile.pointerMove(at.x + n * 45, at.y - n * 10, camera);
      frame(pile);
    }
    expect(pile.debugState().grabbed).toBe(i);
    expect(pile.pointerUp()).toBe(-1); // a throw, not a click
    let far = 0;
    for (let n = 0; n < 30; n++) {
      frame(pile);
      far = Math.max(far, offHome(pile));
    }
    expect(far).toBeGreaterThan(1);
    expect(cueLog.played.get("KEYCAP") ?? 0).toBeGreaterThan(0);
    expect(settle(pile)).toBeLessThan(8);
    expect(offHome(pile)).toBeLessThan(0.01);
  });

  it("presses a clicked key: a clack, its row lit, and back to sleep", () => {
    const pile = new Pile(data, "sim");
    settle(pile);
    const at = screenOf(pile, 3);
    expect(pile.pointerDown(at.x, at.y, 0)).toBe(3);
    expect(pile.pointerUp()).toBe(3);
    pile.pressKey(3);
    expect(cueLog.played.get("KEYCAP")).toBe(1);
    expect(useKeys.getState().lit?.index).toBe(3);
    expect(frame(pile)).toBe(true);
    expect(settle(pile)).toBeLessThan(4);
  });

  it("hovers the key under the pointer", () => {
    const pile = new Pile(data, "sim");
    settle(pile);
    frame(pile, screenOf(pile, 5));
    expect(useKeys.getState().hovered).toBe(5);
    frame(pile, { x: 2, y: 2 });
    expect(useKeys.getState().hovered).toBeNull();
  });

  it("gathers by a category and sleeps there, the category in front", () => {
    const pile = new Pile(data, "sim");
    settle(pile);
    pile.setCluster(1);
    expect(settle(pile)).toBeLessThan(8);
    const s = pile.debugState();
    const z = (i: number) => s.positions[i * 3 + 2] ?? 0;
    const front = K.keys.flatMap((k, i) => (k.category === 1 ? [z(i)] : []));
    const back = K.keys.flatMap((k, i) => (k.category !== 1 ? [z(i)] : []));
    expect(Math.min(...front)).toBeGreaterThan(Math.max(...back));
  });

  it("costs well under A5's 0.3 ms a frame, thrown into the pile", () => {
    const pile = new Pile(data, "sim");
    settle(pile);
    const at = screenOf(pile, 0);
    pile.pointerDown(at.x, at.y, 0);
    for (let n = 1; n <= 6; n++) {
      pile.pointerMove(at.x + n * 80, at.y, camera);
      frame(pile);
    }
    pile.pointerUp();
    const t0 = performance.now();
    const frames = 240;
    for (let n = 0; n < frames; n++) frame(pile);
    expect((performance.now() - t0) / frames).toBeLessThan(0.3);
  });

  it("floats on MID: no throw, but a click still presses", () => {
    const pile = new Pile(data, "float");
    for (let n = 0; n < 120; n++) frame(pile);
    const at = screenOf(pile, 2);
    pile.pointerDown(at.x, at.y, 0);
    pile.pointerMove(at.x + 200, at.y, camera);
    expect(pile.debugState().grabbed).toBe(-1);
    expect(pile.pointerUp()).toBe(-1);
    const click = screenOf(pile, 2);
    pile.pointerDown(click.x, click.y, 0);
    expect(pile.pointerUp()).toBe(2);
  });

  it("clacks in proportion to the hit: silent under clackMin, full at clackFull", () => {
    expect(clackIntensity(KEYS.sim.clackMin)).toBe(0);
    expect(clackIntensity((KEYS.sim.clackMin + KEYS.sim.clackFull) / 2)).toBeCloseTo(0.5, 9);
    expect(clackIntensity(KEYS.sim.clackFull * 2)).toBe(1);
  });
});

describe("type-to-press", () => {
  const terms = derived.skills.all.map((s) => [s.name, s.legend.label, ...(s.aliases ?? [])]);
  const at = (slug: string) => derived.skills.all.findIndex((s) => s.slug === slug);

  it("presses the key a typed run ends in, the longest name first", () => {
    expect(matchTyped("java", terms)).toBe(at("java"));
    expect(matchTyped("javascript", terms)).toBe(at("javascript"));
    expect(matchTyped("qqpython", terms)).toBe(at("python"));
    expect(matchTyped("next.js", terms)).toBe(at("next-js"));
    expect(matchTyped("nextjs", terms)).toBe(at("next-js"));
    expect(matchTyped("c++", terms)).toBe(at("c-cpp"));
    expect(matchTyped("rag", terms)).toBe(at("rag"));
    expect(matchTyped("ragas", terms)).toBe(at("ragas"));
    expect(matchTyped("postgresql", terms)).toBe(at("postgresql"));
  });

  it("reads the legends too", () => {
    expect(matchTyped("js", terms)).toBe(at("javascript"));
    expect(matchTyped("py", terms)).toBe(at("python"));
    expect(matchTyped("ts", terms)).toBe(at("typescript"));
  });

  it("never presses on one letter or on what it doesn't know", () => {
    for (const run of ["g", "s", "~", "zzzz", ""]) expect(matchTyped(run, terms)).toBeNull();
  });

  it("compares letters, digits, + and # only", () => {
    expect(typeKey("Socket.IO")).toBe("socketio");
    expect(typeKey("C/C++")).toBe("cc++"); // the "C++" legend is what "c++" matches
  });
});

describe("the panel's words: the rubric and the evidence, never a percentage", () => {
  const L = derived.site.labels.capabilities;

  it("labels each level by the rubric DESIGN.md names", () => {
    const labels = ([1, 2, 3, 4, 5] as SkillLevel[]).map((l) => levelLabel(L.level, l, SKILL_RUBRIC[l]));
    expect(labels).toEqual(["L1 USED", "L2 BUILT", "L3 SHIPPED", "L4 LED", "L5 TAUGHT/PUBLISHED"]);
    expect(DESIGN).toContain(`\`${labels.join(" · ")}\``);
    for (const s of derived.skills.all) expect(s.rubric).toBe(SKILL_RUBRIC[s.level as SkillLevel]);
  });

  it("says what a skill was used in, counted from the content", () => {
    expect(evidenceLine({ projects: [1, 2, 3, 4], papers: [1, 2], roles: [] }, L.evidence)).toBe("In 4 projects · 2 papers");
    expect(evidenceLine({ projects: [1], papers: [], roles: [1] }, L.evidence)).toBe("In 1 project · 1 role");
    expect(evidenceLine({ projects: [], papers: [], roles: [] }, L.evidence)).toBe(L.evidence.none);
    expect(yearsLabel(1, L.years)).toBe("1 year");
    expect(yearsLabel(3, L.years)).toBe("3 years");
  });

  it("never rates itself in a percentage", () => {
    expect(JSON.stringify(L)).not.toMatch(/%|percent/i);
  });
});

describe("the stage data: a key per skill", () => {
  it("holds every skill in content order, with its category, its primary flag and its cell", () => {
    const all = derived.skills.all;
    const cats = derived.skills.categories.map((c) => c.category);
    expect(K.keys.map((k) => k.slug)).toEqual(all.map((s) => s.slug));
    expect(K.keys.length).toBeLessThanOrEqual(KEYS.maxKeys);
    expect(K.categories).toBe(cats.length);
    K.keys.forEach((k, i) => {
      expect(k.cell).toBe(i);
      expect(k.category).toBe(cats.indexOf(all[i]?.category ?? ""));
    });
    expect(K.keys.filter((k) => k.primary).map((k) => k.slug).sort()).toEqual(derived.skills.primary.map((s) => s.slug).sort());
  });

  it("points at the files the bake wrote", () => {
    for (const url of [K.legends, ...Object.values(K.matcaps)]) expect(existsSync(resolve(ROOT, `public${url}`))).toBe(true);
    expect(`/${LEGENDS_OUT.replace(/^public\//, "")}`).toBe(K.legends);
  });
});

describe("the bake: the legend atlas and the matcaps", () => {
  const meta = JSON.parse(readFileSync(resolve(ROOT, KEYCAPS_JSON), "utf8")) as { inputHash: string; legends: { slug: string; cell: number }[] };

  it("is fresh: its input hash recomputes from the legends, the marks and the face", () => {
    const fontHash = createHash("sha256").update(readFileSync(resolve(ROOT, "app/fonts/JetBrainsMono-Variable.woff2"))).digest("hex").slice(0, 16);
    expect(meta.inputHash).toBe(keycapsInputHash(legendSpecs(), fontHash));
    expect(meta.legends.map((l) => l.slug)).toEqual(derived.skills.all.map((s) => s.slug));
  });

  it("names only marks the CC0 Simple Icons set carries", () => {
    const slugs = new Set((Object.values(simpleIcons) as unknown[]).flatMap((x) => (x && typeof x === "object" && "slug" in x ? [(x as { slug: string }).slug] : [])));
    for (const s of derived.skills.all) if (s.legend.icon) expect(slugs.has(s.legend.icon), s.legend.icon).toBe(true);
    expect(legendSpecs().filter((s) => s.path).length).toBe(derived.skills.all.filter((s) => s.legend.icon).length);
  });

  it("is a 1024² lossless WebP within 90 KB: a legend inside every key's cell, nothing past them", async () => {
    expect(statSync(resolve(ROOT, LEGENDS_OUT)).size).toBeLessThanOrEqual(KEYS.atlas.maxBytes);
    const { data, info } = await sharp(resolve(ROOT, LEGENDS_OUT)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([KEYS.atlas.size, KEYS.atlas.size]);
    const cols = KEYS.atlas.cols;
    const cell = KEYS.atlas.size / cols;
    const border = 3;
    for (let c = 0; c < cols * cols; c++) {
      const x0 = Math.round((c % cols) * cell);
      const y0 = Math.round(Math.floor(c / cols) * cell);
      const x1 = Math.round((c % cols) * cell + cell);
      const y1 = Math.round(Math.floor(c / cols) * cell + cell);
      let ink = 0;
      let edge = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const a = data[(y * info.width + x) * 4 + 3] ?? 0;
          ink += a;
          if (x < x0 + border || x >= x1 - border || y < y0 + border || y >= y1 - border) edge += a;
        }
      }
      const share = ink / ((x1 - x0) * (y1 - y0) * 255);
      if (c < K.keys.length) {
        expect(share, `cell ${c}`).toBeGreaterThan(0.02);
        expect(edge, `cell ${c}'s border`).toBe(0); // its mips never bleed into a neighbour
      } else expect(ink, `cell ${c}`).toBe(0);
    }
  });

  it("has a matcap per theme within 12 KB: a lit sphere, daylight the brightest, each tube's rim its tint", async () => {
    const read = async (t: (typeof MATCAP_THEMES)[number]) => {
      expect(statSync(resolve(ROOT, matcapOut(t))).size).toBeLessThanOrEqual(KEYS.matcap.maxBytes);
      const { data, info } = await sharp(resolve(ROOT, matcapOut(t))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([KEYS.matcap.size, KEYS.matcap.size]);
      const px = (u: number, v: number) => {
        const o = (Math.round(v * (info.height - 1)) * info.width + Math.round(u * (info.width - 1))) * 3;
        return [data[o] ?? 0, data[o + 1] ?? 0, data[o + 2] ?? 0] as const;
      };
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] ?? 0;
      return { mean: sum / data.length, rim: px(0.5, 0.985), lit: px(0.33, 0.25), shade: px(0.7, 0.8) };
    };
    const [phosphor, amber, paper] = await Promise.all(MATCAP_THEMES.map(read));
    for (const m of [phosphor, amber, paper]) expect(m?.lit[1]).toBeGreaterThan(m?.shade[1] ?? 255); // the key light up and to the left
    expect(paper?.mean).toBeGreaterThan(phosphor?.mean ?? 255);
    expect(phosphor?.rim[1]).toBeGreaterThan(phosphor?.rim[0] ?? 255);
    expect(amber?.rim[0]).toBeGreaterThan(amber?.rim[2] ?? 255);
  });
});

describe("A5's budget and editions", () => {
  it("holds at most 40 keys, within A5's 6 MB of VRAM", () => {
    expect(KEYS.maxKeys).toBeLessThanOrEqual(40);
    const g = keycapGeometry();
    const geometry = Object.values(g.attributes).reduce((n, a) => n + (a.array as Float32Array).byteLength, 0) + ((g.index?.array as Uint16Array | Uint32Array | undefined)?.byteLength ?? 0);
    const mips = 4 / 3;
    const textures = KEYS.atlas.size ** 2 * mips + KEYS.matcap.size ** 2 * 4 * 3 * mips;
    const instances = KEYS.maxKeys * (16 + 4 + 16 + 2) * 4;
    expect((geometry + textures + instances) / 2 ** 20).toBeLessThanOrEqual(6);
  });

  it("runs the micro-sim on HIGH, the float on MID and the HTML edition below (DESIGN.md §5)", () => {
    expect([TIERS.HIGH.keycaps, TIERS.MID.keycaps, TIERS.LOW.keycaps, TIERS.OFF.keycaps]).toEqual(["micro-physics", "sine-float", "html", "html"]);
    expect(DESIGN).toMatch(/\| Keycaps \| micro-physics \| sine float \+ hover \| HTML edition \| HTML edition \|/);
  });

  it("steps at 1/120 s and settles within the motion rules (no tween over 900 ms)", () => {
    expect(KEYS.sim.step).toBeCloseTo(1 / 120, 12);
    expect(KEYS.press.ms).toBeLessThanOrEqual(900);
    expect(KEYS.typeResetMs).toBeLessThanOrEqual(900);
  });
});
