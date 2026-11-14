/**
 * The terminal (DESIGN.md §7.4 SHELL; PROMPTS.md Part 13). Until it exists, nothing points at it:
 * the nav's `~` key is present but aria-disabled, and the hero's "PRESS ~ FOR TERMINAL" hint (§7.4
 * SYSTEM) is built but held — a hint for a key that does nothing would be untrue (Global Rules #4).
 */
export const TERMINAL = { ready: false } as const;
