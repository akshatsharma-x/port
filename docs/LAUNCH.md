# Launch checklist

Walked on a local production build at Part 15 (2026-11-15); the results are below each item. Every check that needs a public URL is marked **after deploy** — it can't be run until the site is live.

Build under test: `npx tsx scripts/bake.ts --offline && NEXT_PUBLIC_SITE_URL=http://localhost:3200 RETROGRADE_DEV_ROUTES=1 npx next build && node scripts/boot-manifest.mjs`, served by `next start -p 3200`.

## 1. Lighthouse — mobile and desktop, all four categories

`sh scripts/audit/lh.sh <tag> <name> <path> 3` (Lighthouse 12.8.2, devtools throttling: Slow 4G, 4× CPU), and `npx lhci autorun` (Lighthouse CI's own, 13.6, median of three).

| Page | Run | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | desktop | 99 | 100 | 100 | 100 | 75 ms | 75 ms | 0 ms | 0.0000 | 1,205 ms |
| `/` | mobile 1 | 97 | 100 | 100 | 100 | 1,755 ms | 1,755 ms | 55 ms | 0.0000 | 4,164 ms |
| `/` | mobile 2 | 97 | 100 | 100 | 100 | 1,734 ms | 1,734 ms | 49 ms | 0.0000 | 4,143 ms |
| `/` | mobile 3 | 97 | 100 | 100 | 100 | 1,731 ms | 1,731 ms | 48 ms | 0.0000 | 4,136 ms |
| `/work/cognivault-ai` | desktop | 100 | 100 | 100 | 100 | 47 ms | 47 ms | 0 ms | 0.0000 | 591 ms |
| `/work/cognivault-ai` | mobile 1 | 97 | 100 | 100 | 100 | 1,716 ms | 1,716 ms | 21 ms | 0.0000 | 4,228 ms |
| `/work/cognivault-ai` | mobile 2 | 97 | 100 | 100 | 100 | 1,720 ms | 1,720 ms | 22 ms | 0.0000 | 4,226 ms |
| `/work/cognivault-ai` | mobile 3 | 96 | 100 | 100 | 100 | 1,720 ms | 1,720 ms | 24 ms | 0.0000 | 4,264 ms |
| `/research/food-waste-cold-chain-sci-2026` | desktop | 100 | 100 | 100 | 100 | 49 ms | 49 ms | 0 ms | 0.0000 | 326 ms |
| `/research/food-waste-cold-chain-sci-2026` | mobile 1 | 98 | 100 | 100 | 100 | 1,679 ms | 1,679 ms | 27 ms | 0.0002 | 3,250 ms |
| `/research/food-waste-cold-chain-sci-2026` | mobile 2 | 98 | 100 | 100 | 100 | 1,661 ms | 1,661 ms | 25 ms | 0.0002 | 3,249 ms |
| `/research/food-waste-cold-chain-sci-2026` | mobile 3 | 98 | 100 | 100 | 100 | 1,679 ms | 1,679 ms | 21 ms | 0.0002 | 3,203 ms |

Lighthouse 12.8.2, devtools throttling; benchmarkIndex 4,468–4,582. Mobile Performance 97 on `/`, 96–97 on a case study and 98 on a paper — over the 95 the checklist asks, so nothing to fix. LCP is first paint on every page (the text, gated by the render-blocking CSS on Slow 4G); the slowest run's 1,755 ms is 45 ms under the 1.8 s budget. Speed Index is the drag: it scores 0.76–0.78 on `/` and a case study (FCP 0.91–0.92, LCP 0.99, TBT and CLS 1). In the filmstrip, a first visit's boot holds `/` until between 3.9 and 4.7 s (throttled), and a case study's cover arrives between 4.0 and 4.8 s, after hydration, through DITHER RESOLVE. Both are the design (DESIGN §3, §7.4); a paper has no cover, and its Speed Index scores 0.91–0.92. The case study's 96 is its weighted 96.45 rounding down: it sits on the line, 96.45–96.65 over the three runs.

**Lighthouse CI** (`npx lhci autorun`, `lighthouserc.cjs`: Lighthouse 13.6.0, mobile, devtools throttling, three runs a page) — **every assertion passes** on the median run: LCP ≤ 1,800 ms, CLS ≤ 0.02, TBT ≤ 150 ms, Performance ≥ 95, and 100 for accessibility, best practices and SEO.

| Page | Run | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile 1 (median) | 97 | 100 | 100 | 100 | 1,744 ms | 1,744 ms | 63 ms | 0.0000 | 4,148 ms |
| `/` | mobile 2 | 97 | 100 | 100 | 100 | 1,740 ms | 1,740 ms | 49 ms | 0.0000 | 4,175 ms |
| `/` | mobile 3 | 97 | 100 | 100 | 100 | 1,740 ms | 1,740 ms | 51 ms | 0.0000 | 4,150 ms |
| `/work/cognivault-ai` | mobile 1 (median) | 97 | 100 | 100 | 100 | 1,723 ms | 1,723 ms | 20 ms | 0.0000 | 4,247 ms |
| `/work/cognivault-ai` | mobile 2 | 97 | 100 | 100 | 100 | 1,735 ms | 1,735 ms | 23 ms | 0.0000 | 4,253 ms |
| `/work/cognivault-ai` | mobile 3 | 97 | 100 | 100 | 100 | 1,725 ms | 1,725 ms | 25 ms | 0.0000 | 4,242 ms |
| `/research/food-waste-cold-chain-sci-2026` | mobile 1 | 98 | 100 | 100 | 100 | 1,673 ms | 1,673 ms | 26 ms | 0.0002 | 3,253 ms |
| `/research/food-waste-cold-chain-sci-2026` | mobile 2 (median) | 98 | 100 | 100 | 100 | 1,670 ms | 1,670 ms | 21 ms | 0.0002 | 3,237 ms |
| `/research/food-waste-cold-chain-sci-2026` | mobile 3 | 98 | 100 | 100 | 100 | 1,667 ms | 1,667 ms | 23 ms | 0.0002 | 3,246 ms |

benchmarkIndex 4,474–4,570.

## 2. Rich results — ScholarlyArticle and Person

- **Schema Markup Validator** (validator.schema.org, the pages' HTML posted): home, a case study and a paper — **0 errors, 0 warnings**. It reads WebSite, ProfilePage, Person (name, url, jobTitle, description, email, 28 `knowsAbout`, 2 `sameAs`), PostalAddress, CollegeOrUniversity, Organization, ScholarlyArticle (url, headline, name, description, datePublished, keywords, inLanguage, isAccessibleForFree, image, author) and CreativeWork.
- **Locally, every build**: `tests/seo.test.ts` — the graphs, every `@id` resolving, nothing a record lacks (no DOI, Scholar or ORCID profile, co-author, photo).
- **After deploy**: Google's [Rich Results Test](https://search.google.com/test/rich-results) on `/` (Profile page) and on each `/research/<slug>` (Article). Then add the site to Search Console and submit `/sitemap.xml`.

## 3. Social previews

- **Locally**: `BASE_URL=… node scripts/audit/social.mjs` — **8 of 8 pages pass**: og:title, og:description, og:type (article for papers), og:url = the canonical, og:site_name, og:image with its width, height, type and alt, and twitter:card `summary_large_image` with its title, description, image and alt. Each card fetched: a 200, a PNG truly 1200 × 630, 49–84 KB (X's limit is 5 MB).
- **After deploy**: the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) and a draft post on X, for `/`, a case study and a paper.

## 4. Broken links — every DOI, arXiv and verify URL

`BASE_URL=… node scripts/audit/links.mjs` — **29 links: 28 resolve, 1 behind a bot wall, 0 broken.**

- External: GitHub 200; LinkedIn 999 (its wall for any script; the profile resolves in a browser).
- DOIs: none yet; arXiv ids: none yet. Certificate verify URLs: fifteen since 2026-11-26, all the owner's LinkedIn certifications page, which needs a sign-in, so the bake never fetches it and the cards read ON FILE (`SIGN_IN_WALLS`, DESIGN v2.8). The bake's verify step checks each other one the moment it's added, and a dead DOI or arXiv id fails the build.
- Internal: every page in the sitemap, the 404, the eight share cards, the icons, the manifest, robots.txt, sitemap.xml and the publication list — all 200 (the 404 a 404).

## 5. Spelling

`npm run spell` (cspell 9.8 over `content/data.ts` and `content/no-signal.ts`, every word the site says) — **0 issues**. Its dictionary (`cspell.json`) holds the 42 names and terms it didn't know: people, companies and projects, BibTeX fields, icon slugs, and words like "explainability".

## 6. Browsers

`BASE_URL=… node scripts/audit/browsers.mjs` — **5 of 5 pass**: home through every section, a case study, a paper and NO SIGNAL; no uncaught error, no console error, no sideways overflow; the theme switch and the terminal on desktop. Every page's first screen is shot on each (`.artifacts/browsers/`) and was looked at: the checks read the DOM, not the picture.

| | Engine | Tier | |
|---|---|---|---|
| Chrome | Chrome 141 | HIGH | pass |
| Firefox | Firefox 159 | HIGH | pass |
| Safari | WebKit 27.2 | HIGH | pass |
| iOS Safari | WebKit 27.2, iPhone 15 emulated | LOW (phone policy) | pass |
| Android Chrome | Chrome 141, Pixel 7 emulated | LOW (phone policy) | pass |

What looking found:

- **Fixed — the scenes drew the accent white on every P3 screen.** In WebKit the hero's particles were gray where Chrome's were green: on the desktop their brightest pixels averaged rgb(177, 181, 177) against Chrome's (116, 179, 139), and the iPhone emulation's were gray to the eye. The build's CSS minifier (Lightning CSS) writes DESIGN §2.3's Display-P3 upgrades as `lab()` under `@supports`, and that's what a P3 screen computes. The GL colors read tokens from the computed style and knew hex and `oklch()` only, so `--accent` and `--hot` fell through to white. Chrome on an emulated P3 screen read the same (177, 181, 177), so it was every P3 screen in every engine: every iPhone since the 7, most Macs' built-in displays, wide-gamut Android phones. No gate saw it: headless Chrome reports sRGB. Now `lib/token-color.ts` reads `lab()`, `tests/token-color.test.ts` pins the build's own strings to the authored colors (within 2 × 10⁻⁶), and the hero gate checks the field's colors on an emulated P3 screen in Phosphor and Amber. After the fix, WebKit's particles are Chrome's green: rgb(115, 179, 131) against Chrome's (116, 179, 139), the lower blue being the P3 accent clamped to sRGB. On the emulated P3 screen the field's base color is (0, 1, 0.262) in linear light, where it was (1, 1, 1).
- **Open — the case study's cover on a portrait screen.** The hero is the cover at `object-fit: cover`, 100lvh, where the PROJECTION lands (DESIGN §7.4). On a phone that keeps about the middle third of the 3:2 cover (33% in a Pixel 7's viewport), and while the covers are title cards their type is cut: the first screen reads "ivault AI · rch assistant · GEMINI 1.5 · … · POSTGRESQ" in the iPhone 15 emulation and "vault AI · n assistant · INI 1.5 · … · POSTGR" in the Pixel 7's (`.artifacts/browsers/*--work-cognivault-ai.png`). Desktop shows the whole card; the visual matrix shoots the body past the cover. A fix changes DESIGN's landing, so it's the owner's call (DESIGN §7.4).
- Firefox's first shot caught the hero mid-resolve (its runtime arrives later than Chrome's); 4 s in, its particles are Chrome's green: rgb(120, 182, 142).

**After deploy, on devices**: an iPhone (Safari) and a mid-range Android (Chrome, Galaxy A54-class): the hero's frame rate, the phone keyboard over the terminal, the credential cards' gyro, VoiceOver and TalkBack.

## 7. Gates and budgets

`npx size-limit` (every §8.3 bundle and asset budget) and the twelve gates on the same build.

| Budget (`.size-limit.mjs`) | Limit | Size |
|---|---|---|
| first-load JS · / | 230 kB | 229.46 kB gz |
| first-load JS · / (hard cap) | 280 kB | 229.46 kB gz |
| first-load JS · a case study | 230 kB | 220.98 kB gz |
| first-load JS · a paper | 230 kB | 221.29 kB gz |
| HTML · / | 60 kB | 45.51 kB gz |
| stage runtime | 250 kB | 220.3 kB gz |
| scene · system | 35 kB | 3.02 kB gz |
| scene · log | 35 kB | 6.42 kB gz |
| scene · archive | 35 kB | 9.28 kB gz |
| scene · work | 35 kB | 11.39 kB gz |
| scene · capabilities | 35 kB | 10.3 kB gz |
| terminal | 30 kB | 12.75 kB gz |
| terminal · its index | 60 kB | 11.17 kB gz |
| fonts · all | 165 kB | 154.49 kB |
| fonts · preloaded | 125 kB | 113.97 kB |
| textures · all | 2.5 MB | 299.04 kB |
| textures · the largest file | 600 kB | 21.61 kB |

Every budget green (17 of 17). First-load JS is 0.21 KB more than before the browser walk: the GL colors' `lab()` reader (§6), in first-load with `#fx-gl` (`lib/fxgl.ts` reads the accent). 0.54 KB remains.

| Gate | Checks |
|---|---|
| `scripts/audit-gate.mjs` | 46 / 46 |
| `scripts/stage-gate.mjs` | 23 / 23 |
| `scripts/boot-gate.mjs` | 37 / 37 |
| `scripts/hero-gate.mjs` | 40 / 40 (the two P3 checks are new) |
| `scripts/log-gate.mjs` | 33 / 33 |
| `scripts/archive-gate.mjs` | 54 / 54 |
| `scripts/work-gate.mjs` | 57 / 57 |
| `scripts/capabilities-gate.mjs` | 46 / 46 |
| `scripts/credentials-gate.mjs` | 33 / 33 |
| `scripts/scroll-gate.mjs` | 64 / 64 |
| `scripts/connect-gate.mjs` | 53 / 53 |
| `scripts/shell-gate.mjs` | 43 / 43 |

**529 checks, all green**, on this build. With the unit tests (`npm test`: 406) and the visual matrix (`npx playwright test`: 72 of 72). The audit gate's vitals on it: INP 48 ms at 4× CPU over 21 interactions, CLS 0.0000 over a whole visit on a desktop and a phone, the JS heap 11 MB after every scene has been LIVE.
