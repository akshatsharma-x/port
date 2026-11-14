/**
 * The icon set (PROMPTS.md Part 15), all drawn from app/icon.svg — the block caret on Phosphor's
 * ground — by scripts/bake/icons.ts: favicon.ico's sizes, the apple-touch-icon, and the web
 * manifest's icons (the 512 again as maskable: the caret sits inside its safe zone, the ground runs
 * to the edge).
 */
export const ICONS = {
  favicon: [16, 32, 48],
  apple: 180,
  manifest: [
    { src: "/icons/icon-192.png", size: 192, maskable: false },
    { src: "/icons/icon-512.png", size: 512, maskable: false },
    { src: "/icons/icon-maskable-512.png", size: 512, maskable: true },
  ],
} as const;
