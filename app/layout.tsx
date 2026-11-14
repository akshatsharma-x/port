import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Boot } from "@/components/boot/Boot";
import { Chrome, CursorLayer } from "@/components/chrome/Chrome";
import { FxCss } from "@/components/chrome/FxCss";
import { Stage } from "@/components/stage/Stage";
import { Providers } from "@/components/ui/Providers";
import { headScript } from "@/lib/theme-script";
import { THEME_BG } from "@/lib/tokens";
import { hubotSans, jetbrainsMono, monaSans } from "./typefaces";
import "./globals.css";

export const metadata: Metadata = {
  // absolute OG and Twitter URLs need the site's own address (Part 15 sets it at deploy)
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
  title: { default: "RETROGRADE", template: "%s · RETROGRADE" },
  description: "A portfolio you boot, not browse.",
};

export const viewport: Viewport = {
  themeColor: THEME_BG.phosphor,
};

/**
 * `modal`: the @modal slot — a record's dossier as a <dialog> over the page you're on (app/@modal,
 * intercepting a soft navigation to /research/[slug]; visited directly, it's a full page).
 */
export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="phosphor"
      data-motion="full"
      className={`${hubotSans.variable} ${monaSans.variable} ${jetbrainsMono.variable}`}
      // the display face alone, so each type step can follow it with its own measured fallback
      style={{ "--ff-display-face": hubotSans.style.fontFamily.split(",")[0] } as CSSProperties}
      // the head script sets data-theme / data-motion / .js before hydration
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body>
        <Providers>
          {/* DESIGN.md §4.1: the stage (parked in #stage, docked in the live slot) and #fx-gl (z60)
              live here, so they survive route changes; #hud (z30) sits outside #screen */}
          <Stage />
          <div id="screen">{children}</div>
          {modal}
          <Chrome />
          <CursorLayer />
          <FxCss />
          {/* the boot (first visit to /) and POWER ON-fast (everything else): z45, chosen before first paint */}
          <Boot />
        </Providers>
      </body>
    </html>
  );
}
