# Leftovers — after the owner's content (2026-11-26)

What's still open after the projects, credentials, photo and Merck role went on the site (DESIGN.md v2.8, `content/portfolio-additions.md`). First the facts only Akshat can supply, then the checks a session didn't finish.

## Facts to send (they replace a `TODO(akshat)` in `content/data.ts`)

- [ ] **ResearchX vs Cognivault AI.** Both are multi-agent research assistants. Are they the same project or two? ResearchX is a fork of Adyashas/ResearchX: Adyashas made the first commit, and Akshat's two wire up the pipeline. What should its role line say?
- [ ] **Each project's year and role** (solo or team). All are shown as pending. MyHUB, BBC News Retrieval and Vistara were first committed on 2026-11-25, which looks like the upload date. When was the TVS Credit hackathon?
- [ ] **Live links** for QuizMUJ (Render) and CV-Scan (Streamlit), if those apps are up.
- [ ] **Merck Group:** the location (India for now), and the stack and highlights once the work starts. The card has one highlight, so the bake warns that it shows three.
- [ ] **CURRENTLY → building** still names United Airlines' Cartographer, which ended in November. What are you building from December?
- [ ] **Credentials:**
  - the issue days (only months are shown; 3 have no date);
  - the IDs the certificates print (9 read "Not listed");
  - the skills LinkedIn folds into "+1 skill";
  - each issuer's own verify link, behind LinkedIn's **Show credential**, so a card can earn VERIFIED (LinkedIn's page needs a sign-in, so every card reads ON FILE);
  - confirm the drafted domain, level (all foundational) and "proves" lines.
- [ ] **Confirm the drafted copy:** each project's problem, approach and outcome are written from its README, and the tagline and bios now name Merck Group.
- [ ] `me.jpeg` (the original photo) is untracked in the repo root and wasn't committed. The site uses `public/media/profile/photo.jpg`, a head-and-shoulders crop with no EXIF. Delete it or keep it outside the repo.

## Checks to finish (engineering)

- [ ] **Visual baselines.** The visual matrix wasn't re-run. Run `npx playwright test` against a production build on :3200. If `/work/cognivault-ai` changed (its neighbours in the project order did), run `npx playwright test --update-snapshots`, look at the diffs, and commit them. CI's `visual` job fails until then.
- [ ] **Boot gate, reduced motion:** the crossfade measured 423 ms against ≤ 420. It was 884 before the cards skipped off-screen rendering (`content-visibility`). Re-measure with `node scripts/boot-gate.mjs` on a quiet machine. If it's still over, skip more off-screen work (another heavy section).
- [ ] **LCP on home:** 1,832–1,934 ms locally (mobile, devtools throttling) against the 1.8 s budget. The machine was busy (benchmarkIndex 3,900–4,650), and locally the HTML is served gzipped (66.4 KB). Vercel serves Brotli (42 KB), so measure on the deployed site (PageSpeed Insights or Speed Insights) and record it in DESIGN.md §8.3's LCP row.
- [ ] **The audit's touch targets:** the last fix (`.record__proof` at 44 px on a coarse pointer) wasn't re-run. Run `node scripts/audit-gate.mjs --only=layout`. All its other parts passed after the fixes: overflow at 768 px (the section strip wraps), the tilt chip, and tiers.
- [ ] **A full gate pass after the last CSS fixes** (the strip wrap, the coarse targets). Before them: credentials 33/33, work 57/57, log 33/33, shell 43/43, scroll 64/64, hero 40/40, capabilities 46/46, boot 36/37, audit 52/56 (then layout and tiers again: 10/11).
- [ ] **CI:** the `budgets` job's Lighthouse step was already failing before this work (CRITIQUE.md #46). size-limit's home HTML budget is now 70 kB (66.40 measured).

## Deploying on Vercel

Import the repository (vercel.json pins `npm ci` and `npm run build`). For the contact form, set the env vars from `.env.example`: `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and optionally `CONTACT_TO` and `CONTACT_FROM`. Without them the form fails closed and offers mailto. Set `NEXT_PUBLIC_SITE_URL` once there's a domain. Enable Web Analytics and Speed Insights, then walk `docs/LAUNCH.md`. README.md § Deploying has the details.
