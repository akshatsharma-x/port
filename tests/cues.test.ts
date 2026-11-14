import { beforeEach, describe, expect, it } from "vitest";
import { CUE_LIMIT_MS, cue, cueLog, registerCueEngine, resetCues, type Cue } from "@/lib/cues";
import { useUI } from "@/lib/store";

/** DESIGN.md §6.4 — the cue sheet's rate limits hold whether or not sound is on. */
describe("cue bus", () => {
  beforeEach(() => {
    resetCues();
    registerCueEngine(null);
  });

  it("SECTION relay clicks are ≥ 1.2 s apart; TEAR ≥ 450 ms", () => {
    expect(CUE_LIMIT_MS.SECTION).toBe(1200);
    expect(CUE_LIMIT_MS.TEAR).toBe(450);
    expect(cue("SECTION", {}, 0)).toBe(true);
    expect(cue("SECTION", {}, 600)).toBe(false);
    expect(cue("SECTION", {}, 1199)).toBe(false);
    expect(cue("SECTION", {}, 1200)).toBe(true);
    expect(cue("TEAR", {}, 0)).toBe(true);
    expect(cue("TEAR", {}, 449)).toBe(false);
    expect(cue("TEAR", {}, 450)).toBe(true);
    expect(cueLog.played.get("SECTION")).toBe(2);
    expect(cueLog.limited.get("SECTION")).toBe(2);
  });

  it("reaches the engine only when sound is on (Part 5 registers it)", () => {
    const heard: Cue[] = [];
    registerCueEngine((c) => heard.push(c));
    useUI.setState({ sound: false });
    cue("POWER", {}, 0);
    useUI.setState({ sound: true });
    cue("POWER", {}, 10);
    useUI.setState({ sound: false });
    expect(heard).toEqual(["POWER"]);
  });
});
