import { feedback } from "./motion";
import { jumpToHash } from "./navigation";

/**
 * Channels (PROMPTS.md Part 16, a seeded delight): the number keys tune the sections like a TV's.
 * Each section already wears its number ("[04] ARCHIVE", HALT's index "04 ARCHIVE"); pressing 4 shows
 * the set's on-screen display — CH 04 · ARCHIVE, in the corner, over the picture — and the TRACKING
 * TEAR takes you there, as the nav would. Invisible until discovered: no hint names it.
 *
 * The map is the page's own: HALT's index of the sections (home only; elsewhere there's nothing to
 * tune). Never while typing (a field, the terminal, CAPABILITIES' type-to-press, which claims its
 * keys first), in a dialog, or with a modifier. Loaded on idle (components/scroll/ScrollProvider).
 */
export function startChannels(): () => void {
  let timer = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || !/^[1-9]$/.test(e.key)) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], dialog") || document.querySelector("dialog[open]")) return;
    const want = e.key.padStart(2, "0");
    const link = [...document.querySelectorAll<HTMLAnchorElement>('.halt-index a[href^="#"]')].find((a) => a.textContent?.trim().startsWith(`${want} `));
    if (!link) return;
    e.preventDefault();
    const osd = document.querySelector<HTMLElement>(".channel-osd");
    const n = osd?.querySelector<HTMLElement>("[data-osd-n]");
    const name = osd?.querySelector<HTMLElement>("[data-osd-name]");
    if (osd && n && name) {
      n.textContent = want;
      name.textContent = link.textContent?.trim().slice(want.length + 1) ?? "";
      osd.hidden = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        osd.hidden = true;
      }, feedback.channelMs);
    }
    void jumpToHash(link.hash);
  };
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("keydown", onKey);
    window.clearTimeout(timer);
  };
}
