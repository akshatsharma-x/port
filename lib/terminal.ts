import { track } from "@/lib/analytics";
import { useUI } from "./store";

/**
 * The terminal (DESIGN.md §7.4 SHELL; PROMPTS.md Part 13): first-load is only what opens it — the
 * ~ and / keys, the HUD's ~ key — and the Konami code's listener. The panel, its commands, the
 * index and the degauss load on first use (components/shell/ShellLauncher.tsx).
 */
export const TERMINAL = { ready: true } as const;

export const openTerminal = (): void => {
  if (!useUI.getState().terminalOpen) track("terminal_open");
  useUI.getState().setTerminalOpen(true);
};

const TEXT_INPUTS = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

/** A field that takes typing: a key pressed there is the field's, never a shortcut. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUTS.has(target.type);
}

/** ~ or / opens the terminal — not while typing somewhere, not with a modifier, not over another dialog. */
export function opensTerminal(e: KeyboardEvent): boolean {
  if (e.key !== "~" && e.key !== "/") return false;
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || isTextEntry(e.target)) return false;
  return !document.querySelector("dialog:modal");
}

/** ↑ ↑ ↓ ↓ ← → ← → B A */
export const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"] as const;

/** Feeds one key to the Konami sequence; returns how far along it is now (KONAMI.length: done). */
export function konamiStep(at: number, e: KeyboardEvent): number {
  if (isTextEntry(e.target)) return 0;
  const key = e.key.toLowerCase();
  if (key === KONAMI[at]) return at + 1;
  return key === KONAMI[0] ? 1 : 0;
}
