"use client";

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useUI } from "@/lib/store";
import { KONAMI, konamiStep, openTerminal, opensTerminal } from "@/lib/terminal";

/**
 * The terminal's first-load part (DESIGN.md §7.4 SHELL; PROMPTS.md Part 13): the keys that open it
 * (~ and /; the HUD's ~ key is in Nav), the Konami code, and the panel's chunk, fetched on the first
 * open and never before. The terminal is additive: if its chunk fails to load or it breaks, it's
 * gone and nothing else is touched.
 */

/** The few words the panel needs before its index arrives (or if it never does). */
export interface ShellBoot {
  label: string;
  close: string;
  input: string;
  output: string;
  user: string;
  host: string;
  tty: string;
  os: string;
  loading: string;
  offline: string;
}

class Guard extends Component<{ children: ReactNode }, { broken: boolean }> {
  override state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  override componentDidCatch() {
    useUI.getState().setTerminalOpen(false);
  }
  override render() {
    return this.state.broken ? null : this.props.children;
  }
}

export function ShellLauncher({ boot }: { boot: ShellBoot }) {
  const open = useUI((s) => s.terminalOpen);
  const [Panel, setPanel] = useState<ComponentType<{ boot: ShellBoot }> | null>(null);

  useEffect(() => {
    let konami = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      konami = konamiStep(konami, e);
      if (konami === KONAMI.length) {
        konami = 0;
        void import("@/lib/degauss").then((m) => m.degauss()).catch(() => undefined);
        return;
      }
      if (useUI.getState().terminalOpen || !opensTerminal(e)) return;
      e.preventDefault(); // the key opens the panel; it isn't typed into it
      openTerminal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || Panel) return;
    let live = true;
    import("./Terminal")
      .then((m) => live && setPanel(() => m.default))
      .catch(() => useUI.getState().setTerminalOpen(false)); // the next open tries again
    return () => {
      live = false;
    };
  }, [open, Panel]);

  return Panel ? (
    <Guard>
      <Panel boot={boot} />
    </Guard>
  ) : null;
}
