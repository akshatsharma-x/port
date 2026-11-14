import { ShellLauncher } from "@/components/shell/ShellLauncher";
import { derived } from "@/content/derive";
import { Cursor } from "./Cursor";
import { FrontPanel } from "./FrontPanel";
import { HudReadout } from "./HudReadout";
import { HudMetrics } from "./HudMetrics";
import { Nav } from "./Nav";
import { SectionRail } from "./SectionRail";
import type { ChromeSection } from "./types";

/** The page sections the chrome tracks: SYSTEM … HALT (POST is the boot overlay, SHELL the terminal). */
const RAIL_RANGE = { first: 1, last: 9 } as const;

/**
 * #hud (z30, DESIGN.md §4.1): the persistent chrome, outside #screen so a tear's jitter (which
 * moves #screen) never re-anchors it. Server component: the copy comes from content, the client
 * parts receive only what they render.
 */
export function Chrome() {
  const { labels, sections } = derived.site;
  const pageSections: ChromeSection[] = sections
    .filter((s) => s.index >= RAIL_RANGE.first && s.index <= RAIL_RANGE.last)
    .map(({ id, index, code, title }) => ({ id, index, code, title }));
  return (
    <div id="hud">
      {/* the bezel: four corner brackets and hairline rules at the viewport edges (§2.9) */}
      <span className="hud-bezel" aria-hidden="true">
        <i className="hud-bezel__tl" />
        <i className="hud-bezel__tr" />
        <i className="hud-bezel__bl" />
        <i className="hud-bezel__br" />
        <i className="hud-bezel__rule hud-bezel__rule--top" />
        <i className="hud-bezel__rule hud-bezel__rule--bottom" />
      </span>
      <div className="hud-top">
        <HudReadout os={labels.chrome.os} sections={pageSections} timeZone={derived.profile.timezone} countryCode={derived.profile.location.countryCode} />
        <Nav label={labels.nav.label} items={labels.nav.items} terminal={labels.nav.terminal} />
      </div>
      <SectionRail label={labels.chrome.rail} sections={pageSections} />
      <div className="hud-bottom">
        <FrontPanel labels={labels.panel} />
      </div>
      <HudMetrics />
      {/* ∞ SHELL: the keys that open it; the panel itself arrives on its first open */}
      <ShellLauncher
        boot={{
          label: labels.shell.label,
          close: labels.shell.close,
          input: labels.shell.input,
          output: labels.shell.output,
          user: labels.shell.user,
          host: labels.shell.host,
          tty: labels.shell.tty,
          os: labels.chrome.os,
          loading: labels.shell.loading,
          offline: labels.shell.offline,
        }}
      />
    </div>
  );
}

/** #cursor (z40, DESIGN.md §4.1): above the HUD, under #fx-css's glass. */
export function CursorLayer() {
  return <Cursor labels={derived.site.labels.cursor} />;
}
