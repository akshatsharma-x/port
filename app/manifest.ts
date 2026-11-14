import type { MetadataRoute } from "next";
import { derived } from "@/content/derive";
import { ICONS } from "@/lib/icons";
import { THEME_BG } from "@/lib/tokens";

/**
 * The web manifest (PROMPTS.md Part 15): RETROGRADE installed is the default tube, Phosphor — its
 * ground behind the launch and in the title bar — with the block caret as its icon (scripts/bake/icons.ts).
 */
export default function manifest(): MetadataRoute.Manifest {
  const d = derived;
  return {
    name: d.site.title,
    short_name: d.site.meta.appName,
    description: d.site.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_BG.phosphor,
    theme_color: THEME_BG.phosphor,
    icons: ICONS.manifest.map((i) => ({ src: i.src, sizes: `${i.size}x${i.size}`, type: "image/png", ...(i.maskable ? { purpose: "maskable" as const } : {}) })),
  };
}
