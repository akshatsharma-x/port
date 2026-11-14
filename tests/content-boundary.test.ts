import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Content is read on the server and handed to client components as props (content/derive.ts).
 * A "use client" module that reaches content/ — directly or through any chain of local imports —
 * would ship the dataset (and zod) to every visitor. `import type` is erased, so it's allowed.
 */
const ROOT = resolve(__dirname, "..");
const SCAN = ["app", "components", "hooks", "lib"];
/**
 * Allowed on the client: small dev fixtures, and NO SIGNAL's seven words — app/global-error.tsx
 * replaces the root layout, so nothing can hand them to it (content/no-signal.ts imports nothing).
 */
const ALLOWED = new Set(["content/kitchen-sink.ts", "content/dev-stage.ts", "content/no-signal.ts"]);
const EXT = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|mts)$/.test(name) ? [p] : [];
  });
}

const isClient = (code: string) => /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/.test(code);

/** Value imports and re-exports (not `import type` / `export type`), plus dynamic import(). */
function valueImports(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g)) if (!m[1] && m[2]) out.push(m[2]);
  for (const m of code.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) if (m[1]) out.push(m[1]);
  return out;
}

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of EXT) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/** The first chain from `entry` into content/, or null. */
function contentChain(entry: string): string[] | null {
  const seen = new Set<string>();
  const walk = (file: string, chain: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    const rel = relative(ROOT, file);
    if (rel.startsWith("content/") && !ALLOWED.has(rel)) return [...chain, rel];
    if (!/\.(tsx?|mts)$/.test(file)) return null;
    for (const spec of valueImports(readFileSync(file, "utf8"))) {
      const next = resolveLocal(file, spec);
      if (next) {
        const found = walk(next, [...chain, rel]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(entry, []);
}

describe("content boundary — content never ships as client JavaScript", () => {
  const clientFiles = SCAN.flatMap((d) => files(join(ROOT, d))).filter((f) => isClient(readFileSync(f, "utf8")));

  it("finds the client components", () => {
    expect(clientFiles.length).toBeGreaterThan(5);
  });

  it("no client module reaches content/ through value imports", () => {
    const leaks = clientFiles.map(contentChain).filter((c): c is string[] => c !== null).map((c) => c.join(" → "));
    expect(leaks).toEqual([]);
  });

  it("the detector catches a leak", () => {
    expect(valueImports(`"use client";\nimport { derived } from "@/content/derive";`)).toEqual(["@/content/derive"]);
    expect(valueImports(`import type { Content } from "@/content/schema";`)).toEqual([]);
    expect(valueImports(`const m = await import("../content/data");`)).toEqual(["../content/data"]);
  });
});
