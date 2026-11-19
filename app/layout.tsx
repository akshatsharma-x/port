import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Boot } from "@/components/boot/Boot";
import { Chrome, CursorLayer } from "@/components/chrome/Chrome";
import { FxCss } from "@/components/chrome/FxCss";
import { Stage } from "@/components/stage/Stage";
import { Providers } from "@/components/ui/Providers";
import { derived } from "@/content/derive";
import { rootMeta } from "@/lib/seo";
import { headScript, PRINT_HREF } from "@/lib/theme-script";
import { THEME_BG } from "@/lib/tokens";
import { hubotSans, jetbrainsMono, monaSans } from "./typefaces";
import "./globals.css";

// the site's address, title template, description and authors (lib/seo.ts, PROMPTS.md Part 15)
export const metadata: Metadata = rootMeta;

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
        {/* the print edition (DESIGN.md §2.4): a print-only sheet, fetched last and never render-blocking
            (through the bundle it would be render-blocking bytes on every screen's first paint). The head
            script links it — a rendered <link> gets a preload from React, a warning in Firefox — and
            this carries it without JS */}
        <noscript>
          <link rel="stylesheet" href={PRINT_HREF} media="print" />
        </noscript>
      </head>
      <body>
        <Providers labels={{ newTab: derived.site.labels.chrome.newTab }}>
          {/* the first stop on every page: past the HUD to the page's <main id="main"> (WCAG 2.4.1) */}
          <a href="#main" className="btn btn--primary skip-link" data-transition="skip">
            {derived.site.labels.chrome.skip}
          </a>
          {/* DESIGN.md §4.1: the stage (parked in #stage, docked in the live slot) and #fx-gl (z60)
              live here, so they survive route changes. #hud (z30) sits outside #screen, and before it
              in the document, so the keys meet the navigation first, as they see it */}
          <Stage />
          <Chrome />
          <div id="screen">{children}</div>
          {modal}
          <CursorLayer />
          <FxCss />
          {/* the boot (first visit to /) and POWER ON-fast (everything else): z45, chosen before first paint */}
          <Boot />
        </Providers>
      </body>
    </html>
  );
}
