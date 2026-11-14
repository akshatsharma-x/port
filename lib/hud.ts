/**
 * HUD text runs on the one RAF but writes rarely (DESIGN.md §4.1): readouts at 10 Hz, FPS at 2 Hz.
 * Writers register a callback with its rate; the stage tick calls flushHud() once per frame and
 * each callback runs at most `hz` times a second. Callbacks write textContent directly — no
 * React render per frame.
 */
export const HUD_HZ = { text: 10, fps: 2 } as const;

/** The owner's local time, as the HUD readout and the hero's micro-block both show it. */
export const localClock = (timeZone: string, countryCode?: string): Intl.DateTimeFormat =>
  // the zone as the owner's country writes it in English (IST, CET, EST — GMT+9 where English has
  // no name for it); en-GB named Asia/Kolkata "GMT+5:30"
  new Intl.DateTimeFormat(countryCode ? `en-${countryCode}` : "en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" });

/** The clock's widest reading over a year (summer time renames the zone), in mono cells: its fixed field. */
export const clockCells = (timeZone: string, countryCode?: string): number => {
  const f = localClock(timeZone, countryCode);
  return Math.max(...[0, 6].map((month) => f.format(new Date(Date.UTC(2026, month, 15, 12))).length));
};

type HudWriter = (now: number) => void;
interface Channel {
  intervalMs: number;
  last: number;
  writers: Set<HudWriter>;
}

const channels = new Map<number, Channel>();

export function onHud(hz: number, write: HudWriter): () => void {
  let ch = channels.get(hz);
  if (!ch) {
    ch = { intervalMs: 1000 / hz, last: Number.NEGATIVE_INFINITY, writers: new Set() };
    channels.set(hz, ch);
  }
  ch.writers.add(write);
  return () => ch.writers.delete(write);
}

/** Called by the stage tick every frame. */
export function flushHud(now: number): void {
  for (const ch of channels.values()) {
    if (ch.writers.size === 0 || now - ch.last < ch.intervalMs - 0.5) continue;
    ch.last = now;
    for (const w of ch.writers) w(now);
  }
}

/** Writes only when the text changed (no style/layout invalidation otherwise). */
export function setText(node: Node | null | undefined, text: string): void {
  if (node && node.textContent !== text) node.textContent = text;
}
