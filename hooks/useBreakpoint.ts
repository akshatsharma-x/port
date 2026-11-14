"use client";

import { useSyncExternalStore } from "react";
import { BREAKPOINTS } from "@/lib/tokens";

export type Breakpoint = "base" | "sm" | "md" | "lg" | "xl" | "2xl";

export interface BreakpointState {
  bp: Breakpoint;
  /** DESIGN.md phone policy: coarse pointer and narrower than 768 px */
  isPhone: boolean;
  coarse: boolean;
}

const ORDER: readonly [Exclude<Breakpoint, "base">, number][] = [
  ["2xl", BREAKPOINTS["2xl"]],
  ["xl", BREAKPOINTS.xl],
  ["lg", BREAKPOINTS.lg],
  ["md", BREAKPOINTS.md],
  ["sm", BREAKPOINTS.sm],
];
const PHONE = `(pointer: coarse) and (max-width: ${BREAKPOINTS.md - 0.02}px)`;
const COARSE = "(pointer: coarse)";

const SERVER: BreakpointState = { bp: "lg", isPhone: false, coarse: false };
let snapshot: BreakpointState = SERVER;
let queries: MediaQueryList[] | null = null;

function compute(): BreakpointState {
  const width = window.innerWidth;
  const bp = ORDER.find(([, min]) => width >= min)?.[0] ?? "base";
  const isPhone = window.matchMedia(PHONE).matches;
  const coarse = window.matchMedia(COARSE).matches;
  if (snapshot.bp === bp && snapshot.isPhone === isPhone && snapshot.coarse === coarse) return snapshot;
  return { bp, isPhone, coarse };
}

function subscribe(onChange: () => void): () => void {
  queries ??= [
    ...ORDER.map(([, min]) => window.matchMedia(`(min-width: ${min}px)`)),
    window.matchMedia(PHONE),
    window.matchMedia(COARSE),
  ];
  const handler = () => {
    snapshot = compute();
    onChange();
  };
  for (const q of queries) q.addEventListener("change", handler);
  return () => {
    for (const q of queries ?? []) q.removeEventListener("change", handler);
  };
}

function getSnapshot(): BreakpointState {
  snapshot = compute();
  return snapshot;
}

/** Current breakpoint and phone policy. Renders the desktop default on the server. */
export function useBreakpoint(): BreakpointState {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}
