"use client";

import { extend } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { AmbientLight, DirectionalLight, Group, InstancedMesh, MeshLambertMaterial, Object3D, type BufferGeometry } from "three";
import { useSceneHandle, useTokenColor } from "../scene-api";

/**
 * What the five placeholder scenes share: unlit-ish monochrome (Lambert under one key light),
 * colors from tokens (identity is shape, not hue — DESIGN.md §2.4), instanced geometry only.
 * Placeholders for Part 3's harness; Parts 6–10 replace each scene wholesale.
 */
extend({ AmbientLight, DirectionalLight, Group, InstancedMesh, MeshLambertMaterial });

export const scratch = new Object3D();

export function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 6]} intensity={1.8} />
    </>
  );
}

/** Camera placement, once. */
export function useCamera(x: number, y: number, z: number): void {
  const h = useSceneHandle();
  useLayoutEffect(() => {
    h.camera.position.set(x, y, z);
    h.camera.lookAt(0, 0, 0);
  }, [h, x, y, z]);
}

/**
 * An InstancedMesh whose material color tracks a design token. `matrices` (16 floats per
 * instance) is written once at mount; scenes that animate instances update them per frame.
 */
export function Instances({
  count,
  matrices,
  token,
  meshRef,
  children,
}: {
  count: number;
  matrices: Float32Array;
  token: `--${string}`;
  meshRef?: React.RefObject<InstancedMesh | null>;
  /** the geometry element, e.g. <boxGeometry args={…} /> */
  children: ReactNode;
}) {
  const own = useRef<InstancedMesh>(null);
  const ref = meshRef ?? own;
  const color = useTokenColor(token);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.array.set(matrices.subarray(0, count * 16));
    mesh.instanceMatrix.needsUpdate = true;
    (mesh.material as MeshLambertMaterial).color = color; // the same Color object: theme changes apply in place
    mesh.computeBoundingSphere();
  }, [ref, matrices, count, color]);
  return (
    <instancedMesh ref={ref} args={[undefined as unknown as BufferGeometry, undefined, count]}>
      {children}
      <meshLambertMaterial />
    </instancedMesh>
  );
}
