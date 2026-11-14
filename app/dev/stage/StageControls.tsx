"use client";

import { useEffect, useState } from "react";
import { sendToScene } from "@/components/stage/events";
import { useStage } from "@/components/stage/useStage";
import { Button } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/ChipToggle";
import { stageDev } from "@/content/dev-stage";
import { fx } from "@/lib/fxgl";
import { governor } from "@/lib/sceneManager";
import { useUI } from "@/lib/store";
import { THEMES } from "@/lib/tokens";
import { powerOff, powerOn, switchTheme } from "@/lib/signatures";

/** OFF → a beat of dark glass → ON: the whole POWER CYCLE grammar on one button. */
async function powerCycle(): Promise<void> {
  await powerOff();
  await new Promise((r) => window.setTimeout(r, 400));
  await powerOn();
}

/** The harness's levers: the fx-gl test wipe, forced context loss, the GFX override, themes, power. */
export function StageControls() {
  const c = stageDev.controls;
  const gfx = useUI((s) => s.gfx);
  const setGfx = useUI((s) => s.setGfx);
  const theme = useUI((s) => s.theme);
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? THEMES[0];
  const lost = useStage((s) => s.contextLost);
  const [short, setShort] = useState(false);

  // shrinks the first interlock below 100 svh: the dev assertion must warn (and the overlay shows it)
  useEffect(() => {
    document.querySelector("[data-spacer='0']")?.toggleAttribute("data-short", short);
  }, [short]);

  return (
    <div role="group" aria-label={c.label} className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void fx.wipe()}>{c.wipe}</Button>
      <Button onClick={() => sendToScene({ id: "work", action: "next" })}>{c.next}</Button>
      <Button onClick={() => (lost ? governor.dev.restoreContext?.() : governor.dev.loseContext?.())}>{lost ? c.restore : c.lose}</Button>
      <Button onClick={() => void switchTheme(nextTheme)}>{c.theme}</Button>
      <Button onClick={() => void powerCycle()}>{c.power}</Button>
      <ChipToggle pressed={gfx === "low"} onPressedChange={(p) => setGfx(p ? "low" : "auto")}>
        {`${c.gfx} LOW`}
      </ChipToggle>
      <ChipToggle pressed={short} onPressedChange={setShort}>
        {stageDev.short}
      </ChipToggle>
    </div>
  );
}
