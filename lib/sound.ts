import { cue } from "./cues";
import { isTextEntry } from "./keys";
import { useUI } from "./store";

/**
 * Sound, as first-load code sees it (DESIGN.md §6.2). The engine (lib/audio.ts) is a lazy chunk:
 * it loads on the first enable — a gesture, so its AudioContext may start — or, when the saved
 * preference is ON, on the first gesture of the visit (and at boot, where the hum fades in only if
 * the browser lets the context run). Suspended when muted or when the tab is hidden. `S` toggles
 * (never while typing). Muted by default.
 */
type Audio = typeof import("./audio");
let audio: Promise<Audio> | null = null;

export const loadAudio = (): Promise<Audio> => (audio ??= import("./audio"));

/**
 * May an AudioContext start right now? After a gesture (sticky activation), or where the browser
 * says so. Otherwise creating one only earns a console warning and a suspended context: the
 * first gesture of the visit starts it instead (§6.2).
 */
export function audioMayStart(): boolean {
  const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean }; getAutoplayPolicy?: (kind: string) => string };
  return nav.userActivation?.hasBeenActive === true || nav.getAutoplayPolicy?.("audiocontext") === "allowed";
}


/** Turns sound on (call from a gesture) or off. */
export async function setSoundOn(on: boolean): Promise<void> {
  useUI.getState().setSound(on);
  if (on) {
    const engine = (await loadAudio()).getEngine();
    await engine.resume();
    cue("ENABLE");
    return;
  }
  const m = audio ? await audio : null;
  await m?.existingEngine()?.suspend();
}

/** The output level for the VU meter (dBFS), or null while there's no engine. */
export async function soundLevel(): Promise<number | null> {
  const m = audio ? await audio : null;
  const e = m?.existingEngine();
  return e && e.ctx.state === "running" ? e.level() : null;
}

/** Installs the hotkey and the lifecycle; returns the cleanup. */
export function installSound(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if ((e.key !== "s" && e.key !== "S") || e.metaKey || e.ctrlKey || e.altKey || isTextEntry(e.target)) return;
    void setSoundOn(!useUI.getState().sound);
  };
  // a saved ON resumes on the visit's first gesture (browsers start audio only after one)
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    if (useUI.getState().sound) void loadAudio().then((m) => m.getEngine().resume());
  };
  const onVisibility = () => {
    void (async () => {
      const m = audio ? await audio : null;
      const e = m?.existingEngine();
      if (!e) return;
      if (document.visibilityState === "hidden") await e.suspend();
      else if (useUI.getState().sound) await e.resume();
    })();
  };
  // COMMIT (§6.4): every button, chip and toggle ticks — one listener, ≥ 40 ms apart (the bus's
  // limit); `data-cue="none"` opts out (the SND switch plays ENABLE instead)
  const onCommit = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.("button, [role='button'], [role='switch'], input[type='radio'], input[type='checkbox'], .chip--toggle");
    if (el && !el.closest("[data-cue='none']") && el.getAttribute("aria-disabled") !== "true") cue("COMMIT");
  };
  document.addEventListener("click", onCommit, true);
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    document.removeEventListener("click", onCommit, true);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("pointerdown", onGesture, true);
    window.removeEventListener("keydown", onGesture, true);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
