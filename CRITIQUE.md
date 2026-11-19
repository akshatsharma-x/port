# CRITIQUE — the polish pass (PROMPTS.md Part 16)

A design director's walk of RETROGRADE for an Awwwards jury: every moment that reads cheap, generic, janky, mistimed, misaligned or over-animated. No compliments.

**How it was walked.** `scripts/audit/walk.mjs` shot every screen of the site in twelve editions — Phosphor, Amber and Paper × motion on and off × a 1440 × 900 desktop and a 390 × 844 phone — 306 screens, with each screen's orphans, numerals set in a proportional face, and every transition and animation timing measured in the page (`.artifacts/walk/`). Then targeted probes: a squint test (each screen blurred), hover and focus states read from computed style on every kind of control, the foil at four lamp angles in three themes, a card's back, print, a time-sampled LOG entry, and the first CI run's Lighthouse reports from GitHub's runner. Each finding names where it is and what was measured. "Status" says what this pass did about it. The walk had one blind spot, and the worst finding was in it: a screenshot never draws the native cursor and the walk hid the reticle, so 49 — no cursor at all — came from the owner.

## Timing

| # | Where | What's wrong | Status |
|---|---|---|---|
| 01 | ARCHIVE · the dossier (`.dossier__fiche`, `fiche-in`, `fiche-scan`) | The microfiche enters over **600 ms** (`--dur-element` × 1.5, a multiplier from nowhere). §4.4 B3 puts it on the element tier, 400 ms. It is the one panel that lingers. | Fixed: `--dur-element` |
| 02 | CONNECT · the teletype (`styles/connect.css`) | It prints at a literal **18 ms a character**, a number from nowhere: not in `lib/motion.ts`, not the 45 cps the typewriter runs at. | Fixed: a token in `lib/motion.ts`, read by CSS |
| 03 | The two COPY buttons (CONNECT's address, a paper's BibTeX) | "COPIED" holds for 1,600 ms in both, but as two private constants (`ConnectBehavior.tsx`, `CopyBibtex.tsx`). One timing, two sources of truth. | Fixed: one token |
| 04 | The boot · reduced motion (`styles/boot.css`, `beam-fade`) | The shutter's crossfade runs **linear** — linear is reserved for scroll-scrubbed timelines (§3.2). | Fixed: it exits on `depart` |
| 05 | Every control but keycaps and `.btn` | **No press state.** §3.4: "press feedback lands in the same frame". Chips, the TUBE panel, the ledger's sort headers, nav links, COPY, CLOSE and the card's TURN all ignore a press. | Fixed: one `:active` dip, untransitioned |
| 06 | CREDENTIALS · the stamp's thud (`CredentialsBehavior.tsx`) | Scheduled by `setTimeout` against a compositor animation: under main-thread load the sound lands late. The stamp is the one cue that must be synced to the frame. | Fixed: scheduled on the audio clock (`delayMs`) from the same moment the stamp's animation starts on the compositor's; a timer no longer stands between them |
| 07 | Any machine without a GPU | WebGL on a software rasterizer (SwiftShader, WARP, llvmpipe) runs the hero and WORK on the CPU. GitHub's runner measured **35.5 s** of main-thread time on `/` and Lighthouse couldn't finish; TBT 293–336 ms on the other pages. The probe only demotes to LOW, never OFF. | Fixed: a software rasterizer is OFF, the posters: `#fx-gl` asks with `failIfMajorPerformanceCaveat` and checks its renderer's name, so the runtime's chunk is never fetched. Measured: Chrome falling back to SwiftShader and Chrome forced onto it both go OFF, 0 runtime bytes, 0 console errors; the GPU path stays HIGH |

## Optical alignment

| # | Where | What's wrong | Status |
|---|---|---|---|
| 08 | A paper's page and its dossier · IN PLAIN WORDS | The opening **“ isn't hung**: line one starts a quote-mark's width right of lines two to four. Chrome ignores `hanging-punctuation`. | Fixed: hung in every engine |
| 09 | ARCHIVE · the ledger's header | The AUTHORS column's rule sits **3 px above** its neighbours' (the one header without a sort button, so a shorter cell). The rule breaks twice across the table. | Fixed: one rule, one header height |
| 10 | CREDENTIALS · RECORDS' tiles | Labels and figures don't share a baseline: "TEAMS IN THE ROUND / 300+" stand **12 px above** "HONORS / 2" and "AWARDS / 1". | Fixed: tiles align on their figures |
| 11 | CONNECT · the form's errors | "THIS ONE'S NEEDED." starts at **three x positions** (95, 103, 111 px): every input begins after its own label's width. | Fixed: one label column |
| 12 | LOG · the printout | The green-bar bands are ≈ 45 px and the lines ≈ 24.5 px: **rows straddle band edges**. Fanfold registers three lines to a half-inch band. | Fixed: two lines a band, registered |
| 13 | WORK · the INDEX, CREDENTIALS · a card | **Orphans**: "Automated Resume / *Screening*"; "Certified Kubernetes Application Developer / *(CKAD)*". | Fixed: balanced |
| 14 | ARCHIVE · the ledger (YEAR, CITATIONS), the INDEX (01–05), a paper's YEAR figure | **Changing numbers in Mona Sans** — `.numeral` set tabular figures in the sans. §2.5: numbers that change are mono. On a paper's page "0" (mono) and "2026" (sans) sit side by side in two faces. | Fixed: `.numeral` is mono |
| 15 | LOG · a role's panel | "**JUN 2026 – PRESENT**" — while the printout below says "2026-06 – PRESENT". Two formats for one fact; the voice is ISO (§2.10). | Fixed: ISO |
| 16 | IDENTITY · the record | "H-INDEX … 0 · as of **11 Nov 2026**" — a non-ISO date. | Fixed (and see 22) |
| 17 | HALT · the index | The two papers' titles, **18 and 11 words, set in uppercase**. §2.5: never uppercase a title longer than six words. | Fixed: sentence case |
| 18 | ARCHIVE · the sky (live and the reduced edition's SVG) | The cluster label is **crossed by the edge** as the camera orbits ("SUSTAINABILITY" cut by the line at mid-pin); the SVG sky does the same. | Fixed: a label sits on a plate of the ground, so an edge passes behind it |
| 19 | Phone · the HUD | The readout looked clipped ("· 120 FPS" → "120 FP" at 390 px). | Withdrawn: the FPS field is `?debug=1`'s only, which every walk shot used; a visitor's band fits (§7.3's phone rule drops the clock) |
| 20 | Phone · CONNECT | The address **breaks at the @**: "akshatsharma.data / @gmail.com". | Fixed: it fits its measure |
| 21 | CONNECT · EMAIL / LINKEDIN / GITHUB | Each button's corner brackets **collide** with its neighbour's: a "][" crowd between every pair. | Fixed: the arms clear |

## Hierarchy

| # | Where | What's wrong | Status |
|---|---|---|---|
| 22 | The hero, IDENTITY, a paper | **Zeros promoted to figures**: "CITATIONS 0" on the first screen (alone on its own line on a phone), "H-INDEX 0" in the record, and a paper's CITATIONS as a 0 at display size. True, and a flex in reverse. ARCHIVE's lead already follows the rule (PUBLICATIONS until there are citations). | Fixed: the hero's strip and IDENTITY's record add them once there are any; a paper says "Not yet cited". ARCHIVE's tiles keep CITATIONS 0, H-INDEX 0 and I10 0: the owner's call (§7.4 v1.9, "CITATIONS stands among the tiles") |
| 23 | IDENTITY · the bio | **Eight phrases in `--accent`**. Colour carries only state (§2.4); here it decorates, reads as eight links, and the squint test finds no first read. | Fixed: emphasis by ink, not hue |
| 24 | A paper's page, the dossier | The reversed-type ID strip is **the brightest mass on the page** (squint): it outshouts the title it heads. | Fixed: the strip's reversed type on `--fg-3` (AA: 5.8–7.3 : 1), under the title. (Its truncated title stays: §7.4's fiche header) |
| 25 | CREDENTIALS · RECORDS | The LED "3", "300+" and three cards **weigh the same** in the squint. "300+" is the hackathon's field, not the owner's figure. | Fixed: one figure leads |
| 26 | CONNECT | The address set **near mega under a mega headline**: two loud lines for one invitation. | Fixed: a step down |
| 27 | The hero | The particle "AS" and the name are **two full-width figures spelling the same letters**; the squint has two first reads. | Open: the INITIALS state is A1's design (§4.3); dimming it is the owner's call |
| 28 | CAPABILITIES' first screen | Six skill names at display size: a **keyword wall**, the pile below the fold. | Open: §7.4's band; the pile is the figure |

## Rhythm

| # | Where | What's wrong | Status |
|---|---|---|---|
| 29 | ARCHIVE (§7.2: the second-loudest beat, on purpose) | It is **the quietest screen on the site**: two dots, one hairline, one label, a black field — and 150 svh of pinned scroll through it. The loud/quiet alternation breaks exactly where it should peak. | Fixed in part: 30–32 give it a first read. Open: the pin's length (§3.8 caps it at 150 svh; scaling it to the sky's size changes the scroll gates' geometry) |

## The new sections

| # | Where | What's wrong | Status |
|---|---|---|---|
| 30 | ARCHIVE · the constellation | It reads as **decoration, not data**: nothing says what a star is until you hover one. With two records, labels cost nothing. | Fixed: a sky of ≤ 6 records labels each in place, its title and facts, clear of the cluster labels and the view's edges (`lib/sky-tags.ts`); the tuned one in full ink with its facts in the accent. In the stage's layer and the phone's and reduced edition's drawing alike |
| 31 | ARCHIVE · the legend | Eight venue types listed, one in the sky: a key to absent things. | Withdrawn: §4.3 A3 and §7.4 — "the legend is always visible", the seven shapes and the dashed key; it teaches the shape language before the sky holds every type (DESIGN wins) |
| 32 | ARCHIVE · the stars | One star green, one white, **with no key**: the green is the open record (HOT), never explained. | Fixed: the legend keys it (TUNED IN), and the tuned record's tag lights with it |
| 33 | CREDENTIALS · Paper's foil | **Flat grey at every angle**: four lamp positions give near-identical discs. Stamped silver flashes as it turns; this reads as grey print. | Fixed: a wider metal (0.45 → 0.98) under a narrower specular band that sweeps with the lamp |
| 34 | CREDENTIALS · a card's back | **A plain dark panel**: ID, dates, chips, a line, VERIFY, a 100 px dead band, the MRZ. The front is a security document; the back forgot. | Fixed: the card's own guilloche, mirrored, as underprint; a microprint rule of its ID; the MRZ in its zone across the foot |
| 35 | A case study's body | **A Markdown page**: one text column, the right five columns empty for the whole page, the stack at the very end. | Fixed: a facts rail — the stack and the links, sticky beside the story on a wide screen, after the header on a phone |
| 36 | The dossier | The title at display size and the quote at lead size **compete**; nothing but the strip reads as microfiche. | Fixed in part (24, 08, 01). Open: a fiche frame worth the name needs the paper's pages to show on it |

## Detail layer

| # | Where | What's wrong | Status |
|---|---|---|---|
| 37 | ARCHIVE's LAYOUT chips, CAPABILITIES' category chips, the ledger's sort headers, the TUBE panel, "← ALL PROJECTS" | **No hover state** (computed style unchanged on hover). | Fixed: the chips' language — ink up, a ring |
| 38 | A paper's KEYWORDS | The keywords wear "□" checkbox glyphs, as if they were toggles. | Withdrawn: they are — each lights its records in the sky and goes back to it (`KeywordChips.tsx`); the glyph is the toggle's off state |
| 39 | WORK · the INDEX | ROLE and YEAR are **"—" in every row**; on a phone, a "— —" line per project. Empty columns presented as data, and their width forces 13's orphan. | Fixed: a column no row fills isn't drawn (§10 #42 refined: a dash still marks a pending fact in a drawn column) |
| 40 | Every page but home · the HUD | The section slot reads **"—"**. | Fixed: a page names the section it belongs to — "05 WORK", "04 ARCHIVE", NO SIGNAL (`data-hud-page`) |
| 41 | A case study · the top band | Lead text scrolling under the band stays legible at ~40% and **runs through "RETROGRADE/OS"**: the backing (§7.3) is too thin where the readout sits. | Fixed: 92%, solid for 65% (was 84% / 55%) |
| 42 | HALT · the build line | "DEPLOYED **2026-11-14**" is a UTC date beside an IST clock, unzoned. | Fixed: "2026-11-15 UTC" |

## Found while fixing

| # | Where | What's wrong | Status |
|---|---|---|---|
| 47 | Every count-up (`Counter`) | Its digits reset to 0 at hydration and wait to be half in view: printed, or met before its count-up, ARCHIVE's FIRST-AUTHOR read 0 where it is 2, VENUES 0 where it is 1. The server's HTML had them right. | Fixed in print (a counter prints its value); on screen the count-up is the design (§3.4) |
| 48 | ARCHIVE · the sky's tags (this pass's own) | The first placement rule (flip left past 62% of the width) laid a tag across the cluster label, and an absolute box near an edge shrank to a column ("Short- / Term PM2.5 / Forecastin…"). | Fixed: `lib/sky-tags.ts` — beside the star facing away from the nearest label, else the other side, else above or below slid inside the view; `width: max-content` |
| 49 | **Every page, on a mouse · the cursor** (the owner's report: "after CLOSE on a record's details the cursor becomes invisible") | **There was no cursor.** The stylesheet showed the reticle on `data-cursor`, which nothing set, while `data-reticle` hid the native cursor everywhere but inside a modal dialog — so from Part 5 on, the one place a cursor showed was a dossier, and closing it "made it vanish". Behind it: the boot (z45) and the tear's cover (z60) were above the reticle's z40; its `difference` blend sat inside its own stacking context and blended with nothing, so its white would have drawn white on Paper; a View Transition froze it in the snapshot. The boot gate passed it for eleven parts, reading the script's attribute, not the screen. Not one of the 306 shots could show it: a screenshot never draws the native cursor, and the walk hid the reticle | Fixed: one flag shows the reticle and hides the native cursor, so one of the two is always on screen (the native one until the pointer moves, in fields and dialogs); z62 above every layer; the parts blend with the page; live groups through the full edition's View Transitions (in the reduced crossfade, the live new snapshot carries it: groups there cost 35 ms). Once it showed, its snap was a layout shift (the corners anchored right and bottom moved in layout: 84 entries in one sweep of the nav, caught by the scroll gate's CLS = 0); the corners now move by transform. And its flag, written in the pointer event, restyled the whole page inside the next click (the first click's input delay 31 ms at 4× CPU, INP 64–72): it's written after the next paint now (5 ms; INP 40). The audit gate's new `cursor` part proves it all in pixels — before a move, the dossier closed by CLOSE, Esc and Back under a still pointer, the terminal, a field, mid-transition, HALT's dark tube, the boot, reduced motion, no shift: 10/10, the hotspot at 6.5–20 : 1 |

## Sound

No hover sounds (none fire on hover; cues fire on commits, crossings, transitions and physical events); every cue peaks at its sheet level under the −6 dBFS ceiling (`tests/audio.test.ts`); SECTION never doubles a TEAR (it only fires on continuous scroll). The one fault is 06.

## Consistency

| # | Where | What's wrong | Status |
|---|---|---|---|
| 43 | WORK · the title cards (`lib/covers.ts`) | **Five hues by content order** — a categorical palette, which §2.4 forbids. In Amber and Paper they resolve to green, salmon and blue glows that belong to no theme. | Fixed: achromatic cards; the theme's dither carries colour |
| 44 | CREDENTIALS · the foil (`styles/credentials.css`) | Its spectrum is **nine OKLCH literals** outside `styles/tokens.css`. | Open, by necessity: the hues compose with `--foil-sat`, which varies per card (Paper's silver, an expired card's grey), and a custom property's `var()` resolves where it's declared — in `:root` it couldn't follow the card. The foil is the one material colour that lives with its object |
| 45 | Print | The site **prints as 21 A4 pages**: the dark hero with its canvas, the HUD on every page, blank pinned tracks, an empty portrait box. §2.4's print edition (Paper's tokens, no HUD, FX or stage, the ledger in full, URLs after links) was never built. | Fixed: it prints as a fanfold printout, 8 sheets (delight 1, below) |
| 46 | CI · Lighthouse on GitHub's runner | The runner benchmarks at 2,600–2,700 against this machine's ~4,500, so the same 4× throttle measures a different phone: LCP 1.80–1.91 s, and every budget failed on its first run. | Fixed: CI throttles to the reference CPU (`LHCI_CPU_SLOWDOWN` 2.4 on the runner, 4 here), and the runner's GPU-less Chrome now takes 07's OFF path |

## Open, for the owner

- **27, 28, 29, 36** — design calls (above).
- **The portrait** is a generic dithered silhouette until a photo arrives: the section's one image reads as a default avatar.
- **A case study's cover on a phone** (Part 15): title-card type cut by `object-fit: cover`.
- **The covers themselves**: until screenshots arrive, the gate slide repeats its own mount's print (category and title, twice in one frame).

## Delights shipped (§7.5's seven were all built; three new ones, cheap in bytes, invisible until found)

1. **Print it** and it comes out of the Paper machine: continuous-feed green-bar stock with tractor strips down both edges on every sheet, a cover, one chapter a section, the ledger in full, the skills in two columns, counters at their values, URLs after links, page numbers. `public/print.css`, 2.5 KB gz, linked `media="print"` by the head script (a `<noscript>` copy without JS; a rendered link drew a preload from React, which Firefox warned about on every load): fetched at the lowest priority, never render-blocking. It also builds §2.4's print edition, which existed only as a token switch (45).
2. **Channels.** The sections already wear their numbers ([04] ARCHIVE); the number keys tune them like a TV's. Press 4 and the set's on-screen display reads CH 04 · ARCHIVE in LED numerals, over the tear's static as a set's own overlay is, and the TRACKING TEAR takes you there. Never while typing, in a dialog or with a modifier; CAPABILITIES' type-to-press claims its keys first. `lib/channels.ts`, its own chunk after idle.
3. **Last login.** Open the terminal on a later visit and it greets you as a tty does — `Last login: 2026-11-15 11:39 GMT+5:30 on tty1` (measured, an en-US browser in India's zone; en-IN says IST), your last visit in your zone as your locale names it. localStorage only, beside the shell's history; nothing is sent.

## Verdict

**Strong — not award-submittable yet.** The craft is there: one motion language with tokens and gates behind it, a type system that solves its own fit, three themes and a reduced edition each designed, accessibility measured rather than claimed, a performance budget held to the byte. What a jury would mark down now is content, not craft — but the pass's worst fault was craft, and the owner found it, not the walk: there was no cursor on a mouse (49), in every session since Part 5, past every gate, because each gate read the script's state rather than the screen. It is fixed and proven in pixels now; the lesson is in the gate. The rest:

1. **ARCHIVE has two papers and no citations.** The second-loudest beat is built for a body of work; it labels its two stars now, but a constellation of two is a line. The works the papers cite — the references the owner was asked for — are what would make it a sky.
2. **The covers are title cards.** WORK's slides, the case studies' heroes and the share cards show type on a ground where a jury expects the work itself, and on a phone the hero crops that type (Part 15's open call).
3. **The portrait is a placeholder, and the case studies carry no metrics, media or links:** the projects read as descriptions, not evidence.

**With one more day:** get the five screenshots (the bake already crops them to 3:2), the two papers' references, a photo and one metric per project — none of it code — and re-walk. In code: scale ARCHIVE's pin to its sky (29), give the dossier a fiche frame worth the name (36), and settle the phone cover.
