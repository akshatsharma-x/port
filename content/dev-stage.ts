/**
 * DEV FIXTURE — copy for /dev/stage and the ?debug=1 overlay only. Holds no personal data, so it
 * is allowed in client code (tests/content-boundary.test.ts); section names come from content/
 * data.ts via derive on the server page.
 */
export const stageDev = {
  title: "Stage harness",
  code: "RETROGRADE/OS · STAGE",
  intro:
    "Five placeholder scenes in five real slots, with DOM-only interlocks between them. Scroll fast, jump, change route, lose the context: one canvas docks to whichever slot is on screen. Add ?debug=1 for the overlay.",
  nav: "Jump to",
  controls: {
    label: "Controls",
    wipe: "Run test wipe",
    next: "Next slide",
    lose: "Lose context",
    restore: "Restore context",
    gfx: "GFX",
    theme: "Cycle theme",
    power: "Power cycle",
  },
  slots: {
    system: "100 svh slot.",
    log: "160 svh slot: taller than the viewport, so the stage holds still inside it, like sticky.",
    archive: "100 svh slot.",
    work: "70 svh slot: shorter than the viewport, so the stage carries a static clip. At rest it renders on demand only.",
    capabilities: "100 svh slot.",
  },
  route: "Open in its own route",
  spacer: {
    label: "Interlock — DOM-only",
    lines: [
      "Between any two stages sits at least one full viewport of plain document.",
      "Two stages can never share the screen, so the governor swaps scenes where nobody can see.",
      "The next scene warms here, before you arrive; the one you left cools for two seconds, then goes.",
    ],
  },
  /** a chip: short (chips don't wrap) */
  short: "Short interlock",
  single: {
    back: "Back to the harness",
    note: "Same canvas, same scene instance: the mesh kept animating through the route change.",
  },
  overlay: {
    title: "STAGE · DEBUG",
    tier: "tier",
    display: "display",
    frame: "frame",
    stage: "stage",
    render: "render",
    memory: "memory",
    contexts: "contexts",
    scenes: "scenes",
    checks: "checks",
    raf: "raf",
    interlock: "interlock",
    pass: "PASS",
    fail: "FAIL",
    ok: "ok",
  },
} as const;
