/**
 * DEV FIXTURE — sample copy for /dev/kitchen-sink only, so no component hardcodes text.
 * Real content arrives in Part 2 (content/data.ts via content/derive.ts).
 */
export const sink = {
  title: "Kitchen sink",
  intro:
    "Every primitive in every variant and every theme. Use the toolbar for the reduced-motion edition, the page theme and the grid overlay (or press G).",
  // "-\u2060" keeps hyphenated compounds on one line (U+2060 is default-ignorable)
  display: "Hi-\u2060fi rendering of lo-\u2060fi artifacts",
  lead: "A portfolio you boot, not browse.",
  body: "I build interfaces and study how people read them. This paragraph shows the body face at reading length: Mona Sans at the body step, with the dark-theme weight compensation on Phosphor and Amber, a measure capped near 68 characters, and pretty wrapping so the last line never strands a single word.",
  revealLines:
    "RAIL REVEAL wipes each line in from the left edge of its column, sixty milliseconds apart, at most six lines deep. It never fades, never floats, and the text is selectable the whole time.",
  revealChars: "Every number is true",
  section: {
    index: 4,
    code: "ARCHIVE",
    title: "Research & Publications",
    counts: ["23 RECORDS", "1,284 CITATIONS", "2016–2026"],
  },
  datasheet: [
    ["Role", "Design engineer · researcher"],
    ["Experience", "8 years"],
    ["Location", "Amsterdam, NL"],
    ["Timezone", "CET · UTC+01:00"],
    ["Stack", "TypeScript · WebGL · Python"],
    ["H-index", "9 · OpenAlex"],
    ["Education", "MSc Human–Computer Interaction"],
    ["Availability", "Open to research-engineering roles"],
  ],
  stats: [
    { label: "Years", value: 8 },
    { label: "Shipped", value: 24 },
    { label: "Papers", value: 11 },
    { label: "Citations", value: 1284 },
  ],
  hero: { label: "Citations · OpenAlex · as of 2026-11-10", value: 1284 },
  marquee: ["RETROGRADE/OS", "PHOSPHOR · P1", "AMBER · P3", "PAPER · PPR", "EVERY NUMBER IS TRUE", "STAGE, THEN DOCUMENT"],
  chips: ["TypeScript", "WebGL", "Python", "Open access", "Peer reviewed"],
  motion: {
    index: 9,
    code: "Motion",
    title: "Signature motion · §3.6–3.7",
    counts: ["DITHER RESOLVE", "SCRAMBLE", "TYPEWRITER", "SLIDE ADVANCE"],
    image: { src: "/fixtures/test-card.png", alt: "A color test card: bars, a luma ramp, a zone plate and a grid.", width: 960, height: 540 },
    resolve: "Resolve again",
    resolveNote: "4×4 Bayer, 17 levels, steps(16) over 400 ms, radiating from the pointer. Switch the page to Paper for HALFTONE.",
    scramble: "Signal acquired",
    scrambleAgain: "Scramble again",
    lines: ["Building a WebGPU port of a progressive renderer.", "Reading The Reflective Practitioner.", "Researching how scroll physics changes reading comfort."],
    nextLine: "Next line",
    slides: ["01 / 03 · Bars", "02 / 03 · Ramp", "03 / 03 · Zone plate"],
    hhold: "Lost horizontal hold",
    tear: "Tracking tear (H-HOLD at the cut)",
    prev: "Previous",
    next: "Next",
  },
  filters: ["Journal", "Conference", "Workshop", "Preprint"],
  tilt: {
    kicker: "Tier B · one lamp",
    title: "Credential card",
    body: "Move the pointer across the card: --mx / --my drive the highlight and the cast shadow, on spring tilt, max 8°.",
  },
  buttons: { primary: "View work", secondary: "Read research", tertiary: "Resume", external: "Google Scholar", back: "Back", disabled: "Offline" },
  brackets: { solid: "Live region", active: "Selected", dashed: "Under review", large: "Panel ≥ 1024 px", focus: "Tab here: focus = brackets" },
} as const;
