# RETROGRADE — Portfolio Build Prompt Library

`v2 · 2026-11-10 · aligned to DESIGN.md v1.1`

Paste **one part per message** into Claude Code, in order. Each part ends with a report. Parts with a **gate** don't move on until the gate is green. Run `npm run dev` and look at the result in the browser after every part.

**DESIGN.md is the spine.** Every prompt below points at the DESIGN.md sections it depends on. If a prompt and DESIGN.md ever disagree, DESIGN.md wins.

Part numbers follow the **build order** (DESIGN.md §11), which is not the page order. See "How to run this" at the bottom.

---

## THE ART DIRECTION (summary — the full spec is DESIGN.md)

**Codename `RETROGRADE`. The portfolio is a machine you boot — a fictional operating system for one person.**

The trap most people fall into: "retro" = low fidelity. We invert it.
**> High-fidelity GPU rendering of low-fidelity artifacts.**

- **Retro supplies texture & personality:** CRT phosphor glow, scanlines, ordered dither, DOS-style boot logs, punch cards, microfiche, 35 mm slides, keycaps, holographic-foil security documents, teletype, corner brackets, live readouts.
- **Modern supplies physics & precision:** real-time shaders, HDR bloom, 120 Hz frame-rate-independent springs, variable fonts, inertial scroll, scroll-driven cameras.

**The seven laws** (DESIGN.md §1.3): hi-fi rendering of lo-fi artifacts · every number is true · stage, then document · one live canvas · artifacts step, physics springs · color is earned by attention · bake, don't compute.

**Themes** (DESIGN.md §2.3):
- **PHOSPHOR** (default): `#050505`, accent `#00FF9C`, signal `#FF2E88`.
- **AMBER:** `#080605`, accent `#FFB000`, signal `#37D2F2`.
- **PAPER:** `#F2F0EB`, ink `#0A0A0A`, ledger green `#006842`, stamp red `#B71747`.

The signal color stays under 5% coverage. There is no categorical palette: identity comes from shape, position and label, and color only ever means state.

**Type** (DESIGN.md §2.5–2.6):
- **Display:** Hubot Sans. Its variable `wdth` axis (75–125) is used to fit text, not just for style.
- **Body:** Mona Sans.
- **Mono/data:** JetBrains Mono.

It's an 8-step fluid scale: ratio 1.2 on phones, rising to 1.5 on desktop. UPPERCASE is the machine; sentence case is the human. Numbers that change are mono.

**Motion** (DESIGN.md §3): three signature transitions, each with a grammatical job. DITHER RESOLVE means continuity, TRACKING TEAR means discontinuity, POWER CYCLE means existence. Duration tiers are 120 / 400 / 900 ms.

### Sitemap & wow beats (page order)

| # | Section | Code | Tier | Wow beat |
|---|---|---|---|---|
| 0 | Boot | `POST` | fx-gl | a real POST log about *your* machine, then the tube powers on |
| 1 | Hero | `SYSTEM` | A1 | 250k particles: initials → paper constellation → live globe → the site's own grid |
| 2 | About | `IDENTITY` | Canvas2D | the dithered portrait develops under the cursor like an exposure |
| 3 | Experience | `LOG` | A2 | a camera rail through a punch-card deck; light through real Hollerith holes |
| 4 | **Research & Publications** | `ARCHIVE` | A3 | **a monochrome citation constellation that re-plots + a microfiche dossier** |
| 5 | Projects | `WORK` | A4 | a 35 mm slide carousel; the slide projects into its case study |
| 6 | Skills | `CAPABILITIES` | A5 | a keycap pile — type a skill and its key goes down |
| 7 | **Certificates & Records** | `CREDENTIALS` | Tier B | **holographic foil ID-1 cards; gyro foil on phones** |
| 8 | Contact | `CONNECT` | — | a teletype transmission with a real log and your working-hour overlap |
| 9 | Footer | `HALT` | fx-gl | the last pixel powers the tube off |
| ∞ | Terminal | `SHELL` | — | a real CLI over the whole dataset |

### The 3D budget doctrine (non-negotiable — DESIGN.md §4)

- **One persistent stage canvas** (WebGL2, three/R3F) lives in the root layout and renders the **five Tier-A scenes**: Hero, Experience rail, Research constellation, Projects carousel, Skills keycaps. A governor keeps **at most one scene live**, warms at most one ahead, and disposes the rest.
- **One transition layer** (raw WebGL2, about 4 KB) draws the signature transitions above the DOM. **Exactly one context draws in any frame:** the stage freezes while a transition runs.
- **The interlock:** at least 100 svh of DOM-only content sits between any two stages. That one rule is both the performance budget and the loud/quiet rhythm.
- **Tier B** — 3D without WebGL: CSS transforms, gradients and blend modes, lit by one lamp (the cursor). The holographic foil is pure CSS.
- **The one Canvas2D exception:** the About portrait (not WebGL).

Nothing animates without a reason. Performance is a design constraint, not a cleanup task.

---

## GLOBAL RULES (every prompt says "follow the Global Rules"; this is what that means)

1. **DESIGN.md wins.** Read the sections a part cites before writing code. If anything in a prompt conflicts with DESIGN.md, follow DESIGN.md and say so in one line.
2. **No magic numbers.**
   - Colors come only from `styles/tokens.css`.
   - Easing, springs, durations and staggers come only from `lib/motion.ts`.
   - Graphics tiers come only from `lib/tier.ts`.

   A raw hex value or an inline duration in a component is a bug.
3. **No hardcoded copy.** Every word and number comes from `content/data.ts` via `content/derive.ts`.
4. **Every number is true.** No fake progress, stats, coordinates or badges.
5. **Three themes, three editions.** Everything works in all three themes: Phosphor, Amber and Paper. (Paper is a different material set, not inverted colors — DESIGN.md §5.4.) It also works in:
   - a **reduced-motion edition** — complete and designed, with no WebGL contexts (§3.9);
   - a **phone edition**, where one is specified (§4.4, §7.4).
6. **Accessible by construction:**
   - real HTML for everything readable;
   - a keyboard path for every interaction;
   - visible focus (brackets + outline);
   - no information carried by color alone;
   - text contrast ≥ 4.5:1.
7. **Motion rules:** frame-rate-independent motion (`lib/damp.ts`, `lib/spring.ts`); nothing time-based longer than 900 ms; any input interrupts animation.
8. **Measure, don't guess.** Budgets are in DESIGN.md §8.3. Report real numbers.
9. **Don't commit to git** unless I ask.
10. **End every part with a report:** what was built, what was verified (with numbers), what's knowingly unfinished, and the gate status if the part has one.

---

## PART 0 — Lock the direction ✅ done → `DESIGN.md`

Kept for reproducibility. Re-run only to regenerate the bible from scratch.

```
You are a world-class creative director + senior creative engineer (ex-Active Theory / Resn / Basement Studio caliber).

I'm building a personal portfolio that must feel: animated, 3D-interactive, dynamic, "modern but retro at the same time", and genuinely award-submittable (Awwwards SOTD / FWA tier). I'm a builder AND a researcher, so published work and credentials are first-class content, not footnotes.

Codename: RETROGRADE. Core concept: the portfolio is a machine you boot — a fictional operating system for one person. The central craft principle is HIGH-FIDELITY GPU RENDERING OF LOW-FIDELITY ARTIFACTS: CRT phosphor glow, scanlines, dot-matrix, dither, microfiche archives, punch cards, holographic foil seals, boot logs — rendered with modern shaders, 120fps spring motion and buttery inertial scroll.

Section order is fixed: Boot -> Hero -> About -> Experience -> Research & Publications -> Projects -> Skills -> Certificates & Records -> Contact -> Footer, plus a global terminal overlay.

Do NOT write code yet. Produce a design bible as DESIGN.md containing:
1. Concept statement (3 sentences) + the one-line hook a judge would remember.
2. Art direction: exact color tokens (hex + OKLCH), 3 themes (Phosphor dark, Amber dark, Paper light), type stack with fallbacks, a modular type scale (clamp() based, 8 steps), spacing scale, radii, border/grid treatment.
3. Motion language: easing curves (actual cubic-bezier + spring configs), duration tiers (micro 120ms / element 400ms / scene 900ms), stagger rules, the 3 "signature transitions".
4. The 3D budget: exactly FIVE Tier-A WebGL scenes (Hero, Experience rail, Research constellation, Projects gallery, Skills cluster) — justify each and state what it would cost to cut it. Then define Tier B: 3D achieved with CSS transforms + blend modes only (certificates, cards, tilts). Explain the rule that only one canvas renders at a time.
5. Texture/post-processing stack with target intensities (grain, scanline alpha, chromatic aberration px, bloom threshold, vignette).
6. Sound design plan (muted by default, prominent toggle).
7. Section-by-section sitemap with the "wow beat" of each, and the quiet/loud rhythm across the page.
8. Tech stack decision with justification and a performance budget (LCP, bundle KB, texture MB, draw calls, target FPS on M1 + mid Android).
9. Anti-goals: a blunt list of clichés we will not ship (synthwave sunset grids, floating crypto blobs, unreadable 10% contrast text, scroll-jacking that fights the user, 3-second mandatory intros, a "publications" section that's just a bulleted list in 14px grey).

Be opinionated. Make real decisions, no "you could choose X or Y". End with a build order.
```

---

## PART 1 — Scaffold + design system

```
Scaffold the RETROGRADE portfolio. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §2, §3 and §8.1 first.

Stack (use exactly this — DESIGN.md §8.1):
- Next.js 16 (App Router) + React 19 + TypeScript (strict). Turbopack (the default).
- Tailwind CSS v4, CSS-first. Tokens live as CSS custom properties. An `@theme inline` block maps them to utilities, so [data-theme] swaps propagate with no JS. No tailwind.config.js.
- three + @react-three/fiber + @react-three/drei (cherry-picked imports only) + postprocessing (pmndrs, used directly — NOT @react-three/postprocessing).
- Animation:
  - GSAP owns time. Only core is in first-load JS: eases register with `gsap.registerEase`, and ScrollTrigger and SplitText load lazily where a part needs them (DESIGN.md v1.6 §8.1).
  - Motion (motion/react) owns presence, layout/FLIP and gestures, via LazyMotion + `m` (domAnimation sync, domMax async).
  - Never both on one property.
- Lenis driven by gsap.ticker: `gsap.ticker.add(t => lenis.raf(t * 1000))` and `gsap.ticker.lagSmoothing(0)`, with lib/scroll.ts's tick right after it (DESIGN.md v1.6 §3.8). NO scrollerProxy — Lenis scrolls the real window.
- zustand for UI state: theme, sound, boot, terminal open, grid overlay, graphics-tier override.
- Fonts: next/font/local with variable woff2 files:
  - Hubot Sans (display): wdth 75–125, wght 500–900.
  - Mona Sans (body): wght 300–700 at wdth 100.
  - JetBrains Mono: wght 400–800.

  Write scripts/fonts (Python fontTools: pyftsubset + varLib.instancer; needs `pip install fonttools brotli`). It fetches the OFL sources from the google/fonts repository (ofl/hubotsans, ofl/monasans, ofl/jetbrainsmono), subsets them to Latin, trims the axes and writes the results to app/fonts/, so normal builds never need the network.

  Fallbacks: metric-adjusted Arial for the two sans. For mono, a hand-tuned "JetBrains Mono Fallback" @font-face (size-adjust, ascent-override) over local Menlo / Consolas / DejaVu Sans Mono.

  Preload display + mono only. Budget: ≤ 165 KB total, ≤ 125 KB preloaded (DESIGN.md §2.5).

Deliver:
1. Structure: app/, components/ (ui/ sections/ stage/ fx/), lib/, hooks/, shaders/, content/, styles/, scripts/.
2. styles/tokens.css, containing ALL of DESIGN.md §2 verbatim:
   - the three theme token tables (§2.3) on [data-theme="phosphor|amber|paper"];
   - the Display-P3 upgrades under @media (color-gamut: p3);
   - the 8-step type scale with line heights, tracking and faces (§2.6), including dark-theme weight compensation;
   - spacing and fluid layout tokens (§2.7), radii (§2.8), and the per-DPR hairline;
   - the easing custom properties (§3.2);
   - the accessibility modes (§2.4): prefers-contrast: more, forced-colors, and print = Paper.

   Add a lint rule that allows only the permitted spacing steps.
3. A contrast unit test that parses tokens.css and recomputes WCAG contrast for every text token against every surface in every theme. It fails below 4.5:1 for text, or 3:1 for --line-2 and --accent-fill, and it must reproduce the DESIGN.md §2.3 numbers.
4. lib/motion.ts, with DESIGN.md §3 verbatim:
   - easing tokens, registered with gsap.registerEase (DESIGN.md v1.6);
   - springs: snap, settle, overshoot, tilt, magnetic, heavy, relayout;
   - follower λ values;
   - duration tiers (in/out);
   - stagger helpers: per char / line / item, distance-ordered, ±15% seeded jitter, 600 ms cap.

   Also add lib/damp.ts and lib/spring.ts: frame-rate-independent followers and an RK4 spring integrator (DESIGN.md v1.2), sub-stepped at 1/240 s and using the SAME constants, so DOM and WebGL motion feel identical. Every animation in the app imports from here.
5. Primitives, each correct in all three themes and in reduced motion:
   - <Text> — steps --step--2 to --step-5, an uppercase micro-label variant, a mono-numeral variant (numbers that change are mono), and the LED material (dot mask, DESIGN.md §2.6) for mono numerals at --step-3 and up.
   - <Button> — magnetic hover (spring magnetic, ≤ 6 px, label parallax 1.5×), mono label, bracket corners, phosphor glow on dark themes only.
   - <Section> — full-bleed, with a data-section id and the section header strip from DESIGN.md §2.9 (with live counts).
   - <Grid> — 12 columns, plus the "G" overlay (accent-wash columns, 8 px baseline, column numbers).
   - <Bracket> — solid = live, dashed = provisional. Draws in on reveal (micro, relay). Also serves as the focus indicator: it snaps to the focused element, plus a 2 px outline.
   - <Marquee> — velocity-reactive (≤ 4×), pauses on hover/focus, static under reduced motion.
   - <Reveal> — RAIL REVEAL (DESIGN.md §3.7): a clip-path wipe with per-line and per-char modes via GSAP SplitText. Never an opacity-only fade. Reveals once and never gates interaction.
   - <Tilt> — the Tier-B one-lamp model (DESIGN.md §4.4): rotateX/Y from the pointer, max 8°, spring tilt. Writes --mx/--my (registered with @property) and the cast-shadow vector. will-change only while interacting.
   - <DataRow> — LABEL ......... VALUE with leader dots.
   - <Chip> — a mono tag, with a toggle variant for filters.
   - <Counter> — counts up at 50% visibility on the scene tier, with digits stepped at 30 fps, in mono. The final value is in the SSR HTML.
6. hooks/: useLenis, useMagnetic, usePointer (normalized + damped), useReducedMotion, useBreakpoint (including the phone policy: coarse pointer and < 768 px), useScrollVelocity, useInViewMount.
7. /dev/kitchen-sink, rendering every primitive in every variant and every theme, with a reduced-motion toggle.

Quality bar: zero TS errors, zero hydration warnings, no layout shift.

Gate: the kitchen sink is correct in all three themes, the contrast test is green, and the font budget is met (report the file sizes).
```

---

## PART 2 — Content layer + bake pipeline

```
Build the content layer so design and data are fully decoupled, plus the skeleton of the build-time bake pipeline. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §1.3 (laws 2 and 7) and §8.2 first.

1. content/schema.ts — strict Zod schemas + inferred types for:
   - profile (name, initials, role, tagline, location, coordinates {lat, lon} for the hero globe, timezone, workingHours {start, end} for the contact overlap, availability, bio short/long, avatar, resume url, socials[], scholarProfiles[{platform: googleScholar|orcid|scopus|researchgate|dblp, url, id}])
   - experience[] (company, role, type, start, end|present, location, blurb, highlights[], metrics[{label,value,unit}], stack[], logo, url)
   - publications[] (slug, title, authors[{name, isMe, affiliation}], venue, venueShort, venueType: journal|conference|workshop|preprint|patent|thesis|chapter, year, month, doi, arxivId, pdfUrl, codeUrl, datasetUrl, abstract, tldr (one plain-language sentence — required), keywords[], citations, citationsAsOf, citationSource, impactFactor, isOpenAccess, isPeerReviewed, status: published|accepted|underReview|inPrep, bibtex, coAuthorIds[], relatedPublicationSlugs[], topicCluster, featured)
   - projects[] (slug, title, subtitle, year, role, category, summary, problem, approach, outcome, metrics[], stack[], links{live,repo,case,paper}, media[{type:image|video,src,alt,poster}], featured, relatedPublicationSlugs[])
   - skills[] (name, category, level 1–5 using the DESIGN.md rubric — L1 USED · L2 BUILT · L3 SHIPPED · L4 LED · L5 TAUGHT/PUBLISHED, years, legend (logo + label for the keycap), primary: boolean (max 6))
   - certificates[] (slug, title, issuer, issuerLogo, issueDate, expiryDate|null, credentialId, verifyUrl, skillsCovered[], domain, level: foundational|associate|professional|expert, proves (one line), featured)
   - achievements[] (title, issuer, date, description, proofUrl, kind: award|honor|speaking|oss|press|grant|patent, metric?)
   - education[], testimonials[], currentFocus[] (building / reading / researching)

   There are no accentColor or issuerColor fields: color is state, not identity (DESIGN.md §2.4).
2. content/data.ts — RICH, REALISTIC placeholder data, clearly marked as placeholder (export IS_PLACEHOLDER = true):
   - 8 projects;
   - 5 roles;
   - 10 publications, with real-looking BibTeX and cross-references, including 1 under review and 1 in prep;
   - 25 skills across 5 categories;
   - 12 certificates across 5 issuers, including 1 expired and 1 without a verifyUrl;
   - 10 achievements;
   - 3 testimonials.
3. content/derive.ts — selectors computed once:
   - totals and citations;
   - h-index and i10 (computed, labelled with their source), first-author count, distinct venues;
   - publications by year, by venue type, and co-author frequency;
   - the publication graph: nodes + edges from shared authors / relatedPublicationSlugs / topicCluster;
   - skill evidence: how many projects use each skill in their stack, and how many papers mention it;
   - certificates by issuer and domain, active vs expired;
   - skills by category;
   - the hero spec strip (years · shipped · papers · citations).
4. Validate at build time and fail loudly on any mismatch.
5. Bake-pipeline skeleton — scripts/ wired into `prebuild` (DESIGN.md §8.2):
   - layout-graph → content/graph.json, with THREE precomputed 3D coordinate sets per node:
     - TOPIC: seeded d3-force-3d, solved here, never at runtime;
     - YEAR: a timeline lattice;
     - VENUE: labeled columns.

     It must be deterministic: same input → same output.
   - citations → refresh counts from OpenAlex by DOI and stamp citationsAsOf. If the API is unreachable, keep the last values and warn; the build must work offline.
   - verify → check every DOI, arXiv id and verifyUrl. A dead DOI fails the build. A dead verifyUrl marks that credential ON FILE instead of VERIFIED, and warns. While IS_PLACEHOLDER is true, citations and verify run in dry mode (no network, no failures).
   - search-index → public/search-index.json for the terminal (≤ 60 KB gz).
   - posters, atlases, og → stubs with TODOs for Part 6 (posters), Parts 7 and 10 (atlases) and Part 15 (og). Fonts were already baked in Part 1.
6. CONTENT_INTAKE.md — a fill-in-the-blank questionnaire with an example per field, and guidance on what makes a strong entry:
   - quantified outcomes over responsibilities;
   - a plain-language TLDR for every paper;
   - credential IDs and verify URLs that actually resolve;
   - the skill rubric, with honest levels;
   - a note that the name's length drives the hero fit and the paper count drives the constellation.
7. /dev/content — the parsed data as a raw audit table, plus the derived metrics and the bake outputs (graph node/edge counts, verify results), so I can proofread everything in one screen.

Every section built later reads from content/data.ts via content/derive.ts. No hardcoded copy in components, ever.
```

---

## PART 3 — The stage governor (architecture spike — before any real scene)

```
Build the rendering architecture before any real 3D scene. Every Tier-A part depends on this. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §4.1, §4.2 and §8.3 first.

1. #stage — ONE persistent R3F <Canvas> in the root layout (built as R3F createRoot on one persistent <canvas> — DESIGN.md v1.4 §4.1). It must survive route changes. WebGL2, frameloop="never", position: fixed, height: 100lvh, behind the DOM, with DPR capped per tier.
2. One RAF for the whole site: gsap.ticker → lenis.raf → the scroll tick (lib/scroll.ts) → governor.update (docking, LIVE scene) → R3F advance(). Throttle HUD text writes to 10 Hz and FPS to 2 Hz. No other requestAnimationFrame loops anywhere.
3. lib/sceneManager.ts — the governor:
   - A registry of five scene ids (system, log, archive, work, capabilities), each a lazily imported chunk.
   - States: COLD → PRIMED → WARM → LIVE → COOLING (2 s grace) → COLD.
   - Invariants:
     - at most 1 LIVE scene;
     - at most 2 scenes resident in VRAM — a COOLING scene is disposed early if a WARM one needs the slot;
     - WARM = assets uploaded + renderer.compileAsync, with zero draw calls;
     - COLD = fully disposed (renderer.info.memory back to baseline).
   - Render policy:
     - offscreen → 0 draw calls;
     - hidden tab → loop stopped;
     - 2 s without input or camera motion → 30 fps;
     - nothing animating → render on demand.
   - Warm-ahead: the next scene starts warming when the current stage's document begins. Chunks prefetch on idle after boot (HIGH/MID).
4. <StageSlot id> — the DOM placeholder each Tier-A section renders.
   - Docking (DESIGN.md v1.5 §4.2): the one canvas is re-parented into the LIVE slot's dock and held by position: sticky; the slot clips it with overflow: clip. The DOM moves only when the docked slot changes; between slots it parks in #stage.
   - Never call getBoundingClientRect inside the loop; recache offsets on resize and refresh.
   - Slots shorter than the viewport are clipped by the slot itself.
   - Nothing about docking runs per frame.
5. The interlock: a dev assertion that warns whenever two stage slots are separated by less than 100 svh of DOM-only content at the current viewport.
6. #fx-gl — the transition layer: a second, raw WebGL2 context (about 4 KB, no three.js), fixed above the DOM, pointer-events: none, idle unless a transition runs.
   - Implement the freeze handshake now: while #fx-gl draws, the stage stops drawing (it keeps showing its last frame) and resumes after.
   - Exactly one context draws in any frame. Prove it with a simple test wipe.
7. lib/tier.ts — HIGH / MID / LOW / OFF, exactly as in the DESIGN.md §4.2 table:
   - Hard rules: WebGL2 required, Save-Data, deviceMemory, and the phone policy (phones are LOW and run Hero + Projects only).
   - Probe: 45 frames of a representative placeholder load. p90 > 9 ms demotes HIGH → MID; p90 > 14 ms demotes MID → LOW.
   - Refresh rate: measured as the median of 60 rAF intervals.
   - drei PerformanceMonitor steps DPR by 0.25 (floor 1.0) after 30 bad frames, and back up after 120 good frames.
   - The GFX AUTO/LOW override from zustand.
8. Posters and gap protection: while a slot's scene isn't LIVE, the slot shows its poster. For now that's a placeholder 1-bit PNG, colorized by a CSS mask so one file serves all themes. If the user outruns warm-up, the poster stays until the scene is ready, then crossfades. (Part 4 replaces the crossfade with DITHER RESOLVE.)
9. Context loss: webglcontextlost → posters everywhere; webglcontextrestored → re-warm the current slot. Under reduced motion or tier OFF, no WebGL context is ever created.
10. Test harness: five placeholder scenes (each with distinct, simple instanced geometry) in five real slots on /dev/stage, with interlock spacers. Plus /dev/stage/[slug], to prove a mesh keeps animating across a route change (the future PROJECTION transition depends on it).
11. Dev overlay (?debug=1), showing:
    - contexts alive and per-scene state;
    - draw calls, triangles/points, and geometries/textures in memory;
    - a VRAM estimate;
    - FPS and frame time p50/p95;
    - tier, DPR and measured refresh rate.

Gate A — report with numbers. Test on an M1 and a mid-range Android (or Chrome with 4× CPU throttle + mobile emulation if no device is available). The invariants must hold while:
- scrolling fast in both directions;
- jumping via anchors;
- navigating between routes;
- forcing context loss with WEBGL_lose_context.

Pass means: never more than two contexts, never two drawing in one frame, and offscreen scenes at zero draw calls.
```

---

## PART 4 — Scroll engine + signature transitions

```
Build the scroll choreography and the transition grammar that make the site feel like one continuous machine. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §3.6–§3.9 and §7.2 first.

1. lib/scroll.ts — the single Lenis orchestration layer, running on the RAF from Part 3. It tracks sections and pins itself from geometry measured on refresh (DESIGN.md v1.6 §3.8); ScrollTrigger is lazy, for a later part that wants a scrubbed timeline.
   - Lenis per DESIGN.md §3.8: lerp 0.1, native touch, data-lenis-prevent for nested scrollers.
   - Sections register declaratively (id, pin?, scrub?, enter/leave callbacks). No scattered ScrollTrigger calls in components.
   - Handles resize, route-change cleanup, and refresh after fonts and images load.
2. The three signature transitions, exactly as DESIGN.md §3.6 specifies (timelines, cut points, variants, sound hooks, reduced-motion fallbacks, photosensitivity limits). POWER CYCLE and TRACKING TEAR render in #fx-gl using the freeze handshake from Part 3.
   - POWER CYCLE — ON 600 ms / OFF 450 ms. Includes the theme-switch variant (OFF-fast → swap → ON-fast, inside a View Transition where supported) and the Paper SCAN variant.
   - TRACKING TEAR — 450 ms, cut at 180 ms. The scroll teleport, route swap and stage swap happen under cover. Includes head-switching noise, the Bayer flood, and the Paper MISFEED variant.

     Use it ONLY for discontinuous jumps: nav clicks, rail clicks, terminal goto/open, route changes with no shared element, and back/forward.
   - DITHER RESOLVE —
     - element tier: 4×4 Bayer, steps(16), 400 ms;
     - scene tier: 8×8 Bayer, steps(32), 900 ms;
     - threshold field: 0.7·bayer + 0.3·radial(origin).

     It runs in-shader for stages. For DOM images, build a CSS mask-sprite version as a <DitherImage> primitive that every raster image in the site will use. Includes the Paper HALFTONE variant. It replaces Part 3's poster crossfade.
3. Standard motion utilities (DESIGN.md §3.7): RAIL REVEAL (already in <Reveal>), SCRAMBLE (≤ 40 chars, once), TYPEWRITER (one-liners only), H-HOLD (wdth jump on the tear's cut, then spring back), SLIDE ADVANCE (push + dither resolve).
4. Scroll-velocity reactivity, used sparingly:
   - marquee speed;
   - velocity skew ≤ 3° (damped, λ 6) on media frames and marquees only — never on text;
   - a velocity signal the hero can read for turbulence.
5. Section-change side effects on continuous scroll:
   - update the HUD readout;
   - glitch ONLY the HUD's section label (no full-screen effect);
   - play the SECTION relay click if sound is on (≥ 1.2 s apart);
   - update the progress rail;
   - push a shallow URL hash so sections are linkable.
6. <StickyStack> — pinned sections whose inner content advances in discrete steps on scrub.
   - Soft detents: when velocity is < 0.2 px/ms and the scroll is within 8% of a node, ease to the node. Never fight live input.
   - Pins: hero 100 svh, LOG ≤ 200 svh, ARCHIVE ≤ 150 svh. Nothing else pins.
   - Pins are native (DESIGN.md v1.5 §3.8): a sticky block in a track sized in CSS; lib/scroll.ts reads their progress (v1.6).
7. Stub all ten sections at their real heights, with stage slots and posters, so the interlock assertion from Part 3 passes at 1440×900, 1920×1080 and 390×844 (report it).

Hard constraints:
- Never trap the user. The native scroll position stays truthful.
- PageUp / PageDown / Space / Home / End, arrows and anchor links all work, and scroll position restores on back.
- Under prefers-reduced-motion: Lenis off, no scrub, pins become stacked static frames, and transitions become the DESIGN.md crossfades.
```

---

## PART 5 — Boot sequence + global chrome (first wow beat)

```
Build the entry experience and the persistent chrome. This is the first 4 seconds and it decides everything. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §5, §6, §7.3 and the POST entry in §7.4 first.

1. <BootSequence> — a real preloader, not a fake timer.
   - Progress: aggregate real tasks and real bytes through a task registry. Fonts (document.fonts), the stage runtime chunk and the data are registered now. The hero's morph-target worker and its textures register themselves in Part 6.
   - When it runs: ONLY on the first visit to "/" in a session (sessionStorage). Deep links (/work/*, /research/*, any #hash) skip it and get POWER ON-fast (360 ms) over already-painted content.
   - P1 (0–250 ms): black, with a block caret blinking 530/530. The hum fades in only if the sound preference is already ON.
   - P2: log lines print WHOLE as their real task resolves, ≥ 40 ms apart.
     - Every line is true: logical cores, the GPU renderer string (or "MASKED BY BROWSER"), viewport @ DPR, the measured refresh rate, the graphics tier + particle count, fonts loaded, data counts, reduced-motion/contrast preferences, and sound state.
     - Only the owner banner (name — role) types, at 45 chars/sec.
     - The percentage and byte counter are real.
   - P3: POWER CYCLE ON at 100% or at 1.6 s, whichever comes first.
   - Hard cap: the hero is visible by 2.2 s even on slow networks; the hero streams in progressively. The cap is CSS on the compositor, so it holds with no script and with a stalled one (DESIGN.md v1.6 §7.4).
   - "SKIP [ESC]" works from frame one, and a click or tap anywhere also skips.
   - LCP: the hero <h1> is server-rendered and painted beneath the boot overlay, so LCP fires at first paint. The per-character name reveal starts on the exact frame the beam opens.
   - Reduced motion: a tasteful crossfade, no flash.
2. <Chrome> — the persistent HUD (DESIGN.md §7.3):
   - Fixed viewport corner brackets and hairline rules.
   - Top-left readout: RETROGRADE/OS · section number + codename · scroll % · my local time with zone. FPS shows only in debug.
   - Right-edge section rail: nine clickable nodes with current / visited / unvisited states and labels on hover and focus. Clicks use TRACKING TEAR.
   - <Nav>: WORK · RESEARCH · CREDENTIALS · CONTACT · ~ in mono labels, with magnetic hover and one shared active indicator: a single bar on `settle` springs (DESIGN.md v1.6 §7.3; Motion's layout bundle doesn't fit first-load).
   - Front panel (bottom-left), styled as hardware switches with LEDs:
     - TUBE P1 · P3 · PPR — the theme switch, using POWER CYCLE (SCAN for Paper). The Konami degauss is NOT used here.
     - SND OFF/ON, with a 4-LED VU meter driven by a real AnalyserNode.
     - GRID (also the "G" key).
     - GFX AUTO/LOW.
   - scroll-padding equal to the HUD height, so focused elements are never hidden (WCAG 2.4.11).
3. <Cursor>:
   - A 10 px hollow-square reticle with an UNLAGGED 2 px center dot (the hotspot), and a ring that trails at λ 24.
   - It snaps to interactive elements as four brackets.
   - Over media it grows a label chip (VIEW / DRAG / FLIP / OPEN, λ 12).
   - Drawn with mix-blend-mode: difference.
   - Hidden on coarse pointers, in forced-colors mode, and inside text fields (native I-beam there).
4. #fx-css — the global CSS overlay, at the DESIGN.md §5.2 intensities:
   - Film grain: a 24 fps stepped transform jitter, white speckle on dark themes and toner on Paper.
   - Scanlines: α 0.07 on dark themes, none on Paper. The pitch is snapped to device pixels via --scan-pitch, which JS writes at boot and on resolution change.
   - The refresh roll: dark themes only, HIGH/MID tiers.

   All of it is off under prefers-contrast: more and forced-colors, and static under reduced motion.
5. lib/audio.ts — the sound engine from DESIGN.md §6:
   - Web Audio, muted by default; the AudioContext is created on first enable, never before a user gesture (DESIGN.md v1.6 §6.2).
   - The master chain, a voice cap, per-cue rate limits and ±pitch randomization.
   - Samples are fetched only after enable. The preference persists, and audio is suspended when the tab is hidden.
   - Implement the ENABLE, BOOT, POWER, TEAR, SECTION and COMMIT cues now, and register the remaining cues as named stubs for later parts.

Everything respects prefers-reduced-motion. Nothing blocks first paint.

Gate B — report:
- Lighthouse mobile LCP ≤ 1.8 s with the boot in place.
- The skip, never-replay and deep-link rules verified.
- The hard cap verified on a throttled network.
```

---

## PART 6 — Hero: Tier-A scene A1

```
Build the hero — the single most important screen. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §4.3 (A1), §5 and the SYSTEM entry in §7.4 first. The scene mounts through the governor from Part 3 and has no render-loop logic of its own.

Centerpiece — a GPU particle system (one Points draw, custom GLSL in shaders/, additive HDR phosphor) that morphs through four TRUE states:
  1. INITIALS.
  2. CONSTELLATION — the real content/graph.json.
  3. GLOBE — a live day/night terminator for the current UTC time, with my city (profile.coordinates) lit and synced to the HUD's local time. Uses a land mask of ≤ 4 KB.
  4. GRID LATTICE — the site's own 12-column/baseline grid, computed in screen space from the live layout tokens. It lands as the About layout while the "G" overlay flashes once.

Behavior:
- Morph targets are generated in a Web Worker during boot (OffscreenCanvas for the initials) and uploaded as normalized Int16 attributes (6 B per particle per target). No position data is downloaded.
- Transitions scatter and reassemble on curl noise, with per-particle random offsets and delays — never a mechanical lerp. On HIGH, persistence trails make the motion read as phosphor.
- Scroll owns the morph: the hero pins for 100 svh, with checkpoints at 0, ⅓, ⅔ and 1. A click scrolls (Lenis) to the next checkpoint, so there's one source of truth.
- Pointer: camera parallax of ±3° yaw / ±2° pitch (λ 4), and particles repel from a cursor force field (radius 12% of viewport height, λ 10). Scroll velocity adds turbulence.
- Post-processing: postprocessing used directly — one EffectPass with Bloom + a custom RetroEffect — at the DESIGN.md §5.2 intensities:
  - bloom threshold 1.0 in linear HDR;
  - persistence 0.84 (0.88 in Amber), HIGH only;
  - radial CA of 0.6 px at the corners, HIGH only;
  - stage vignette;
  - AgX tone mapping;
  - ±1 LSB blue-noise output dither.

  In Paper: ink stipple with multiply blending, no bloom, no persistence (DESIGN.md §5.4).
- Tiers come from lib/tier.ts:
  - 250k / 90k / 35k particles, with DPR caps of 1.75 / 1.5 / 1.25.
  - On phones the stage runtime loads after LCP + idle: the hero shows its 1-bit poster first, then DITHER-RESOLVEs to live.
  - Under reduced motion or tier OFF: the poster only, no WebGL.
- Posters: implement scripts/posters for real. It captures each registered scene headlessly (Playwright) at its canonical state and ordered-dithers the frame into a 1-bit PNG. Register the hero; later parts register theirs.

Typography layer, in true HTML (selectable and crawlable), on top of the canvas:
- My name at --step-5, fitted to 12 columns by solving the wdth axis (75–125) at a fixed size. It wraps to two lines only below wdth 75. Each character rises on spring overshoot with a 28 ms stagger — on first boot only; later loads render it settled.
- Role + tagline in mono, with a one-time SCRAMBLE (≤ 40 chars).
- A mono micro-block: location, live local time, and availability with a pulsing accent dot.
- The spec strip in tabular mono: YEARS · SHIPPED · PAPERS · CITATIONS, each a <Counter> fed from derive.ts.
- CTAs: primary "VIEW WORK →", secondary "READ RESEARCH →", tertiary "RESUME ↗".
- A scroll hint that fades after the first scroll. After 25 s idle, once ever: "PRESS ~ FOR TERMINAL".

I want this to look expensive. Iterate on the shader until the motion reads as organic, not linear.

Gate C — report numbers on the reference devices at every tier: GPU ms, draw calls, VRAM, FPS, LCP/TBT. This scene is the performance template for the other four.
```

---

## PART 7 — About + Experience (Tier-A scene A2)

```
Build the About and Experience sections. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §4.3 (A2), §2.11, and the IDENTITY and LOG entries in §7.4 first.

ABOUT — "IDENTITY". It's a quiet beat, and it's also the interlock between the Hero and Experience stages.
- An asymmetric 5/7 grid: portrait in columns 1–5, bio in columns 7–12.
- The portrait is Canvas2D, NOT WebGL — the only canvas outside the two contexts.
  - A dot-matrix ordered dither at 180 × 225 cells over the real photo.
  - The cursor is an exposure lamp (radius 18% of the portrait) writing an exposure buffer that decays with τ = 600 ms. The photo develops where you shine it, then fades back like phosphor.
  - Touch: press and hold. Reduced motion: a static half exposure.
  - It only computes while you interact or while the exposure decays.
- The bio uses RAIL REVEAL per line, with at most three accent key phrases per paragraph.
- A spec sheet of <DataRow>s: ROLE, EXPERIENCE, LOCATION, TIMEZONE, STACK, H-INDEX, EDUCATION, AVAILABILITY.
- A "CURRENTLY" block (BUILDING / READING / RESEARCHING): a one-line typewriter swap every 6 s, paused on hover and focus. All three items are present statically for screen readers.

EXPERIENCE — "LOG":
- The stage, pinned ≤ 200 svh: the camera scrubs along a Catmull-Rom rail through a deck of punch cards (80-column proportions, 7⅜ × 3¼ in, with the corner cut). It banks ±6° on curves, and fog swallows both ends.
- Each card's holes are a REAL Hollerith encoding of the company and years printed along its top edge. A backlight behind the deck shines through the holes and projects their pattern onto the next card (a cheap additive shaft batch plus a projected mask).
- Hover: the card flexes (vertex bend) and its backlight brightens. No RGB split.
- One InstancedMesh and one material for all cards. Card faces come from an atlas baked at build time by scripts/atlases (lossless WebP ≤ 300 KB).
- The active card is mirrored into a crisp HTML panel — company, role, dates, blurb, three quantified highlights, stack chips — real, selectable and accessible. The 3D is the stage; HTML is the content.
- A left-edge year scale scrubs with the camera and snaps to each role. Clicking a year flies the camera there on spring heavy.
- Document (the interlock after the stage): PRINTOUT — continuous-feed tractor paper rolling out of the machine.
  - It carries the condensed log and education, dot-matrix printed (mono under the dot mask).
  - Perforations every 11 in.
  - Ends with RESUME ↗.
- Paper theme: the cards sit on a light table, and the light shows through the holes.
- Phone edition (no 3D): a CSS punch-card feed. Cards rise through a sticky stack as you scroll, with a sticky year badge and the same HTML content.
- Register this scene's canonical poster with scripts/posters.
- Keep the About layout's hooks for the hero: data-lattice="block" on the portrait and data-lattice="lines" on the bio paragraphs. The hero's GRID LATTICE lands on them (Part 6).
- Build the stage on the hero's template (DESIGN.md §4.3 A1, "As built"): prime() + the component in components/stage/scenes/, a field class outside React driven by the LIVE frame callback, the post chain from useStagePost() (never a chain of its own), constants in lib/<scene>.ts. Report Gate C's table for it (scripts/hero-gate.mjs is the pattern).

Read all content from content/data.ts. Hold DESIGN.md's A2 budget: ≤ 4 geometry draws, ≤ 4 ms GPU.
```

---

## PART 8 — Research & Publications (Tier-A scene A3) ★

```
Build the Research & Publications section — "ARCHIVE". It has to make a hiring manager or a PhD committee stop scrolling. Treat it with the same craft as Projects, not as a CV appendix. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §2.4, §4.3 (A3) and the ARCHIVE entry in §7.4 first.

This part needs my real publication data in content/data.ts. If it's still placeholder, say so before tuning. (Since Part 7 the content is real, from the résumés: two SCI-2026 papers, with no DOIs, abstracts or co-authors yet — each gap is marked TODO(akshat). Ask for them before tuning; the hero's CONSTELLATION is these same two papers.)

Framing: a retro library / microfiche terminal that happens to render in real-time 3D. The header is an ARCHIVE QUERY bar with a live record count, total citations, the year range, the layout chips, and the shape legend (always visible).

PART A — THE CITATION CONSTELLATION (the 3D moment):
- A monochrome star chart. NO categorical colors — a 7-hue palette failed the CVD validator (DESIGN.md §2.4). The encoding:
  - SHAPE = venueType, as 7 SDF glyphs drawn in the fragment shader: ◆ journal, ● conference, ▲ workshop, ✱ preprint, ■ patent, ⬢ thesis, ✚ chapter;
  - SIZE = citations;
  - POSITION = the active layout;
  - ACCENT = focus;
  - HOT = the record whose dossier is open;
  - a DASHED OUTLINE of the same shape = under review / in prep.

  Nodes get a subtle pulse and a phosphor glow.
- Edges (shared co-authors, relatedPublicationSlugs, shared topicCluster) are thin lines that draw in like a pen plotter, staggered by distance from the camera.
- No runtime force simulation: positions come from content/graph.json (Part 2). Use one InstancedMesh for all nodes, one merged LineSegments for all edges, and zero per-node materials. At runtime the graph only drifts slowly and responds to input.
- Layout chips — TOPIC (organic clusters) / YEAR (timeline lattice) / VENUE (labeled columns). Each re-plot springs every node between precomputed coordinate sets on spring relayout, with mass = 1 + normalized citations and damping = 14·√m. Heavier papers move slower and settle last, without bouncing more. This is the signature delight of the section.
- Scroll flies the camera on a RETROGRADE LOOP: a prograde arc, a loop back, then prograde again, passing the densest cluster twice. The nearest node auto-focuses as you pass, like tuning a dial. The ARCHIVE sound cue sets pitch by year (pentatonic) and length by citations.
- Hover a node: it scales, its edges and direct neighbours brighten, everything else recedes into fog, and one HTML mono tooltip shows title / venue / year / citations.
- Click a node: the camera dollies to it (spring heavy) and the dossier opens.
- Cluster names are HTML labels positioned by projection, not 3D text.
- Register the build-time SVG constellation poster with scripts/posters, generated straight from graph.json.
- The stage's post chain has no depth buffer (DESIGN.md §4.3 A2, v1.8): additive light needs none, and LOG paints its deck far to near. Points and edges can stay additive; anything that crosses needs a depth option added to StagePost. (As built, v1.9: ARCHIVE blends with MAX on the dark tubes and MIN on Paper — additive light whited out at the budget's caps — so it needs no depth buffer either.)
- Build the stage on the hero's template (DESIGN.md §4.3 A1, "As built"), as Part 7 does, and report Gate C's table for it.

PART B — THE DOSSIER (where the content lives):
- An intercepted route, /research/[slug] (parallel + intercepting routes).
  - Navigated from home, it opens as a native <dialog> over the constellation.
  - Visited directly, it's a full page.
  - The URL is shareable either way.
- A microfiche frame (rotateX 8° → 0, plus a scan-bar reveal) with a reversed-type header strip: ARCHIVE ID · YEAR · VENUE · TITLE….
- The title at --step-3, in sentence case.
- The full author list: MY NAME in accent at weight 600, co-authors in --fg-2 mono.
- Venue + year + venueType badge, plus peer-reviewed and open-access badges.
- The plain-language TLDR directly under the title, as a quoted callout at --step-2. It's the second read, and it's what non-specialists will actually read.
- The abstract, with a per-line reveal (NOT a scramble), collapsible after 4 lines.
- Keyword chips that filter the constellation when clicked.
- A metrics row: citations (count-up, with source and as-of date), impact factor, year.
- Actions: DOI ↗, PDF ↗, ARXIV ↗, CODE ↗, DATASET ↗, and COPY BIBTEX with a mono "COPIED ✓" toast.
- BUILT FROM THIS: projects whose relatedPublicationSlugs include this paper — reciprocal with the case studies in Part 9.
- Under-review / in-prep records get dashed brackets and a "STATUS: UNDER REVIEW" stamp in --warn. Honest, and it signals momentum.
- Prev/next record with SLIDE ADVANCE. The open node stays visually linked (hot) in the graph.

PART C — THE LEDGER (scannable, crawlable, recruiter-friendly):
- A real <table> of ALL publications, grouped by year with sticky year headers: [YEAR] [VENUE-SHORT] Title — authors — citations.
  - Sortable by year / citations / venue (aria-sort).
  - Green-bar banding (--bg-band).
  - Hovering a row lights its node above; clicking opens the dossier.
- Metrics: ONE hero figure — CITATIONS, in LED numerals — plus tiles: PUBLICATIONS · H-INDEX · I10 · FIRST-AUTHOR · VENUES. Every figure shows its provenance ("OPENALEX · AS OF {date}"), and the section links to my Google Scholar and ORCID profiles for the canonical numbers.
- PUBLICATIONS BY YEAR, as a unit chart in plain SVG (no chart library):
  - one cell per paper, and every cell is a link to its dossier;
  - --accent-fill cells with a 2 px surface gap; under-review cells are hollow;
  - a hairline baseline and tabular mono year ticks, with only the peak year and the current year labeled;
  - a hover/focus tooltip per cell;
  - the ledger is its table view, and as a single series it needs no legend.

Phone and reduced-motion editions (no graph):
- The build-time SVG constellation as the section header. Its edges plot in on view, or stay static under reduced motion.
- The ledger as record cards with a scan-line reveal.
- The dossier as a full-screen sheet.

It must feel designed, not stripped.

Accessibility: the constellation is augmentative. Every publication is reachable through the ledger with real headings and links. Nodes are keyboard-navigable, with visible focus and aria-labels.

Budget (DESIGN.md A3): 2 geometry draws, no textures, ≤ 3 ms GPU.
```

---

## PART 9 — Projects: the showcase (Tier-A scene A4)

```
Build the Projects showcase. This is what gets me hired, so it gets the most craft. (The five projects in content/data.ts come from the résumés; their years, roles, links and screenshots are TODO(akshat). The slides need real covers: ask for them first.) Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §4.3 (A4), §4.4 (B4) and the WORK entry in §7.4 first.

INDEX — the slide carousel:
- Featured projects (≤ 8) as 35 mm slides in mounts on a gently concave arc.
  - Drag with inertia via pointer, touch, horizontal wheel / Shift+wheel and arrow keys.
  - The vertical wheel ALWAYS scrolls the page; the gallery never hijacks it.
- Each mount, drawn in-shader: mono index (01/08), title, year, category.
- Slides rest as a dither duotone. The slide that lands in the gate PROJECTS: it DITHER-RESOLVEs to full color under lamp falloff, with dust specks and a hint of lens barrel, and plays the GATE clunk.
- Fast flings smear as phosphor persistence (plus subtle radial CA ≤ 4 px on HIGH), settling on a spring. No RGB-split trope. The FLING whir is mapped to speed.
- One InstancedMesh sampling a DataArrayTexture of covers — one draw call. Covers are AVIF ≤ 120 KB each, decoded off-thread with createImageBitmap, at 1024×683 / 768×512 / 640×427 per tier.
- Paper theme: slides on a lightbox; the gate is a loupe.
- Register this scene's canonical poster with scripts/posters.
- Build the stage on the hero's template (DESIGN.md §4.3 A1, "As built"), as Part 7 does, and report Gate C's table for it.
- Document (the interlock): INDEX — every project in a dense table (# · TITLE · ROLE · YEAR · STACK · →).
  - Hovering a row shows its cover in a floating preview that follows the cursor (λ 9), with rotateZ from velocity (±4°).
  - Filters by category/stack as mono chips, with Motion layout FLIP.

DETAIL — a case study per project (/work/[slug]):
- The PROJECTION transition (continuity — the stage survives the route change, from Part 3): the clicked slide flies to fill the viewport, the route swaps underneath, the DOM hero image decodes, then the stage lets go. It must reverse on back-navigation.
- A structure that sells:
  1. Context
  2. Problem
  3. My role
  4. Approach — decisions and tradeoffs
  5. Outcome — one LED hero figure + metric tiles
  6. Stack
  7. Links

  Media is lazy-loaded with <DitherImage> / next/image. Videos autoplay muted and inline, only while in view, with a poster.
- PUBLISHED RESEARCH: if the project has relatedPublicationSlugs, show mini-dossier cards linking to /research/[slug] — and link back here from each dossier. The cross-linking between research and built work is what makes me look rare; make it visible. (Part 8 built the other half: a dossier's BUILT FROM THIS links to /work/[slug], hidden until a project lists the paper; none does yet — ask which projects were built from which paper. The dossier intercept sits at the root (DESIGN.md v1.9, §10 #33), so a mini-dossier's link opens the record over the case study, and closing it returns there. Mark such links data-transition="dossier": a record opening over the page is no route change, so it gets no TRACKING TEAR.)
- First-load JS on / is 227.9 KB gz of the 230 KB budget after Part 8 (DESIGN.md §8.3): 2.1 KB remain. The carousel's code must be lazy; the governor's state machine (≈ 4 KB gz) is the lever still unspent.
- Prev/next with SLIDE ADVANCE.
- Full SSG via generateStaticParams, with per-project metadata and OG images (finalized in Part 15).

Accessibility and SEO are not optional:
- The carousel is fully keyboard-navigable, with visible focus.
- Every project is reachable and crawlable as real HTML with semantic headings.
- All media has alt text.
- A recruiter with JS disabled still sees the work.

Reduced motion / tier OFF: a CSS curved carousel and a DOM FLIP into the case study.
```

---

## PART 10 — Skills (Tier-A scene A5)

```
Build the Skills section — "CAPABILITIES". (The skills' rubric levels and years in content/data.ts are provisional, read from the résumé alone — confirm them before the keycaps show them.) Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §4.3 (A5) and the CAPABILITIES entry in §7.4 first.

- Before the stage (part of the interlock): the header and a PRIMARY STACK strip — the six primary technologies at --step-4.
- The stage, an 80 svh band: every skill is a sculpted keycap with its legend (logo + name), in a loose cloud.
  - One InstancedMesh for the caps, one legend atlas baked by scripts/atlases (≤ 90 KB), one matcap per theme (≤ 12 KB), and an instanced blob shadow.
  - Primary-stack skills are accent-colored keys.
  - Phosphor/Amber: charcoal caps with backlit emissive legends (they bloom).
  - Paper: beige caps with dye-sublimated legends under a daylight matcap.
  - Register this scene's canonical poster with scripts/posters.
  - Build the stage on the hero's template (DESIGN.md §4.3 A1, "As built"), as Part 7 does, and report Gate C's table for it.
- Physics: a custom micro-sim (~5 KB) — NOT Rapier, which is 1.65 MB gz as @react-three/rapier ships it (DESIGN.md A5).
  - Sphere proxies, bounding walls, anchor springs to each category's home, a grab spring for drag-and-throw, and a legend-up orientation spring so labels stay readable.
  - Fixed step of 1/120 s, sleeping when settled and when offscreen.
  - ≤ 0.3 ms/frame.
- Interaction:
  - Hover: the key lifts toward the camera, the rest dim, and a mono tooltip shows name / years / level label.
  - Click: the key presses down with a KEYCAP clack, and its row lights up in the panel.
  - Clicking a category label magnetically re-clusters the pile.
- Type-to-press: while the stage has focus, typing a skill's name presses its keycap and highlights it. Global single-key shortcuts like G and ~ are suspended while it's focused; Esc releases focus.
- The HTML companion panel is canonical, not a fallback, and always visible. Categories are columns, and each skill is a <DataRow> with:
  - years;
  - a 5-segment meter (--accent-fill on an --accent-wash track), labeled by the rubric: L1 USED · L2 BUILT · L3 SHIPPED · L4 LED · L5 TAUGHT/PUBLISHED;
  - derived evidence, e.g. "IN 4 PROJECTS · 2 PAPERS".

  No self-rated percentage bars.
- Tiers:
  - HIGH runs the micro-sim.
  - MID floats the keys on a sine with hover and press (no physics).
  - LOW and phones get a CSS keycap grid (tap to press) plus the panel.
- First-load JS on / is 229.3 KB gz of the 230 KB budget after Part 9 (DESIGN.md §8.3): 0.7 KB remain. The keycaps' page code (the panel's behavior, the tooltip, the CSS grid's press) must be lazy, as WORK's INDEX is; the governor's state machine (≈ 4 KB gz) is the lever still unspent, and this part will likely need it.
- A module worker must not import the module that spawns it: that hung the production build with no error (Part 9).
```

---

## PART 11 — Certificates & Records (Tier B) ★

```
Build the Certificates & Records section — "CREDENTIALS". (The résumés list no certificates — content/data.ts has none, only three records — so ask for them, with their verify URLs, first.) Impressive 3D with ZERO WebGL: the proof that Tier B can look as expensive as Tier A, and protection for the performance budget right before Contact. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §4.4 and the CREDENTIALS entry in §7.4 first. This part has no WebGL dependency, so it can run any time after Part 4.

PART A — THE HOLOGRAPHIC CREDENTIAL WALL:
- Certificates as ISO/IEC 7810 ID-1 cards in a wall: 85.60 × 53.98 mm proportions, corner radius --r-card. They're real DOM elements, with perspective + rotateX/Y on spring tilt from the one-lamp model (--mx/--my).
- Card anatomy, bottom → top:
  1. base stock;
  2. a guilloche engraving as inline SVG, generated from a seed of credentialId (unique per card, deterministic);
  3. an embossed issuer seal, shaded along the lamp vector;
  4. FOIL ZONES — the seal and a stripe ONLY, never under text;
  5. title, issuer logo, a mono serial from credentialId, level badge, issue date;
  6. a perforated edge;
  7. the stamp.
- THE FOIL, pure CSS, inside the foil zones:
  - a repeating-linear-gradient rainbow sheen (color-dodge, 0.55);
  - a conic-gradient iridescence (soft-light, 0.5);
  - a radial specular glare at the cursor (overlay, opacity = tilt magnitude);
  - all of it masked by a diffraction-noise tile, so it has grain like a real grating.

  Drive hue shifts with background-position — never animate filter: hue-rotate. At most 2 cards have live foil at once; the rest show a static resting foil. Tune it until it looks like holding a holographic seal, not like a CSS demo. In the Paper theme it becomes silver foil stamping.
- Stamps tell the truth:
  - VERIFIED (hot ink, scale overshoot + 4° rotation + the STAMP thud) appears only when the build-time verify step resolved the verifyUrl. Otherwise the stamp reads ON FILE.
  - Expired certificates get a static desaturation and an EXPIRED stamp in --fg-3 ink. Honesty reads as confidence.
- Click / Enter FLIPS the card (rotateY 180°, backface-visibility hidden); Escape unflips it. The back shows:
  - credential ID, issue/expiry dates;
  - skills covered as chips;
  - the "what this proves" line;
  - VERIFY ↗ (opens in a new tab);
  - an MRZ-style line encoding ID, issuer and dates, with real ICAO 9303 check digits (7-3-1 weighting).
- Filters as mono chips by issuer / domain / level, with Motion layout FLIP. A readout from derive.ts: "12 CREDENTIALS / 5 ISSUERS / 11 ACTIVE".
- Reveal: cards deal in from the bottom-right in an arc (40 ms stagger, −12° → 0 on spring overshoot), with stamps synced to the deal.
- Phones: a "TILT TO INSPECT" chip requests device-orientation permission (iOS) on tap, then drives --mx/--my from the gyro, so the foil catches real light as the phone tilts. Never request automatically. Tap to flip.

PART B — RECORDS (awards, talks, OSS, press, proof):
- One hero figure (LED numerals) plus three metric tiles with mono captions — not four equal giants.
- Achievement cards in a staggered masonry: bracket corners, a kind glyph (AWARD / HONOR / TALK / OSS / PRESS / GRANT / PATENT), issuer, date and proof link, with <Tilt> at max 6°.
- A press/logo marquee that reacts to scroll velocity and pauses on hover/focus.
- Testimonials as a mono "transmission": the name/role scrambles in (≤ 40 chars) and the quotes reveal per line.

Handle every state: empty, 1 item, 40 items, missing expiry, missing logo, very long titles, no testimonials.

Reduced motion: no tilt, foil frozen at (0.62, 0.38), instant flips.

Keyboard: cards are focusable, Enter flips, Escape unflips, focus is visible.

Budget and build:
- First-load JS on / is 229.5 KB gz of the 230 KB budget after Part 10 (DESIGN.md §8.3): 0.5 KB remain. The wall is DOM, so all of it is page code. The cards and the records are server HTML; their behavior (tilt, flip, the filters, the gyro chip, the marquee) must be lazy, loaded on idle as WORK's INDEX and the keycaps' panel are. The filters' FLIP is hand-rolled, as the INDEX's is (DESIGN.md §10 #37): Motion's layout features don't fit. The governor's state machine (≈ 4 KB gz) is the lever still unspent; this part will need it.
- HTML on / is 35.8 KB gz of the 60 KB budget after Part 10; the cards' inline SVG (each guilloche, each seal) counts against it.
- A lazy chunk carries every module it imports whole: Part 10's three chunks each carried all of lib/capabilities.ts until its layout moved out. Keep what only one chunk needs in its own module.
```

---

## PART 12 — Contact + footer

```
Build the contact section and the footer — the conversion moment. Make it impossible to leave without a way to reach me. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read the CONNECT and HALT entries in DESIGN.md §7.4 first.

CONTACT — "CONNECT" (quiet, plus one loud beat):
- The invitation "SEND A SIGNAL" at --step-5, with a per-character reveal — the only per-char reveal after the hero.
- My email as a giant mailto: link, with a copy-to-clipboard affordance that confirms with a mono "COPIED ✓" toast.
- A working form styled as a teletype:
  - Prompts NAME> EMAIL> INTENT> MESSAGE> with a block caret. Intent is a select: hire / collaborate / research / speak / other.
  - Zod + react-hook-form, with inline mono errors announced via aria-live.
  - Spam protection: a honeypot, a 2.5 s minimum time-to-submit, and server-side rate limiting (Upstash Ratelimit, 3 per 10 minutes per IP).
  - A real send via Resend. On failure, fall back to a mailto: link that keeps the visitor's text.
- Loading state: a REAL transmission log typing out (VALIDATE ✓ · POST /api/contact · status code · message id).
- Success state: a CRT "TRANSMISSION RECEIVED" screen, plus the TRANSMIT sound cue if sound is on.
- A live availability block: a status dot, my local time ticking, my timezone, and "OVERLAP 3H 30M · 09:00–12:30 YOUR TIME", computed from the visitor's timezone and my working hours.
- A channel row in mono with magnetic hover and a sliding arrow: Email, LinkedIn, GitHub, Google Scholar, ORCID, X. The research channels sit beside the engineering ones.
- A final CTA pair: "DOWNLOAD RESUME" and "DOWNLOAD PUBLICATION LIST (PDF)".

FOOTER — "HALT":
- A huge, LED-masked, velocity-reactive marquee of my name and role.
- A mono site index (all sections, all projects, all publications).
- A build line: version · commit sha · deploy date · "built with" stack.
- A "back to top" that Lenis-scrolls on transit over 900 ms.
- POWER CYCLE OFF on the very last scroll pixel (450 ms): the tube collapses to a line, then shows "SYSTEM HALTED. SCROLL UP TO RESUME." Any upward scroll or key press reverses it instantly; it never blocks scrolling back up. Plays the HALT sound cue.

Accessibility: proper labels, error announcements via aria-live, visible focus, and a form that's fully usable by keyboard and screen reader.

Budget and build:
- First-load JS on / is 229.9 KB gz of the 230 KB budget after Part 11 (DESIGN.md §8.3): 0.1 KB remain. Pull the lever first: move the governor's state machine (≈ 4 KB gz) into the stage-runtime chunk, gate it, then build on what it frees. The form is client code: react-hook-form and its resolver must be lazy (on focus or idle, as the INDEX's behaviour is), never in first-load.
- HTML on / is 38.2 KB gz of 60 after Part 11.
- The contact route is the site's first server endpoint: rate limiting and the send must fail closed, and nothing secret reaches the client bundle.
```

---

## PART 13 — The terminal (the differentiator)

```
Build the hidden terminal — a real, working CLI inside the portfolio. It's built last among the features because it's a view over everything. Make it genuinely good, not a gimmick. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read the SHELL entry in DESIGN.md §7.4 first.

- Open / close:
  - Opens with "~", "/" or the HUD button, via a panel-scoped POWER CYCLE ON. Closes with Esc.
  - A native <dialog>: focus-trapped, background inert, ARIA-announced.
  - Bottom-anchored, ≤ 960 px wide, 62 svh tall, with --r-bezel corners.
  - Its own scanlines at α 0.10, phosphor text, a blinking block caret, a boot banner.
- Real shell behaviour:
  - command history (up/down) and tab completion;
  - Ctrl+C / Ctrl+L and autoscroll;
  - output streaming at 120 lines/s (any key skips to the end);
  - "did you mean…" suggestions (edit distance ≤ 2).
- Commands:
  help, whoami, about, stack, date, uptime, clear, history
  ls <projects|papers|skills|experience|certs|awards>
  cat <slug> — a formatted record for any project, paper, cert or role
  open <slug> — navigates there with TRACKING TEAR
  cite <paper> — prints the BibTeX and copies it to the clipboard
  scholar — the publication metrics table (count, citations, h-index, i10, with source and as-of date) and my Scholar/ORCID links
  verify <cert> — credential ID + issuer + build-time verify status, then opens the verification URL
  grep <term> — searches ALL content and prints ranked hits with their section
  resume, contact, email, social <platform>
  theme <phosphor|amber|paper>, sound <on|off>, grid, gfx <auto|low>, goto <section>
  sudo hire-me — a cheeky recruiting pitch, then opens the contact form
  neofetch — ASCII portrait + spec sheet (role, stack, papers, citations, certs, uptime)
  rain (alias: matrix) — 30 s of phosphor rain made of MY OWN data (paper titles, DOIs, commit hashes), not a film pastiche
  man retrograde — explains the name and the archive's retrograde-loop camera path
  decode <card> — reads an experience punch card's holes back into text
  debug — toggles the dev overlay
- Every command reads from /search-index.json (built in Part 2, ≤ 60 KB gz, fetched on first open) and from content/derive.ts. The terminal is a view over the data, never a copy of it.
- Also wire the Konami code: a full-screen CRT degauss (1.2 s wobble + rainbow fringe + hum). It's the one ungrammatical motion, allowed because it's hidden.
- Discoverability: after 25 s idle on the hero, a subtle mono hint appears once — "PRESS ~ FOR TERMINAL". Never nag twice. Part 6 built it and holds it until the terminal exists (DESIGN.md §10 #28): set TERMINAL.ready in lib/terminal.ts when the terminal ships, and enable the HUD's ~ key (aria-disabled until now).

Hard rule: the terminal is additive. If it fails to load, nothing else breaks. Code-split it (≤ 30 KB gz) and load it on first open.
```

---

## PART 14 — Performance, accessibility, resilience (do not skip)

```
Audit and harden the entire portfolio against DESIGN.md. Be ruthless: measure, don't guess. Follow DESIGN.md and the Global Rules in PROMPTS.md. Read DESIGN.md §4.2, §8.3, §3.9 and §5.3 first.

PERFORMANCE:
- Measure first: a production build, bundle sizes per route, and a profile of all five Tier-A scenes. Show me real numbers before and after.
- Targets are DESIGN.md §8.3:
  - Web vitals: LCP ≤ 1.8 s on 4G, CLS ≤ 0.02, INP ≤ 150 ms, TBT ≤ 150 ms.
  - JS: first-load ≤ 230 KB gz (hard cap 280); stage runtime ≤ 250 KB gz; each scene ≤ 35 KB gz.
  - Assets: fonts ≤ 165 KB (≤ 125 KB preloaded); textures ≤ 2.5 MB total and ≤ 600 KB per file.
  - GPU: VRAM ≤ 160 / 64 / 24 MB by tier; ≤ 40 draw calls per frame; ≤ 8 ms on M1 and ≤ 14 ms on the mid-range Android.
  - FPS: 60 on M1; 120 on ProMotion where the stage fits; for Hero and Projects on the mid-range Android, ≥ 50 and never below 45 sustained.
- Verify the governor:
  - exactly two WebGL contexts exist by architecture (stage + transition layer), never more;
  - exactly one draws in any frame;
  - at most one LIVE scene;
  - offscreen scenes at zero draw calls;
  - COLD scenes fully disposed.

  If any invariant breaks, fix it before anything else.
- Verify the tier system end to end: the HIGH / MID / LOW / OFF profiles, the probe, DPR regression, and the HUD's GFX LOW override visibly working.
- Confirm the bakes: graph layout precomputed (no runtime force simulation), atlases and posters baked, fonts trimmed. Textures stay AVIF + createImageBitmap. Adopt KTX2 only if a tier exceeds its VRAM budget, and show the numbers if you do.
- Put the budgets in CI: size-limit for bundles, Lighthouse CI for vitals, and a Playwright visual matrix (3 themes × 320/375/768/1024/1440/2560 × reduced motion on/off).

ACCESSIBILITY (WCAG 2.2 AA, verified, not assumed):
- prefers-reduced-motion must produce the complete static edition from DESIGN.md §3.9, with no WebGL context created at all. Check the constellation's SVG edition and the foil cards specifically.
- A full keyboard path through every interaction:
  - visible focus (brackets + outline) and a logical tab order;
  - a skip-to-content link;
  - focus traps only in the terminal and the dossier dialog;
  - focus never obscured by the HUD.
- Semantic landmarks and heading hierarchy, alt text everywhere, aria-live for dynamic text.
- No information by color alone: shapes + labels in the constellation, and a glyph + label for every status.
- Contrast: the token test must still pass. Re-verify DESIGN.md §5.3's under-FX numbers in the real build, in all three themes. The foil must never sit under text — check at every tilt angle.
- Every publication and certificate must be reachable and readable without touching a 3D element. Test with keyboard only and with a screen reader, and report what you found.

RESILIENCE:
- WebGL unavailable or context lost: the posters and phone editions take over. That's a fully designed 2D site, not an error.
- Error boundaries around the stage and every scene.
- Graceful states for slow networks, failed media, JS disabled (the SSR content is the site), and 404/500 pages as NO SIGNAL screens.
- Responsive from 320 px to 2560 px:
  - no 100vh bugs (use svh/lvh as specified);
  - no hover-only affordances;
  - touch targets ≥ 44 px;
  - cert cards tap-to-flip.

Gate D: every §8.3 budget is green in CI. Report a before/after table with real measurements, and tell me honestly what still falls short.
```

---

## PART 15 — SEO, metadata, launch

```
Make the portfolio findable, shareable and shipped. Follow DESIGN.md and the Global Rules in PROMPTS.md.

- The full Next.js metadata API: per-route title/description templates, canonical URLs, Open Graph + Twitter cards.
- Dynamic OG images via next/og (ImageResponse) for home, each project (/work/[slug]) and each publication (/research/[slug]), in the RETROGRADE art direction (Phosphor tokens, mono type, bracket frame).
  - The publication card shows title, venue, year and citation count (with as-of date). A shared paper link must look like a published artifact.
  - Verify all of them render correctly at 1200×630.
- JSON-LD structured data — this is how my research surfaces in search, so get the schema exactly right and validate it:
  - Person: sameAs all socials AND Google Scholar/ORCID, plus jobTitle, knowsAbout, alumniOf.
  - CreativeWork or SoftwareApplication per project.
  - ScholarlyArticle per publication: author list, datePublished, isPartOf venue, identifier DOI.
  - EducationalOccupationalCredential per certificate.
- robots.ts, sitemap.ts (home + every /work and /research route), a web manifest, a favicon set + apple-touch-icon, and themed 404/500 pages (NO SIGNAL).
- Privacy-light analytics (Vercel Analytics + Speed Insights) with custom events: section views, project opens, dossier opens, BibTeX copies, cert verifications, terminal opens, commands run, resume downloads, contact submits, theme switches, sound enables.
- README.md covering:
  - the concept (link DESIGN.md) and the stack;
  - an architecture map: stage, governor, FX layers, interlock;
  - how to edit content, and how to add a project / publication / certificate;
  - the bake pipeline: fonts, layout-graph, posters, atlases, citations, verify, search-index, og;
  - the performance budgets;
  - deploy steps.
- Vercel deploy config and env var docs (Resend, Upstash).
- A pre-launch checklist that you then actually walk through:
  - Lighthouse, mobile + desktop, all four categories;
  - rich-results validation for ScholarlyArticle and Person;
  - social preview validation;
  - a broken-link scan — every DOI, arXiv and verify URL must resolve;
  - a spellcheck of all copy;
  - a cross-browser check: Chrome, Safari, Firefox, iOS Safari, Android Chrome.

Give me the final Lighthouse numbers verbatim. Mobile Performance below 95 means fix and re-measure (90 is the floor).
```

---

## PART 16 — The polish pass (what separates good from award-winning)

```
Final craft pass. You are now a hyper-critical design director reviewing this portfolio for an Awwwards jury. Be harsh. Follow DESIGN.md and the Global Rules in PROMPTS.md.

1. Walk the entire site — in all three themes, with reduced motion on and off, on desktop and on a phone — and write CRITIQUE.md: every moment that feels cheap, generic, janky, mistimed, misaligned or over-animated. Minimum 30 specific, located observations. No compliments.
2. Then fix them, prioritising:
   - TIMING: check every duration, easing and spring against lib/motion.ts and DESIGN.md §3. Hunt for anything linear, anything that lingers, any stagger that feels mechanical. Micro-interactions instant (< 150 ms); scene changes inevitable, not slow.
   - OPTICAL ALIGNMENT:
     - optical margins and hanging punctuation;
     - baseline rhythm on the 4 px grid;
     - mono numerals in ALL changing data (citations, dates, credential IDs, metrics);
     - no orphans/widows in headings;
     - display tracking per the type scale, and the hero name fit.
   - HIERARCHY: squint at every screen. One first read per screen, and one hero figure per view.
   - RHYTHM: verify the loud/quiet alternation against DESIGN.md §7.2 and the interlock. No section shouts twice in a row.
   - THE NEW SECTIONS:
     - Does the constellation read as meaningful (shape, size, re-plot) or as decorative noise?
     - Is the foil convincing at every tilt angle in all three themes?
     - Are the dossier and the cert back as considered as the case studies?

     Raise anything weaker than Projects to that level.
   - DETAIL LAYER: hover, active/pressed, loading, empty, error and focus states — all designed, none default.
   - SOUND: subtle, mixed low, never startling, perfectly synced. No hover sounds.
   - CONSISTENCY:
     - one easing language (lib/motion.ts);
     - tokens only;
     - one voice in all mono copy: terse, uppercase labels, no exclamation marks;
     - the artifact allocation in DESIGN.md §2.11 respected.
3. Ship 3 small, unexpected delights — cheap in bytes, invisible until discovered. Start from DESIGN.md §7.5, and propose better ones if you have them.
4. Final honest verdict: what tier is this (portfolio / strong / award-submittable), the top 3 remaining weaknesses, and exactly what you'd do with one more day.
```

---

## HOW TO RUN THIS

**Build order ≠ page order.** The page reads Boot → Hero → About → Experience → Research → Projects → Skills → Certificates → Contact → Footer. The build goes foundation-first, so nothing gets retrofitted. The section parts still follow page order.

| Phase | Parts | Gates |
|---|---|---|
| 0 · Lock | Part 0 ✅ (DESIGN.md). Push back now, before any code | — |
| 1 · Foundation | 1 → 2 → **3** → 4 → **5** | **A** after 3 (governor invariants) · **B** after 5 (LCP with the boot) |
| 2 · Stages, in page order | **6** → 7 → 8 → 9 → 10 | **C** after 6 (the performance template) |
| 3 · DOM showpieces | 11 (any time after 4) → 12 → 13 | — |
| 4 · Harden & ship | **14** → 15 → 16 | **D** after 14 (all budgets green in CI) |

1. **Start `CONTENT_INTAKE.md` as soon as Part 2 creates it.** Real content changes the design: the name's length tunes the hero fit, and the paper count tunes the constellation. It must be real before Part 8 at the latest. Every paper needs a plain-language TLDR, and every certificate needs a credential ID and a verify URL that resolves. Once it's filled, ask Claude to replace the placeholder data and set `IS_PLACEHOLDER = false`.
2. **One part per message.** Review in the browser after each one. A red gate blocks the next part.
3. **Never skip Part 14.** Part 16 is what makes it world-class.

**If something feels off, say so immediately and specifically.** "The constellation edges draw in too evenly, stagger them by distance from camera" beats "make it better". Taste is applied through notes, not through prompts alone.
