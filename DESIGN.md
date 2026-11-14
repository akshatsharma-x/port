# RETROGRADE — Design Bible

`v2.3 · LOCKED · 2026-11-14`

*v2.3 (2026-11-14, Part 12): Contact and the footer, as built and measured (§7.4 CONNECT and HALT), and the governor lever pulled (§4.2). The scheduler moved out of first-load JS into the lazy stage runtime and saved 2.6 KB gz, not the ≈ 4 estimated. CONNECT's form posts to the site's one server endpoint, which fails closed: with no rate limiter or no sender it answers 503 and the page offers a `mailto:` that keeps the visitor's words. Its rate limit holds each sender address as well as each IP (§10 #50). The form's behaviour arrives on its first focus or on idle, with its schema in zod/mini, a 31.5 KB chunk where classic zod made it 45.8 (§10 #55). The owner confirmed their working hours (10:00–18:00 IST), asked for no résumé until one without their phone number exists (§10 #49), and for a publication list printed at build (§10 #57). Back to top is a quiet glide (§10 #56), and the last pixel powers off only at the page's true end. First-load JS is 228.0 KB of 230.*

*v2.2 (2026-11-13, Part 11): Certificates & Records, as built and measured (§4.4 B1/B2, §7.4 CREDENTIALS). The owner has no certificates yet. The wall is built and tested on the fixture persona's on a dev page, and home leaves it out rather than say "0 CREDENTIALS"; theirs drop in with no code change (§10 #46). Records holds the owner's three achievements, and the empty press and testimonial blocks stay hidden. Every card's engraving is its own, seeded from its credential ID: a few figures drawn once per page and placed by each card, about 0.3 KB of HTML a card (§10 #47). The machine-readable zone is TD1's, the ID-1 card's own, with real ICAO 9303 check digits. On phones the gyro moves the foil, not the card (§10 #48). FLIP and STAMP are synthesized (§6.4). First-load JS is 229.9 KB of 230: Part 12 must pull the governor lever first.*

*v2.1 (2026-11-13, Part 10): Skills, as built and measured (§4.3 A5, §7.4 CAPABILITIES). The owner confirmed every skill's rubric level and years before the keys showed them, kept the six primary technologies, and asked for logos: the legends carry the CC0 Simple Icons marks, or a monogram where the set has none (§10 #44). The pile is clustered by category from the start, so the category chips choose which cluster leads: it comes forward to the middle and the rest part around it, laid out as seen so nothing stands behind it (§10 #45). Every home, arranged or gathered, is at least two sphere radii from the next, so the sim can come to rest and sleep; a test proves it, because the first layout's overlapping homes would have kept it awake for good. KEYCAP's three clacks are synthesized, not sampled (§10 #43). A slot shorter than the viewport is captured at its own size for its poster (§8.2).*

*v2.0 (2026-11-12, Part 9): Projects, as built and measured (§4.3 A4, §7.4 WORK). Three of the owner's calls shaped it. Until real screenshots arrive, every cover is a build-time title card set from the project's own words, plainly type and saying so in its alt text; a screenshot dropped into `content/covers/` replaces it with no code change (§10 #40). A year or a role not yet given shows as pending, never guessed (§10 #42). All five projects are on the rail. The research ↔ work cross-link is built and tested on a fixture page; no project lists a paper yet. The PROJECTION is a governor takeover: the stage holds the viewport over the page, the route swaps under it, and Back flies the slide home (§7.4). The INDEX stays server HTML and its filters' FLIP is hand-rolled, lazy (§10 #37).*

*v1.9 (2026-11-12, Part 8): Research & Publications, as built and measured (§4.3 A3, §7.4 ARCHIVE). Two of the owner's calls changed the text. The sky adds the works the owner's papers cite as faint stars, from their real reference lists, so its layouts have real spread (§10 #30); until those lists arrive it holds the two papers. And the section's LED figure is PEER-REVIEWED PAPERS until anything is cited (§10 #31). Light blends with MAX on the dark tubes and ink with MIN on Paper: overlapping stars never white out, and no depth buffer is needed (§10 #32). A record's dossier opens over whatever page you're on, a record's own page included, because the intercept sits at the root (§10 #33); its prev / next push is a view transition (§10 #34).*

*v1.8 (2026-11-11, Part 7): About and Experience, as built and measured (§4.3 A2, §7.4 IDENTITY and LOG), on the owner's real content. The placeholder persona is now a test fixture, and `content/data.ts` holds Akshat Sharma's résumés, with every gap marked as one. Two decisions changed the text. The hero name now fits, then grows: past `wdth` 125 its size grows to fill the 12 columns instead of falling short (§2.5, §10 #29). The stage has no depth buffer, so LOG's deck paints back to front (§4.3 A2). The HUD names the owner's zone as their country writes it (IST, not GMT+5:30), and its clock field is sized to the zone (§7.3). Measuring also found that since Part 6 the hero's INITIALS had been drawn in the system's sans: the worker resolved the display face's `url()` against the document, and the font 404'd (§4.3 A1). Measuring found a rule, too: nothing writes to `html` after first paint unless the user asked for it. In Chrome a restyle of `html` restyles every element, and three such writes had forced full recalcs inside hydration; TBT fell from 110–116 to 37–78 ms (§8.3).*

*v1.7 (2026-11-11, Part 6): the hero, as built and measured. §4.3 A1 records the morph targets, the morph and the numbers; §5.1–§5.3 record how the post chain is assembled; §7.4 SYSTEM records the type layer. Four decisions changed the text. The display steps' cap trim is now computed from Hubot's own metrics rather than with `text-box-trim`, which follows the fallback's taller caps; the name grew 8 px until the face arrived (§2.5). Paper's stage is not tone-mapped: Neutral shifted its paper ground and erased faint ink (§5.3). The idle hint waits for the terminal (§10 #28). A high-refresh display drops the stage to 60 only when frames are slow and also late, because Apple GPUs' timers overstate a light load 3–5× (§8.3). The HUD bands gain an on-screen-display backing and now stay one row at every width from 320 px; layout that clears them uses their token height, not their measure (§7.3).*

*v1.6 (2026-11-11, Part 5): the boot and the chrome, as built and measured. §7.4 records how the boot keeps its promises. The head script decides before first paint, the clock starts at first paint, and the bytes are the stage runtime's real chunks. The hard cap is a compositor fade that holds with no script and with a stalled one. §6.3 records the master chain's makeup trim and the measured cue peaks. §7.3 records the hand-rolled nav indicator, the measured HUD bands behind `scroll-padding`, the phone chrome and the cursor's ink. §3.8 and §8.1: `lib/scroll.ts` tracks sections and pins itself, so ScrollTrigger and CustomEase left first-load JS. §2.5 adds per-step display fallbacks. §5.1 places the boot overlay. §8.3 records the Part 5 weight, LCP and CLS. No design values changed.*

*v1.5 (2026-11-11, Part 4): docking and pins are native. The one stage canvas is re-parented into the LIVE slot and held there by `position: sticky` (§4.1, §4.2), and pins are sticky blocks in tracks sized in CSS (§3.8). The browser holds both, with no per-frame JS and no lag behind a phone's compositor scroll. ScrollTrigger's own `pin` reported a layout shift of about 0.65 at every pin end (measured); sticky pins measure CLS 0. §3.6 records how POWER CYCLE renders: View Transition snapshots animated from the timelines, with `#fx-gl` as its own live group. §3.8 records the history rules that make Back restore the page and the scroll position. §7.3 makes the HUD readout's fields fixed-width. §8.3 records the Part 4 weight and CLS. No design values changed.*

*v1.4 (2026-11-11, Part 3): §4.1 records two mechanisms the stage is built on — every `requestAnimationFrame` caller is funnelled into one native frame, and the R3F root is made with `createRoot` (not `<Canvas>`, which registers all of three.js and defeats the §8.3 budget). §8.3 records the measured first-load JS, stage runtime and scene chunks. No design values changed.*
*v1.3 (2026-11-10, Part 2): §8.2 records the bake as built: where each output lives, the three run modes (dry / offline / live), and that a dead arXiv id fails the build just as a dead DOI does. §8.3's font row now carries the Part 1 measurement instead of the Part 0 estimate. No design values changed.*
*v1.2 (2026-11-10, Part 1): springs now integrate with RK4 instead of semi-implicit Euler. At the 1/240 s sub-step, semi-implicit Euler under-shot the analytic response by up to 0.76 percentage points; RK4 matches it within 0.01. The §3.3 settle times are replaced with exact values. §2.10 now limits UI glyphs to marks the baked fonts carry; ✓ and the ARCHIVE shape glyphs become pixel SVG. §8.3 records the measured first-load JS.*
*v1.1 (2026-11-10): part references renumbered to PROMPTS.md v2, where part N = build step N (§11). The §10 overrides are now folded into the prompts. No design values changed.*

This is the single source of truth for the RETROGRADE portfolio. Every value is meant to be copied into code verbatim: §2 → `styles/tokens.css`, §3 → `lib/motion.ts`, §4–§5 → `lib/tier.ts` and `lib/sceneManager.ts`, §8 → CI budgets. If code and this document disagree, the document wins until it is amended.

Values marked **(measured)** were measured on 2026-11-10 from the published npm and Google Fonts artifacts. Values marked **(est.)** must be verified in Part 14. All color values and contrast ratios were computed, not eyeballed.

> *In astronomy, retrograde motion is an illusion: a planet only appears to move backwards because we are moving faster. That is the brief.*

**Contents** — 1 Concept · 2 Art direction · 3 Motion language · 4 The 3D budget · 5 Texture & post-processing · 6 Sound · 7 Sitemap & rhythm · 8 Stack & performance budget · 9 Anti-goals · 10 Overrides to PROMPTS.md · 11 Build order

---

## 1. Concept

### 1.1 Statement

RETROGRADE is a portfolio you power on: a fictional operating system for one person, in which every role, paper, project and credential is stored as a physical artifact of old computing — punch cards, microfiche, slide mounts, keycaps, foil-sealed ID cards. Its craft inverts nostalgia: low-fidelity artifacts rendered at uncompromising fidelity — HDR phosphor bloom, frame-rate-independent springs, graph physics solved at build time, type fitted on its variable width axis. Nothing on screen is fake — every readout is live, every number is sourced — and the machine itself, fast and accessible on a mid-range phone, is the strongest exhibit in it.

### 1.2 The hook

> **A portfolio you boot, not browse — where the papers form a star chart and the credentials catch the light.**

### 1.3 The seven laws

Every decision below derives from one of these. When spectacle conflicts with law 2 or law 3, spectacle loses.

1. **Hi-fi rendering of lo-fi artifacts.** The artifact is retro. Its rendering never is.
2. **Every number is true.** No fake progress bars, coordinates, system stats or "verified" badges. If we can't source it, we don't show it.
3. **Stage, then document.** 3D is the stage; HTML is the content. Everything you can read is real, selectable, crawlable DOM.
4. **One live canvas.** Exactly one WebGL context draws in any frame.
5. **Artifacts step, physics springs.** Things that imitate old machines move in discrete steps (typing, blinking, dither, digits). Things that imitate matter move on springs (cards, cameras, keycaps).
6. **Color is earned by attention.** Chroma belongs to state. Images rest as dither and resolve to full color when you look at them.
7. **Bake, don't compute.** Anything that can be computed at build time is: graph layouts, atlases, posters, fonts, citation counts, the search index.

---

## 2. Art direction

### 2.1 Brand constants

| Name | Hex | OKLCH | Role |
|---|---|---|---|
| Void | `#050505` | `oklch(11.5% 0 0)` | Phosphor background; the tube when it's off |
| Phosphor | `#00FF9C` | `oklch(88.0% 0.211 156.6)` | P1 green — accent of the default theme |
| Amber | `#FFB000` | `oklch(81.2% 0.170 76.4)` | P3 amber — accent of the Amber theme |
| Signal | `#FF2E88` | `oklch(66.2% 0.244 1.7)` | the interrupt — ≤ 5% coverage |
| Paper | `#F2F0EB` | `oklch(95.5% 0.007 88.6)` | Paper theme sheet |
| Ink | `#0A0A0A` | `oklch(14.5% 0 0)` | Paper theme text |

Against Void: Phosphor 15.32:1, Amber 11.12:1, Signal 5.82:1. Against Paper: Phosphor 1.17:1, Amber 1.61:1, Signal 3.07:1. That last set is why Paper gets its own inks instead of reusing the dark accents.

### 2.2 Semantic tokens

Components consume only these. A raw hex inside a component is a bug.

| Token | Role | Rule |
|---|---|---|
| `--bg` | page, stage clear color | |
| `--bg-raised` | panels, cards, dossier, terminal | |
| `--bg-sunken` | inputs, code, wells | |
| `--bg-band` | ledger row banding (green-bar in Paper) | |
| `--fg-1` | primary text, display type | |
| `--fg-2` | secondary text, dense panels | |
| `--fg-3` | meta, captions, axis labels | **the floor: no text token sits below it** |
| `--line-1` | hairlines, dividers | decorative; never the only boundary of a control |
| `--line-2` | control boundaries (inputs, chip outlines) | ≥ 3:1 on every surface |
| `--accent` | interactive, live, focus — and *me* (my name in author lists) | text-safe on every surface |
| `--accent-fill` | graphical fills: meters, unit cells, bars | never under text |
| `--accent-wash` | hover/selection tint, meter track | never carries data alone |
| `--on-accent` | text on `--accent` (inverse video, `::selection`) | |
| `--hot` | signal: stamps, the open record, error glyphs | ≤ 5% coverage. As text: only ≥ `--step-1` at weight ≥ 600, or on `--bg` / `--bg-sunken` |
| `--warn` | pending: UNDER REVIEW, EXPIRING | always with glyph + label |
| `--focus` | focus ring | = `--accent` in all themes |

Status triplet — always glyph + label, never color alone: **OK** = `--accent` + `✓` · **PENDING** = `--warn` + `△` · **FAULT** = `--hot` + `✕`.

### 2.3 Themes

Three themes via `[data-theme]` on `<html>`: `phosphor` (default), `amber`, `paper`. The HUD labels them by tube type: **P1 · P3 · PPR**. Ratios are WCAG 2; "worst surface" is the minimum across `--bg`, `--bg-raised`, `--bg-sunken` and `--bg-band`.

#### PHOSPHOR — P1 green (default)

| Token | Hex | OKLCH | vs `--bg` | Worst surface |
|---|---|---|---|---|
| `--bg` | `#050505` | `oklch(11.5% 0 0)` | — | |
| `--bg-raised` | `#0B100D` | `oklch(16.6% 0.010 158.8)` | 1.06:1 | |
| `--bg-sunken` | `#020202` | `oklch(8.5% 0 0)` | 1.02:1 | |
| `--bg-band` | `#060D09` | `oklch(14.9% 0.015 160.8)` | 1.04:1 | |
| `--fg-1` | `#E1F6EA` | `oklch(95.4% 0.027 160.9)` | 18.02:1 | 16.97:1 |
| `--fg-2` | `#B2C9BB` | `oklch(81.5% 0.032 158.9)` | 11.61:1 | 10.94:1 |
| `--fg-3` | `#8BA093` | `oklch(68.6% 0.030 158.3)` | 7.33:1 | 6.90:1 |
| `--line-1` | `#1B2620` | `oklch(25.6% 0.019 160.8)` | 1.31:1 | |
| `--line-2` | `#54675B` | `oklch(49.4% 0.030 157.4)` | 3.37:1 | 3.17:1 |
| `--accent` | `#00FF9C` | `oklch(88.0% 0.211 156.6)` | 15.32:1 | 14.43:1 |
| `--accent-fill` | `#03915A` | `oklch(57.9% 0.135 158.0)` | 5.05:1 | 4.75:1 |
| `--accent-wash` | `#002010` | `oklch(21.4% 0.050 157.9)` | 1.18:1 | |
| `--on-accent` | `#05160D` | `oklch(18.2% 0.031 159.4)` | — | 14.01:1 on `--accent` |
| `--hot` | `#FF2E88` | `oklch(66.2% 0.244 1.7)` | 5.82:1 | 5.48:1 |
| `--warn` | `#F7C243` | `oklch(84.0% 0.150 85.2)` | 12.38:1 | 11.66:1 |

#### AMBER — P3 amber

The background is a warm void (`#080605`), not `#050505`. `--hot` turns **cyan**: amber plus pink is the synthwave palette (§9), and the signal is always the accent's complement.

| Token | Hex | OKLCH | vs `--bg` | Worst surface |
|---|---|---|---|---|
| `--bg` | `#080605` | `oklch(12.5% 0.006 51.8)` | — | |
| `--bg-raised` | `#14100B` | `oklch(17.6% 0.012 73.1)` | 1.07:1 | |
| `--bg-sunken` | `#030302` | `oklch(9.6% 0.005 107.3)` | 1.02:1 | |
| `--bg-band` | `#100B06` | `oklch(15.4% 0.014 69.7)` | 1.03:1 | |
| `--fg-1` | `#FAEDD5` | `oklch(95.0% 0.035 82.9)` | 17.47:1 | 16.36:1 |
| `--fg-2` | `#D5BF9F` | `oklch(81.5% 0.050 77.2)` | 11.34:1 | 10.63:1 |
| `--fg-3` | `#AF9778` | `oklch(69.0% 0.052 73.9)` | 7.24:1 | 6.78:1 |
| `--line-1` | `#2B241B` | `oklch(26.5% 0.019 73.8)` | 1.32:1 | |
| `--line-2` | `#73614C` | `oklch(50.4% 0.039 71.1)` | 3.41:1 | 3.20:1 |
| `--accent` | `#FFB000` | `oklch(81.2% 0.170 76.4)` | 11.04:1 | 10.34:1 |
| `--accent-fill` | `#AC731A` | `oklch(60.1% 0.120 72.1)` | 5.03:1 | 4.71:1 |
| `--accent-wash` | `#281802` | `oklch(22.5% 0.044 73.3)` | 1.18:1 | |
| `--on-accent` | `#1C1105` | `oklch(18.9% 0.029 69.0)` | — | 10.13:1 on `--accent` |
| `--hot` | `#37D2F2` | `oklch(79.9% 0.130 215.4)` | 11.23:1 | 10.52:1 |
| `--warn` | `#FD8358` | `oklch(73.9% 0.160 39.8)` | 8.25:1 | 7.72:1 |

#### PAPER — green-bar printout

The accent becomes ledger-green ink; `--hot` becomes stamp-red ink.

| Token | Hex | OKLCH | vs `--bg` | Worst surface |
|---|---|---|---|---|
| `--bg` | `#F2F0EB` | `oklch(95.5% 0.007 88.6)` | — | |
| `--bg-raised` | `#FBFAF7` | `oklch(98.5% 0.004 91.4)` | 1.09:1 | |
| `--bg-sunken` | `#E8E6E0` | `oklch(92.5% 0.008 91.5)` | 1.10:1 | |
| `--bg-band` | `#DFEEE2` | `oklch(93.5% 0.023 151.6)` | 1.06:1 | |
| `--fg-1` | `#0A0A0A` | `oklch(14.5% 0 0)` | 17.38:1 | 15.86:1 |
| `--fg-2` | `#413E39` | `oklch(36.5% 0.009 80.7)` | 9.35:1 | 8.53:1 |
| `--fg-3` | `#605C55` | `oklch(47.6% 0.012 81.8)` | 5.84:1 | 5.33:1 |
| `--line-1` | `#D5D2CD` | `oklch(86.5% 0.008 80.7)` | 1.32:1 | |
| `--line-2` | `#83807A` | `oklch(60.1% 0.010 84.6)` | 3.46:1 | 3.15:1 |
| `--accent` | `#006842` | `oklch(45.6% 0.104 159.7)` | 6.03:1 | 5.50:1 |
| `--accent-fill` | `#006842` | `oklch(45.6% 0.104 159.7)` | 6.03:1 | 5.50:1 |
| `--accent-wash` | `#D4EEDD` | `oklch(92.5% 0.036 157.0)` | 1.08:1 | |
| `--on-accent` | `#F2F0EB` | `oklch(95.5% 0.007 88.6)` | — | 6.03:1 on `--accent` |
| `--hot` | `#B71747` | `oklch(50.6% 0.190 12.0)` | 5.71:1 | 5.21:1 |
| `--warn` | `#925301` | `oklch(50.5% 0.115 62.5)` | 5.33:1 | 4.86:1 |

#### Wide gamut — Display-P3 upgrades

Under `@media (color-gamut: p3)` the dark accents get chroma that sRGB can't hold. All three are verified in-gamut for Display-P3, and their contrast is effectively unchanged.

| Theme | Token | sRGB | P3 upgrade | vs `--bg` |
|---|---|---|---|---|
| Phosphor | `--accent` | `#00FF9C` | `oklch(87% 0.250 156.6)` | 15.06:1 |
| Phosphor | `--hot` | `#FF2E88` | `oklch(66.2% 0.290 1.7)` | 5.68:1 |
| Amber | `--accent` | `#FFB000` | `oklch(81.2% 0.190 76.4)` | 10.98:1 |

On HIGH tier the stage uses a Display-P3 drawing buffer where the browser supports one. Paper gets no upgrade: ink is ink.

### 2.4 Color rules

- **Chroma is a privilege.** Only state tokens (`--accent`, `--accent-fill`, `--hot`, `--warn`) exceed C 0.06. Everything else is tinted neutral.
- **There is no categorical palette.** A 7-hue "teletext" palette (OKLCH L 0.80 / C 0.10) was run through the dataviz validator and **failed**: deuteranopia ΔE 0.6 between its green and red, a normal-vision floor of ΔE 8.5 (the gate is 15), and scatter-type charts cap at three hues anyway. So identity is carried by **position, shape, label and type**; color carries only **state**. It's also simply more CRT: monochrome monitors had one color.
- **Signal is the complement.** Phosphor green ↔ magenta-pink; Amber ↔ cyan; Paper ledger-green ↔ stamp red.
- **Color is earned by attention.** Every raster image rests as an ordered-dither duotone (`--bg` × `--accent`) and resolves to full color on focus via DITHER RESOLVE (§3.6).
- **The stage never hardcodes a color.** On every theme change it reads the tokens from computed style and pushes them to uniforms.
- **Selection:** `--accent` background, `--on-accent` text.
- **Paper is a different machine, not an inverted one** (§5.4).
- **Accessibility modes.** `prefers-contrast: more` → FX off, `--fg-3` → `--fg-2`, `--line-1` → `--line-2`. `forced-colors: active` → FX and stage off, brackets become outlines, system colors. `@media print` → Paper tokens; no HUD, FX or stage; the ledger printed in full; URLs printed after links.

### 2.5 Typography

| Role | Family | Axes used | Latin woff2 | Preload | Fallback stack |
|---|---|---|---|---|---|
| Display | **Hubot Sans** (OFL · GitHub × Degarism) | `wdth` 75–125, `wght` 500–900 | 93.3 KB (measured, full axes) | yes | `"Hubot Sans Fallback"` (metric-adjusted Arial), `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif` |
| Body | **Mona Sans** (OFL · same designers) | `wght` 300–700 at `wdth` 100 | 39.8 KB (measured) | no | `"Mona Sans Fallback"`, `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif` |
| Mono | **JetBrains Mono** (OFL) | `wght` 400–800 | 31.3 KB (measured) | yes | `"JetBrains Mono Fallback"` (hand-tuned over local Menlo / Consolas / DejaVu Sans Mono), `ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace` |

Total 164.4 KB, of which 124.6 KB is preloaded. The fonts are served through `next/font/local` from files produced by a font bake (`pyftsubset` plus `varLib.instancer` to trim axis ranges). `next/font` auto-generates metric-adjusted fallbacks for the two sans, but it can only base them on Arial or Times. The mono fallback is therefore a hand-tuned `@font-face` with `size-adjust` and `ascent-override`.

**Display fallbacks per step** (v1.6). `next/font` matches Hubot's fallback to the face's default instance, but the display steps run at `wdth` 100–125. A fallback up to 25% too narrow reflows the hero when the font swaps in: CLS 0.0296 on a throttled first load (measured). `scripts/fonts/display-fallbacks.mjs` measures Hubot against Arial in Chrome at each step's width and weight, and writes one fallback per step: `size-adjust` 103.85% (heading), 112.74% (title), 120.11% (display) and 127.50% (mega). The same load now measures 0.005.

**Why these, and not the shortlist:**
- **Hubot Sans** is the "robotic" sibling of Mona Sans. Its chamfered, mechanical details read as *machine* at display sizes, and its 75–125 width axis is used as a mechanism (fit-to-measure, H-HOLD), not just a style.
- **Mona Sans** shares Hubot's skeleton and proportions, so inline mixes of the two sit on one baseline and the system reads as one voice.
- **JetBrains Mono** has a tall x-height, unambiguous glyphs at 11–12 px uppercase, and fixed-pitch digits for every live number.
- **Rejected:**
  - **Monument Extended:** commercial license, and the most overused display face on Awwwards 2019–23.
  - **Space Grotesk:** ubiquitous, and not wide enough to carry `--step-5`.
  - **Chakra Petch:** reads as esports.
  - **Inter Tight:** spaced for display sizes, so it's cramped as 16–18 px body text. Inter is also the internet's default voice, and judges' eyes slide off it.

**Rules:**
- **UPPERCASE is the machine; Sentence case is the human.** Labels, section names, the HUD and the hero name are uppercase. Paper titles, project titles and the bio are sentence case. Never uppercase a title longer than six words.
- **Numbers that change are mono.** Counters, citations, dates, IDs and timers use JetBrains Mono (fixed pitch, so nothing jitters mid-count). The display face never sets a live number.
- **Fit, don't shrink.** The hero name fills 12 columns by solving the `wdth` axis (75–125) at a fixed `--step-5`, so cap height stays constant whatever the name's length. Only below `wdth` 75 does it wrap to two lines.
  - **Fit, then grow** (v1.8). Where `wdth` 125 can't fill the measure at `--step-5`'s cap, the size grows until the one line does. For "AKSHAT SHARMA" that is from 1,658 px: 161 px at 1,920 and 187 at 2,560. The grow is CSS (`max(--step-5, 100cqi / the line's em width at 125)`, with the hero grid as the container), so the first paint is already right and nothing shifts. Tracking couldn't fill it: it would take +0.16 em at 1,920 and +0.34 em at 2,560, which pulls the word apart (§10 #29).
- **Dark-theme weight compensation.** Light-on-dark text reads heavier (irradiation). In Phosphor and Amber: body `wght` 400 → 385, lead 380 → 365, display 800 → 780.
- **No ligatures in UI mono** (`font-feature-settings: "calt" 0`). A `->` in a DataRow must stay two characters.
- Headings use `text-wrap: balance` and body uses `text-wrap: pretty`. Display and mega boxes are trimmed to the cap line and the baseline, so caps sit exactly on grid lines. Add `hanging-punctuation: first last` for Safari.
  - **The trim** (v1.7) is computed from Hubot's own metrics, not with `text-box-trim`. The metrics are ascent 1.090, descent 0.320 and cap 0.729 em, the same at every instance; `scripts/fonts/display-fallbacks.mjs` bakes them. The `cap` edge of `text-box-trim` reads whichever face is drawing, and no `@font-face` descriptor can give a fallback Hubot's cap height. A width-matched Arial's caps are 1.2–1.3× Hubot's. So the trimmed name stood 8 px taller until the face arrived, and Lighthouse's throttled load measured CLS 0.008. Now the box is identical in the fallback and in Hubot.
  - **Pixel-exact.** The trim places the baseline the way Blink's line layout does: ascent and descent rounded to whole pixels, half-leading floored. Measured at six sizes, the baseline lands on the box's bottom to 1/64 px. The settled name is pixel-identical to the `text-box-trim` rendering at 412, 1440 and 1920 px. Engines without `text-box` now trim too, within ½ px.
- Measure: body 60–68ch; lead ≤ 38ch.
- **Floor: 11 px.** Nothing renders below `--step--2`.

### 2.6 Type scale — 8 steps

Fluid between 360 px and 1600 px (root 16 px). **Minor third (1.2) on a phone, perfect fifth (1.5) on a desktop:** the scale gets more theatrical as the stage gets bigger. Below body the scale is *floored*, not modular — legibility shouldn't get more theatrical. Line heights land on the 4 px grid at max size.

| Step | Name | `clamp()` | @390 | @1440 | @1600 | Line height | Tracking | Face |
|---|---|---|---|---|---|---|---|---|
| `--step--2` | micro | `clamp(0.6875rem, 0.6694rem + 0.0806vw, 0.7500rem)` | 11.0 | 11.9 | 12.0 | 1.3333 | +0.14em | Mono 500, UPPER |
| `--step--1` | small | `clamp(0.8125rem, 0.7944rem + 0.0806vw, 0.8750rem)` | 13.0 | 13.9 | 14.0 | 1.4286 | +0.02em mono / 0 | Mono 400 · Mona 400 |
| `--step-0` | body | `clamp(1.0000rem, 0.9637rem + 0.1613vw, 1.1250rem)` | 16.0 | 17.7 | 18.0 | 1.5556 | 0 | Mona 400 (385 dark) |
| `--step-1` | lead | `clamp(1.2000rem, 1.0585rem + 0.6290vw, 1.6875rem)` | 19.4 | 26.0 | 27.0 | 1.3333 | −0.005em | Mona 380 (365 dark) |
| `--step-2` | heading | `clamp(1.4400rem, 1.1232rem + 1.4081vw, 2.5312rem)` | 23.5 | 38.2 | 40.5 | 1.1852 | −0.015em | Hubot 650 · `wdth` 100 |
| `--step-3` | title | `clamp(1.7280rem, 1.1274rem + 2.6695vw, 3.7969rem)` | 28.4 | 56.5 | 60.8 | 1.0535 | −0.025em | Hubot 720 · `wdth` 110 |
| `--step-4` | display | `clamp(2.0736rem, 1.0221rem + 4.6732vw, 5.6953rem)` | 34.6 | 83.6 | 91.1 | 0.9657 | −0.035em | Hubot 800 · `wdth` 118 · UPPER |
| `--step-5` | mega | `clamp(2.4883rem, 0.7305rem + 7.8125vw, 8.5430rem)` | 42.2 | 124.2 | 136.7 | 0.8779 | −0.045em | Hubot 860 · `wdth` fitted 75–125 · UPPER |

**LED (a material, not a step).** Mono numerals at `--step-3` and above, plus the footer marquee, can render through the LED dot mask: a CSS `mask-image` radial-dot grid with a pitch of 0.075em and dots 80% of the pitch. Glyphs move *under* a fixed dot grid, like a real matrix display. The text underneath stays real, selectable and readable.

### 2.7 Spacing

Base unit 4 px. Allowed steps, set with Tailwind `--spacing: 0.25rem` (anything else fails lint):

`0 · 1 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 24 · 32 · 48 · 64` units = `0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192 · 256 px`

There are two sub-unit exceptions: the one-device-pixel hairline, and the 2 px surface gap / focus offset.

| Fluid token | Range | `clamp()` |
|---|---|---|
| `--gutter` | 16 → 32 px | `clamp(1.0000rem, 0.7097rem + 1.2903vw, 2.0000rem)` |
| `--margin` | 20 → 80 px | `clamp(1.2500rem, 0.1613rem + 4.8387vw, 5.0000rem)` |
| `--block` | 32 → 64 px | `clamp(2.0000rem, 1.4194rem + 2.5806vw, 4.0000rem)` |
| `--section-y` | 96 → 224 px | `clamp(6.0000rem, 3.6774rem + 10.3226vw, 14.0000rem)` |
| `--hud-inset` | 12 → 24 px | `clamp(0.7500rem, 0.5323rem + 0.9677vw, 1.5000rem)` |

**Grid:** 12 columns, full-bleed sections, content capped at 2048 px on viewports ≥ 2200 px (the HUD stays at the viewport edges). Breakpoints: 480 / 768 / 1024 / 1440 / 2200. Phone policy (§4.2) applies when the pointer is coarse and the width is < 768.

### 2.8 Radii

| Token | Value | Only for |
|---|---|---|
| `--r-0` | `0` | everything, by default |
| `--r-1` | `2px` | chips, toggles, tooltips — a machined edge, not a soft one |
| `--r-card` | `3.7cqw` | credential cards: the ISO/IEC 7810 ID-1 corner (3.18 mm on 85.60 mm) |
| `--r-bezel` | `18px` | glass: the terminal and the dossier frame. The only large radius belongs to the tube |
| `--r-dot` | `999px` | status dots, VU LEDs |

Physical objects in WebGL (keycaps, the punch card's corner cut, slide mounts) carry their real-world geometry, not tokens.

### 2.9 Lines, brackets, grid

- **A hairline is one device pixel:** 1 px at DPR < 2, 0.5 px at DPR ≥ 2.
- **Section header strip.** Every section opens with a full-bleed hairline and a single mono line:
  `[04] ARCHIVE ───────── RESEARCH & PUBLICATIONS ───────── 23 RECORDS · 1,284 CITATIONS · 2016–2026`
  The index and codename are in `--accent` micro, the title in `--fg-1` micro, and the live counts in `--fg-3` (real numbers from `derive.ts`).
- **Brackets carry meaning.** Solid corner brackets mark a live, interactive region. Dashed brackets mark something provisional (under review, in prep). No brackets means static content.
  - Arms are 12 px (16 px on panels ≥ 1024 px). Strokes are 1.5 hairlines, rounded to device pixels.
  - Color is `--line-2` when idle and `--accent` on hover or focus.
  - They draw in on reveal (micro tier, `relay`).
- **Focus = brackets.** Keyboard focus snaps the bracket set to the focused element, plus a 2 px `--focus` outline at 2 px offset, so the keyboard gets the same affordance as the cursor. `scroll-padding` equals the HUD height so nothing focused hides under chrome (WCAG 2.4.11).
- **No drop shadows** — except shadows cast by physical objects (Tier-B cards, keycaps) from the one lamp (§4.4).
- **Grid overlay (`G`):** 12 columns as `--accent-wash` fills, an 8 px baseline in `--line-1`, column numbers in micro mono. It's the blueprint the hero's last morph state lands on.

### 2.10 Glyphs, imagery, voice

- **Glyphs:** no icon font. Unicode in mono — `↗` leaves the site (new tab), `→` goes deeper, plus `✕ △ ▲ ■ □ ● ◆ ▸ √` — and a 12 × 12 pixel-grid SVG set for HUD controls (`shape-rendering: crispEdges`).
  - **Only marks the baked fonts carry.** JetBrains Mono has no `✓ ○ ⏎ ✱ ⬢ ✚ ⌜ ⌝ ⌞ ⌟ ▮ ▯`, and Hubot Sans has no `↗`.
  - Missing marks are drawn by the pixel-grid SVG set, never left to system-font fallback, which renders differently on every OS. That covers the ✓ status mark and the ARCHIVE shape legend, and keeps the legend identical to the WebGL SDF shapes.
  - Arrows always set in mono.
  - `tests/glyphs.test.ts` fails the build on any UI symbol the mono font can't render.
- **Imagery:** project covers are 3:2, the portrait is 4:5. The rest state is a dither duotone; focus is full color. No stock photography, no AI-generated faces or "tech" imagery.
- **Voice:** mono labels are uppercase and terse, with no exclamation marks and no emoji. Use ISO dates (`2026-11-10`), 24-hour times with a zone (`14:32 CET`), grouped digits (`1,284`) and uppercase units (`4.2 MB`, `120 HZ`). Body copy is first person, plain, specific and quantified. Banned: "passionate", "crafting digital experiences", "let's work together", "ninja / rockstar / guru", "synergy".

### 2.11 Artifact allocation — one artifact, one home

If two sections want the same artifact, one of them is wrong.

| Artifact | Home | Used as | Never |
|---|---|---|---|
| CRT tube: scanlines, bloom, power cycle | global screen · Boot · Footer · Terminal | the medium itself | in Paper |
| Phosphor point cloud | Hero | the identity morph | anywhere else |
| Ordered (Bayer) dither | About portrait · DITHER RESOLVE · posters · image rest states | low-fi → hi-fi | on text |
| Punch cards (Hollerith) | Experience | role cards | anywhere else |
| Continuous-feed printout (tractor holes, green-bar) | Experience tail · ledger banding (Paper) | the condensed record | as decoration |
| Star chart + pen plotter | Research constellation | the body of work | anywhere else |
| Microfiche | Research dossier | the record | anywhere else |
| 35 mm slides + projector | Projects | the work | anywhere else |
| Keycaps | Skills | capabilities | anywhere else |
| Security documents: guilloche, foil, MRZ, stamps, perforation | Credentials | proof | anywhere else |
| Teletype + modem | Contact | the transmission | anywhere else |
| LED dot matrix (CSS mask) | metric numerals · footer marquee | big numbers | body text |
| VHS tracking error | TRACKING TEAR only | masking cuts | as ambience |
| ASCII | Terminal only (`neofetch`, `rain`) | the shell's own art | anywhere else |

---

## 3. Motion language

### 3.1 Principles

1. **Artifacts step, physics springs.** Classify every animation before writing it. Steps: typing, blinking, dither, HUD digits, grain. Springs: cards, cameras, panels, keycaps, cursor, tilt.
2. **Frame-rate independent or it doesn't ship.** Followers use `damp(current, target, λ, dt) = target + (current − target) · e^(−λ·dt)`. Springs integrate with RK4, sub-stepped at 1/240 s, which tracks the analytic spring (the one Motion uses for the DOM) within 0.01 percentage points of overshoot. No per-frame lerp constants anywhere: 60 Hz and 120 Hz must look identical.
3. **One owner per property.**
   - GSAP owns time and scroll (timelines, scrub, SplitText).
   - Motion owns React state (presence, layout/FLIP, gestures).
   - WebGL uses `lib/spring.ts`, integrating the *same* spring constants, so DOM and GL motion feel identical.
   - Never two engines on one property.
4. **Exits are faster:** 0.66× the entrance.
5. **Nothing time-based exceeds 900 ms**, except the boot gate (≤ 2.2 s) and rate-based text.
6. **The hotspot never lags.** Only decoration trails the pointer.
7. **Input wins.** Any input interrupts non-essential motion: springs retarget from their current velocity, and timelines jump to their end state. Nothing waits for an animation before it becomes interactive.

### 3.2 Easing

| Token | `cubic-bezier` | Use |
|---|---|---|
| `settle` | `(0.22, 1, 0.36, 1)` | entrances, reveals, panels arriving |
| `transit` | `(0.65, 0, 0.35, 1)` | A → B between two resting states: camera flights, layout swaps, back-to-top |
| `depart` | `(0.5, 0, 0.75, 0)` | exits |
| `relay` | `(0.9, 0, 0.1, 1)` | mechanical snaps: toggles, bracket draw, rail detents, the stamp's approach |
| `decay` | `(0.1, 0.9, 0.2, 1)` | light only — glow, flash falloff, afterglow; never positions |
| `linear` | — | scroll-scrubbed timelines only (Lenis supplies the inertia) |
| `steps(n, jump-none)` | — | artifacts. Caret blink = `steps(1)` at 1060 ms (530 on / 530 off) |

GSAP consumes these through `CustomEase.create("settle", "0.22,1,0.36,1")` and so on. CSS consumes them as `--ease-*` custom properties. Both come from `lib/motion.ts`.

### 3.3 Springs

Motion units (stiffness k, damping c, mass m). ζ is the damping ratio; "Settle" is the time to come within 2% of the target.

| Token | k | c | m | ζ | Overshoot | Settle | Use |
|---|---|---|---|---|---|---|---|
| `snap` | 700 | 48 | 1 | 0.91 | ≈ 0% | 0.18 s | toggles, chips, press, cursor ring contraction |
| `settle` | 180 | 25 | 1 | 0.93 | ≈ 0% | 0.38 s | panels, dossier, nav indicator |
| `overshoot` | 300 | 22 | 1 | 0.64 | 7.6% | 0.35 s | hero name per-char rise, VERIFIED stamp, card deal, H-HOLD |
| `tilt` | 150 | 18 | 1 | 0.73 | 3.3% | 0.48 s | Tier-B tilt and flip — weight with a hint of wobble |
| `magnetic` | 260 | 20 | 0.6 | 0.80 | 1.5% | 0.18 s | magnetic buttons |
| `heavy` | 60 | 15.5 | 1 | 1.00 | 0% | 0.75 s | cameras: rail jumps, dossier dolly, gallery settle |
| `relayout` | 120 | 14·√m | 1 + c̃ | 0.64 | 7.4% | 0.55–0.77 s | constellation re-plot (see note below) |

For `relayout`, c̃ is the paper's normalized citation count. Heavier (more-cited) papers therefore move slower and settle last. Because damping scales with √m, they never bounce more.

**Followers** (exponential damping; τ = 1/λ):

| Follower | λ (1/s) | τ |
|---|---|---|
| cursor ring | 24 | 42 ms |
| cursor label | 12 | 83 ms |
| index preview panel | 9 | 111 ms |
| hero camera parallax (±3° yaw, ±2° pitch) | 4 | 250 ms |
| hero repel field | 10 | 100 ms |
| HUD scroll % | 14 | 71 ms |
| scroll-velocity signal | 6 | 167 ms |

### 3.4 Duration tiers

| Tier | In | Out | Default ease | For |
|---|---|---|---|---|
| micro | 120 ms | 80 ms | `settle` / `relay` | hover, press, toggles, chips, bracket snap, tooltips |
| element | 400 ms | 260 ms | `settle` | reveals, panels, cards, dossier, DITHER RESOLVE (4×4) |
| scene | 900 ms | 600 ms | `transit` | camera flights, re-layouts, route transitions, POWER CYCLE, count-ups |

- Press feedback lands in the same frame. There are no transitions on `:active`.
- Rate-based exceptions: typewriter at 45 cps (the boot banner and one-line swaps only); terminal output at 120 lines/s; scramble ≤ 600 ms total.
- **Count-up:**
  - Runs on the scene tier with `settle`.
  - Digits step at 30 fps, because digits are artifacts.
  - Starts at 50% visibility.
  - The final value is already in the SSR HTML, so no-JS readers see the truth.

### 3.5 Stagger

- **Per char:** `min(28 ms, 400 ms / n)`, so the spread is capped at 400 ms.
- **Per line:** 60 ms, for at most 6 lines; line 7 onward arrives with line 6.
- **Per item:** 40 ms, ordered by **distance from the origin** (the click point, the entering edge, or the dealer's position). Never by DOM index — except in lists, where index *is* distance.
- **Humanized:** ±15% deterministic jitter per interval, seeded by element id. Mechanical regularity reads as a template.
- **Cap:** 600 ms total spread per group. Compress `each` to fit.
- **Once:** reveal once per page load; never re-hide on scroll-up.
- **Never gating:** staggered content is interactive at t = 0.

### 3.6 The three signature transitions

Transitions have grammar:
- **Continuity → DITHER RESOLVE.**
- **Discontinuity → TRACKING TEAR.**
- **Existence → POWER CYCLE.**

There is no fourth signature. For routes: if something on screen survives the jump, it's continuity; if nothing does, it's a tear.

#### ① POWER CYCLE — something turns on or off

- **Triggers:**
  - boot (ON)
  - theme switch (OFF-fast 240 ms → swap → ON-fast 360 ms)
  - terminal open and close (scoped to the panel)
  - the footer's last pixel (OFF)
  - 404 and 500 (ON into NO SIGNAL)
- **ON · 600 ms:**
  - 0–90 ms: a 2 px dot at center stretches into a full-width line (`settle`) at 1.25× brightness.
  - 90–420 ms: the line opens vertically (scaleY 0.004 → 1, `settle`), barrel distortion goes 0.15 → 0, and one scanline roll passes.
  - 420–600 ms: brightness settles 1.25 → 1.0 (`decay`) and the afterglow fades. The stage holds its first frame underneath until 420 ms (law 4).
- **OFF · 450 ms:**
  - 0–220 ms: content collapses to a line (scaleY → 0.004, `depart`) while the line brightens to 1.6×.
  - 220–340 ms: the line pinches to a dot.
  - 340–450 ms: the dot fades, leaving a 300 ms afterglow.
- **Rendering:** compositor transforms of the whole picture (DOM and stage move together), with `#fx-gl` drawing the beam, bloom and barrel. Where View Transitions are supported, the transform is applied to the root snapshots: the old one collapses and the new one expands, with keyframes sampled from the timelines. `#fx-gl` has its own `view-transition-name`, so its beam draws live above them. Transforming `#screen` directly would re-anchor every fixed descendant. Without View Transitions, `#fx-gl` covers the instant token swap at the moment of collapse. At the swap `#fx-gl` yields one frame, so the stage holds a frame of the *new* theme through the ON (law 4), not the last frame of the old one.
- **Paper variant — SCAN:** a bright bar sweeps top → bottom (`transit`, 600 ms), revealing the new theme behind it, like a photocopier pass.
- **Sound:** thunk + rising whine (ON); falling whine + click (OFF).
- **Reduced motion:** a 200 ms crossfade with no flash.
- **Photosensitivity:** one flash per cycle, ≤ 2 frames, confined to the beam.
- **One at a time** (v2.3, Part 12): a power-on asked for while one runs joins it (an upward key at the footer both resumes the tube and scrolls it off the end). A view transition skipped by a newer one has still run its update, so it animates nothing and throws nothing; a skipped power-on still opens.

#### ② TRACKING TEAR — you jumped

- **Triggers:** nav clicks, progress-rail clicks, terminal `goto` and `open`, route changes with no shared element, and back/forward across routes.
- **Not triggered** by continuously scrolling across a section boundary. That only glitches the HUD's section label.
- **450 ms, with the cut at 180 ms:**
  - **0–120 ms:** 3–5 seeded tear bands (1.5–9% of viewport height), offset 12–48 px with 4–12 px chroma fringes, drawn by `#fx-gl`. VHS head-switching noise runs across the bottom 4%. `#screen` jitters `translateX` by ±3–8 px in 30 Hz steps.
  - **120–200 ms:** noise floods to 100% coverage through a 4×4 Bayer threshold (crunchy, never an alpha fade).
  - **180 ms — the cut:** under cover, the scroll teleports (`lenis.scrollTo(…, { immediate: true })`), routes swap, and the governor swaps stages. A route swap holds the cover until the new route has committed (at most 1.5 s), and `#fx-gl` yields one frame after the cut so the stage can draw its new scene under the cover. Back/forward enters the tear at its cut (the browser has already swapped), then restores the saved position.
  - **200–450 ms:** the flood rolls off upward as one rolling bar, the bands decay and the jitter damps. Display headings in view go through H-HOLD (§3.7).
- **Paper variant — MISFEED:** skewed feed bands, toner streaks and a toner flood, on the same timing.
- **Sound:** a tape chunk + 120 ms of static.
- **Reduced motion:** a 160 ms cover/uncover with a solid `--bg` panel.

#### ③ DITHER RESOLVE — same thing, more fidelity

- This is the core principle animated: low-fi becomes hi-fi in front of you.
- **Triggers:**
  - every raster image's arrival and focus: gallery gate, index preview, case-study hero, dossier media
  - poster → live stage
  - the About portrait's exposure
  - project prev/next (SLIDE ADVANCE = a push plus a resolve)
- **Timing:**
  - Element tier: 4×4 Bayer, 17 levels, `steps(16)` over 400 ms.
  - Scene tier: 8×8 Bayer, 65 levels, `steps(32)` over 900 ms.
- **Threshold field:** `0.7 · bayer(x, y) + 0.3 · radial(origin)`, so the resolve radiates from where you looked.
- **Rendering:** in-shader on stages; on DOM images, a `mask-image` stepping through a 16-frame Bayer sprite; Canvas2D on the portrait.
- **Paper variant — HALFTONE:** AM halftone dots grow at 45°. Print resolves by screen, not by dither.
- **Sound:** none. It's the quiet signature.
- **Reduced motion:** instant swap.

#### The Konami code — the one ungrammatical motion

A full-screen degauss: a 1.2 s wobble, a rainbow fringe sweep and a hum. It's hidden, so it's allowed to break the grammar.

### 3.7 Standard motion (not signatures)

- **RAIL REVEAL** is the default reveal. A `clip-path: inset()` wipe runs from the left edge of its grid column with a per-line stagger, on the element tier with `settle`. No float-ups, and no opacity-only fades.
- **H-HOLD:** display type "loses horizontal hold". At the cut of a TRACKING TEAR, `wdth` jumps to 125, then springs back to its base width on `overshoot`. It applies only to single-line display/mega headings in fixed-width boxes (≤ 3 in view), so nothing around them reflows.
- **SCRAMBLE:** ≤ 40 characters, once per session, ≤ 600 ms. Glyphs cycle in 30 fps steps and resolve left → right. Titles and labels only.
- **TYPEWRITER:** the boot banner and one-line swaps only (the CURRENTLY block), at 45 cps.
- **MAGNETIC:** pulls within 1.4× the element's size, max 6 px, on `magnetic`. The label inside travels 1.5× as far (parallax).
- **MARQUEE:** 40 px/s base. Scroll velocity adds up to 4×, and direction follows scroll. Pauses on hover and focus; static under reduced motion.
- **VELOCITY SKEW:** ≤ 3°, damped (λ 6), on media frames and marquees only. **Never text.**

### 3.8 Scroll

- **Lenis:**
  - `lerp: 0.1` (frame-rate independent internally) with a 1× wheel multiplier.
  - Touch stays native (`syncTouch: false`), and nested scrollers use `data-lenis-prevent`.
  - Off under reduced motion.
- **Pins:** hero 100 svh, LOG ≤ 200 svh, ARCHIVE ≤ 150 svh. Nothing else pins, so there are 450 svh of pinned scroll in total.
  - **Native pins:** a pinned block is `position: sticky` inside a track 100 svh + the pin tall. The height is in CSS from the server render on, so nothing is inserted after hydration. Nothing switches the block between fixed and in-flow, which Chrome reports as a layout shift at every pin start and end.
  - **Tracking** (v1.6). `lib/scroll.ts` measures every section and pin on refresh (resize, fonts, images, height changes), never per frame. A frame's work is then a comparison against `scrollY`: the current section, and each pin's progress and step. ScrollTrigger isn't needed for any of this, so it stays out of first-load JS. A later part that wants a scrubbed timeline loads it, and it updates on the same tick.
  - **Without the motion edition** (reduced motion, or no JS) there is no track: the frames stack as static frames.
- **No page snapping.** Inside pins there are only *soft detents*: when velocity is < 0.2 px/ms and the position is within 8% of a node, it eases to that node. Never against live input.
- **Native truth:** `scrollY` is always real. PgUp/PgDn/Space/Home/End/arrows and anchors work, and scroll position restores on back. A scrolling key, a press or a touch cancels any eased scroll in flight (a detent, a glide), so input always wins.
- **History** (`lib/navigation.ts`). Every entry belongs to the Next.js router, so Back always restores the page and not just the URL:
  - **Same-document `#hash` links:** intercepted in the capture phase, then a TRACKING TEAR with `pushState` at the cut.
  - **Landing** (v1.6): a jump subtracts `scroll-padding-top`, as a native anchor does, so a section's strip never lands under the HUD's top band (§7.3). A pinned block lands at its pin's start.
  - **Continuous scroll:** keeps the hash linkable with `replaceState` (no entries; no hash for the first section).
  - **Route links with no shared element:** a tear, then `router.push(…, { scroll: false })` at the cut.
  - **Back/forward:** a tear entering at its cut, then the saved position.
  - **Positions:** `history.scrollRestoration = "manual"`. Positions are saved per URL in `sessionStorage`: continuously (debounced, never mid-jump) and at every landing.
  - **Opt-outs:** `data-transition="continuity"` (PROJECTION), `"none"`, modified clicks, `target`, `download`, other origins.
  - **If the grammar's lazy chunk hasn't landed,** a jump happens at once, uncovered, under the same rules. Navigation never waits on decoration.

### 3.9 The reduced-motion contract

`prefers-reduced-motion: reduce` produces a complete, designed static edition, not a broken one:

- Lenis off, no scrub, and pins become stacked static frames.
- **No WebGL context is ever created** (posters everywhere): reduced motion also means reduced compute.
- POWER CYCLE and TRACKING TEAR become crossfades; DITHER RESOLVE is instant.
- Typewriter, scramble and count-up show their final values.
- Tilt is off, with the foil fixed at `--mx: .62; --my: .38`.
- Marquees are static, the cursor has no lag, grain is static and the refresh roll is off.
- Sound is unaffected (it's already opt-in).

---

## 4. The 3D budget

### 4.1 Architecture — one stage context, five scenes, one live

```
<html data-theme="phosphor">
└─ <body>
   ├─ #stage    parking bay  WebGL2 context #1 — three.js / R3F. The one canvas lives in the root
   │                         layout and survives route changes; it is re-parented into the LIVE
   │                         slot's dock (sticky, z0 of the slot) and parks here between slots.
   ├─ #screen   z10          all DOM. Tier-A sections contain <StageSlot id="…">.
   ├─ #hud      z30          chrome — outside #screen, so the tear's jitter never re-anchors it
   ├─ #cursor   z40
   ├─ #fx-css   z50          grain + scanlines + refresh roll (CSS, compositor-only)
   ├─ #fx-gl    z60          WebGL2 context #2 — raw WebGL2 (~4 KB), transitions only, idle otherwise
   └─ <dialog>  top layer    terminal, dossier
```

**Why one persistent stage context instead of a canvas per section:**
1. Creating a context and compiling shaders at section entry costs 50–300 ms of jank, exactly when the section arrives.
2. Browsers cap live contexts and silently kill the oldest.
3. Shared GPU resources (post chain, render targets, blue noise, Bayer textures, matcaps) upload once.
4. The gallery slide can fly into the case-study hero only if the canvas outlives the route change.
5. **One RAF.** One `gsap.ticker` tick runs the whole chain, so DOM and GL can't drift apart. A funnel in `<head>` (`lib/raf-funnel.ts`) batches every `requestAnimationFrame` caller (GSAP, Motion, React, Next) into one native frame, and app code may not call rAF at all (ESLint):
   1. `lenis.raf`
   2. `ScrollTrigger.update`
   3. the governor (docking, LIVE scene)
   4. R3F `advance()` (`frameloop="never"`)
   5. HUD text (throttled to 10 Hz; FPS at 2 Hz)

The stage's R3F root is made with `createRoot` on the one persistent `<canvas>`, not with `<Canvas>`: `<Canvas>` calls `extend(THREE)`, which keeps every three.js class in the bundle (§8.3). Each scene extends only the classes it uses.

The transition layer is a second, raw-WebGL2 context for two reasons. It must run before the 250 KB stage runtime arrives (the boot's power-on), and it draws *above* the DOM while the stage draws *below* it.

The About portrait is a Canvas2D micro-surface (40,500 cells), not WebGL. It's the only canvas outside the two contexts, and it only runs while you interact with it.

### 4.2 The governor — `lib/sceneManager.ts`

Scene states: `COLD → PRIMED → WARM → LIVE → COOLING → COLD`
- **PRIMED:** chunk and assets fetched and decoded (CPU only).
- **WARM:** uploaded, with shaders compiled (`compileAsync`). Zero draw calls.
- **COOLING:** a 2 s grace period after leaving, to absorb back-and-forth scrolling, then dispose.

**Where it lives** (v2.3, Part 12): the governor is split in two.
- `lib/sceneManager.ts` is in first-load JS. It keeps what the page needs before any scene can draw: the store, the tier, the slots and the interlock, the boot's tasks, `#fx-gl`'s frames, the stats and refresh sampling, and `prefetch()`, which still fetches scene chunks on idle.
- The state machine is `lib/governor-engine.ts`: residency, loads and mounts, docking, the render decisions, takeover and context loss. The lazy stage runtime brings it and plugs it in (`governor.attachEngine`). Until then no scene loads or primes, and every slot shows its poster.
- **Measured:** first-load JS 229.9 → 227.3 KB gz, 2.6 against the ≈ 4 estimated.

**Invariants.** These are asserted by the dev overlay (`?debug=1`, or `debug` in the terminal) and by e2e tests.
- At most one LIVE scene and at most two scenes resident in VRAM. A COOLING scene is disposed early whenever a WARM one needs its slot.
- **Exactly one context draws per frame.** While `#fx-gl` runs a transition the stage freezes (a WebGL canvas keeps showing its last frame), then resumes.
- COLD means disposed: `renderer.info.memory` returns to baseline.
- Offscreen ⇒ 0 draw calls. Hidden tab ⇒ loop stopped.
- No input or camera motion for 2 s ⇒ 30 fps. Nothing animating (gallery at rest) ⇒ render on demand (0 fps).

**The interlock.** Between any two stage slots there is at least **100 svh of DOM-only content**, the interlock zone. Two stages can therefore never share the screen, and the governor swaps scenes where nobody can see it. The rhythm (§7) and the performance budget are the same rule. The next scene starts warming when the current stage's document begins (≥ 1.5 viewports ahead). Scene chunks prefetch on idle after boot (HIGH and MID).

**Gap protection.** If a fast fling outruns warm-up, the slot shows that scene's 1-bit poster and DITHER-RESOLVEs to live when ready. Never a black hole.

**Docking** (v1.5). The canvas is moved into the LIVE slot's `.stage-dock` and held by `position: sticky; top: 0; height: 100lvh`. The slot clips it with `overflow: clip`; `hidden` would make the slot a scroll container and break the sticky. The DOM moves only when the docked slot changes, inside the interlock where nobody sees it. Between slots and across routes the canvas parks in hidden `#stage`. The browser keeps it aligned, so nothing runs per frame. On a phone the stage moves with the native, compositor-driven scroll instead of a frame behind it, which settles the Part 3 finding. Inside a pin, the slot's geometry comes from its track, which is read on measure and never in the loop.

**Context loss.** `webglcontextlost` → posters everywhere. `webglcontextrestored` → re-warm the current slot. While the context is lost, the runtime frees every mounted scene's GPU objects, uniform textures included (v1.8). Deletes are silent then, and three re-uploads each object from its JS-side data on next use. What isn't freed then keeps three's old dispose listener, which after the restore deletes the old context's object in the new one (`INVALID_OPERATION: object does not belong to this context`). LOG's atlas hit this at Part 7. A scene's own dispose, on the other hand, frees only its materials' own maps: a uniform's texture is the scene module's, and may be shared (LOG's deck frees its atlas itself).

**Device tiers — `lib/tier.ts`:**

| | HIGH | MID | LOW | OFF |
|---|---|---|---|---|
| Typical | Apple-silicon Macs, discrete GPUs | integrated-GPU laptops, tablets | phones, Save-Data | no WebGL2, reduced motion |
| Hero particles | 250,000 | 90,000 | 35,000 | poster |
| DPR cap | 1.75 | 1.5 | 1.25 | — |
| Scene render target | HalfFloat (HDR) | HalfFloat | RGBA8 (no bloom ⇒ no HDR) | — |
| Bloom mip levels | 6 | 4 | 0 (halo baked into the sprite) | — |
| Persistence trails | on (half-res buffer) | off | off | — |
| Rest chromatic aberration | 0.6 px | 0 | 0 | — |
| Live stages | all five | all five | Hero + Projects | none |
| Keycaps | micro-physics | sine float + hover | HTML edition | HTML edition |
| Project covers | 1024×683 | 768×512 | 640×427 | DOM images |

**How a tier is chosen:**
1. **Hard rules first:**
   - WebGL2 is required (otherwise OFF).
   - Save-Data → LOW.
   - `deviceMemory` ≤ 4 → at most MID.
2. **Phone policy:** a coarse pointer with a width < 768 → LOW, whatever the GPU — for battery and thermals over a long scroll. Phones run Hero and Projects only. Experience, Research and Skills ship their *phone editions*, which are designed versions, not degraded ones.
3. **Probe:** during boot, render 45 frames of the hero at the provisional tier.
   - A p90 frame time > 9 ms demotes HIGH → MID; > 14 ms demotes MID → LOW.
   - The refresh rate is measured as the median of 60 rAF intervals and shown in the boot log.
   - **As built** (v1.7): the probe draws the hero's real sprite, curl included, every frame through a temporary post chain at the provisional tier, so the p90 is the hero's own cost. Measured on the M5 Pro over three fresh boots: p90 3.4–3.6 ms at HIGH, so it stays HIGH. Timer readings on Apple GPUs at a light load are inflated (§8.3).
4. **Runtime:** drei's `PerformanceMonitor` steps DPR down by 0.25 (floor 1.0) after 30 bad frames, and back up after 120 good ones.

The HUD's `GFX AUTO / LOW` overrides all of it.

### 4.3 Tier A — the five stages

Cut order if the budget breaks: **A5 → A2 → A4 → A3 → A1 (never)**.

#### A1 · HERO "SYSTEM" — Phosphor morph

- **What:** 250k / 90k / 35k points morph through four true states:
  1. **INITIALS** — identity.
  2. **CONSTELLATION** — the real `graph.json` of my papers.
  3. **GLOBE** — a live day/night terminator, with my city lit, synced to the local-time readout.
  4. **GRID LATTICE** — the site's own 12-column/baseline grid. It lands as the About layout while the `G` overlay flashes once.

  Transitions scatter and reassemble on curl noise with a per-particle delay, never a linear lerp.
- **Why WebGL:** 250k independently moving points with HDR additive glow and persistence trails. No CSS, SVG or Canvas2D path survives 1% of that.
- **Budget:**
  - 1 geometry draw (Points).
  - Morph targets are generated in a worker at boot as normalized Int16 attributes. At 6 B per particle per target, that's 6.0 MB VRAM at 250k, 2.2 MB at 90k and 0.8 MB at 35k.
  - Downloads: a 4 KB land mask, `graph.json` (shared), and a chunk ≤ 35 KB gz.
  - GPU ≤ 5 ms on M1/HIGH, ≤ 9 ms on the A54/LOW.
- **Cost to cut:** the submission thumbnail and the first five seconds. Every juror's first screenshot becomes a typographic poster. It's the one scene with no acceptable substitute, so it is never cut. (If physically forced: the 1-bit poster plus a scene-tier DITHER RESOLVE.)
- **As built** (v1.7, Part 6). The scene module is `components/stage/scenes/system.tsx`. The field is `components/stage/hero/field.ts`, a class outside React that the LIVE frame callback drives. Its shaders are in `shaders/hero.ts`, and its constants in `lib/hero.ts`. This is the performance template for A2–A5.
  - **Targets:** a module worker (`components/stage/hero/targets.worker.ts`) generates them during the boot. The generators in `lib/hero-gen.ts` also back a main-thread fallback. No particle position is downloaded. The 5.5 KB fetched are `/data/stage.json` (1,397 B: the graph's baked node layouts and the city) and the land mask. The boot counts both.
    - **INITIALS:** drawn from the display face's own file, read off the CSSOM, onto an OffscreenCanvas. 28% of the particles trace the outline and the rest fill the glyphs, ±0.075 deep. The file's `url()` resolves against its stylesheet, not the document (v1.8). Until Part 7 it resolved against the document: next/font's `../media/…` became `/media/…`, a 404 in the worker, and the system's sans drew the initials without a word ("AS" at aspect 1.74; 2.34 in the display face). The targets now say which face drew them (`initialsFace`), and Gate C fails on the system's. Its network listener covers the workers too, since a worker's failed fetch never reaches the page's console.
    - **CONSTELLATION:** 50% in blobs on the papers, sized by citations; 36% along the edges; 14% a faint sky.
    - **GLOBE:** 72% land, weighted by the mask (256 × 128 at 1 bit, 4,096 B, 29.0% land, baked from Natural Earth 1:110m by `scripts/bake/landmask.ts`). 8% ocean, 16% a 15° graticule, 4% the city's glow. The order is shuffled, so LOW's first 35k sample the same picture as HIGH's 250k (land share within 1.5 points, tested).
    - **GRID LATTICE:** read from the live page at its current size: the `.layout-grid` columns (computed `grid-template-columns`), `--baseline`, and the About layout's portrait and bio lines (`[data-lattice]`). It's placed in NDC, so it lands on the page's own columns at any camera. Resize, font loads and scroll refreshes regenerate it.
    - **Measured** (M5 Pro, four Gate C runs): 132–144 ms at HIGH, 60–88 at MID and 33–55 at LOW, all in the worker with none on the main thread. Upload (WARM) takes 16.5–21.3 ms.
  - **The morph:** scroll progress m ∈ [0, 3] picks the segment. Each particle starts its flight at a hashed share of the segment (≤ 0.42) and flies on a quintic ease. Its path bends through a divergence-free curl of two simplex potentials, scaled by a bell over the flight (scatter 0.16, burst 0.35). The curl is evaluated only while a particle flies or is stirred. At rest each particle breathes on its own phase (0.012), and HIGH adds the persistence trails.
  - **Pointer and scroll:** parallax ±3° / ±2° (λ 4); repel radius 12% vh (λ 10, push 0.08). Scroll velocity adds turbulence, saturating at 0.06 at 3,200 px/s.
  - **The sun:** NOAA's general solar position (±0.5°) for the current UTC. The city faces the viewer 18° above center, and the terminator and the HUD's local time read the same clock. The `G` overlay flashes once (600 ms) as the lattice lands, once per page view.
  - **Light:** a 2.1 px disc with `fwidth` AA. 1.2% of particles run 4× hot, burning to white through AgX. LOW has no bloom and draws a halo profile in a 1.7× sprite instead. Paper inverts the colors into what the ink absorbs and multiplies them in (§5.4).
  - **Budget, measured:** one Points draw. The scene chunk is 6.3 KB gz and the worker 5.3 KB gz. The hero's shaders also ride in the 4.4 KB `StageRuntime` chunk, because the boot probe draws them. The GPU, VRAM and draw-call numbers are in §8.3.

#### A2 · EXPERIENCE "LOG" — Punch-card rail

- **What:** the camera rides a Catmull-Rom rail through a deck of punch cards.
  - The cards use 80-column proportions (7⅜ × 3¼ in = 2.27:1), with the corner cut.
  - Each card's holes are a real Hollerith encoding of the company and years printed along its top edge.
  - Light behind the deck shines through the holes and projects their pattern onto the next card.
  - Fog swallows both ends, and the camera banks ±6° on curves.
  - Hover flexes the card (a vertex bend) and brightens its backlight.
- **Why WebGL:** depth fog, light through cut-outs, and banking on a spline. CSS 3D gets the stack (≈ 70%), but not light through holes or fog — the 30% that makes it a moment.
- **Budget:**
  - 1 InstancedMesh (≤ 12 cards) plus 1 additive light-shaft batch: ≤ 4 geometry draws.
  - The card-face atlas (2048×1024) is baked at build: lossless WebP ≤ 300 KB, ≈ 11 MB VRAM with mips.
  - GPU ≤ 4 ms.
- **Cost to cut:** the page's first *travel* — the moment the site goes from flat to deep — and the career reads as a list. The substitute is the phone edition (a CSS 3D card feed): ≈ 60% of the effect for zero GPU. Second to cut.
- **As built** (v1.8, Part 7), on the hero's template: `components/stage/scenes/log.tsx` (`prime()` loads the stage data and the atlas), the deck class `components/stage/log/deck.ts`, `shaders/log.ts`, and constants in `lib/log.ts`. World units are inches.
  - **The deck** stands along a centripetal Catmull-Rom rail, newest role first, with two blank leader cards at each end that the fog swallows. It has 16 slots (the shafts' uniform array holds one card matrix each), so it holds 12 roles, the `≤ 12` above; the atlas bake fails the build on a 13th rather than let the deck drop the oldest (`MAX_ROLE_CARDS`, `lib/log.ts`). The camera rides the rail on the `heavy` spring, driven by the pin's progress. Each card it passes hinges at its bottom edge and flips forward and down (104°), fading into the ground as it falls. The camera never cuts through a card; it's like riffling a card file.
  - **The camera** rides above the cards' tops and looks down about 9°, so the deck behind shows as a file of top edges, each with its company's name. It sits square-on, offset right by 16% of the visible width, so the card stays left of the HTML panel. It backs off on narrow screens until the card fills at most half the width. It banks up to ±6° by the rail's curvature times its own speed: in travel only, level at rest.
  - **The holes** are real IBM 029 Hollerith of each card's top-edge text (`lib/hollerith.ts`, with `decode` for the terminal). The tests read every card's holes back out of the atlas pixels.
  - **The light:** on a standing card the backlight comes through the holes (HDR 3.4, so they bloom). The card behind's holes glow through the stock (its alpha at a blurred mip): that's the projected mask. A light panel behind the deck glows. One InstancedMesh of shafts draws a ribbon per hole of the cards the camera faces.
  - **The cursor** bows the card it's over by 0.32 in and lifts its light 1.7×.
  - **Paper:** the deck lies on a light table. Cards are `--bg-sunken` taken 16% toward the print, the holes `--bg-raised`; no shafts, no glow.
  - **Draw order:** the stage's post chain has no depth buffer (the hero is all additive light). An InstancedMesh draws in instance order, so the deck's instances run far to near and the nearer card covers the farther. The cards never cross. A scene with crossing geometry asks the chain for depth.
  - **On demand:** the scene declares itself animating only while the camera, a bow or the bank still moves. A ticker watch wakes it when the pin's progress or the cursor changes, so at rest it draws nothing.
  - **Budget, measured:** 3 geometry draws (cards, shafts, light). The scene chunk is 6.2 KB gz. The atlas is 11.5 KB lossless WebP (2048 × 1024, 4 × 4 cells: A stock, R print, G the top-edge text). GPU, VRAM and draw-call numbers are in §8.3.

#### A3 · RESEARCH "ARCHIVE" — Citation constellation

- **What:** my publications as a monochrome star chart.
  - **Encoding:**
    - **shape** = venue type (7 SDF glyphs; the legend is always visible)
    - **size** = citations
    - **position** = the active layout
    - **accent** = focus; **hot** = the open record
    - a dashed outline = not yet published
  - **Edges** (shared co-authors, explicit relations, shared topic) draw in like a pen plotter, staggered by distance from the camera.
  - **Layouts:** three precomputed layouts spring into each other with `relayout`:
    - TOPIC: force-directed, solved at build
    - YEAR: a timeline lattice
    - VENUE: labeled columns
  - **Camera:** scroll flies it on a **retrograde loop** — a prograde arc, a loop back, then prograde again — passing the densest cluster twice from two angles. The nearest node auto-focuses, like tuning a dial.
- **Why WebGL:** hundreds of nodes and thousands of edges with focus+context (the rest recede into fog), a camera flight through depth, and a 60 fps re-plot. SVG can draw it, but it can't fly through it or re-plot it in depth.
- **Budget:**
  - 1 InstancedMesh (≤ 200 glyph quads) plus 1 LineSegments (≤ 2,000 edges with per-vertex draw progress): 2 geometry draws.
  - No textures. Springs run on the CPU (< 0.2 ms).
  - Labels are HTML (cluster names plus one tooltip).
  - GPU ≤ 3 ms.
- **Cost to cut:** the most differentiating screen on the site. Without it the research is a list — the exact failure the brief forbids — and "builder *and* researcher" loses its proof that the work is one connected body. The substitute is the phone edition: a build-time SVG snapshot whose edges plot in on view. Fourth to cut.
- **As built** (v1.9, Part 8), on the hero's template: `components/stage/scenes/archive.tsx` (`prime()` loads the shared sky from the stage data), the sky class `components/stage/archive/sky.ts`, `shaders/archive.ts`, and constants in `lib/archive.ts`. World units are the baked layouts' (a sphere of radius 10).
  - **The sky** is my records, then the works they cite (v1.9, the owner's call, §10 #30). A cited work is a faint star with a `cites` edge to each paper whose reference list includes it; the references are real ones, never invented. A shared reference settles between its citers in TOPIC. Its size is its own citations, normalized within its class, and every cited work stays smaller than any record of mine. Those counts come from the citations bake, which reads a cited work by its DOI as it reads my records, each count dated. A work without a DOI, or one OpenAlex doesn't know, stays the smallest. Until the reference lists arrive the sky holds the two papers and their topic edge.
  - **Shape** has one geometry, `lib/archive-shapes.ts`. The shader takes its polygon vertices as a uniform for an exact polygon SDF; the HTML legend, the SVG constellation and the poster draw the same paths. ✱ ⬢ ✚ are drawn, never left to a font.
  - **Blending** (§10 #32): each fragment is its final color over the ground, blended with MAX on the dark tubes and MIN on Paper. Overlapping glyphs and converging edges never add up to a white-out (additive light did, at the budget's caps), and nothing needs a depth buffer.
  - **The camera** orbits the sky's weighted center; the loop's bearing is the densest cluster's, so it passes that bearing on both arcs and again from the loop, higher and closer. The clip planes follow the sky. A dossier dollies the camera to its record, held left of center, clear of the reader.
  - **The re-plot** springs every node on `relayout`, batched RK4 at the 1/240 s sub-step. Measured at the caps, the most-cited settle last: a median of 358 ms against 266.
  - **The dial** focuses the star nearest the view's center (within 40% of the shorter side, 18 px of hysteresis) and plays its ARCHIVE note.
  - **The HTML layer** is the accessible half. Every star is a real link or button: one tab stop with a roving index, arrow keys travel by screen direction, Enter opens. The focused one sits over its glyph, at least 24 px across. The cluster, year and venue labels and the one tooltip move by transform from the screen positions the stage publishes.
  - **Gate C** measures cost on a synthetic sky at the budget's caps (`?debug=1&sky=stress`: 200 glyphs, 2,000 edges, never content), not on the two-paper sky.
  - **Budget, measured:** 2 geometry draws and no textures. The scene chunk is 9.2 KB gz. GPU, VRAM and draw-call numbers are in §8.3.

#### A4 · PROJECTS "WORK" — Slide carousel

- **What:** featured projects (≤ 8) as 35 mm slides in mounts on a gently concave arc.
  - Drag or fling with inertia.
  - The slide that lands in the gate *projects*: it DITHER-RESOLVEs to full color under lamp falloff, with dust specks and a hint of lens barrel.
  - Fast flings smear as phosphor persistence (not RGB split).
  - Click, and the slide projects into the case-study hero *across the route change*.
- **Why WebGL:** per-pixel dither → color, velocity smear, lens distortion, and a shared element that survives navigation. CSS can curve a row of cards, but it can't smear pixels or fly through a route change.
- **Budget:**
  - 1 InstancedMesh sampling a `DataArrayTexture` of covers, with the mount drawn in-shader: 1 geometry draw.
  - Covers are AVIF ≤ 120 KB each, at 1024×683 / 768×512 / 640×427. That's ≤ 30 / 17 / 12 MB VRAM.
  - GPU ≤ 4 ms.
- **Cost to cut:** the tactile proof that I build delightful interfaces, and the cinematic way into case studies. The work itself survives as content. The substitute is a CSS scroll-snap carousel with rotateY curvature plus a DOM FLIP into the case study. Third to cut.
- **As built** (v2.0, Part 9), on the hero's template: `components/stage/scenes/work.tsx` (`prime()` reads the slides from the stage data, packs every cover off the main thread and draws the mounts' print), the carousel class `components/stage/work/carousel.ts`, `shaders/work.ts`, the PROJECTION's choreography `components/stage/work/projector.ts`, and constants in `lib/work.ts` and `lib/covers.ts`. The covers are packed by the stage's shared image worker, `components/stage/shared/` (v2.1: CAPABILITIES' legends and matcaps use it too; the worker imports only the packing, never the module that spawns it). World units are mounts: the 50 mm mount is 1 × 1, its 36 × 24 mm window 0.72 × 0.48.
  - **The rail** is an arc of radius 4.4 mounts whose centre sits behind the viewer, so the edges come toward you. Slides stand 1.14 mounts apart along it (1.04 on a portrait frame, so a neighbour still shows), each turned to face the centre. The gate's distance is solved per frame so its mount fills 58% of the slot's height or 38% of its width, whichever binds (74% of a phone's width).
  - **Input** belongs to the page's HTML layer, which hands it to the carousel through `lib/work.ts` `workInput`. A drag moves the rail by the pointer's travel over one pitch on screen and rubber-bands past either end (0.32 of the pull). A release coasts: it lands on the slide nearest where it would stop after 0.32 s, on the `heavy` spring. A sideways wheel or Shift + wheel moves it and settles 140 ms after the burst. ← → step, Home and End jump. The vertical wheel is never the rail's.
  - **The gate:** when the rail comes to rest, the slide there lands. It plays GATE and DITHER-RESOLVEs to full colour, the scene tier: steps(32) over 900 ms on 0.7 · bayer8 + 0.3 · radial. It shows under the lamp's falloff (30% at the corners), with nine dust specks seeded per slide and a 0.04 lens barrel. At rest the others are a 1-bit dither duotone of their cover's tone, in `--fg-3` on `--bg-sunken`, 1.5 CSS px cells, dimming with distance. An INDEX row's slide prints in `--accent`.
  - **A fling** reads one amount, its speed over 6 slides/s, for three effects. The picture smears behind its motion in eight taps decaying like phosphor, on every tier; HIGH's persistence pass adds its own trail. FLING's whir follows it, sent at most every 50 ms. The post chain's radial aberration takes the scene's fling as it takes a scroll's (§10 #38).
  - **Paper is a lightbox.** The film's dark parts are the ink, on backlit white, and the gate is a loupe: full colour, magnified 1.18×, under a round lens with a rim.
  - **The mount and its print** are drawn in the shader: a rounded square in the theme's stock with an edge that catches the light and a shadow into the window. The print is the number and category above the window and the title below (the year too, once it's known). It comes from a one-channel atlas the scene draws at prime in the page's own mono face, as wide as the tier's covers, at its own aspect so it never stretches.
  - **Covers** are one `DataArrayTexture`, a layer per slide, at the tier's size: 1024 × 683, 768 × 512 or 640 × 427. A module worker fetches each AVIF, decodes it with `createImageBitmap` and reads it through an OffscreenCanvas into one transferred buffer, so the main thread never decodes a pixel. Mipmapped, sampled at a −0.5 LOD bias: a window minifies its cover. The worker's packing lives apart from its loader; a worker importing the module that spawns it hung the production build with no error.
  - **The HTML layer** (`components/sections/work/CarouselLayer.tsx`, loaded once the scene starts warming): every slide is a real link over its window, placed from the stage's projection (`workView`) by transform. There is one tab stop, the gate, and focus follows the rail. A click brings a slide to the gate, and on the gate opens it; a drag never opens anything. The pointer is captured only once a press becomes a drag, because a captured press sends its click to the layer. The gate is announced as it changes. Sideways wheels are kept from Lenis, which reads `deltaY` and ignores a prevented event.
  - **The stage-less edition** (tier OFF, reduced motion, no JS) is a CSS curved carousel in the slot's place: a scroll-snap row whose slides turn as they pass (a scroll-driven rotateY, ±24°), flat under reduced motion. Opening one is a DOM FLIP: its cover and the case study's hero share a view-transition name (§10 #39).
  - **Budget, measured:** one geometry draw, the covers within A4's VRAM, the GPU well under 4 ms. Numbers in §8.3.

#### A5 · SKILLS "CAPABILITIES" — Keycap pile

- **What:** every skill is a sculpted keycap with its legend (logo + name), in a loose cloud.
  - Grab and throw them; keys drift back to their category's home and clack on contact.
  - Primary-stack skills are accent-colored keys — the one red Escape key.
  - Clicking a category magnetically re-clusters the pile.
  - **Type a skill's name on your real keyboard and its key goes down** (when the stage has focus).
- **Why WebGL:** tactile, lit objects with collisions — **but not Rapier.**
  - `@dimforge/rapier3d-compat` 0.21 inlines a 3.08 MB WASM file. That's 1.17 MB gz as a raw binary and **1.65 MB gz** as `@react-three/rapier` ships it (measured) — seven times our first-load JS budget, for a toy.
  - Real rigid bodies also tumble legends face-down.
  - A purpose-built micro-sim is ≈ 5 KB and better UX: sphere proxies, walls, anchor springs, a grab spring and a *legend-up orientation spring*, on a fixed 1/120 s step, sleeping when settled.
- **Budget:**
  - 1 InstancedMesh (≤ 40 caps × ~1.5k tris) plus 1 instanced blob-shadow batch: 2 geometry draws.
  - Legend atlas: 1024² lossless WebP ≤ 90 KB. One 256² matcap per theme ≤ 12 KB.
  - ≤ 6 MB VRAM. Physics ≤ 0.3 ms/frame. GPU ≤ 3 ms.
- **Cost to cut:** the dwell-time toy — the screen where people stop and play — and the page's only tactile object. The content loses nothing, because the HTML panel is canonical. First to cut.
- **As built** (v2.1, Part 10), on the hero's template: `components/stage/scenes/capabilities.tsx` (`prime()` reads the keys from the stage data and decodes the legend atlas as one channel and the three matcaps as one array, off the main thread), the pile `components/stage/keycaps/pile.ts`, the cap `components/stage/keycaps/geometry.ts`, `shaders/keycaps.ts`, constants in `lib/capabilities.ts` and the pure layout in `lib/capabilities-layout.ts`. World units are keycaps: a 1u cap's base is 1 × 1, its legend facing the camera.
  - **The cap:** a squircle (n = 5) lofted from its 1u base to a 0.78 top, the top edge rounded over, then a 0.035 spherical dish: one lathe, 1,240 triangles. The legend face is the top (`aTop`), its UVs one atlas cell.
  - **The look:** one matcap per theme, layers of one `sampler2DArray`, so a theme change is a uniform. On Phosphor and Amber the caps are charcoal (the raised ground toward `--fg-3`) and the legends backlit past 1 (×2.2), so they bloom. On Paper the caps are beige under a daylight matcap, the legends dye-sublimated into the plastic. The primary stack is `--accent`. The post chain has no depth buffer, so the caps draw back to front with backface culling, after their blob shadows.
  - **The pile:** a cluster per category, each a hexagonal lattice 1.36 keycaps apart, turned by a seeded angle and nudged a seeded little. It looks loose, but no two homes are nearer than two sphere radii (1.2), so every key can rest at home. The clusters stand in loose rows, 1.8 apart. The arrangement is whichever shows them largest in the band (a row across a laptop's, a block in a portrait tablet's), at 82% of its width or 62% of its height.
  - **Gathering** (the chips, §10 #45): the category comes forward to the middle by 10% of the cloud's depth. The rest part around it, back by 45% and dimmed: to its sides, in a row or a column a side, or above and below, whichever leaves the band the most room. They're placed as they look from the camera, so on screen nothing stands behind the gathered keys. The steps are shares of the depth, so a gathered pile looks the same at every depth.
  - **The micro-sim (HIGH):** semi-implicit Euler at a fixed 1/120 s, at most four steps a frame. Each key has a home spring (26 s⁻², ζ 0.9). A grab spring (260 s⁻², ζ 1) drives drag-and-throw, capped at 26 keycaps/s. Sphere proxies (radius 0.6, restitution 0.32) collide, and the walls are the band's edges, widening with depth (restitution 0.45). The legend-up spring (90 s⁻², ζ 0.8) turns each key back to its resting tilt by quaternion error. It sleeps once every key is within 0.01 of home and slower than 0.004 for 0.5 s; then the stage draws nothing. A contact over 1.4 keycaps/s clacks, at full gain from 9.
  - **MID** floats the keys on a 3.6 s sine at their homes, easing to new ones: hover and press, no throw.
  - **The HTML layer** (`components/sections/capabilities/KeyLayer.tsx`, loaded with the scene) is one focus stop for the keys. While it has focus, typing a skill's name, an alias or its legend presses its key, longest name first ("java" presses Java, "javascript" goes on to JavaScript), and the run resets after 900 ms. The page's single-key shortcuts (G, S) stand aside (`data-keys="capture"`, `lib/keys.ts`), and Esc leaves. There's no `~` yet (the terminal is Part 13); the layer takes printable keys, so it will stand aside too. The pointer: a click presses; on HIGH a drag grabs and throws. One tooltip (name · years · level) follows the hovered key. The category chips are one radio group.
  - **Budget, measured:** two geometry draws, 2.48 MB of VRAM, the physics 0.015 ms a frame, the GPU about 0.5 ms, at the 40-key cap. Numbers in §8.3.

### 4.4 Tier B — 3D without WebGL

CSS 3D transforms, gradients and blend modes, driven through custom properties, with **zero canvases**. Tier B must look as expensive as Tier A; that's the point of it.

**One lamp.** Every Tier-B object is lit by the same light: the cursor.
- `--mx` and `--my` ∈ [0, 1] are the pointer position over the element. On phones they come from device tilt (β/γ ±25° → 0…1).
- `rotateX = (0.5 − my) × 2 × 8°` and `rotateY = (mx − 0.5) × 2 × 8°`, on `tilt`.
- The specular highlight sits at (mx, my).
- The cast shadow is offset by `((0.5 − mx) × 16 px, (0.5 − my) × 16 px + 10 px)`, with a blur of 18 px + 12 px × tilt magnitude.

**B1 · Credential cards (the Tier-B hero)**
- **Format:** ISO/IEC 7810 **ID-1**, 85.60 × 53.98 mm (1.586:1), corner radius `--r-card`. Credentials are access cards for the machine.
- **Front, bottom → top:**
  1. base stock (`--bg-raised`)
  2. **guilloche** — an inline SVG seeded by `credentialId`, so every card's engraving is unique and deterministic
  3. the issuer seal, embossed with paired highlights and shadows offset along the lamp vector
  4. **foil zones — the seal and a stripe only, never under text**
  5. title, issuer logo, mono serial, level badge, issue date
  6. a perforated edge (radial-gradient mask)
  7. the stamp
- **Foil recipe** (inside foil zones only):
  1. **Sheen:** `repeating-linear-gradient(115deg, …)`, six hues per 12% period, `background-size: 300%`, positioned by `--mx/--my`, `mix-blend-mode: color-dodge`, opacity 0.55.
  2. **Iridescence:** `conic-gradient(from calc(var(--mx) * 360deg) …)`, `soft-light`, opacity 0.5.
  3. **Glare:** `radial-gradient(circle at (mx, my), white, transparent 45%)`, `overlay`, with opacity equal to the tilt magnitude.
  4. **Grain:** the whole stack is masked by a 128 px diffraction-noise tile (≈ 6 KB), so it shimmers like a grating rather than clean plastic.

  Hue shifts move `background-position`. Never animate `filter: hue-rotate()` — filters force re-rasterization.
- **Stamps tell the truth.**
  - **VERIFIED** (in `--hot` ink, with `overshoot`, a 4° rotation and a thud) appears only if `verifyUrl` resolved at build time. Otherwise the stamp reads ON FILE.
  - **EXPIRED** cards get a static desaturation and a stamp in `--fg-3` ink. Honesty reads as confidence.
- **Back** (rotateY 180°, `backface-visibility: hidden`):
  - credential ID, issue and expiry dates
  - skills covered, plus one line on what the credential proves
  - **VERIFY ↗**
  - an **MRZ line** encoding ID, issuer and dates, with real ICAO 9303 check digits (7-3-1 weighting)
- **Paper theme:** the foil becomes silver foil stamping — less hue, more specular. Themes change materials.

- **As built** (v2.2, Part 11): `components/sections/credentials/` (`IdCard.tsx`, `Defs.tsx`, the lazy `CredentialsBehavior.tsx`), `lib/credentials.ts`, `lib/mrz.ts`, `lib/guilloche.ts` and `styles/credentials.css`. Server HTML throughout; the behaviour loads on idle.
  - **The card** is an `<li>` holding the cast shadow and the card, the card holding the turn and the turn holding the two faces: `preserve-3d` two deep, the faces flat. Every size inside is in container units of the card's own width, so it scales as one object. The `<li>` carries `contain: layout paint style` and enough padding for the tilt's overhang and the shadow.
  - **The guilloche:** two rosettes (ellipses turned about their centre, closing on a clean circle) and a band of waves, drawn once per page, placed by each card's seed (§10 #47). The wave's half-sine is one cubic, control points 0.4125 of the way at 1.337× the amplitude: within 0.3% (measured).
  - **The foil** is the recipe above, on a dark metal: color-dodge over a light metal only ever made white. The grain is a 128 px tile baked as a luminance mask (§8.2). Paper's silver bands its metal with an overlay sheen and a brighter glare; an expired card's foil and ink grey out through its custom properties, never a filter.
  - **The lamp:** pointer events only set the `tilt` springs' targets, and one tick writes each live card's variables. At most two cards are live (the hovered one and the one settling); a third retires the oldest. `will-change` goes 300 ms after a card settles. At rest every card keeps the resting lamp, (0.62, 0.38).
  - **The turn** is a button over the card (aria-pressed, the title in its label). It turns on the `tilt` spring, sampled into a `linear()` easing (`springLinear`, `lib/motion.ts`) for a CSS transition; Escape turns back and returns focus. A face on another 3D plane can't be lifted over the button by z-index, so a turned card's button stops taking the pointer and a click on its back (not a link) turns it back. VERIFY ↗ is focusable only while its face is up. Without JS the back sits under the front.
  - **The MRZ** is TD1's first two lines (`lib/mrz.ts`): `CR`, the issuer's three letters, the credential ID with TD1's long-number rule, the dates, the level, the composite digit. The 7-3-1 check digits match ICAO's own specimen; the gate recomputes every card's.
  - **The deal:** armed only when the wall starts below the fold; once it comes into view, each card flies from beyond the wall's bottom-right, nearest first (`itemDelays`, ≤ 600 ms of stagger). Its x eases on `overshoot`, its y on `settle` (the two make the arc), its −12° turn on `overshoot`. Its stamp lands at 70% of the flight with a STAMP thud for VERIFIED and EXPIRED. These are compositor animations; nothing is written per frame.
  - **Phones:** TILT TO INSPECT shows on a coarse pointer with device orientation, and asks for permission only when tapped. Then the gyro (β from where the phone was held, γ; ±25°) moves the foil of the at most two cards most in view (§10 #48). A tap turns a card.

**B2 · Record cards** (awards, talks, OSS…): tilt max 6°, bracket corners, a glyph per kind, no foil.
- **As built** (v2.2): server cards in a staggered grid (the middle and right columns lower on wide screens). Their brackets are drawn statically, their kind glyphs are seven 16 px figures drawn once, and their tilt (the same lamp, at 6°) arrives with the wall's behaviour.

**B3 · Microfiche dossier:** arrives with rotateX 8° → 0 plus a scan-bar reveal (element tier) — the fiche landing on the reader glass.

**B4 · Index preview:** the hovered project's cover follows the cursor (λ 9) with `rotateZ = clamp(vx × 0.02, ±4°)` — a slide held between fingers.

**B5 · Phone editions:**
- Experience: a punch-card feed.
- Research: a plotter-SVG constellation.
- Skills: a CSS keycap grid with press states.
- Projects (OFF tier): a CSS curved carousel.

**Tier-B performance rules:**
- Animate `transform` and `opacity`. Animate `background-position` only on live foil cards, and allow **at most 2 live foil cards** (hovered + releasing). The rest show a static, pre-composited resting foil.
- Set `will-change: transform` only during interaction: add it on enter, remove it 300 ms after settle.
- Make one style write per frame, with pointer events coalesced into rAF. Register `--mx/--my` with `@property` (`<number>`, inherits).
- Give each card `contain: layout paint style`. Nest `preserve-3d` at most two levels deep, and never put `overflow: hidden` on a `preserve-3d` parent (it flattens it).
- No `filter` or `backdrop-filter` on moving elements.
- **Reduced motion:** no tilt, foil frozen at (0.62, 0.38), instant flips.
- **Gyro:** iOS permission is requested only from an explicit **TILT TO INSPECT** chip, never automatically.

---

## 5. Texture & post-processing

### 5.1 Stack order (bottom → top)

1. `#stage`: scene → bloom → `RetroEffect` (persistence composite, chromatic aberration, vignette, tone mapping, output dither)
2. `#screen` (DOM)
3. `#hud`
4. `#cursor`
5. the boot overlay (`.boot`, a first visit only; v1.6). It sits under the glass: grain and scanlines lie on the boot screen, and `#fx-gl`'s beam opens over it.
6. `#fx-css`: grain, scanlines, refresh roll
7. `#fx-gl`: transitions only

The vignette lives inside `#stage` and never darkens DOM text. Scanlines and grain exist only in `#fx-css`; the stage never draws its own. Two scanline grids beat into moiré, and two grain layers double-dip.

**The chain as built** (v1.7, `components/stage/post.ts`). `postprocessing` is used directly. A RenderPass clears to `--bg` and draws the scene. On HIGH, a persistence pass follows: two half-resolution HalfFloat buffers, decay dt-corrected. Then comes ONE EffectPass holding Bloom and `RetroEffect`. The scene target is HalfFloat (RGBA8 on LOW), with no depth buffer. The chain is fixed per tier and theme: Phosphor ↔ Amber is uniforms, while Paper builds its own chain with no bloom and no persistence. A scene gets the chain from `useStagePost()` and never builds its own.

### 5.2 Target intensities

| Effect | Where | Phosphor | Amber | Paper | Tiering | Reduced motion |
|---|---|---|---|---|---|---|
| Film grain | `#fx-css` | white speckle, peak α 0.08, mean 0.028, 24 fps | same | black toner speckle, peak α 0.09, mean 0.025 | all tiers | static (no jitter) |
| Scanlines | `#fx-css` | α 0.07, pitch 3 CSS px snapped to device px, line = ⅓ pitch | α 0.07 | **none — paper is not a screen** | all | static (kept) |
| Refresh roll | `#fx-css` | +2.5% luminance band, 140 px, every 9 s | same | none | HIGH, MID | off |
| Bloom | stage | **threshold 1.0 (linear HDR)**, smoothing 0.15, intensity 1.15, radius 0.72, mipmap blur | intensity 0.95 | **off — ink doesn't glow** | 6 / 4 / 0 mip levels | n/a |
| Phosphor persistence | stage | decay 0.84 per 1/60 s (dt-corrected) | 0.88 — a longer trail; the tubes differ in physics, not just hue | off | HIGH | n/a |
| Chromatic aberration | stage, radial | 0 px at center → 0.6 px at corners at rest; ≤ 4 px on fling | same | becomes **registration offset**: cyan/magenta plates ±1 px, on fling only | rest: HIGH · fling: HIGH, MID | n/a |
| Vignette | stage | offset 0.35, darkness 0.45 | same | multiply 0.15 (scanned-page falloff) | all | n/a |
| Tone mapping | stage | AgX — hot cores burn to white like overdriven phosphor | AgX | **none** (v1.7) — ink is LDR and keeps its hue untouched (§5.3) | all | n/a |
| Output dither | stage, last pass | ±1 LSB blue noise (kills banding in halos over `#050505`) | same | same | all | n/a |
| Barrel distortion | `#fx-gl` | 0 at rest; 0.15 → 0 during POWER CYCLE only | same | none | all | none |
| Text glow (DOM) | accent display text | `text-shadow: 0 0 .35em` accent @ 40%, ≤ 3 elements in view | same | none | MID and up | kept (static) |
| Flicker | — | none at rest; boot only, ≤ 3% luminance modulation | same | none | — | none |

### 5.3 Rules

- **Bloom is opt-in by luminance.** The stage renders to a half-float target, and only emissives meant to glow exceed 1.0. UI-like textures (card faces, legends) are tone-mapped below 1, so they can't bloom by accident.
- **Device-pixel snapping.** `pitch_dev = max(2, round(3 × DPR))` and `line = max(1, round(pitch_dev / 3))`. JS writes `--scan-pitch` (in CSS px) on `#fx-css`, never on `html` (§8.3, TBT), at boot and on every resolution change. Fractional pitches band on 1.5× and 2.625× Android screens.
- **No MSAA anywhere.** All our geometry is points, lines and quads, so every fragment shader does analytic AA with `fwidth`.
- **Overlays are part of the color system.** Effective contrast under FX (measured; dark themes with grain mean 0.028 / peak 0.08 and scanlines 0.07; Paper with toner):

| Theme | Token on surface | Base | Average under FX | Worst single pixel |
|---|---|---|---|---|
| Phosphor | `--fg-3` on `--bg` | 7.33 | 6.71 | 5.52 |
| Phosphor | `--fg-3` on `--bg-raised` | 6.90 | 6.22 | 5.00 |
| Phosphor | `--hot` on `--bg` | 5.82 | 5.35 | 4.39 |
| Phosphor | `--hot` on `--bg-raised` | 5.48 | 4.96 | 3.98 — hence the `--hot` text rule (§2.2) |
| Amber | `--fg-3` on `--bg-raised` | 6.78 | 6.08 | 4.86 |
| Paper | `--fg-3` on `--bg` | 5.84 | 5.53 | 4.76 |
| Paper | `--hot` on `--bg` | 5.71 | 5.41 | 4.66 |

- **Grade the light, not the ground** (v1.7). The canvas is opaque in `--bg`, and `RetroEffect` grades only what the scene added: `bg + AgX(light)`. The vignette and the aberration act on that light alone. So the ground leaves the chain as the page's own `--bg` — 11/255 on both sides of the canvas edge, measured — and there's no seam.
  - **The trap:** postprocessing's clear sets its color before binding its target. If the canvas is still bound, three converts that color to sRGB, and the ground read 32/255 for 11. The renderer binds the chain's input buffer before every render.
- **Persistence keeps the trail's share in alpha** (v1.7), so the composite adds only what has moved. A still particle gets no halo of its own past.
- **Allocate only what's read** (v1.7). The luminance pass runs at half resolution. The composer's output buffer stays 1 × 1 unless a resolve (DITHER RESOLVE, posters) needs the frame as a texture; three allocates a target's memory on its first bind.
- **Paper is not tone-mapped** (v1.7). Multiply blending can't take the stage past its paper, so there's nothing to compress. Neutral is not identity on this field:
  - On the image, it takes the paper ground (linear 0.888, 0.871, 0.831) to (0.824, 0.808, 0.769): 242 → 234 in sRGB, a seam against the page's paper.
  - On the ink, its toe takes a faint stipple's density from 0.05 to 0.016.

  The ink falloff (multiply 0.15) acts on the ink only, so the stage's paper meets the page's.
- **Photosensitivity (WCAG 2.3.1):** no full-screen luminance change above 10% more than 3 times per second — anywhere, ever.
- `prefers-contrast: more` and `forced-colors: active` switch every FX layer off.

### 5.4 Paper is a different machine

Paper never gets CRT artifacts; it gets print artifacts. Each stage has a paper material set, planned from day one (cheap to plan, expensive to retrofit):

| Stage | Phosphor / Amber | Paper |
|---|---|---|
| Hero | additive HDR phosphor | ink stipple (multiply blend), no bloom, no persistence |
| Experience | backlit cards in fog | cards on a light table; the light shows through the holes; fog = paper |
| Research | glowing vector star chart | printed star chart; edges plotted in ink |
| Projects | a projector in a dark room | slides on a lightbox; the gate is a loupe |
| Skills | charcoal caps, backlit legends (bloom) | beige caps, dye-sublimated legends, daylight matcap |
| Transitions | POWER CYCLE / TEAR / DITHER | SCAN / MISFEED / HALFTONE |

---

## 6. Sound

### 6.1 Stance

Muted by default. Sound confirms what you did; it never announces what you might do. No music, no ambient loops and **no hover sounds**. Sound never carries information alone.

### 6.2 The toggle

- **Placement:** the HUD front panel, labeled **SND OFF / SND ON** in text (not an icon).
- **Meter:** when on, a 4-LED VU meter driven by a real `AnalyserNode` (law 2).
- **Hotkey:** `S` (disabled while typing).
- **Persistence:** saved in `localStorage`.
- **Lifecycle:** the `AudioContext` is created on first enable (a user gesture) and suspended when muted or when the tab is hidden. If the saved preference is ON, it resumes on the first gesture of the next visit.
- **Never before a gesture** (v1.6). Chrome starts a context created earlier as suspended, with a console warning. So a saved ON waits for the first gesture, unless the browser already allows audio (`navigator.userActivation.hasBeenActive`, or `getAutoplayPolicy("audiocontext")` is `"allowed"`). BOOT's hum plays only there.

### 6.3 Engine and mix

- **Engine:** the Web Audio API, ≈ 3 KB, no library.
- **Master chain:** HPF 70 Hz → compressor (−24 dB, 3:1; knee 6 dB, attack 3 ms, release 250 ms) → makeup trim → LPF 11 kHz → master → an `AnalyserNode` (the VU meter).
  - **The trim** (v1.6). Web Audio's compressor adds its own makeup gain, (1 / curve(0 dBFS))^0.6, which is +9.6 dB at these settings. Without the trim a released compressor plays every cue about 10 dB over the sheet (POWER OFF measured +9 dB), so the trim takes the makeup back out.
- **Levels:** peaks ≤ −6 dBFS; program level ≈ −30 LUFS short-term — under-the-desk quiet.
- **Voices:** cap 8 (keycaps ≤ 6). Repeating cues get ±4–8% pitch randomization.
- **Samples:** ≤ 6 (AAC-LC `.m4a`, 48 kHz mono), ≤ 90 KB total, fetched only after first enable. Everything else is synthesized.
- **Bursts** (v1.6): ticks, clicks and static are synthesized once per shape. Each is seeded noise through an RBJ band-pass with the envelope baked in, normalized to a peak of 1, so a burst played at its sheet level peaks there. A `BiquadFilterNode` on live noise throws most of the energy away; it measured 10–20 dB under the sheet.
- **Measured** (v1.6). `scripts/boot-gate.mjs` renders each cue offline through the real chain, after 0.5 s of silence. For jittered cues the figure is the loudest of 24 takes. Results in dBFS: ENABLE −20.2, BOOT tick −29.5 and thunk −22.2, POWER on −22.2 and off −22.4, TEAR −23.2, SECTION −29.6, COMMIT −30.4.
  - No cue is more than 1 dB over its sheet peak.
  - The low tones sit about 2 dB under, because the HPF takes their fundamentals.
  - TEAR's static starts 25 ms after its tape chunk, so the two peaks never stack.
- **Nothing at 15.7 kHz.** The flyback whine is authentic, and it's an ear-pick for anyone under 25.

### 6.4 Cue sheet

| Cue | Trigger | Source | Peak | Limit |
|---|---|---|---|---|
| ENABLE | sound switched on | relay clunk + 300 ms hum swell | −18 dBFS | — |
| BOOT | boot, only if the preference is already ON | 120 Hz transformer hum (2× mains), key ticks, power thunk | −32 / −30 / −20 | ticks ≤ 25/s |
| POWER | POWER CYCLE | synth sweep + click | −22 | — |
| TEAR | TRACKING TEAR | tape chunk + 120 ms static | −24 | 1 per 450 ms |
| SECTION | scrolling into a new section | relay click | −30 | ≥ 1.2 s apart |
| COMMIT | buttons, chips, toggles | 4 ms band-passed noise tick at 3.2 kHz | −30 | ≥ 40 ms apart |
| FLING | gallery drag | filtered-noise carousel whir, gain proportional to speed | ≤ −28 | continuous |
| GATE | a slide lands in the gate | slide-drop clunk | −22 | — |
| ARCHIVE | the nearest node takes focus during the camera flight | sine blip: pitch = year on an A-minor pentatonic scale (220–880 Hz), length proportional to citations (40–120 ms). **Scrolling plays the publication history.** | −30 | ≥ 150 ms apart |
| REPLOT | layout chip | plotter servo sweep | −28 | — |
| KEYCAP | collisions, presses | three clacks (a thock, a bright clack, a low clunk), synthesized (v2.1, §10 #43); one at random, gain proportional to impact, pitch ±6% | −20 | 6 voices |
| FLIP | card flip | paper flick: air past the card's edge (a band of noise, pitched ±6%) and the tick of it landing; synthesized (v2.2) | −28 | — |
| STAMP | VERIFIED / EXPIRED | thud: the stamp's slap, the handle's thump rising as the slap decays, the stock's body; synthesized (v2.2) | −18 | synced to the deal stagger |
| SHELL | open/close · enter · error | chirp · 880 Hz square, 35 ms · 220 → 196 Hz | −28 | — |
| TRANSMIT | the contact form's send accepted (202) | 1.4 s stylized modem handshake → two-partial chime; synthesized (v2.3): a 2.1 kHz answer tone (240 ms), a 1,650/1,850 Hz square warble in 30 ms steps, 470 ms of band-passed hiss, then a fifth (1,320 + 1,980 Hz) | −24 | — |
| HALT | footer power-off | 2 kHz → 60 Hz sweep in 400 ms + click; synthesized (v2.3): a triangle sweep and the relay's 6 ms click after it. It replaces POWER's off | −22 | — |

---

## 7. Sitemap & rhythm

### 7.1 Map

| # | Section | Code | Tier | Level | Artifact | Wow beat |
|---|---|---|---|---|---|---|
| 00 | Boot | POST | fx-gl | LOUD (≤ 2.2 s) | CRT tube, POST log | The machine tells you the truth about *your* machine — GPU, refresh rate, tier, bytes — then the tube powers on |
| 01 | Hero | SYSTEM | A1 | LOUD | phosphor point cloud | 250k particles condense out of the boot noise into initials, then unfold into my papers, my place and the site's own grid |
| 02 | About | IDENTITY | Canvas2D | quiet | ordered dither | Your cursor is an exposure lamp: the dithered portrait develops where you shine it, then fades back like phosphor |
| 03 | Experience | LOG | A2 | LOUD → quiet | punch cards, printout | Riding a rail through a deck of punch cards; light through the holes — which really encode each role — falls on the next card |
| 04 | Research & Publications | ARCHIVE | A3 | LOUD → quiet | star chart, microfiche | One chip re-plots the sky: nodes spring from topic clusters into a timeline, the most-cited papers settling last |
| 05 | Projects | WORK | A4 | LOUD → quiet | slide projector | Fling the carousel; the slide in the gate projects from dither to color; click and it projects into its case study |
| 06 | Skills | CAPABILITIES | A5 | mid → quiet | keycaps | Type a skill on your real keyboard and its keycap goes down with a clack |
| 07 | Certificates & Records | CREDENTIALS | Tier B | LOUD → quiet | security documents | The foil catches the light from your cursor — or, on a phone, from tilting it; flip a card for its MRZ line and VERIFY |
| 08 | Contact | CONNECT | — | quiet + one loud | teletype, modem | The transmission log is real, and the availability block tells you how many working hours we overlap |
| 09 | Footer | HALT | fx-gl | quiet → flourish | CRT power-off | The last pixel collapses the tube to a line: SYSTEM HALTED. SCROLL UP TO RESUME. |
| ∞ | Terminal | SHELL | — | — | ASCII, shell | A real CLI over all of it: `cite`, `verify`, `grep`, `open` |

### 7.2 Rhythm

```
               LEVEL                    GPU      NOTE
00 POST        ██████████░░░░░░  LOUD   fx-gl    ≤ 2.2 s, once per session, never on deep links
01 SYSTEM      ████████████████  LOUD   A1       the loudest beat
02 IDENTITY    ███░░░░░░░░░░░░░  quiet  —        interlock · Canvas2D portrait
03 LOG         █████████████░░░  LOUD   A2       pinned ≤ 200 svh
   printout    ██░░░░░░░░░░░░░░  quiet  —        interlock
04 ARCHIVE     ██████████████░░  LOUD   A3       pinned ≤ 150 svh · second-loudest, on purpose
   ledger      ███░░░░░░░░░░░░░  quiet  —        interlock · dossier, ledger, metrics
05 WORK        █████████████░░░  LOUD   A4       not pinned
   index       ██░░░░░░░░░░░░░░  quiet  —        interlock (+ Skills header, primary stack)
06 CAPABIL.    ████████░░░░░░░░  mid    A5       80 svh band
   panel       ██░░░░░░░░░░░░░░  quiet  —        interlock
07 CREDENT.    ███████████░░░░░  LOUD   —        Tier B: loud without a canvas
   records     ███░░░░░░░░░░░░░  quiet  —
08 CONNECT     ███░░██████░░░░░  q + 1  —        one loud invitation, then calm
09 HALT        ██░░░░░░░░░░████  q → !  fx-gl    power-off on the last pixel
```

**Rules:**
- Never two loud beats without a quiet one between. The interlock guarantees it, because every Tier-A section is a STAGE (loud) followed by its DOCUMENT (quiet).
- The hero is the loudest beat. The second-loudest is Research, not Projects — deliberately, because Research is the differentiator.
- The page ends quiet, with one flourish.

**Phone rhythm:** LOUD hero → quiet about → mid (punch-card feed) → mid (plotter SVG) → LOUD (WebGL carousel at LOW) → quiet → LOUD (gyro foil) → quiet → flourish.

### 7.3 Persistent chrome

- **HUD readout** (top-left, mono micro): `RETROGRADE/OS · 04 ARCHIVE · 37% · 14:32:07 CET`. The zone (v1.8) is named as the owner's country writes it in English, `en-<countryCode>`: IST, CET, EST, or a GMT offset where English has no name. en-GB alone named Asia/Kolkata "GMT+5:30". The clock's field is sized to the zone's widest reading over a year (`clockCells`), so summer time's CEST fits too; a fixed 13 cells would have clipped "GMT+5:30". FPS appears only in `debug`. Its fields are fixed-width, like any terminal status line: the section field is as wide as the longest label, so a label change never moves the percentage. That means no layout shift. It's `aria-hidden`; the section rail carries the same state as `aria-current`. The widths are in `em` on the mono cell (`0.6em` + tracking), not `ch` (v1.6). A `ch` is measured from the fallback font until the real one swaps in, so a `ch` width moved the clock (CLS 0.00007, measured).
- **Nav** (top-right): `WORK · RESEARCH · CREDENTIALS · CONTACT · ~`. Magnetic, with one shared-layout active indicator.
  - **The indicator** (v1.6) is a single hand-rolled bar that springs its x and width on `settle` to the item for the current section. Motion's layout animation put `/` at 253.9 KB gz of first-load JS, over the 230 budget; with the bar it measured 214.3.
  - **`~`** is the terminal's key. It is present but `aria-disabled` until the terminal exists (Part 13).
- **Section rail** (right edge): nine nodes, labeled on hover and focus. Current = filled `--accent`, visited = filled `--line-2`, unvisited = hollow. Each node is a plain `#hash` link, so a click is a TRACKING TEAR (§3.8, History), with 24 px targets. Labels are positioned out of flow, so hidden ones never catch the pointer over the page.
- **Front panel** (bottom-left): `TUBE P1 · P3 · PPR` · `SND OFF/ON ▮▮▯▯` · `GRID` · `GFX AUTO/LOW`. Hardware switches with LEDs. Each key has a face (`--bg-raised`), so what scrolls under the panel never shows through a label (v1.6). The VU meter's four LEDs light at −48, −36, −24 and −12 dBFS of the analyser's peak, read at 10 Hz (v1.6).
- **Bands and focus** (v1.6):
  - On resize, the top band (readout and nav) and the bottom band (front panel) are measured and written straight to `html`'s `scroll-padding`, so focus and anchors never land under the chrome (WCAG 2.4.11). Not through custom properties on `html`: each write restyled the whole document, and the hydration commit's next layout read paid for it. With `#fx-css`'s pitch, also written to `html` then, that was two of the three forced full recalcs in the hydration task, ~15 ms each at 4× CPU (Part 7; §8.3, TBT). Both bands are read before either is written, and the first write waits for the ResizeObserver's first callback, after layout.
  - The front panel takes the pointer only on its switches; the band between them passes clicks through.
- **Phones** (v1.6): under 48 rem the top band stacks, readout over nav. Under 30 rem the readout drops the clock and the panel drops GRID and GFX, so each band stays one row.
  - **As built** (v1.7). Measured at Part 6, that rule kept the bands to one row at most widths but not all. At 360 px the nav's `~` fell to a row of its own. At 480 px the full panel, which needs 477 px, wrapped GFX. At 320 px even TUBE + SND wrapped. Now:
    - The panel sheds keys by its own room: a container query on the bottom band drops GRID and GFX below 30 rem of band, about 539 px of viewport.
    - Below 19 rem of band, TUBE's legend is read but not shown.
    - Under 30 rem the nav spreads across its row, with at least 6 px between keys, and passes the gaps through.
  - **Measured** at 13 widths from 320 to 2560 px: every band is one row, the top band 58–62 px stacked on phones.
  - **Clearing a band.** Since every band is one row of 24 px keys, the bottom band's height is a token: `--hud-band-bottom` = `--hud-inset` + 24 px. It equals the measured band at all 13 widths. Layout that must clear the band uses the token: the hero's padding and its hints. The measured band stays for `scroll-padding`. The measure arrives after hydration; the hero is bottom-aligned, so it moved 11 px when the measure landed (CLS 0.0081 on Lighthouse's phone load).
- **The bands' backing** (v1.7) is an on-screen display's. Behind the top band and the bottom band lies the theme's own ground at 84%, solid for 55% of its height and clear a little past the band. What scrolls under the chrome dims, and the chrome reads; on a phone the hero's particles pass behind `RETROGRADE/OS` without crossing it.
  - The height comes from tokens (`--hud-inset` + 14 spacing steps, or 22 for the stacked top band under 48 rem), not from the measured bands. Those arrive at hydration, and a backing that resized then measured as a layout shift of 0.0012.
  - It sits under the chrome's own text and switches off under `forced-colors`.
- **Corner brackets** frame the viewport.
- **Cursor:**
  - A 10 px hollow-square reticle with an *unlagged* 2 px center dot (the hotspot), plus a ring that trails at λ 24.
  - It snaps to interactive elements as four brackets.
  - Over media it grows a label chip — `VIEW` / `DRAG` / `FLIP` / `OPEN` — at λ 12.
  - Drawn with `mix-blend-mode: difference`, in the `--cursor-ink` token (white). Under `difference`, white inverts whatever is beneath it, in every theme (v1.6).
  - It never snaps to anything wider and taller than 60% of the viewport: that's a region, not a target (v1.6).
  - Hidden on coarse pointers, in forced-colors mode and inside text fields (which get the native I-beam).

### 7.4 Section by section

**00 · POST — Boot**
- **When it runs:** only on the first visit to `/` in a session (tracked in sessionStorage). Deep links (`/work/*`, `/research/*`, any `#hash`) skip it and get POWER ON-fast (360 ms) over already-painted content — a recruiter clicking a shared link gets the content now. The head script decides before first paint (`html[data-boot="run" | "fast"]`) and sets the session flag at once, so a reload mid-boot never replays the boot (v1.6).
- **Phases:**
  - **P1 (0–250 ms):** a block caret blinking 530/530. The hum fades in if the sound preference is ON.
  - **P2:** log lines print *whole* as their real task resolves, ≥ 40 ms apart so they read as a cascade. Only the owner banner types, at 45 cps. The percentage is real bytes.
    - **The bytes** (v1.6) come from three sources. The stage runtime's chunks are listed at build time in `public/boot-manifest.json`, streamed so the count moves as bytes land, then imported from the HTTP cache. The fonts count at their baked sizes, and this document at its decoded size.
    - **The hero's data** (v1.7) is the fourth source: `/data/stage.json` and the land mask, 5,493 B. The manifest lists every file under `/data/` at its decoded size, because Next serves the JSON gzipped and chunked, with no length a reader could declare. Without that entry the counter read 1.07 MB for 1.08.
    - **The spacing** (v1.6) is timed on the frame clock (`document.timeline`), so ≥ 40 ms holds on screen. Measured: 41.6 ms or more at 120 Hz (five frames).
  - **P3:** POWER ON, at 100% or at 1.6 s, whichever comes first.
- **Hard cap:** the hero is visible by 2.2 s. `SKIP [ESC]` (and click/tap anywhere) works from frame one.
  - **How** (v1.6). The cap is CSS, timed from first paint. A compositor-only opacity fade runs at `--boot-cap`, then a visibility step makes sure the faded overlay never catches a click. `--boot-cap` is 2.2 s less one 60 Hz frame: a compositor change is presented on the next vsync, so the frame that shows the hero is on screen by 2.2 s.
    - It holds with no script at all, and with a script that took over and then stalled. Normally P3 hides the overlay long before.
    - The step must not touch opacity. Beside a non-compositable opacity animation, Chrome won't composite the fade (measured).
    - The step is hidden at every progress: a 1 ms animation's last frame lands a hair under p = 1, where `visibility` still reads visible.
  - **Skip from frame one** works because the head script listens before hydration. A skip before the grammar loads gets the CSS ON-fast shutters.
  - **Measured** on Chrome's compositor frames, two runs each: the hero shows at 1.89–1.90 s on Slow 4G + 4× CPU, at 2.17–2.18 s on 3G + 4× CPU, and at 2.17–2.18 s with the main thread stalled from P2 to 2.6 s.
- **Every line is true:**

  ```
  RETROGRADE/OS 1.0 · BUILD 2026.11.10-{sha}
  CPU   8 LOGICAL CORES ................................. OK
  GPU   APPLE M1 · WEBGL2 ............................... OK    (or: MASKED BY BROWSER)
  DISP  1512×982 @2.00× · 120 HZ (MEASURED) .............. OK
  GFX   TIER HIGH · 250,000 PARTICLES ................... OK    (until Part 6: TIER HIGH · PROBE P90 1.8 MS)
  FONT  HUBOT SANS · MONA SANS · JETBRAINS MONO ......... 3/3
  DATA  23 PAPERS · 12 PROJECTS · 12 CREDENTIALS ........ OK
  A11Y  REDUCED MOTION OFF · CONTRAST STANDARD .......... OK
  SND   MUTED ........................................... [S]
  LOADING PORTFOLIO.SYS  ▕██████████████░░░░░░▏ 71%  1.42 / 2.00 MB
  {NAME} — {ROLE}
  ```
- **LCP:** the hero `<h1>` is SSR-painted *beneath* the boot overlay, so LCP fires at first paint. The per-character reveal starts on the exact frame the beam opens.
- **As built** (v1.6):
  - **GPU line:** the renderer comes from `RENDERER` first, and from the debug extension only when that's generic. Under reduced motion, no context is made just to ask (`NOT QUERIED · REDUCED MOTION`).
  - **GFX line:** until the hero's particles exist (Part 6), it reports the tier and the probe's p90 frame time, which is true now. Since v1.7 it reads the tier and the particle count the hero will draw: `TIER HIGH · 250,000 PARTICLES`.
  - **The rise** is a per-character copy laid over the kerned text and removed when the last character settles. At rest, the name is one kerned text node.

**01 · SYSTEM — Hero**
- **Name:** at `--step-5`, fitted across 12 columns. Per-character rise on `overshoot` with a 28 ms stagger — first boot only; later loads render it settled.
- **Role + tagline:** in mono, with a one-time SCRAMBLE (≤ 40 chars).
- **Micro-block:** location · live local time · availability, with a pulsing `--accent` dot.
- **Spec strip** (mono, tabular): `YEARS 08 · SHIPPED 24 · PAPERS 11 · CITATIONS 1,284`. All values come from `derive.ts` and count up.
- **CTAs:** `VIEW WORK →` (primary) · `READ RESEARCH →` · `RESUME ↗`.
- **Morph control:** the hero is pinned for 100 svh, and scroll owns the morph (checkpoints at 0, ⅓, ⅔ and 1). A click scrolls to the next checkpoint, so there's one source of truth.
- **Pointer:** a repel field (radius 12% of viewport height) and camera parallax of ±3° / ±2°.
- **Idle hint:** after 25 s idle, shown once: `PRESS ~ FOR TERMINAL`.
- **As built** (v1.7, Part 6; `components/sections/hero/`):
  - **The name** is fitted from a width model measured in Chrome: `scripts/fonts/name-fit.ts` writes `content/name-fit.json`, the name's em width at nine `wdth` samples for one line and for two. The first paint comes from 95 CSS bands, one per viewport range. The client refines that by solving the same model against the measured 12-column width. Measured at seven widths from 320 to 1,440 px, the name fills the measure to within 0.4%. Past the axis it grows (v1.8, §2.5): Part 6's "NOOR HALVORSEN" fell short from 1,732 px, filling 89% of the measure at 1,920 and 77% at 2,560. The line count is fixed in CSS — one line from 272 px up — so the refine never re-wraps, and the page doesn't shift. H-HOLD's `--t-wdth` rides above the fit.
  - **Role and tagline:** the role SCRAMBLEs once; the tagline is set in mono.
  - **The micro-block** is a `<dl>`: LOC, LOCAL and STATUS. The time is the HUD's own clock (one `localClock`, in the owner's zone), so the hero, the HUD and the globe's terminator agree. The dot pulses on `--dur-scene` and holds still under reduced motion. LIMITED shows it in `--warn`, CLOSED in `--fg-3`, still.
  - **The spec strip** is four `<Counter trigger="boot">`s. They count from the frame the beam opens on a first boot, and on view otherwise.
  - **CTAs:** VIEW WORK → `#work` and READ RESEARCH → `#archive` are jumps (TRACKING TEAR). RESUME ↗ opens a new tab and says so to screen readers.
  - **The click:** anywhere on the hero except a control or a text selection scrolls (a Lenis glide) to the next checkpoint. From the last one, it moves on to IDENTITY.
  - **The scroll hint** leaves on the first scroll.
  - **The idle hint** is built — 25 s, once ever, remembered in `localStorage` — but **held until the terminal exists** (Part 13). Until then `~` does nothing, and a hint that names a dead key would be false (§10 #28).
  - **The type layer** sits over the stage in every edition, bottom-aligned: over the poster in reduced motion and OFF, so the name is in the first viewport there too. The field's subject sits above it, lifted 0.215 of the frame.

**02 · IDENTITY — About** (quiet)
- **Layout:** a 5/7 asymmetric grid — the portrait in columns 1–5, the bio in 7–12.
- **Portrait:** a Canvas2D dot-matrix dither at 180 × 225 cells over the real photo.
  - The cursor is a lamp (radius 18% of the portrait) writing an exposure buffer that decays with τ = 600 ms.
  - Touch: press and hold. Reduced motion: a static half exposure.
- **Bio:** RAIL REVEAL per line, with at most three accent phrases per paragraph.
- **Spec sheet:** `<DataRow>` leader-dot rows — ROLE, EXPERIENCE, LOCATION, TIMEZONE, STACK, H-INDEX, EDUCATION, AVAILABILITY.
- **CURRENTLY:** BUILDING / READING / RESEARCHING, as a one-line typewriter swap every 6 s, paused on hover and focus. All three are present statically for screen readers.
- **As built** (v1.8, Part 7; `components/sections/about/`, `lib/identity.ts`):
  - **The portrait** draws its cell grid on a 180 × 225 Canvas2D, scaled up pixelated; a CSS mask makes each cell a round dot, on the compositor.
    - A cell is ink when its luma times its exposure clears its 8 × 8 Bayer threshold. Luma under a 10% black point is ground: without it, a dark background printed a regular grid of dots, one cell in 64.
    - Exposure rests at 0.3 (an underexposed print). Under the lamp it develops toward full over `duration.micro.in`, then fades back with τ.
    - The loop runs only while the lamp is on or the exposure decays.
    - Before the canvas draws, and without JS, the photo itself shows through the same dot mask, tinted by CSS.
    - The source is `public/media/profile/portrait.png`, baked from the owner's photo (§8.2). Until the photo arrives it's a placeholder silhouette, and its alt text says so.
    - A caption names the gesture by input ("Shine the cursor…", "Press and hold…"); without it, press-and-hold on touch is undiscoverable.
  - **The bio:** the first paragraph leads (≤ 38ch); the rest read at the body measure. The accent phrases are content (`profile.bio.accents`, ≤ 3 per paragraph, each validated against its paragraph).
  - **The spec sheet's** values are all derived. EXPERIENCE is the years since the first role and the count of roles. TIMEZONE is the zone and its UTC offset at build. STACK is the primary skills. H-INDEX is computed from the per-paper counts, with their as-of date.
  - **CURRENTLY** swaps only while on screen. Its three lines share one grid cell, so the box is always the tallest and a swap never moves the page. Reduced motion shows the three items as a static list.

**03 · LOG — Experience**
- **Stage** (pinned ≤ 200 svh): the punch-card rail.
  - The left edge holds a year scale that scrubs with the camera and snaps to roles. Clicking a year triggers a `heavy` camera flight.
  - On the right, the active card is mirrored as crisp HTML: company, role, dates, blurb, three quantified highlights and stack chips.
- **Document** (the interlock) — **PRINTOUT:** continuous-feed tractor paper carrying the condensed log and education.
  - Dot-matrix printed (mono under the dot mask), with perforations every 11 in (the real form length).
  - Ends with `RESUME ↗`.
- **Delight:** `decode <card>` in the terminal reads the holes back.
- **Phone edition:** a CSS card feed, where cards rise through a sticky stack as you scroll.
- **As built** (v1.8, Part 7; `components/sections/log/`):
  - **The mirror** is the pin's frames, one per role, centered on the right. Each has the dates, the role, company and location, the blurb, three highlights with punched holes for bullets, and the stack as chips.
  - **The year scale** runs newest at the top, a tick per month, each role's span a bar.
    - The playhead moves between the active role's stop and the next by the pin's progress; it ticks only while on screen.
    - A year flies to the newest role that ran that year; a role's bar flies to that role. Each glides the page to the role's node, and the camera's heavy spring makes the flight.
    - Hit areas are 24 px wide.
    - The active frame is a 12-column grid over the scale and the stage, so only its panel takes the pointer. Before that, the frame's empty columns covered every year and bar at every role: the scale took no clicks. Gate C now hit-tests each of its buttons at every role, and the panel too.
  - **The phone edition** reuses the baked atlas as CSS masks: alpha cuts the card and its holes, and luminance is the print, the top-edge words brighter than the digits. The light behind shows through the holes.
    - The pin's step (`--step`) moves the cards. The active one stays in place, the passed ones step back up the stack smaller and dimmer, and the next one rises from a screen below, under the pin's clip.
    - A sticky year badge sits by the card, and the panel below is set smaller. The same content; zero GPU.
  - **The PRINTOUT** is a 9½ in form at its column's width (`--in`, from container units). It has tractor holes every ½ in down both edges, dashed tear lines, green-bar bands every other ½ in, and a perforation every 11 in. The dot-matrix print is mono under a 2 px dot mask. It ends with RESUME ↗.

**04 · ARCHIVE — Research & Publications**
- **Header — the ARCHIVE QUERY bar:**
  `QUERY ALL ▸ 23 RECORDS ▸ 1,284 CITATIONS ▸ 2016–2026 ▸ LAYOUT [TOPIC · YEAR · VENUE] ▸ ◆ JOURNAL ● CONFERENCE ▲ WORKSHOP ✱ PREPRINT ■ PATENT ⬢ THESIS ✚ CHAPTER`
  The shape legend is always visible. Filled = published; dashed outline of the same shape = under review or in prep.
- **Stage** (pinned ≤ 150 svh): the constellation (§4.3).
  - **Hover:** the node scales, its edges and neighbors brighten, everything else recedes into fog, and one mono tooltip appears (title · venue · year · citations).
  - **Click:** the camera dollies in and the dossier opens.
- **Dossier:** an intercepted route, `/research/[slug]`. Navigated to, it's a `<dialog>` over home; visited directly, it's a full page. Either way the URL is shareable. Contents:
  - a microfiche frame with a reversed-type header strip (`ID · YEAR · VENUE · TITLE…`)
  - the title (`--step-3`, sentence case)
  - authors: me in `--accent` at weight 600, co-authors in `--fg-2` mono
  - venue-type, peer-reviewed and open-access badges
  - **the TLDR, right under the title, as a quoted callout at `--step-2`** — the second read, and what non-specialists actually read
  - the abstract, with a per-line reveal, collapsed after 4 lines
  - keyword chips that filter the sky
  - metrics
  - actions: `DOI ↗ PDF ↗ ARXIV ↗ CODE ↗ DATASET ↗ COPY BIBTEX`
  - **BUILT FROM THIS** — linked projects, reciprocal with the case studies

  Under-review and in-prep records get dashed brackets and a `STATUS: UNDER REVIEW` stamp in `--warn`.
- **Ledger** (document): a real `<table>`, grouped by year with sticky year headers, sortable (`aria-sort`), with green-bar banding. Hovering a row lights its node above.
- **Metrics:**
  - One hero figure: CITATIONS in LED numerals.
  - Tiles: PUBLICATIONS · H-INDEX · I10 · FIRST-AUTHOR · VENUES.
  - Every figure carries its provenance (`OPENALEX · AS OF 2026-11-10`) and links to the Google Scholar and ORCID profiles for the canonical numbers.
- **Publications by year — a unit chart:**
  - One cell per paper, and every cell links to its dossier.
  - `--accent-fill` cells with a 2 px surface gap; under-review cells are hollow.
  - A hairline baseline and mono year ticks; only the peak year and the current year are labeled.
  - A hover tooltip per cell. The ledger is its table view, and as a single series it needs no legend box.
- **Phone edition:** the SVG plotter constellation, record cards with scan reveals, and the dossier as a full-screen sheet.
- **As built** (v1.9, Part 8; `components/sections/archive/`, `components/research/`, `app/@modal`, `app/research`):
  - **The query bar** sits in the pinned frame with the sky: the live counts (records, cited works once there are any, citations, the years), the layout chips (radio inputs dressed as chips, ■ / □), and the legend: the seven shapes, the dashed key, and the faint key once there are cited works. Each ▸ travels with the term after it, so a wrapped line never ends on one.
  - **A keyword from a dossier** narrows the query, and the bar says so: QUERY “PM2.5” · 1 MATCH, with CLEAR. It never says ALL while a keyword holds. CLEAR lights the whole sky again and keeps the keyboard in the bar. The ledger lights the same records; it is the only sky the stage-less editions have.
  - **Without a stage there's nothing to re-plot**, so the layout chips step aside (§10 #35): on phones, under reduced motion and without JS from the first paint, and on a tier that can't run ARCHIVE (LOW, OFF) once the tier is final.
  - **The LED figure** is PEER-REVIEWED PAPERS until anything is cited, then CITATIONS (v1.9, the owner's call, §10 #31); CITATIONS stays among the tiles. Every figure carries its source and date: the citation counts' (MANUAL until a DOI lets OpenAlex count them), or COUNTED IN THE LEDGER. The scholar-profile links appear once there are profiles.
  - **The dossier** is a native `<dialog>` held by the intercepted segment's layout (`app/@modal/(.)research/layout.tsx`), so prev / next swap the record inside it. The intercept sits at the root and catches every soft navigation to a record, so from a record's own page its prev / next open the neighbor over that page (§10 #33). Opening and closing are no route change: no TRACKING TEAR (`data-transition="dossier"`), the page behind holds still (scroll locked, Lenis paused), and focus returns to what opened it. Inside it, prev / next push the record across as a typed view transition (§10 #34).
  - **Titles stay as published,** in Title Case. Sentence-casing them by rule would break their acronyms (PM2.5, ML).
  - **The unit chart's axis** runs through this year, gaps kept; only the peak year and this year are labelled.
  - **Without a stage** (phones, reduced motion, no JS) the header is the SVG constellation, drawn at build from the same graph (`lib/archive-svg.ts`); the slot's poster is the same drawing. It is drawn twice, wide (720×440) and tall (360×560, below 48rem), so each shows at about 1:1 and its glyphs keep the stage's sizes. The wide drawing on a phone halved every glyph to 5 px, too small to tell ● from ◆. The TOPIC clusters are labelled in HTML over it, as the stage's are, each label anchored by its own share across so it stays inside the drawing. In the pinned frame it lies in the flow under the query bar and fills what the bar leaves above the HUD's bottom band: a size container, fitted with `cqh`. A fixed offset put a star on the legend at 360 px, because the bar's height changes with the width (§10 #36).
  - **The phone ledger's record card** reads YEAR · VENUE · CITATIONS n on its first line, then the title, then the authors. The count carries its own label, since no column header stands over a card.
  - **A provenance date never breaks.** "As of" and the date hold one line, so a narrow tile wraps before them; it had read 2026- / 11-11.
  - **The dossier's panel is opaque.** At 95% the page behind ghosted through the record's text: the ledger's titles under the TLDR on a phone. The sky stays in view beside the panel, through the backdrop.

**05 · WORK — Projects**
- **Stage** (a 100 svh band, not pinned): the slide carousel.
  - Input: drag, touch, horizontal wheel / Shift+wheel, and arrow keys. **The vertical wheel always scrolls the page.**
  - Each slide mount shows `01/08`, title, year and category in mono.
- **Document — INDEX:** every project in a dense table (`# · TITLE · ROLE · YEAR · STACK · →`), with the B4 cursor preview and filter chips that animate with Motion layout FLIP.
- **Case study** (`/work/[slug]`, SSG):
  - **Entry — the PROJECTION transition** (continuity): the slide becomes the hero, the DOM hero image decodes underneath, and then the stage lets go. It reverses on back.
  - **Structure:**
    1. Context
    2. Problem
    3. My role
    4. Approach (decisions and tradeoffs)
    5. Outcome (one LED hero figure + tiles)
    6. Stack
    7. Links
    8. **PUBLISHED RESEARCH** (mini-dossiers)
    9. prev/next (SLIDE ADVANCE)
- **As built** (v2.0, Part 9; `components/sections/work/`, `components/work/`, `app/work/`):
  - **The band** holds the stage slot, the CSS carousel and the HTML layer in one box. A tier that can't run A4 marks it, so the CSS carousel takes the slot's place with no shift. All five projects are on the rail (the owner's call).
  - **The PROJECTION** is the governor's `takeover()`. The canvas docks into a fixed layer over the page (z 20, under the HUD), and the scene is LIVE there whatever the slots say. The page still shows outside the union of the band and the growing window: the layer is clipped to it, one style write per frame. The slide flies on `transit` for 680 ms until its window covers the viewport the way the hero does (`object-fit: cover`, 100lvh, the canvas's height). Then the route swaps under it with no tear and scrolls to the top. The DOM hero decodes (at most 1.5 s), and the stage lets go through the element tier's Bayer sprite, run backwards (400 ms).
  - **Back** from a case study the carousel projected flies the slide home. A `hold()` keeps the scene resident while you read; it's released when you leave the case studies any other way. The stage takes the viewport with the slide still covering it, the route and the scroll go back under it, and the slide flies home on the same 680 ms. Two traps were measured and fixed on the way. Lenis clamps to the last page's scroll limit until its ResizeObserver runs, so home's 10,155 px landed at 1,346: a teleport measures Lenis first. And the stage must be woken when a flight starts, because the takeover's first frame finds the rail at rest. A case study reached any other way goes Back through a tear: there's no slide to fly home.
  - **INDEX** is server HTML: the table (# · TITLE · ROLE · YEAR · STACK · →, each title its case study's link, the row its target) and the chips (one category, or a stack two projects share). Their behaviour, the rows' FLIP and the B4 preview arrive on idle (§10 #37). The preview keeps each row's cover loaded once seen and resolves it on every arrival. Pointing at a row lights its slide.
  - **A fact not in yet** (a year, a role: §10 #42) is a dash on screen and "To come" to a screen reader. The mount leaves it out, and the case study drops a section with nothing to say (My role, Links, PUBLISHED RESEARCH) rather than show a placeholder.
  - **The case study:** the Outcome's LED figure is the project's first metric and the tiles the rest; a project without numbers has neither. PUBLISHED RESEARCH lists each paper as a mini-dossier (`data-transition="dossier"`): it opens over the page through the root intercept and closes back to it, tested on `/dev/work-fixture`. Prev / next push the project through as a typed view transition, like the dossiers'. Metadata per project; the OG image appears once the site's URL is set (§10 #41).

**06 · CAPABILITIES — Skills** (mid)
- **Before the stage:** the header and **PRIMARY STACK** — six technologies at `--step-4`. This is part of the interlock.
- **Stage** (an 80 svh band): the keycap pile.
  - Hover: the key lifts, the others dim, and a tooltip appears (name · years · level).
  - Click: the key presses with a clack, and its row lights up in the panel.
  - Category labels re-cluster the pile.
- **Document:** the canonical HTML panel, with categories as columns. Each skill is a DataRow showing:
  - years
  - a 5-segment meter (`--accent-fill` on an `--accent-wash` track), **labeled by rubric**: `L1 USED · L2 BUILT · L3 SHIPPED · L4 LED · L5 TAUGHT/PUBLISHED`
  - derived evidence: `IN 4 PROJECTS · 2 PAPERS`

  No self-rated percentages.
- **Phone edition:** a CSS keycap grid; tap to press.
- **As built** (v2.1, Part 10; `components/sections/capabilities/`, `styles/capabilities.css`):
  - **Levels and years** are the owner's, confirmed before the keys showed them.
  - **The band** is the slot, the stage-less edition and the HTML layer in one 80 svh box (`components/sections/StageBand.tsx`, shared with WORK). A tier that can't run the pile marks the band. The slot then leaves the box (`display: none`, so its poster isn't fetched either) and the CSS keycap grid takes its place: on LOW, tier OFF, phones (a coarse pointer under 48 rem, the tier's phone policy), reduced motion and no JS. Out of the layout, the slot is out of the interlock too: on a phone it spans the four stages that remain. The grid's keys wear the stage's own legends (the same atlas, as a CSS mask), the primary stack in accent; a tap presses (the clack, the row).
  - **The panel** is server HTML: four category columns on desktop (two on a tablet, one on a phone), every skill a DataRow on three lines. First its name and years; then the 5-segment meter with the rubric's label beside it (`L2 BUILT`); then its evidence. The evidence is counted from the content: the projects and roles whose stack names the skill, and the papers whose text does (`IN 2 PROJECTS · 1 ROLE`). Where nothing does, it says so (`NOT YET IN A PROJECT, PAPER OR ROLE`). The meter is `aria-hidden`; its words are the rubric's. A pressed or typed key's row lights for 1.8 s on `--accent-wash`; that behaviour loads on idle.

**07 · CREDENTIALS — Certificates & Records**
- **Wall** (Tier B): ID-1 foil cards dealt in from the bottom-right in an arc (40 ms stagger, −12° → 0 on `overshoot`).
  - Readout: `12 CREDENTIALS / 5 ISSUERS / 11 ACTIVE`.
  - Filter chips by issuer, domain and level.
  - Enter flips a card; Escape unflips it.
- **Records** (document):
  - one hero figure plus three tiles
  - B2 record cards in a staggered masonry
  - a press-logo marquee
  - testimonials as a mono transmission — the name/role scrambles (≤ 40 chars) and the quotes reveal per line
- Every state is handled: 0, 1 or 40 items; no expiry; no logo; very long titles; no testimonials.
- **As built** (v2.2, Part 11; `components/sections/credentials/`, `app/dev/credentials/[state]`):
  - **The wall appears only with certificates** (the owner's call, §10 #46). The readout is derive.ts's (`12 CREDENTIALS / 5 ISSUERS / 11 ACTIVE` on the fixture). A chip group shows only if it has two values or more; the chips are server buttons, hidden without JS, and their FLIP is hand-rolled (§10 #37). The section strip counts only what's there: the wall's readout, then the records.
  - **The stamps:** VERIFIED only when this build reached the verify URL. An unchecked or dead one reads ON FILE, and an expired card reads EXPIRED first. The bake's verify step is live only in `npm run build`, so a dry bake shows ON FILE throughout.
  - **RECORDS:** the LED figure counts every record. Up to three tiles follow: the records' own metrics, then each kind with any, by count. Never a zero, and never a kind that would only repeat the figure. A tile names its source only when it isn't the figure's. The press marquee and the transmissions appear only when there's one to show. A transmission's name and role scramble in when they fit a 40-character line; otherwise just the name does.
  - **States:** `/dev/credentials/{full,one,forty,long,empty}` render the fixture persona with its own verify results; the gate reads them all. A long title clamps at three lines and a long issuer at two. A missing logo is the issuer's initials in the seal, and a missing expiry reads "No expiry" (fillers in the MRZ). On a phone each chip group is one row that scrolls sideways.

**08 · CONNECT — Contact** (quiet, plus one loud beat)
- **Invitation:** **SEND A SIGNAL** at `--step-5` — the only per-character reveal after the hero.
- **Email:** a giant `mailto:` link plus COPY (`COPIED ✓`).
- **Form, styled as a teletype:**
  - Prompts `NAME> EMAIL> INTENT> MESSAGE>`, with a block caret.
  - Inline mono errors, announced via `aria-live`.
  - Spam protection: a honeypot, a 2.5 s minimum time-to-submit and a server-side rate limit.
  - Sends through Resend. On failure, falls back to a `mailto:` that keeps the visitor's text.
- **Transmission log:** real, e.g. `VALIDATE ✓ · POST /api/contact · 202 · ID re_…`.
- **Availability:** a status dot, my local time, and **`OVERLAP 3H 30M · 09:00–12:30 YOUR TIME`**, computed from the visitor's timezone.
- **Channels:** EMAIL · LINKEDIN · GITHUB · SCHOLAR · ORCID · X — research beside engineering.
- **CTAs:** `DOWNLOAD RESUME` · `DOWNLOAD PUBLICATION LIST (PDF)`.
- **As built** (v2.3, Part 12; `components/sections/connect/`, `lib/contact.ts`, `app/api/contact/route.ts`):
  - **Server HTML, whole without JavaScript.** The teletype is then a `mailto:` form (text/plain) with native validation, and COPY and the live parts are absent (§10 #53). The behaviour is one 31.5 KB gz chunk, on the form's first focus or on idle (§10 #55): react-hook-form with the zod/mini schema, the log, the received screen, COPY, the ticking clock and the overlap. COPY and the overlap readout keep their places until it arrives, so landing on `#connect` moves nothing (CLS 0 in six zones, desk and phone).
  - **The invitation:** SEND A SIGNAL at `--step-5` (124 px at 1440 wide), its eleven characters revealed in 390 ms.
  - **The form:** the prompts are hidden from screen readers, and each field is named by its label (Your name, Your email, What it's about, Your message). Errors are the content's words, on `aria-live` with `aria-invalid`, and an empty TRANSMIT focuses the first. The block caret blinks only in an empty focused field, and not under reduced motion. The honeypot is off screen, out of the tab order and hidden from screen readers.
  - **The endpoint** (`POST /api/contact`, the site's only one) checks in order:
    - JSON only (415), this origin only (403), and at most 16 KB counted in bytes (413).
    - The honeypot. Anything in it gets a 202 with no id, and nothing is sent (§10 #52).
    - The fields (400, a code per visible field), then 2.5 s since the form's first focus (422).
    - Upstash Ratelimit's sliding windows: 3 sends per 10 minutes per IP and per sender address (429, §10 #50).
    - The send, through Resend's REST API (502 if it fails).
    - With no limiter or no sender configured, or a limiter that can't answer, it's a 503 and nothing is sent. Every answer to a POST is JSON and `no-store`.
    - The keys are server-only environment variables: `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL` and `_TOKEN`, `CONTACT_TO`, `CONTACT_FROM`. A test holds that only the route reads them, and the gate that no client chunk names them.
  - **The log is the request's own:** `Validate ✓ · POST /api/contact · <status> <reason> · ID <Resend's id>`, typed out (untyped under reduced motion), or NO RESPONSE when nothing answers. The ✓ is the pixel glyph (§2.10). A 202 replaces the form with TRANSMISSION RECEIVED, which takes focus, and plays TRANSMIT; SEND ANOTHER brings back an empty form. A 503, a 429 or no answer says why in words and offers a `mailto:` carrying the visitor's message, name and address.
  - **Availability:** the status dot, my time ticking in IST at the HUD's text rate, and the overlap of my confirmed hours (10:00–18:00, Asia/Kolkata) with a 09:00–17:00 day in the visitor's zone, DST included (§10 #51). It reads `OVERLAP 3H 30M · 09:00–12:30 YOUR TIME` in a London winter and `7H · 10:00–17:00` in India. In New York there's none in common, so it says when my day starts there (23:30). Without JS it gives the hours as written.
  - **Channels:** only the owner's (EMAIL, LINKEDIN, GITHUB); SCHOLAR, ORCID and X appear when the content has them. They're magnetic, and their arrows slide.
  - **CTAs:** DOWNLOAD PUBLICATION LIST (PDF) downloads the printed list (§8.2, §10 #57). No résumé button, here or in the hero or LOG, until there's a résumé without the owner's phone number (§10 #49).

**09 · HALT — Footer**
- An LED-masked, velocity-reactive marquee of name and role.
- A site index of every section, project and publication.
- A build line: `v1.0 · {sha} · DEPLOYED 2026-11-10 · NEXT 16 · THREE r187`.
- Back to top (Lenis, `transit`, 900 ms).
- **On the last pixel:** POWER OFF (450 ms) → `SYSTEM HALTED. SCROLL UP TO RESUME.` Any upward scroll or key press reverses it instantly.
- **As built** (v2.3, Part 12; `components/sections/halt/`):
  - **The marquee:** name and role at the mega step, lit through a radial dot mask at a 0.14 em pitch, with one readable copy and the repeats `aria-hidden`. It runs at 40 px/s at rest and faster with the scroll (78 px/s under a wheel, at most 4×), and stands still under reduced motion.
  - **The index:** the nine sections (01 SYSTEM … 09 HALT), the five projects and the two papers, each a live target.
  - **The build line**, read at build: `v0.1.0 · <commit> · DEPLOYED <date> · BUILT WITH NEXT 16 · THREE r187`. The commit is Vercel's, or git's with a + when the tree was dirty.
  - **Back to top:** Lenis on `transit`, 900 ms (961 ms from the click, measured). It's a quiet glide: the sections it passes don't each play SECTION, and it lands like a jump, writing its hash once (§10 #56).
    - It opts out of the tear every other `#hash` link gets; until its behaviour loads, it is that jump.
    - A wheel, touch, press or scrolling key takes the scroll back where it is.
  - **The last pixel:** the cached end is only a candidate. At it the end is read again, so a page that has just grown doesn't halt 3 px early (CONNECT's log adds 159 px).
    - Then POWER OFF: the view transition's old frame collapses in 450 ms with HALT's sweep, and `SYSTEM HALTED. SCROLL UP TO RESUME.` (role=status) sits over the dark tube, outside `#screen`.
    - An upward scroll turns it back on in about 60 ms and still scrolls; a downward one doesn't. A key or a touch turns it on too, and so does leaving the end any other way (a scrollbar's drag, a script), which raises no input event.
    - It halts again only after the page has been scrolled 48 px back up. Under reduced motion it's a crossfade, with the same ways back.

**∞ · SHELL — Terminal**
- **Open/close:** `~`, `/` or the HUD button opens it with a panel-scoped POWER ON. It's a native `<dialog>` (focus-trapped, background inert); Esc closes it.
- **Panel:** bottom-anchored, ≤ 960 px wide, 62 svh tall, with `--r-bezel` corners and its own scanlines at α 0.10.
- **Behavior:**
  - Output streams at 120 lines/s, and any key skips to the end.
  - History, tab completion, "did you mean" (edit distance ≤ 2), Ctrl+C and Ctrl+L.
- **Commands:** everything in Part 13, plus `man retrograde`, `decode <card>` and `debug`. `matrix` is an alias for `rain`, which rains **our own data** (titles, DOIs, commit hashes) instead of a film pastiche.
- **Data:** reads `/search-index.json` (≤ 60 KB gz, built at compile time), fetched on first open.

**404 / 500 — NO SIGNAL:** POWER ON into an empty tube, with a drifting on-screen-display box and the hint `goto system`.

### 7.5 Seeded delights — cheap in bytes, invisible until discovered

- The punch cards' holes really encode their printed text.
- Credential backs carry MRZ lines with valid check digits.
- Every guilloche pattern is generated from its credential ID.
- The Research camera path is a retrograde loop (`man retrograde` explains it).
- With sound on, scrolling the archive plays the publication history as a pentatonic melody.
- Typing a skill's name presses its keycap.
- Contact computes your working-hour overlap with me.

Part 16 asks for three delights; pick them from this list first.

---

## 8. Stack & performance budget

### 8.1 Stack (versions current on 2026-11-10)

| Layer | Decision | Why | Rejected |
|---|---|---|---|
| Framework | **Next.js 16.4** (App Router, SSG-first) · **React 19.3** · TypeScript strict · Turbopack | Static HTML for every project and publication (crawlable, readable with JS off). Intercepting routes for the dossier. `next/og` for publication cards. `next/font`. One Route Handler for contact. A root layout that keeps the stage alive across routes. | Astro (islands suit content, but the cross-route canvas and shared-element flight want one React tree); a Vite SPA (no SSG/SEO) |
| Styling | **Tailwind CSS 4.3**, CSS-first `@theme inline` over runtime token variables | `[data-theme]` swaps propagate to every utility with no JS; zero runtime CSS | CSS-in-JS runtimes |
| 3D | **three r187** (WebGLRenderer, WebGL2) + **R3F 9.8** (`frameloop="never"`, advanced from `gsap.ticker`) + **drei 10** (cherry-picked: `PerformanceMonitor` and little else) | Mature and predictable on Safari and mid-range Android. Nothing here needs compute: layouts are baked and particles are vertex-driven. | three's WebGPU renderer — revisit in 2027 |
| Post | **postprocessing 6.39** directly: one `EffectPass` merging Bloom + a custom `RetroEffect` | Effects merge into a single fullscreen pass; the chain is fixed per theme and tier | `@react-three/postprocessing` — 19.7 KB gz (measured) of declarative wrapper for a chain that never changes at runtime |
| Transitions | raw WebGL2, ≈ 4 KB | must run during the boot, before three arrives | three for the overlay |
| Scroll | **Lenis 1.3** (5.4 KB gz, measured), driven by `gsap.ticker`; sections and pins tracked by `lib/scroll.ts` (v1.6) | Buttery inertia on the real window; the native position stays truthful | `scrollerProxy` (it's for transform-based scrollers, and Lenis isn't one); Locomotive |
| Animation | **GSAP 3.15** — core 28.5 + ScrollTrigger 18.0 + SplitText 3.7 + CustomEase 3.7 KB gz (measured; all plugins are now free). Since v1.6 only core is in first-load: eases register through `gsap.registerEase` over lib/motion's bezier solver, and ScrollTrigger and SplitText load where a part needs them · **Motion 14** via `LazyMotion` + `m` (`domAnimation` sync, `domMax` async) | GSAP owns time and scroll; Motion owns React presence, layout and gestures | GSAP Flip (Motion `layout` does FLIP inside React) |
| State | **zustand 5** | theme, sound, boot, terminal, grid, tier | — |
| Content | **Zod 4** schemas validated at build · `derive.ts` selectors · build-time bakes | law 7 | a CMS (one author; git is the CMS) |
| Physics | custom micro-sim, ≈ 5 KB | §4.3 A5 | Rapier — 1.65 MB gz as shipped (measured) |
| Audio | Web Audio API, ≈ 3 KB | — | Howler |
| Modals | native `<dialog>` + `inert` | a correct focus trap at zero KB | focus-trap libraries |
| Fonts | `next/font/local`, variable woff2, Latin subset, axes trimmed at build | — | runtime font CDNs |
| Images | AVIF via `next/image` (DOM) and `createImageBitmap` (WebGL, decoded off the main thread) | Our total texture payload is small | KTX2 by default. The Basis transcoder alone is 260 KB gz (measured: 244.6 KB WASM + 15.1 KB JS), more than our largest texture, and ETC1S smears text atlases. Adopt it only if a tier exceeds its VRAM budget. |
| Forms | react-hook-form + Zod + Resend · Upstash Ratelimit (3 per 10 min per IP) | — | — |
| Analytics | Vercel Analytics + Speed Insights, with custom events | — | cookie-banner analytics |
| QA | Playwright visual matrix (3 themes × 6 widths × reduced motion on/off), axe-core, Lighthouse CI, size-limit — every budget enforced in CI | Budgets that aren't in CI are wishes | — |

### 8.2 Build-time bakes (`scripts/`)

| Script | Output |
|---|---|
| `layout-graph` | `content/graph.json` (committed): TOPIC via seeded `d3-force-3d`; YEAR and VENUE are deterministic. Same content → byte-identical file. It stores an input hash, so `content/derive.ts` can detect a stale layout: it warns in dev and fails a production build |
| `posters` | a 1-bit dither PNG per stage (theme-agnostic, colorized through a CSS mask) plus the SVG constellation. **As built** (v1.7): captured from the live scenes; see *Posters, as built* below |
| `landmask` | `public/data/land-256x128.bin` (v1.7): Natural Earth 1:110m land, 4×4 supersampled into a 1-bit equirectangular mask, 4,096 B, 29.0% land. The hero's globe weights its particles by it |
| `bluenoise` | `public/textures/bluenoise-64.png` (v1.7): a 64 × 64 void-and-cluster tile (every threshold once), 4,228 B, for the stage's ±1 LSB output dither |
| `foil-grain` | `public/textures/foil-grain.webp` (v2.2): the foil's 128 px diffraction grain (§4.4 B1). It's a fine grating (≈ 3 px pitch at 25°, a whole number of cycles across, so it tiles), wavering by a wrapping phase noise and flecked with speckle. It's a luminance mask that never drops below 45%: 5.7 KB of lossy WebP, the same bytes every bake. The stamp's uneven ink reuses it |
| `fonts/name-fit` | `content/name-fit.json` (v1.7, committed): the hero name's width model, measured in Chrome over `wdth` 75–125 (§7.4). Its input hash covers the name, the face's file, the mega step's weight and tracking, and the fluid size and margin the bands are solved against; `tests/hero.test.ts` recomputes it from the repo. `derive.ts` also fails a production build for a renamed owner |
| `fonts/display-fallbacks` | `styles/font-fallbacks-display.css`: the display steps' width-matched fallbacks and, since v1.7, Hubot's ascent, descent and cap height for the cap trim (§2.5) |
| `boot-manifest` | `public/boot-manifest.json` (postbuild, not committed): the stage runtime's chunks and, since v1.7, every file under `/data/`, at decoded sizes, for the boot's byte count (§7.4) |
| `atlases` | punch-card faces, keycap legends. **As built** (v1.8): `scripts/bake/atlases.ts` → `public/textures/log-cards.webp` + `content/log-atlas.json`. The LOG deck's faces are drawn in Chrome with the site's mono face and encoded exactly by sharp: lossless WebP, 11.5 KB. It redraws only when its input hash changes (texts, face, layout); the tests read every card's holes back out of its pixels. **Keycap legends** (v2.1): `scripts/bake/keycaps.ts` → `public/textures/keycaps-legends.webp`, `public/textures/matcap-{phosphor,amber,paper}.webp` + `content/keycaps-atlas.json`. Each skill has a cell, in content order, on a 7 × 7 grid of a 1024² canvas. In it is the skill's mark from the CC0 Simple Icons set over its legend's label in the mono face, or the label alone as a monogram. The content names the slug; an unknown slug fails the build. White on clear, lossless: 14.7 KB of A5's 90. The matcaps are computed, a lit sphere of neutral plastic per theme (a cool key light with a phosphor rim, a warm one, daylight): 1.3 / 1.4 / 0.5 KB of 12. It redraws only when its input hash changes. The tests recompute the hash, find a legend inside every key's cell with a clear border (no mip bleeds into a neighbour), and nothing past the last |
| `covers` | `public/media/projects/<slug>/` (v2.0): every project's 3:2 cover at four sizes. The master (2400 × 1600 AVIF) serves the DOM through next/image; three tier files (1024 / 768 / 640 wide) are each an AVIF of at most 120 KB, and over it fails the build. Plus a provisional 1200 × 630 OG crop. The picture is the screenshot in `content/covers/<slug>.*`, cropped to 3:2 by attention, or until then a title card set in Chrome with the site's faces from the project's own category, title, subtitle and stack. It redraws only when its input hash changes; `content/covers.json` records each cover's source, hash and bytes |
| `portrait` | `public/media/profile/portrait.png` (v1.8): the About portrait's 180 × 225 gray source. It comes from `public/media/profile/photo.*`, cropped to 4:5 by attention and normalized; until there is a photo, a generated head-and-shoulders placeholder |
| `publication-list` | `public/media/publications.pdf` + `content/publication-list.json` (v2.3, both committed): the papers as the content holds them (authors, title, venue and year, status, the DOI or PDF), set in the site's three faces on A4 and printed by the installed Chrome. A PDF carries its print date, so it's reprinted only when its input hash changes (the papers, the name and email, the faces, the layout); a test fails when it's stale. **Measured:** 2 papers, 83.9 KB |
| `fonts` | subsetting + axis trimming |
| `og` | OG images |
| `search-index` | `public/search-index.json` for the terminal (generated, not committed). Over 60 KB gz fails the build |
| `citations` | `content/citations.json` (committed): counts from OpenAlex by DOI, each stamped with the date it was read, for my records and (v1.9) the works they cite. A count is used only for the DOI it was read for. If the API is unreachable, the last values stay with their own dates |
| `verify` | `content/verify.json` (committed): checks every DOI (via the doi.org handle API), every arXiv id and every `verifyUrl`. A dead DOI or arXiv id fails the build. A dead, blocked or unreachable verify URL downgrades its stamp to ON FILE and warns. VERIFIED appears only on a URL this build actually reached |

**Posters, as built** (v1.7): `scripts/posters.ts` captures every scene registered in `components/stage/posters.ts` from a production build, in the installed Chrome (Playwright), at its canonical state: `?poster=1` stops the clock at zero with no cursor and no stir, and the capture runs at HIGH, unprobed.
- **Three frames:** a landscape 640 × 360, a portrait 360 × 780 and a tablet 480 × 640, which the slot picks by orientation and aspect.
  - The portrait is 9:19.5, the phones' own aspect, so the slot's `cover` scales it by width, as the scene's width-limited subject does. At 9:16 its subject came out 22% larger than the live one and was cut at both edges.
  - The tablet frame (v1.8) is 3:4, for portrait screens wider than 3:5. There the phone-shaped one sat 110 px above the live subject, its glow cut off at the top.
  - Registered (v1.8): the hero, and LOG at `/#log` — the deck at its first card. The capture hides the section strips and the pins' frames too.
  - **Drawn, not captured** (v1.9): ARCHIVE's poster is the build-time SVG constellation straight from `content/graph.json` (`POSTER_DRAWINGS`, `lib/archive-svg.ts`), rasterized and put through the same dither. No browser, no stage; the phone edition's header is the same drawing.
- **Only the stage:** the fixed overlays are removed and the type is hidden down to every descendant. The grain sets its own `visibility: visible`, and until v1.7 it was dithered into every capture.
- **The dither:** each frame has its own ground subtracted and is normalized to its 99.5th-percentile white. Then come a 20% ink floor and a γ 1.2 ink curve, both chosen from a contact sheet: at 8%, bloom's flat haze dithered into a box of sparse dots around the subject. Last, an 8 × 8 Bayer ordered dither.
- **Deterministic:** byte-identical across three runs.
- **Measured, hero:** 12.5% ink and 2,688 B landscape; 10.6% and 2,990 B portrait. On a 390 × 844 phone the poster's subject lands on the live one, centers within 4 px.
- **Closed** (v1.8): the portrait tablet's offset, by the third (3:4) capture above.
- **Framed to the slot** (v2.1): a slot shorter than the viewport, such as CAPABILITIES' 80 svh band, is captured in a viewport that makes the slot itself the poster's size, and it's scrolled into view before its scene is waited on. Captured from the window, the pile sat 40% down a frame that the slot's `cover` then cropped: about 80 px above the live pile at 1440 × 900. A full-height slot captures exactly as before.
- **Registered** (v2.1): CAPABILITIES at `/#capabilities`, the pile at rest by category with nothing hovered: 1,833 B landscape, 1,965 portrait, 2,647 tablet.
- The bake keeps drawing placeholders for scenes not yet registered.

**Run modes** (`scripts/bake.ts`, in this order: validate → layout-graph → citations → verify → search-index → posters · atlases · og):
- **dry:** `IS_PLACEHOLDER` content. No network, stable output, and no link can fail.
- **offline:** `--offline`, `RETROGRADE_OFFLINE=1`, and every `npm run dev` (`predev`). The last network results are kept.
- **live:** `npm run build` (`prebuild`) on real content.

`RETROGRADE_BUILD_DATE=YYYY-MM-DD` pins "today" for the as-of dates.

### 8.3 Performance budget

| Metric | Budget | Notes |
|---|---|---|
| LCP (mobile, 4G) | ≤ 1.8 s | the `<h1>` is SSR-painted under the boot. **Measured at Part 12:** 1.72–1.76 s over three runs (1,719–1,764 ms; still the name), Performance 97; desktop 77 ms, 99. The HTML's 4.2 KB gz more is about 21 ms at Lighthouse's 1.6 Mbps: 36 ms of headroom left at the slowest run. **Measured at Part 11:** 1.71–1.72 s over three runs (1,711–1,717 ms; the LCP element is still the name), Performance 97; desktop 70 ms, Performance 99. RECORDS joined the critical path: HTML 35.8 → 38.2 KB gz and CSS 21.7 → 24.3, 50 ms of the margin. **Measured at Part 10:** 1.66 s in each of three runs (1,657–1,661 ms; the LCP element is still the name), Performance 97; desktop 73 ms, Performance 99. **Measured at Part 9:** 1.64 s in each of three runs, Performance 97; desktop 70 ms, Performance 99. A case study (`/work/churn-prediction`): 1.67 s, Performance 97. **Measured at Part 8:** 1.62–1.63 s over three runs (the LCP element is still the name), Performance 97; desktop 70 ms, Performance 99. The page grew by ARCHIVE (HTML 21.9 → 26.3 KB gz, CSS 16.6 → 19.4). A record's own page: 1.58 s, Performance 98. After the phone review, on the part's final build: 1.61–1.62 s over three runs, Performance 97, and a record's page 1.58 s, Performance 98 (HTML 26.9 KB gz, the drawing drawn twice; CSS 19.7). **Measured at Part 7:** 1.54 s in each of three runs on the final build (1,536–1,541 ms; the LCP element is still the name), Performance 98; desktop 59 ms, Performance 99. **Measured at Part 6, with the real hero:** 1.54 s in each of three runs (1,538–1,546 ms; the LCP element is still the name), Performance 97–98; desktop 60 ms, Performance 100. **Measured at Part 5, with the boot in place:** 1.5 s in each of three runs (Lighthouse 12.8 mobile, DevTools throttling: 150 ms RTT, 1.6 Mbps, 4× CPU). LCP equals FCP, and the LCP element is the hero name under the overlay. Performance 96–97. Lighthouse's default simulated throttling reads 3.5 s on localhost, which is meaningless there: its model re-times every request that finished before the observed LCP, and on localhost every request finishes within 54 ms, so the whole first load is charged to LCP |
| CLS | ≤ 0.02 | metric-adjusted font fallbacks, reserved media boxes, native sticky pins. **Measured at Part 12: 0** on three Lighthouse phone loads and one desktop load, and landing on `#connect` in six zones as COPY and the overlap readout arrive (they keep their places); one gate run read 0.0243 there, unreproduced in eight more, and the gate now records every counted shift's source. **Measured at Part 11: 0** on three Lighthouse phone loads of home and one desktop load, and through the credentials gate. The deal and the turn are transforms, and the chips' FLIP follows the visitor's click. **Measured at Part 10: 0** on three Lighthouse phone loads of home and one desktop load, and through the capabilities gate. **Measured at Part 9: 0** on three Lighthouse phone loads of home and one of a case study, and through the work gate (the `?debug=1` overlay's own reflows aside). **Measured at Part 8: 0** on three Lighthouse phone loads of home and two of a record's page, and 0 again on the final build after the phone review (three of home, one of a record's page). The record's page read 0.14 first. The microfiche frame's 3D entrance overflowed sideways, which on a phone widens the layout viewport so every fixed element shifts (the boot's shutter, the bezel's corners); and its scan bar swept by `top`. The page clips horizontally now and the bar moves by transform. **Measured at Part 7: 0** in each of three Lighthouse throttled mobile loads, on every smoke route, and through the scroll gate at three viewports. LOG's playhead had moved by `top`, a layout shift every frame (0.00002 in the scroll gate); it moves by transform now, against its scale's own height (`cqh`). **Measured at Part 6: 0** in each of three Lighthouse throttled mobile loads, on every smoke route, and through the scroll gate at three viewports. Before the fixes, the hero read 0.0081: the display face's cap trim followed the fallback's taller caps (§2.5), and the bottom-aligned hero cleared a band measured at hydration (§7.3). **Measured at Part 5:** 0 on every smoke route and through the scroll gate. 0.005 on Lighthouse's throttled mobile load, where Mona and the mono swap in; the display steps have their own fallbacks (§2.5). **Measured at Part 4: 0** at 1440×900, 1920×1080, 390×844 and in the reduced-motion edition, over load plus a full scroll down and up (`scripts/scroll-gate.mjs`) |
| INP | ≤ 150 ms | |
| TBT (Lighthouse mobile) | ≤ 150 ms | On phones the stage runtime loads after LCP + idle; the hero shows its poster, then dither-resolves to live. Since v1.6, on a first visit to `/` the boot fetches the runtime as its real bytes (still after LCP). **Measured at Part 12:** 55, 60 and 78 ms over three runs (benchmarkIndex 4,438–4,531); desktop 0. **Measured at Part 5:** 110, 100 and 160 ms over three runs (median 110), so one run is over budget. The largest long task is the stage runtime starting up, about 6 s into the throttled load: 112–145 ms, in the three.js chunk. Hydration adds two more (51–102 ms). The open lever is to split the runtime's start-up with yields between module evaluation, renderer creation and scene setup. **Measured at Part 6, with the split** (yields after the runtime's import, the renderer, its configuration and its first render): 90, 90 and 94 ms over three runs. The runtime's largest task is now 80–84 ms, down from 112–145. Hydration's two tasks (52–53 and 107–109 ms) are now the largest. **Measured at Part 7:** 52, 40 and 38 ms over three runs on the final build, and 37–78 over the twelve runs on the four builds since the fix. This part's build read 110–116 before it. A throttled trace found three forced full-document style recalcs inside the hydration task, ~830 elements and 15–17 ms each at 4× CPU. Two effects wrote custom properties to `html` (HudMetrics' band heights, `#fx-css`'s scanline pitch), and Lenis's stylesheet made `html` the subject of the classes Lenis rewrites at construction and at every scroll's start and end. Each time, the commit's next layout read paid. In Chrome any restyle of `html` restyles every element, even for a non-inherited property (measured: `scroll-padding`, `height`, a class, a custom property — 867 elements each). So nothing writes to `html` after first paint unless the user asked for it (the theme, the motion edition). The scroll padding is written straight to the property, in the ResizeObserver's first callback; the pitch sits on `#fx-css`; Lenis's two descendant rules are re-stated in `styles/scroll.css` and `lenis.css` isn't imported. Hydration's task fell from 127–138 to 68–89 ms over those twelve runs. The others: the runtime's start-up 67–78, React's evaluation and its microtasks 50–60, the first style and layout 50–66 (before FCP). **Measured at Part 11:** 60, 58 and 61 ms over three runs (benchmark index 4,494–4,556); the largest long tasks 94–96 ms. **Measured at Part 10:** 45, 46 and 57 ms over three runs (benchmark index 4,499–4,611); the largest long tasks 86–98 ms. **Measured at Part 9:** 52, 57 and 63 ms over three runs; a case study 27. **Measured at Part 8:** 49, 51 and 63 ms over three runs; hydration's task 77–85 ms. The part's build read 217–224 first, its hydration task 235 ms, for two reasons. A scroll lock written as `html:has(.dossier-dialog[open])` made html's style depend on its descendants, so every DOM insertion anywhere restyled html — in Chrome, the whole document. And the metrics' six counters each read their rect, then wrote a zero, so each read forced a layout the last write had dirtied. The lock is set by the dialog now, on the visitor's action; the counters ask an IntersectionObserver, whose first report comes after layout. So, with Part 7's rule: no `:has()` whose subject is html. A record's page: 24–32 ms. On the final build, after the phone review: 58, 68 and 53 ms; a record's page 40 |
| First-load JS, `/` | ≤ 230 KB gz (hard cap 280) | **Measured at Part 12: 228.0 KB gz** (CSS 25.5, HTML 42.4), 1.9 less than Part 11. The governor's state machine left first-load (−2.6, §4.2), and CONNECT's and HALT's idle loaders came in (+0.7). The form's behaviour (react-hook-form, its resolver, the zod/mini schema, the log, COPY, availability) is one 31.5 KB lazy chunk, which classic zod made 45.8 (§10 #55); HALT's is 0.7 KB. 2.0 KB remain. **Measured at Part 11: 229.9 KB gz** (CSS 24.3, HTML 38.2), 0.4 more than Part 10: the wall's idle loader. The wall's and the records' behaviour (the lamp, the turn, the chips, the deal, the gyro chip) is one 3.1 KB lazy chunk; the cards and records are server HTML. 0.1 KB remain: Part 12 pulls the governor lever first. **Measured at Part 10: 229.5 KB gz** (CSS 21.7, HTML 35.8), 0.2 more than Part 9: the band's lazy layer and the panel's idle loader. The keys' HTML layer (2.3 KB), the panel's behaviour (1.5 KB) and the scene (10.3 KB) are lazy. Each of the three had carried all of `lib/capabilities.ts` (the two small ones at 3.7 and 2.9 KB) until the pile's layout moved into its own module. 0.5 KB remain; the governor's state machine (≈ 4 KB) is the lever still unspent. **Measured at Part 9: 229.3 KB gz** (CSS 20.9, HTML 32.4), 1.4 more than Part 8: WORK's band, the INDEX's idle loader, the PROJECTION's registry and the navigation hooks. The carousel's HTML layer (2.4 KB), the INDEX's behaviour (3.4 KB), the scene (11.3 KB) and its covers' worker (0.6 KB) are lazy. 0.7 KB remain; the governor's state machine (≈ 4 KB) is the lever still unspent. **Measured at Part 8: 227.9 KB gz** (CSS 19.7, HTML 26.9), 3.4 more than Part 7: ARCHIVE's islands (the sky's HTML layer, the chips, the query's keyword scope, the ledger, the chart's tooltip). The sky, its shaders and the dossier are lazy. 2.1 KB remain; the governor's state machine (≈ 4 KB) is the lever still unspent. **Measured at Part 7: 224.5 KB gz** (CSS 16.6, HTML 21.9), 4.1 more than Part 6. The new client code is IDENTITY's portrait and CURRENTLY and LOG's year scale; LOG's deck, shaders and atlas are lazy. **Measured at Part 6: 220.4 KB gz** (CSS 14.6, HTML 19.8). The hero's type layer, its hints, the morph-target loader and the name fit added 5.4; the scene, its shaders and the worker are lazy. **Measured at Part 5: 215.0 KB gz.** ScrollTrigger (18.0) and CustomEase (3.7) left first-load (§8.1, v1.6), which paid for the boot, the chrome, the cursor, `#fx-css` and the sound toggle. 15.0 KB remain, and the governor lever is unspent. **Measured at Part 4: 226.1 KB gz** (Part 3: 217.5). The transition grammar is a lazy chunk fetched on idle: `lib/transitions.ts`, its timelines, and the tear, power and scan programs. Moving the governor's state machine into the stage chunk is still available and saves about 4 KB. **Measured at Part 1: 207.8 KB gz** with `npm run weight`, which excludes the 39.4 KB of `noModule` polyfills that modern browsers never download. Next 16.4 + React 19.3 ≈ 131 (measured; the early estimate of 105 was low). GSAP core + ScrollTrigger + CustomEase ≈ 50, with SplitText lazy. Lenis 5.4. Motion's `m` + LazyMotion, with features lazy. zustand. App code. Parts 3–5 (shell, HUD, boot, fx-gl) must fit in the remaining ≈ 22 KB, or ScrollTrigger moves to a lazy chunk. **Measured at Part 3: 217.5 KB gz** — the governor, tiers, `#fx-gl` and slots added 9.7, so ≈ 12.5 KB remain for Parts 4–5. Spare lever: the governor's state machine (≈ 4 KB gz) can move into the stage-runtime chunk |
| Stage runtime (lazy, shared) | ≤ 250 KB gz | three ≈ 160 after tree-shaking (195 KB gz measured for full core + module) · R3F ≈ 45 · postprocessing subset ≈ 40 (117 KB gz measured for the full build). **Measured at Part 7: 218.3 KB gz in four chunks:** 135.2 + 55.1 for three + R3F (190.3; 188.9 at Part 6); 23.5 for postprocessing with `StageRuntime`; 4.5 for the dither resolve (poster → live). **Measured at Part 6: 216.7 KB gz in three chunks:** 188.9 for three + R3F; 23.4 for postprocessing (composer, render and effect passes, bloom) with `RetroEffect`; 4.4 for `StageRuntime` with the hero's shaders, which the boot probe draws. **Measured at Part 3: 191.5 KB gz** — three + R3F via `createRoot` 187.0, drei `PerformanceMonitor` 4.5 |
| Each scene chunk | ≤ 35 KB gz | shaders included. Part 3's placeholders: 1.0–1.2 KB gz each. **Measured at Part 10:** CAPABILITIES is 10.3 KB gz, its shaders, cap, sim and layout included; its images go through the shared packing worker. **Measured at Part 9:** WORK is 11.3 KB gz, its shaders, carousel and projector included; its covers' worker 0.6 KB. **Measured at Part 8:** ARCHIVE is 9.2 KB gz, its shaders included; the dossier dialog's own chunk 1.5 KB, loaded when a record opens. **Measured at Part 7:** LOG is 6.2 KB gz, its shaders included. **Measured at Part 6:** the hero is 6.3 KB gz. Its morph-target worker is 5.3 KB gz, loaded during the boot |
| Terminal | ≤ 30 KB gz + index ≤ 60 KB gz | loaded on first open |
| HTML, `/` | ≤ 60 KB gz | real content is server-rendered; content never ships as JS. **Measured at Part 12:** 42.4 KB gz, 4.2 more than Part 11: CONNECT's form, availability and channels, and HALT's index of every section, project and paper. **Measured at Part 11:** 38.2 KB gz, RECORDS on the owner's content (no certificates yet). A distinct certificate's markup is about 0.3 KB gz (the fixture's twelve together), and Next writes it twice, the HTML and the RSC payload: about 0.6 KB a certificate on the page. The budget holds about 35 more. **Measured at Part 10:** 35.8 KB gz — the panel's rows and the CSS keycap grid are real HTML. **Measured at Part 9:** 32.4 KB gz — WORK's CSS carousel and INDEX are real HTML. |
| Fonts | ≤ 165 KB total, ≤ 125 KB preloaded | **Measured at Part 1:** Hubot Sans 79.6 + Mona Sans 40.5 + JetBrains Mono 34.4 = 154.5 KB; 114.0 KB preloaded (display + mono) |
| Textures (download, all scenes) | ≤ 2.5 MB total · ≤ 600 KB per file · ≤ 300 KB before the first stage is live | **Measured at Part 7:** LOG's card atlas is 11.5 KB (2048 × 1024, lossless WebP), fetched by its `prime()`. IDENTITY's portrait (7.3 KB, a placeholder until the photo) feeds a 2D canvas, not the GPU **Measured at Part 11:** the foil's grain, 5.7 KB (128², gray WebP), fetched only where there's foil. **Measured at Part 10:** A5's legend atlas is 14.7 KB (1024², lossless WebP) and its three matcaps 1.3 / 1.4 / 0.5 KB, fetched by its `prime()`. **Measured at Part 9:** A4's covers, five at the tier's size — 96.9 KB at HIGH (1024 wide), 73.9 at MID, 56.2 at LOW; the largest file 21.6 KB of its 120. The masters (220.0 KB for five) serve the DOM through next/image. |
| VRAM (LIVE + WARM + post targets) | HIGH ≤ 160 MB · MID ≤ 64 MB · LOW ≤ 24 MB | shown via `renderer.info` in the dev overlay. **Measured at Part 10, CAPABILITIES at the cap (40 keys):** HIGH 63.9 MB (the scene 2.48 — the legend atlas 1.4 with its mips, the matcaps 1.0, the geometry and instances — and the post chain 61.4, sized to the 80 svh band), MID 38.1 (2.48 + 35.6). **Measured at Part 9, WORK at the cap (eight slides):** HIGH 108.2 MB (the scene 31.4 — the covers 29.8 within A4's 30, the print 1.6 — and the post chain 76.8), MID 62.3 (17.7 + 44.6: 1.7 MB under), LOW 14.4 (12.3 + 2.1). **Measured at Part 8, ARCHIVE LIVE at the budget's caps** (200 glyphs, 2,000 edges): HIGH 76.9 MB (scene 0.15 + post 76.8) · MID 44.7 (0.15 + 44.6), the canvas apart (47.6 / 35.0). No textures: the scene is its buffers. **Measured at Part 7, LOG LIVE:** HIGH 87.9 MB (scene 11.2 + post 76.8) · MID 55.8 (11.2 + 44.6) at 1440 × 900, the canvas apart (47.6 / 35.0). The scene's 11.2 is the atlas with its mips. The count now includes textures held in a ShaderMaterial's uniforms, which it had missed; the hero holds none, so its Part 6 numbers stand. A full evict → re-prime cycle leaves nothing behind (renderer textures 19 → 18, geometries 5 → 4, programs 12 → 12, LOG alone resident). **Measured at Part 6, the hero LIVE:** HIGH 82.8 MB (scene 6.0 + post 76.8) · MID 46.7 (2.2 + 44.6) · LOW 8.9 (0.8 + 8.1) on desktop and 2.9 (0.8 + 2.1) on a phone. The canvas's own framebuffer is the browser's and is reported apart: 47.6 / 35.0 / 24.3 / 6.2 MB |
| Draw calls per frame | ≤ 40 including post | scene geometry ≤ 16; post ≤ 18 on HIGH, 12 on MID, 3 on LOW. **Measured at Part 10, CAPABILITIES:** two geometry draws (the caps, their shadows); 16 with the post chain on HIGH, 11 on MID. LOW has no CAPABILITIES stage. **Measured at Part 9, WORK:** one geometry draw (the InstancedMesh); 15 with the post chain on HIGH, 10 on MID, 2 on LOW. **Measured at Part 8, ARCHIVE:** 16 on HIGH and 11 on MID: two geometry draws (the glyphs, the edges), plus post. **Measured at Part 7, LOG:** 17 on HIGH and 12 on MID: three geometry draws (the cards, the shafts, the light panel), plus post. LOW has no LOG stage. **Measured at Part 6, the hero:** 15 on HIGH, 10 on MID and 2 on LOW (one Points draw, plus post) |
| Geometry | ≤ 150k triangles, ≤ 250k points | |
| GPU frame time | ≤ 8 ms on M1 (HIGH) · ≤ 14 ms on the A54 (LOW) | **Measured at Part 10 on the M5 Pro, CAPABILITIES at the cap (40 keys), saturated,** over the part's two Gate C runs: HIGH 0.47–0.52 ms at rest, 0.44–0.53 hovered, 0.48–0.57 thrown, 0.44–0.46 gathered; MID 0.35, 0.35–0.42, 0.35–0.36 afloat, 0.35–0.44 — A5's 3 ms with room. The timer queries read 2.2–3.3 ms p50 at HIGH and 1.2–1.7 at MID. 120 fps throughout. **Measured at Part 9 on the M5 Pro, WORK at the cap (eight slides), saturated:** HIGH 0.57 ms at rest, 0.61 mid-fling, 1.07 projected; MID 0.44 / 0.43 / 0.73; LOW 0.20 / 0.23 / 0.29 — A4's 4 ms with room. The timer queries read 4.2–4.6 ms p50 at HIGH, where the GPU clocks down under so light a load (§4.2), 2.0–2.2 at MID and 0.33–0.34 at LOW. 120 fps throughout. **Measured at Part 8 on the M5 Pro, ARCHIVE at the budget's caps:** over its last two Gate C runs, 0.69–0.76 ms at HIGH and 0.42–0.62 at MID, saturated, mid-re-plot included; timer queries read 2.5–4.1 / 1.6–2.0 ms p50. The two-paper sky: 0.52 ms. A3's ≤ 3 ms holds. **Measured at Part 7 on the M5 Pro, LOG:** over its last two Gate C runs, 0.51–0.72 ms at HIGH and 0.36–0.52 at MID, saturated; timer queries read 3.7–4.3 / 1.7–2.2 ms p50. A2's ≤ 4 ms holds. **Measured at Part 6 on the M5 Pro**; there is no M1 or A54 here. Over the last two Gate C runs, the hero's frame costs 0.90–1.49 ms at HIGH, 0.47–0.81 at MID and 0.18–0.58 at LOW, saturated: frames back to back, timed by readback. Timer queries read 4.0–5.5 / 1.8–3.6 / 0.9–1.6 ms p50 at the display's pace. Apple GPUs clock down at a light load, and their timers then overstate the cost: 3.0–5.4× per state at HIGH, 2.0–6.4× across the tiers |
| Main thread | ≤ 4 ms of scripting per frame | **Measured at Part 11, the wall:** a pointer sweep across the cards keeps the display's 120 fps, frame intervals 8.3 ms p50 and 9.0 p95, with at most two live foils. The springs only set targets; one tick writes. **Measured at Part 10, CAPABILITIES:** 0.3–0.7 ms p50 per frame at the cap (0.7–1.3 p95), thrown and gathered included. The physics alone, timed on its own: 0.014–0.015 ms a frame at 60 Hz (two steps) and 0.025 at the 30 fps cap (four) — A5's 0.3 with room. **Measured at Part 9, WORK:** 0.2–0.4 ms p50 per frame at the cap, mid-fling included. **Measured at Part 8, ARCHIVE:** 0.3–0.7 ms p50 per frame at the caps, the re-plot's springs included. **Measured at Part 7, LOG:** 0.4–0.8 ms p50 per frame. **Measured at Part 6, the hero:** 0.2–0.4 ms p50 per frame at every tier |
| Shader warm-up | ≤ 60 ms per scene, off the critical path | `compileAsync` inside the interlock. **Measured at Part 10:** CAPABILITIES 18.7–19.2 ms at HIGH and 17.6–18.4 at MID, the atlas's and matcaps' uploads and mips with it. **Measured at Part 9:** WORK 43.1 ms at HIGH, the eight-layer cover array's upload and mips with it; 16.2 at MID and 16.3 at LOW. **Measured at Part 8:** over its last two Gate C runs, ARCHIVE's WARM takes 15.4–16.7 ms. **Measured at Part 7:** over its last two Gate C runs, LOG's WARM takes 18.1–19.7 ms. **Measured at Part 6:** over four Gate C runs, the hero's WARM takes 16.5–21.3 ms. Its morph targets are generated in the worker, at 132–144 / 60–88 / 33–55 ms at HIGH / MID / LOW, with no long task on the main thread |
| JS heap | ≤ 90 MB | |
| Audio | ≤ 90 KB | fetched only after first enable |

**FPS targets:**
- **M1 MacBook Air (60 Hz), Chrome and Safari:** 60 fps locked on all five stages at HIGH; p99 frame ≤ 20 ms during scroll.
- **M1 Pro/Max (ProMotion, 120 Hz):** DOM, scroll and HUD run at 120. Stages run at 120 when p95 ≤ 7.5 ms. Otherwise the stage renders at 60 while compositor docking stays at 120.
  - **The drop** (v1.7) needs frames that are slow *and* late. The p95 frame must be over 7.5 ms and the p95 rAF interval over 1.5 refresh intervals; the stage then holds 60 for 3 s before it tries the display rate again. A slow p95 alone capped a 120 Hz Mac that never missed a frame. Apple GPUs clock down at a light load, and their timers then read the hero's p95 at 7.5–9.8 ms at HIGH for a frame that costs 0.90–1.49 ms.
  - **Measured at Part 6 on the M5 Pro (120 Hz):** the hero holds 120 fps at HIGH, MID and LOW.
  - **Measured at Part 7 on the M5 Pro (120 Hz):** LOG holds 120 fps at HIGH and MID.
  - **Measured at Part 8 on the M5 Pro (120 Hz):** ARCHIVE holds 120 fps at HIGH and MID, at the budget's caps.
  - **Measured at Part 10 on the M5 Pro (120 Hz):** CAPABILITIES holds 120 fps at HIGH and MID, at the cap.
- **Mid-range Android — reference device Samsung Galaxy A54 (Exynos 1380, Mali-G68 MP5), Chrome:**
  - scroll at 60 fps
  - Hero and Projects ≥ 50 fps at LOW
  - never below 45 fps sustained across a 3-minute session, thermals included
- **Lighthouse:** Performance ≥ 95 mobile (90 is the floor that blocks merge) and ≥ 98 desktop; Accessibility, Best Practices and SEO all 100.
  - **Measured at Part 12:** Performance 97 on mobile (three runs) and 99 on desktop; Accessibility, Best Practices and SEO 100 on all four.
  - **Measured at Part 11:** Performance 97 on mobile (three runs) and 99 on desktop; Accessibility, Best Practices and SEO 100 on all four.
  - **Measured at Part 10:** Performance 97 on mobile (three runs) and 99 on desktop; Accessibility, Best Practices and SEO 100 on all four.
  - **Measured at Part 8:** Performance 97 on mobile (three runs) and 99 on desktop; a record's own page 98. Accessibility, Best Practices and SEO are 100 on all three. The record's page read 98 for Accessibility first: its sections were h3 under the h1, and are h2 there now (h3 under the dialog's h2).
  - **Measured at Part 7, the final build:** Performance 98 on mobile (three runs) and 99 on desktop. Accessibility, Best Practices and SEO are 100 on both. Mobile Accessibility read 96 before the HALT and CONNECT links became 24 px targets: wrapped on a phone, their micro-type rows sat closer than 24 px (`target-size`, WCAG 2.5.8).

---

## 9. Anti-goals — we will not ship

**Visual clichés**
- Synthwave sunset grids, chrome type, palm trees, outrun gradients — and pink-on-amber, which is why Amber's signal is cyan.
- Floating crypto blobs: iridescent metaballs, glassmorphism cards drifting over a gradient mesh.
- The glowing particle head, the AI brain, "neural network" stock imagery — which is why the hero's head was cut.
- Matrix-rain pastiche. Our `rain` falls our own data.
- Costumes of real operating systems: Windows 95 chrome, macOS traffic lights, a fake Start menu. RETROGRADE is fictional.
- Bloom on everything. If everything glows, nothing does.
- Lens flares, decorative god rays, bokeh everywhere, default grey `MeshStandardMaterial`, drag-to-rotate models with no purpose.
- Glitch effects or chromatic aberration on anything you're reading.
- Buzzword marquees (`CREATIVE • DEVELOPER • THINKER •`).
- Emoji in the UI. Exclamation marks in mono. "Let's work together."

**Readability**
- Unreadable low-contrast text. No text token sits below 4.5:1 — on any surface, under any overlay, in any theme (§2.3, §5.3). There is no "faint text" token: if it's too faint to read, it's decoration, and decoration isn't text.
- Text below 11 px. Scramble or typewriter effects on anything longer than a line. Text on images without a scrim.
- Self-rated skill bars ("Python 87%").
- A publications section that's a bulleted list in 14 px grey. Publications get a sky, a dossier, a ledger, a route of their own and an OG card.

**Interaction**
- Scroll-jacking that fights the user: no wheel hijacking, no page snapping, no vertical wheel turned sideways, no pin longer than two viewports, no punishment for scrolling fast.
- Three-second mandatory intros. The boot is ≤ 2.2 s, skippable from frame one, once per session, and never on deep links.
- A custom cursor that lags its hotspot, or that hides the pointer on touch.
- Hover-only affordances, or tooltips as the only carrier of information.
- Sound on hover, autoplaying sound, music.
- Fake truth: fake progress bars, fake coordinates, fake system stats, lorem ipsum or placeholder testimonials in production, "VERIFIED" on anything we didn't verify.

**Engineering**
- Five canvases. A runtime force simulation. 1.65 MB of physics for keycaps. A texture over 600 KB. Per-frame lerp constants. Animated layout properties. Content shipped as JavaScript.
- A Paper theme that's just inverted colors.
- A reduced-motion mode that's a broken version of the site.

---

## 10. Overrides to PROMPTS.md

These were decided here and are now folded into PROMPTS.md v2 (2026-11-10). The table stays as the record of what changed and why. Part numbers refer to PROMPTS.md v2, where part N = build step N (§11).

| # | Part (v2) | Original prompt said | Decision | Why |
|---|---|---|---|---|
| 1 | 1 | Next.js 15 | Next.js 16.4 | current stable; Turbopack is the default; nothing we use regressed |
| 2 | 1 | Lenis via ScrollTrigger `scrollerProxy` | no proxy: `gsap.ticker` drives Lenis, and `ScrollTrigger.update` runs on scroll | Lenis scrolls the real window; a proxy is for transform-based scrollers |
| 3 | 1 | `@react-three/postprocessing` | `postprocessing` directly + `RetroEffect` | −19.7 KB gz for a fixed chain |
| 4 | Art direction | Space Grotesk / Chakra Petch / Monument; Inter Tight | Hubot Sans / Mona Sans / JetBrains Mono | §2.5 |
| 5 | 5 | theme switch = CRT degauss | POWER CYCLE (Paper: SCAN); degauss is the Konami egg | a theme change is existence, not damage |
| 6 | 4, 5 | glitch burst / tracking wipe on every section change | continuous scroll glitches only the HUD label; TEAR only on jumps | a tear masks a cut — no cut, no tear; and fatigue |
| 7 | 5 | boot on every first visit | first visit to `/` only; never on deep links | shared links must land on content |
| 8 | 6 | initials → head → globe → lattice | initials → constellation → live globe → site grid | the particle head is a stock-AI cliché; every state is now real data |
| 9 | 6 | click advances the morph | click scrolls to the next checkpoint | one source of truth |
| 10 | 4 | signature #3: RAIL SLIDE | POWER CYCLE; RAIL REVEAL becomes the standard reveal | a clip wipe isn't ownable |
| 11 | 3 | `sceneManager` built after the hero | governor spike before any scene (Part 3) | every scene depends on it |
| 12 | 7 | About portrait rendered in a shader | Canvas2D dither | WebGL stays at exactly five stages |
| 13 | 7 | generic role cards with RGB-split hover | punch cards; hover = flex + backlight | RGB split is the 2019 default |
| 14 | 8 | nodes colored by venue type | monochrome; shape = venue type; color = state | measured palette failure (§2.4) |
| 15 | 8 | abstract typed out with a scramble | per-line reveal; scramble ≤ 40 chars | reading over theatre; screen readers |
| 16 | 8 | six equal counters + a bar chart | one hero figure + tiles with provenance; a unit chart of linked cells | hierarchy, honesty, interactivity |
| 17 | 9 | wheel drives the gallery; RGB split on fling | the vertical wheel always scrolls the page; persistence smear | no scroll-jacking; ownable |
| 18 | 10 | `@react-three/rapier`; proficiency bars; logo objects | micro-sim; rubric meter + evidence; keycaps | 1.65 MB gz; honesty; an ownable object |
| 19 | 11 | generic certificate cards | ID-1 cards; foil only in text-free zones; MRZ back; gyro on phones; VERIFIED only if it resolves | contrast safety, honesty, a mobile wow |
| 20 | 13 | `matrix` rain | `rain` of our own data (`matrix` is an alias) | no film pastiche |
| 21 | 14 | KTX2 by default | AVIF + `createImageBitmap`; KTX2 only if VRAM exceeds budget | the transcoder is 260 KB gz (measured) |
| 22 | 14 | "≤ 2 WebGL contexts, share one where possible" | exactly two by architecture, one drawing per frame | §4.1 |
| 23 | 3 | docking: `#stage` gets `translate3d(0, slotTop, 0)` every frame | the canvas is re-parented into the LIVE slot's dock and held by `position: sticky` (v1.5) | the browser holds it: nothing per frame, and no lag behind a phone's compositor scroll |
| 24 | 4 | pinned sections (ScrollTrigger `pin`) | sticky blocks in tracks sized in CSS; ScrollTrigger reads progress only (v1.5) | the pin's fixed/in-flow swap is a layout shift at every start and end (≈ 0.65 per end, measured); sticky pins measure 0 |
| 25 | 5 | `<Nav>` indicator via Motion `layoutId` | one hand-rolled bar on `settle` springs (v1.6) | Motion's layout animation put `/` at 253.9 KB gz first-load (budget 230); with the bar, 214.3 |
| 26 | 1, 4 | ScrollTrigger + CustomEase in first-load; `ScrollTrigger.update` on the RAF | `lib/scroll.ts` tracks sections and pins itself; eases via `gsap.registerEase`; ScrollTrigger lazy (v1.6) | 21.7 KB gz (measured, §8.1) of first-load that the boot and chrome needed; native pins leave one comparison per frame |
| 27 | 5 | the BOOT hum "only if sound is already ON" | …and only where the browser allows audio before a gesture (v1.6) | an `AudioContext` made before a gesture starts suspended, with a console warning |
| 28 | 6 | after 25 s idle, once ever: `PRESS ~ FOR TERMINAL` | built (the timer, the once-ever key, the copy) and held until the terminal exists, Part 13 (v1.7) | until then `~` does nothing; a hint that names a dead key is false (Global Rule 4) |
| 29 | 6 | the name "fitted to 12 columns by solving wdth (75–125) at a fixed size" | …and past `wdth` 125, its size grows to fill them (v1.8, §2.5) | at a fixed size, a short name fell to 73–89% of the measure on wide screens; tracking it out took up to +0.34 em, which pulls the word apart |
| 30 | 8 | the constellation's nodes are my publications | …plus the works they cite, as faint stars from the papers' real reference lists (v1.9, §4.3 A3) | the owner's call: two papers sharing a venue, a year and a topic gave three identical layouts, and the re-plot and the loop had nothing to show |
| 31 | 8 | "ONE hero figure — CITATIONS, in LED numerals" | …PEER-REVIEWED PAPERS until anything is cited, then CITATIONS (v1.9, §7.4) | the owner's call: the papers are newly accepted and nothing has counted them yet; a committee shouldn't meet a zero first |
| 32 | 8 | "points and edges can stay additive" | MAX blending on the dark tubes, MIN on Paper (v1.9, §4.3 A3) | additive light whited out where glyphs and edges crowd, at the budget's caps; MAX / MIN keep the brightest light or the darkest ink, and still need no depth buffer |
| 33 | 8 | the dossier: a `<dialog>` over home, a full page when visited directly | …and from a record's own page, prev / next open the neighbor over it (v1.9, §7.4) | Next intercepts by URL segment, so an intercept at the root catches every soft navigation to a record; a route group doesn't scope it (tried: it blanked the page under the dialog) |
| 34 | 8 | "Prev/next record with SLIDE ADVANCE" | …as a typed view transition (React's `<ViewTransition>`), not the Motion slider (v1.9, §7.4) | a layout's `children` is the router's own outlet, so AnimatePresence couldn't hold the leaving record: it stayed and the new one rendered empty |
| 35 | 8 | "TOPIC/YEAR/VENUE chips re-plot with spring relayout" | …where there's a stage to re-plot; without one (phones, reduced motion, no JS, LOW, OFF) the chips step aside (v1.9, §7.4) | the drawing and the poster are TOPIC's alone; a control that changes nothing on screen is false (Global Rule 4) |
| 36 | 8 | phone edition: "the SVG constellation header" | …drawn wide and tall, each about 1:1, with its TOPIC labels in HTML, in the pinned frame's flow under the query bar (v1.9, §7.4) | one landscape drawing scaled to a phone halved every glyph to 5 px, so the shapes were illegible; a fixed offset under a bar whose height changes with the width put a star on the legend at 360 px |
| 37 | 9 | INDEX "filters … with Motion layout FLIP" | a hand-rolled FLIP (WAAPI, `settle`) on the server's own rows, loaded on idle (v2.0, §7.4) | the table stays crawlable HTML and whole without JS; Motion's layout and presence on `/` would have cost several KB of first-load with 2.1 KB left |
| 38 | 9 | "radial CA ≤ 4 px on HIGH" | on HIGH and MID, as a scroll fling's, the scene's fling feeding the post chain (v2.0, §5.2) | §5.2 already gives fling aberration to both tiers; one rule for every fling |
| 39 | 9 | "Reduced motion / tier OFF: … a DOM FLIP into the case study" | the FLIP travels for tier OFF; under reduced motion the cover swaps in place (v2.0, §3.9) | the reduced-motion contract drops movement, not the edition |
| 40 | 9 | "The slides need real covers" | build-time title cards from each project's own words until screenshots arrive; a screenshot replaces its card with no code change (v2.0, §8.2) | the owner's call: build now, swap later — plainly type, never a fake screenshot, and the alt text says which |
| 41 | 9 | "per-project metadata and OG images" | metadata now; the OG image only once the site's URL is set (v2.0) | a relative OG URL resolves against nothing; Part 15 sets the URL and finishes the images |
| 42 | 9 | the projects' years and roles | pending (null) until the owner gives them: a dash, "To come" to a screen reader, left out of the mount and the case study (v2.0, §7.4) | the owner's call: nothing unverified is published |
| 43 | 10 | KEYCAP: "3 clack samples" | three clacks synthesized by the engine — a thock, a bright clack, a low clunk — one at random each time, pitched ±6%, as loud as the impact (v2.1, §6.4) | nothing to record, license or fetch (the 90 KB audio budget untouched), and the clacks share the mix and the voice cap of the other synthesized cues |
| 44 | 10 | "legends (logo + name)" | each technology's mark from the CC0 Simple Icons set, named by slug in the content, over its label; Java wears OpenJDK's mark, as the set carries none for Java; a monogram where there is no mark (SQL, ML, RAG, FAISS, RAGAS, Power BI) (v2.1, §8.2) | the owner asked for logos; CC0 marks need no permission or credit, and a mark the set doesn't carry isn't ours to draw |
| 45 | 10 | "Clicking a category magnetically re-clusters the pile" | the pile is clustered by category from the start; category chips over the stage (one radio group, All first) gather one forward to the middle and part the rest around it, placed as seen so nothing stands behind it (v2.1, §4.3 A5) | keys "drift back to their category's home", so the homes are by category already, and re-clustering means choosing which cluster leads. Placed by world position, a step back of 2.3 keycaps left the middle cluster right behind the gathered one, and the two read as one pile-up |
| 46 | 11 | "the wall" of certificates | the wall only when there are certificates: home leaves it out (no readout, no chips, no "0 CREDENTIALS"), and it's built and tested on the fixture persona's on `/dev/credentials/*` (v2.2, §7.4) | the owner's call: none yet; a wall of zero is a false advertisement, and theirs drop in with no code change |
| 47 | 11 | "a guilloche engraving as inline SVG, generated from a seed of credentialId" | a few shared figures (three rosettes, a wave band), drawn once per page, and each card's own placement of them from its seed (v2.2, §4.4 B1) | unique and deterministic per card at about 0.3 KB of HTML (measured, twelve together), where each card's own curves would be kilobytes, and Next writes a server component's markup twice (the HTML and the RSC payload) |
| 48 | 11 | phones: "drives --mx/--my from the gyro" (§4.4: rotateX/Y follow them) | the gyro moves the foil of the at most two cards most in view; the card itself stays flat (v2.2) | the phone is what tilts: turning the card on screen as well would double the angle, and the foil catching the light is the effect |
| 49 | 12 | `DOWNLOAD RESUME` | no résumé button, here or in the hero or LOG, until there's a résumé without the owner's phone number; `resumeUrl` is null (v2.3, §7.4) | the owner's call: every résumé version carries their phone number, which is never published |
| 50 | 12 | "Upstash Ratelimit (3 per 10 minutes per IP)" | 3 per 10 minutes per IP and per sender address, both sliding windows (v2.3) | a forwarded-for header is only as true as the proxy that sets it; the address's own window stops one sender passing the limit from many IPs |
| 51 | 12 | `OVERLAP 3H 30M · 09:00–12:30 YOUR TIME` | my confirmed hours (10:00–18:00 IST) against a 09:00–17:00 day in the visitor's zone, both on the visitor's today; with no overlap, when my day starts in their time (v2.3) | the browser gives the visitor's zone, not their hours. The example is a London winter's, which the gate checks |
| 52 | 12 | "a honeypot" | anything in it gets a 202 with no id and nothing sent, before any other check (v2.3) | a bot told it failed tries again, and checking the trap first means its other fields can't tell it what was wrong |
| 53 | 12 | (no JavaScript) | the teletype is a `mailto:` form, text/plain, with native validation; COPY and the live parts are absent (v2.3) | the form is server HTML, and the visitor's own mail app is the honest fallback |
| 54 | 12 | "Pull the lever first: move the governor's state machine (≈ 4 KB gz)" | moved into `lib/governor-engine.ts`, which the lazy stage runtime attaches; measured 2.6 KB gz (v2.3, §4.2) | the facade stays in first-load: the boot, the slots' posters and `#fx-gl` need it before any scene |
| 55 | 12 | "react-hook-form and its resolver must be lazy (on focus or idle)" | lazy, with the schema in zod/mini: a 31.5 KB gz chunk, which classic zod made 45.8 (v2.3) | it loads on idle for every visitor, and the same rules in mini give the same codes on the page and the server |
| 56 | 12 | "Back to top via Lenis, on transit, over 900 ms" | a quiet glide: no SECTION cue for each section it passes, its hash written where it lands; it opts out of the jump-with-a-tear every other `#hash` link gets (v2.3) | eight relay clicks in 900 ms are noise, not feedback, and §7.4 asks for a glide, not a jump |
| 57 | 12 | "DOWNLOAD PUBLICATION LIST (PDF)" | printed at build from the content in the site's faces, reprinted only when its inputs change (v2.3, §8.2) | the owner's call: generate it. A PDF carries its print date, so the input hash keeps the committed file stable |

---

## 11. Build order

Part numbers in PROMPTS.md v2 equal the step numbers below. The rule: if a step's gate is red, the next step doesn't start.

### Phase 0 — Lock

0. **Part 0** ✅ — approve this document. Start gathering real content now; it goes into `CONTENT_INTAKE.md` once Part 2 creates it. The name's length tunes the hero fit, the paper count tunes the constellation, and nothing in Research can be tuned on placeholders.

### Phase 1 — Foundation

1. **Part 1** — scaffold, tokens (§2 verbatim), `lib/motion.ts` (§3 verbatim), primitives, `/dev/kitchen-sink`, the font bake, and a unit test that recomputes the §2 contrast tables from the token file.
   *Gate: kitchen sink correct in all three themes; zero TS errors; contrast test green.*
2. **Part 2** — the content layer, plus the bake-pipeline skeleton (§8.2).
3. **Part 3** — the stage governor spike: `#stage`, `#fx-gl`, the single RAF, docking, `lib/tier.ts` with the probe, and the dev overlay, with five placeholder scenes in real slots.
   *Gate A: the §4.2 invariants hold on M1 and the A54, including cross-route survival and context-loss recovery.*
4. **Part 4** — the scroll engine, the three signature transitions, and all ten sections stubbed at real heights with posters in their slots (the interlock becomes measurable).
5. **Part 5** — boot, HUD, cursor, `#fx-css`, sound engine.
   *Gate B: LCP ≤ 1.8 s with the boot; the skip, never-replay and deep-link rules verified.*

### Phase 2 — Stages, in page order

6. **Part 6** — Hero, plus the real poster bake.
   *Gate C: §8.3 met on both reference devices at every tier. This scene is the template for the other four.*
7. **Part 7** — About + Experience.
8. **Part 8** — Research (requires the real publication data).
9. **Part 9** — Projects, case studies, PROJECTION.
10. **Part 10** — Skills, with the micro-sim.

### Phase 3 — DOM showpieces

11. **Part 11** — Credentials. It has no WebGL dependency, so it can run in parallel any time after Part 4.
12. **Part 12** — Contact + Footer.
13. **Part 13** — Terminal, last: it's a view over everything, so it's built once everything exists.

### Phase 4 — Harden and ship

14. **Part 14** — the audit.
    *Gate D: every §8.3 budget green in CI.*
15. **Part 15** — SEO, structured data, launch.
16. **Part 16** — the critique and polish pass, drawing its delights from §7.5.
