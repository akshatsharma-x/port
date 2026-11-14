# RETROGRADE

A portfolio you boot, not browse: Akshat Sharma's — generative-AI systems, full-stack software, and research in interpretable machine learning — built as a fictional operating system in which every role, paper, project and credential is a physical artifact of old computing.

**[DESIGN.md](DESIGN.md) is the source of truth**: the concept, the tokens, the motion, the five 3D scenes, every section, the budgets, and every decision with its reason (§10). [PROMPTS.md](PROMPTS.md) is the build, part by part. Where the two disagree, DESIGN.md wins.

## The stack

| | |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript (strict) |
| 3D | three r187 + React Three Fiber 9.8 (`frameloop="never"`) + drei (PerformanceMonitor), postprocessing 6 |
| Motion | GSAP 3 (the one ticker), Lenis (scroll), Motion (layout springs) |
| UI state | zustand 5 |
| Forms | react-hook-form + zod 4 (zod/mini on the client) |
| Styles | Tailwind CSS 4, CSS custom properties from `styles/tokens.css` (DESIGN.md §2 verbatim) |
| Contact | Resend (send) + Upstash Redis (rate limit), behind `app/api/contact` |
| Analytics | Vercel Web Analytics + Speed Insights (cookieless; lazy, Vercel-only) |
| Tests | vitest (unit), Playwright (gates, the visual matrix), axe-core, Lighthouse CI, size-limit |

## Running it

```sh
npm ci
npm run dev          # the bake (offline) first, then next dev on :3000
npm run build        # the bake (online: citations, verify), next build, the boot manifest
npm start
npm run check        # typecheck (route types generated first), lint, unit tests
```

Node 20.9+ for the site; Node 22.19+ for Lighthouse CI.

## Architecture

```
<body>
├─ #stage    WebGL2 context #1 — the one three.js canvas, parked here between scenes and
│            docked (position: sticky) into whichever scene's slot is LIVE
├─ #screen   all the DOM. Tier-A sections hold <StageSlot id="…">, each with its poster
├─ #hud      z30 — the persistent chrome: readout, nav, section rail, front panel
├─ #cursor   z40 — the reticle
├─ #fx-css   z50 — the glass: grain, scanlines, the refresh roll (CSS, compositor-only)
├─ #fx-gl    z60 — WebGL2 context #2, raw, ~4 KB: the transitions only, idle otherwise
└─ <dialog>  top layer — the terminal, a record's dossier
```

- **The stage** (`components/stage/`): one persistent WebGL context for all five scenes (Hero, Experience, Research, Projects, Skills). Creating contexts and compiling shaders at a section's entry costs 50–300 ms of jank exactly when it arrives; one context, shared GPU resources and one RAF avoid it (DESIGN.md §4.1).
- **The governor** (`lib/sceneManager.ts`, a facade in first-load JS; `lib/governor-engine.ts`, lazy): each scene is COLD → PRIMED → WARM → LIVE → COOLING. At most one scene is LIVE and at most two are resident; an off-screen scene draws nothing; a COLD one is fully disposed. Exactly one of the two contexts draws in any frame. The tier (`lib/tier.ts`: HIGH / MID / LOW / OFF, probed at boot) decides which scenes run live at all; phones run Hero and Projects, the rest ship designed phone editions. DPR steps down 0.25 under load (floor 1.0) and back.
- **The FX layers**: `#fx-css` is the glass every pixel is seen through; `#fx-gl` draws the three signature transitions (POWER CYCLE, TRACKING TEAR, DITHER RESOLVE) and nothing else.
- **The interlock**: between any two stage slots there are at least 100 svh of DOM-only content, so two stages never share the screen and the governor swaps scenes where nobody can see it. The rhythm and the performance budget are the same rule (§4.2).
- **Every edition is complete**: reduced motion creates no WebGL context at all (§3.9); tier OFF, no JS and a lost context show baked posters; NO SIGNAL takes a 404 or any error.

## Content

Everything the site says lives in **`content/data.ts`**, validated by **`content/schema.ts`** (zod) at every bake, dev and build; nothing in a component carries copy. `content/derive.ts` turns it into what the pages read (counts, the graph, the hero strip). Gaps are marked `TODO(akshat)`: nothing is invented to look complete.

After a content change, run `npm run bake` locally and commit what it writes. Three steps draw in the installed Google Chrome (covers, atlases, keycaps); a deploy's bake finds them fresh by their input hashes and draws nothing, so it needs no browser.

**Add a project** — a `projects` entry in `content/data.ts`: `slug`, `title`, `subtitle`, `category`, `summary`, `problem`, `approach`, `outcome`, `stack`, `links`, `media`, `year` / `role` (`null` until known). Drop a screenshot at `content/covers/<slug>.(avif|webp|png|jpg)` and the bake crops its covers from it; without one it draws a title card from the project's own words and says so in the alt text. The case study (`/work/<slug>`), its share card and its structured data follow from the entry.

**Add a publication** — a `publications` entry: `slug`, `title`, `authors` (exactly one `isMe: true`), `venue`, `venueShort`, `venueType`, `year` (+ `month`), `status`, `isPeerReviewed`, `tldr` (one sentence), `keywords`, `bibtex`, `topicCluster`, and a `doi` once it has one (the BibTeX must agree). The bake lays it into ARCHIVE's graph, counts its citations (OpenAlex, by DOI), and the dossier (`/research/<slug>`), its share card, its ScholarlyArticle markup and its Google Scholar tags follow.

**Add a certificate** — a `certificates` entry: `slug`, `title`, `issuer` (+ `issuerLogo`, a file under `public/`), `issueDate`, `expiryDate`, `credentialId`, `verifyUrl`, `skillsCovered`, `domain`, `level`, `proves`. The bake checks `verifyUrl` resolves (VERIFIED only if it does, else ON FILE). The CREDENTIALS wall appears on home with the first certificate.

Links to add when they exist: `profile.scholarProfiles` (Google Scholar, ORCID) and `profile.socials` (X) reach CONNECT, the terminal and the Person markup with no code change.

## The bake

`npm run bake` (`scripts/bake.ts`), before every dev and build. Each step is deterministic: unchanged input, unchanged files.

| Step | What it makes |
|---|---|
| validate | parses `content/data.ts` against the schema; trust warnings (a paper without a DOI, a claim without proof) |
| layout-graph | ARCHIVE's constellation laid out once, at build time (d3-force-3d) → `content/graph.json`: no force simulation runs in the browser |
| citations | each paper's citation count from OpenAlex by DOI → `content/citations.json`; never fails the build (unreachable: the last values stay, with their dates) |
| verify | every DOI, arXiv id and certificate `verifyUrl` checked → `content/verify.json`: a dead DOI or arXiv id fails the build; a credential that doesn't resolve shows ON FILE, never VERIFIED |
| posters | each scene's fallback (`public/posters/`): captured from the live scene by `scripts/posters.ts` (a GPU and a running build), kept in the tree |
| bluenoise · foil-grain · portrait | the dither's blue noise, the foil's diffraction grain, and the About portrait's source — from `public/media/profile/photo.*` once there is one, a placeholder until then |
| covers | each project's covers (AVIF, per tier) from its screenshot or a title card |
| atlases · keycaps | LOG's punch-card atlas, CAPABILITIES' legend atlas and matcaps |
| publication-list | the printed publication list (`public/media/publications.pdf`) |
| icons | `favicon.ico`, the apple-touch-icon and the manifest's icons, from `app/icon.svg` |
| og | the share cards (`public/og/`): home, every project, every paper, 1200 × 630, by next/og from `lib/og-cards.tsx` — after checking their faces exist and every title fits its card |
| search-index | the terminal's index (`public/search-index.json`), from the same `derive()` as the page |

**Fonts** are their own bake (`sh scripts/fonts/run.sh`, Python + fontTools in `.venv`): the three variable faces trimmed and subset to WOFF2 (`app/fonts/`), their measured fallbacks, the hero name's width model, and the share cards' static JetBrains Mono instances (`app/fonts/og/`: next/og reads no WOFF2 and no variable axes).

**Share cards** (`lib/og-cards.tsx`, through `lib/og.tsx`) are rendered by next/og's ImageResponse in the bake, not as app routes: 1200 × 630, Phosphor's tokens read from `styles/tokens.css`, the HUD's readout over a bracket frame. Each page's head names its card, versioned by its bytes. (As `opengraph-image.tsx` routes, next/og's WebAssembly in the app's graph put Turbopack's async-module runtime in every page's first-load JS.)

## Performance budgets

DESIGN.md §8.3, every one measured each part; the numbers there are the latest.

| | Budget |
|---|---|
| LCP (mobile, Slow 4G) | ≤ 1.8 s |
| CLS · INP · TBT | ≤ 0.02 · ≤ 150 ms · ≤ 150 ms |
| First-load JS, `/` | ≤ 230 KB gz (hard cap 280) |
| Stage runtime · each scene | ≤ 250 KB gz · ≤ 35 KB gz |
| Terminal + its index | ≤ 30 + 60 KB gz |
| HTML, `/` | ≤ 60 KB gz |
| Fonts | ≤ 165 KB total, ≤ 125 KB preloaded |
| Textures | ≤ 2.5 MB total, ≤ 600 KB a file |
| VRAM (HIGH / MID / LOW) | ≤ 160 / 64 / 24 MB |
| Draw calls · GPU frame | ≤ 40 · ≤ 8 ms on an M1 (HIGH), ≤ 14 ms on a Galaxy A54 (LOW) |

They're enforced: `npx size-limit` (`.size-limit.mjs`: bundles, fonts, textures, from the build on disk), `npx lhci autorun` (`lighthouserc.cjs`: LCP, CLS, TBT, all four categories), and twelve gates (`scripts/*-gate.mjs`: the eleven parts' and `scripts/audit-gate.mjs`), run against a production build:

```sh
npx tsx scripts/bake.ts --offline && RETROGRADE_DEV_ROUTES=1 npx next build && node scripts/boot-manifest.mjs
RETROGRADE_DEV_ROUTES=1 npx next start -p 3200
BASE_URL=http://localhost:3200 node scripts/audit-gate.mjs     # and any scripts/<part>-gate.mjs
BASE_URL=http://localhost:3200 npx playwright test             # the visual matrix (e2e/)
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, size-limit, Lighthouse CI, the audit gate (`--ci`: what needs a real GPU says SKIP) and the visual matrix (on macOS: its baselines are from one). The GPU-time gates run on a self-hosted Apple-silicon runner once one is registered (`GPU_RUNNER=1`).

## Analytics

Vercel Web Analytics and Speed Insights, privacy-light: no cookies, no personal data, and no event carries free text — only names and enumerable values (`lib/analytics.ts`). Neither script is in first-load JS: `track()` is a queue the script drains when it lands, after idle, on Vercel only. Events:

`section_view` (each section, once a visit) · `project_open` · `dossier_open` · `bibtex_copy` (dossier, terminal) · `cert_verify` · `terminal_open` · `command_run` (the command's name, never its arguments) · `resume_download` · `contact_submit` (the HTTP status, never a field) · `theme_switch` · `sound_enable`.

Custom events need a Vercel Pro or Enterprise plan; page views and Speed Insights work on Hobby.

## Deploying (Vercel)

1. Import the repository in Vercel (framework: Next.js; `vercel.json` pins `npm ci` and `npm run build`). The build runs the online bake (citations, link checks) and writes the boot manifest.
2. Set the environment variables from [`.env.example`](.env.example) for Production (and Preview, if previews should send mail):
   - `RESEND_API_KEY` — the contact form's sender (Resend).
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — its rate limit (Upstash Redis). Without these three, the form answers 503 and offers mailto: it fails closed.
   - `CONTACT_TO`, `CONTACT_FROM` — optional: where messages go, who they're from (a sender on a domain verified in Resend).
   - `NEXT_PUBLIC_SITE_URL` — once the site has its own domain. Until then canonicals and cards use the project's production URL.
3. In the project's dashboard, enable **Web Analytics** and **Speed Insights**.
4. Deploy. Previews are `noindex` and their robots.txt disallows everything; production is indexed, with `sitemap.xml` and `robots.txt` at the root.
5. Walk the launch checklist: [docs/LAUNCH.md](docs/LAUNCH.md).

## Repository map

```
app/            routes: home, /work/[slug], /research/[slug] (+ the @modal dossier), the API,
                the head (robots, sitemap, manifest, icons, share cards), NO SIGNAL, /dev (review only)
components/     sections/ (one folder per section), stage/ (the runtime, slots, scenes), chrome/ (the HUD),
                shell/ (the terminal), research/ & work/ (dossier, case study), ui/ (primitives)
content/        data.ts (everything said), schema.ts, derive.ts, the bake's JSON
lib/            the governor, tier, scroll, navigation, motion, tokens, analytics, seo, og, jsonld…
scripts/        bake.ts + bake/, fonts/, posters.ts, the gates, audit/
styles/         tokens.css and one stylesheet per section
e2e/            the visual matrix and its baselines
```
