/**
 * Every WebGL context the app creates goes through createGlContext(): at most two ever exist —
 * #stage (three.js) and #fx-gl (raw) — DESIGN.md §4.1. The registry is what the governor and the
 * dev overlay call "contexts alive". In ?debug=1 the <head> census (lib/theme-script.ts) also
 * records contexts created by anyone else, so a stray third context can't hide.
 */
export type ContextName = "stage" | "fx-gl";

export interface ContextRecord {
  name: ContextName;
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
}

const registry = new Map<ContextName, ContextRecord>();
let created = 0;

export function createGlContext(name: ContextName, canvas: HTMLCanvasElement, attributes: WebGLContextAttributes): WebGL2RenderingContext | null {
  const gl = canvas.getContext("webgl2", attributes);
  if (!gl) return null;
  created++;
  registry.set(name, { name, gl, canvas });
  return gl;
}

/** Forgets a context, optionally releasing it now rather than at GC. */
export function releaseGlContext(name: ContextName, lose = true): void {
  const rec = registry.get(name);
  if (!rec) return;
  if (lose && !rec.gl.isContextLost()) rec.gl.getExtension("WEBGL_lose_context")?.loseContext();
  registry.delete(name);
}

export const glContext = (name: ContextName): WebGL2RenderingContext | null => registry.get(name)?.gl ?? null;

export interface ContextCensus {
  /** contexts in our registry that aren't lost */
  alive: { name: ContextName; lost: boolean }[];
  aliveCount: number;
  /** contexts we created since load */
  created: number;
  /** every WebGL context any code created (debug census), or null when the census isn't installed */
  seen: number | null;
  seenAlive: number | null;
}

export function contextCensus(): ContextCensus {
  const alive = [...registry.values()].map((r) => ({ name: r.name, lost: r.gl.isContextLost() }));
  const all = typeof window === "undefined" ? undefined : (window as Window & { __glContexts?: (WebGLRenderingContext | WebGL2RenderingContext)[] }).__glContexts;
  return {
    alive,
    aliveCount: alive.filter((a) => !a.lost).length,
    created,
    seen: all ? all.length : null,
    seenAlive: all ? all.filter((c) => !c.isContextLost()).length : null,
  };
}
