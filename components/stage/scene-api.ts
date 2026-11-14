"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { Color, LinearSRGBColorSpace, PerspectiveCamera, Scene } from "three";
import { governor } from "@/lib/sceneManager";
import { MAX_DT } from "@/lib/spring";
import type { SceneId } from "@/lib/tier";
import { tokenLinear } from "@/lib/token-color";

/**
 * How a scene talks to the stage. Every scene renders into its own THREE.Scene through an R3F
 * portal; the governor decides when it draws. Scenes never use useFrame: their frame callbacks run
 * only while they're LIVE (a WARM or COOLING scene costs no CPU), with dt clamped to MAX_DT.
 * Lazy-chunk only (imports three).
 */
export type FrameCallback = (dt: number, t: number) => void;

export interface SceneHandle {
  readonly id: SceneId;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly frame: Set<FrameCallback>;
  /** draws through the stage's post chain (Bloom + RetroEffect, DESIGN.md §5.1) */
  readonly post: boolean;
  setPost(on: boolean): void;
  /** false ⇒ the governor renders this scene on demand only */
  isAnimating(): boolean;
  setAnimating(animating: boolean): void;
  /** advances every LIVE frame (s), so animation is continuous across route changes */
  time: number;
  /** the slot's drawn region, CSS px (set before every frame) */
  readonly size: { width: number; height: number };
  /** 0–1: the scene's own fling (A4's rail), which adds the post chain's aberration as a scroll fling does */
  readonly fling: number;
  setFling(amount: number): void;
  setSize(width: number, height: number): void;
  invalidate(): void;
}

export interface SceneProps<Data = unknown> {
  data: Data;
}

const FOV = 35;

export function createSceneHandle(id: SceneId): SceneHandle {
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  let w = 0;
  let h = 0;
  let animating = true;
  const size = { width: 0, height: 0 };
  return {
    id,
    scene,
    camera,
    frame: new Set(),
    post: false,
    setPost(on) {
      (this as { post: boolean }).post = on;
    },
    isAnimating: () => animating,
    setAnimating(on) {
      if (on && !animating) governor.invalidate(id);
      animating = on;
    },
    time: 0,
    fling: 0,
    setFling(amount) {
      (this as { fling: number }).fling = amount;
    },
    size,
    setSize(width, height) {
      if (width === w && height === h) return;
      w = width;
      h = height;
      size.width = width;
      size.height = height;
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    invalidate: () => governor.invalidate(id),
  };
}

/** Runs the LIVE scene's frame callbacks (called by the stage renderer right before it draws). */
export function stepScene(handle: SceneHandle, rawDt: number): void {
  const dt = Math.min(Math.max(rawDt, 0), MAX_DT);
  handle.time += dt;
  for (const cb of handle.frame) cb(dt, handle.time);
}

export const SceneContext = createContext<SceneHandle | null>(null);

export function useSceneHandle(): SceneHandle {
  const h = useContext(SceneContext);
  if (!h) throw new Error("useSceneHandle: not inside a stage scene");
  return h;
}

/** A per-frame callback, run only while this scene is LIVE. */
export function useSceneFrame(cb: FrameCallback): void {
  const h = useSceneHandle();
  const ref = useRef(cb);
  useLayoutEffect(() => {
    ref.current = cb;
  });
  useLayoutEffect(() => {
    const f: FrameCallback = (dt, t) => ref.current(dt, t);
    h.frame.add(f);
    return () => {
      h.frame.delete(f);
    };
  }, [h]);
}

/** The scene draws through the stage's post chain (the hero, and the stages after it). */
export function useStagePost(): void {
  const h = useSceneHandle();
  useLayoutEffect(() => {
    h.setPost(true);
    h.invalidate();
    return () => h.setPost(false);
  }, [h]);
}

/** Declares whether the scene is moving; at rest it's rendered on demand only. */
export function useSceneAnimating(animating: boolean): void {
  const h = useSceneHandle();
  useLayoutEffect(() => {
    h.setAnimating(animating);
  }, [h, animating]);
}

// ── theme-following colors ──────────────────────────────────────────────────────────────

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;

function onThemeChange(cb: () => void): () => void {
  if (!themeObserver && typeof MutationObserver !== "undefined") {
    themeObserver = new MutationObserver(() => themeListeners.forEach((l) => l()));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

const setFromToken = (c: Color, name: string) => {
  const [r, g, b] = tokenLinear(name);
  return c.setRGB(r, g, b, LinearSRGBColorSpace);
};

/** A THREE.Color read from a design token, updated in place when the theme changes. */
export function useTokenColor(name: `--${string}`): Color {
  const h = useSceneHandle();
  const [color] = useState(() => setFromToken(new Color(), name));
  useLayoutEffect(() => {
    setFromToken(color, name);
    return onThemeChange(() => {
      setFromToken(color, name);
      h.invalidate();
    });
  }, [color, name, h]);
  return color;
}

/** Same, for non-hook code (instance colors). */
export const tokenColor = (name: `--${string}`, out = new Color()): Color => setFromToken(out, name);
export { onThemeChange };
