import { artifact, hashSeed, quantize, rng } from "./motion";
import { onTick } from "./ticker";

/**
 * SCRAMBLE (DESIGN.md §3.7): glyphs cycle in 30 fps steps and resolve left → right, ≤ 40 characters,
 * ≤ 600 ms. The HUD's section-label glitch is the same machine on a 200 ms clock. Every glyph here
 * is in the baked JetBrains Mono (tests/scramble.test.ts checks against the font manifest).
 */
export const SCRAMBLE_GLYPHS = "▖▗▘▙▚▛▜▝▞▟░▒▓#%&*+=<>/\\";

/** One frame per character at 30 fps, capped at 600 ms. */
export const scrambleMs = (text: string): number => Math.min(artifact.scrambleMaxMs, text.length * (1000 / artifact.fps));

/** How many characters (from the left) have resolved at `t` ms of `ms`. */
export const scrambleResolved = (length: number, t: number, ms: number): number => (ms <= 0 ? length : Math.floor(Math.min(1, Math.max(0, t / ms)) * length));

/** The frame at `t` ms of `ms`: a resolved prefix, then glyphs (spaces stay spaces). Pure. */
export function scrambleFrame(target: string, t: number, ms: number, random: () => number): string {
  const chars = [...target];
  const resolved = scrambleResolved(chars.length, t, ms);
  let out = chars.slice(0, resolved).join("");
  for (let i = resolved; i < chars.length; i++) {
    const ch = chars[i] ?? " ";
    out += /\s/.test(ch) ? ch : (SCRAMBLE_GLYPHS[Math.floor(random() * SCRAMBLE_GLYPHS.length)] ?? ch);
  }
  return out;
}

/**
 * Runs a scramble on the one RAF, writing `write(frame, resolved)` once per 30 fps step and the final
 * text last (resolved = its length). Returns a cancel that writes the final text immediately.
 */
export function runScramble(target: string, write: (text: string, resolved: number) => void, { ms = scrambleMs(target), seed = target }: { ms?: number; seed?: string } = {}): () => void {
  const length = [...target].length;
  let elapsed = 0;
  let lastStep = -1;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    off();
    write(target, length);
  };
  const off = onTick((dt) => {
    elapsed += dt * 1000;
    if (elapsed >= ms) {
      finish();
      return;
    }
    const step = quantize(elapsed);
    if (step === lastStep) return;
    lastStep = step;
    write(scrambleFrame(target, step, ms, rng(hashSeed(`${seed}:${step}`))), scrambleResolved(length, step, ms));
  });
  return finish;
}

// ── once per session ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = "retrograde:scrambled";

export function scrambledThisSession(key: string): boolean {
  try {
    return (JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[]).includes(key);
  } catch {
    return false;
  }
}

export function markScrambled(key: string): void {
  try {
    const seen = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "[]") as string[];
    if (!seen.includes(key)) sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen, key]));
  } catch {
    /* blocked storage: it scrambles again next load, which is harmless */
  }
}
