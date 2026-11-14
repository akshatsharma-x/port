# RETROGRADE — Content intake

Everything the site says comes from one file, `content/data.ts`. This questionnaire collects it. Fill in the blanks, either here or straight into `content/data.ts`. Field names match the file one-to-one, and every limit below is enforced at build time: a mistake stops the build and names the field. The examples are the placeholder persona (Noor Halvorsen), so you can see a complete entry in context in `content/data.ts` and on `/dev/content`.

**When you're done**

1. Put files under `public/media/…` at the paths you entered (see §12).
2. In `content/data.ts`, set `IS_PLACEHOLDER = false`. This turns on the live bake, which refreshes citations from OpenAlex and checks every DOI, arXiv id and verify URL.
3. Run `npm run bake`. A dead DOI or arXiv id fails the bake. A credential URL that doesn't resolve shows **ON FILE** instead of **VERIFIED** and prints a warning.
4. Open `/dev/content` (`npm run dev`) and proofread every table, number and warning on that one page.

---

## 0. What makes a strong entry

**Outcomes, not responsibilities.**
- Every highlight carries a number: what changed, by how much, for whom.
- "Cut p95 render time from 2.3 s to 610 ms for 40k analysts" beats "Responsible for performance."
- The build warns about any highlight without a digit.

**Every paper gets a TLDR.**
- One plain-language sentence a smart non-specialist understands: no jargon, no "we propose".
- It sits right under the title. For most readers it is the only thing they'll read.
- The build rejects a TLDR that is two sentences.

**Identifiers that resolve.**
- A DOI must resolve at doi.org, and an arXiv id at arxiv.org. A verify URL must open logged-out, in a private window.
- Copy the public verification link (a Credly badge page, an issuer's "verify" URL), not your dashboard.
- The site only stamps VERIFIED on what the build actually reached. A credential with no verify URL is shown honestly as ON FILE.

**Honest skill levels.** Levels describe evidence, not confidence. There are no percentages anywhere.

| Level | Means | Test |
|---|---|---|
| 1 · Used | worked with it on someone else's codebase or project | you could name the project |
| 2 · Built | built something real with it yourself | there's a repo, demo or artifact |
| 3 · Shipped | it's in production, used by people who aren't you | there's a user, a client, a URL |
| 4 · Led | you set direction: architecture, team, standards | someone followed your decisions |
| 5 · Taught/Published | you taught it, or published or spoke on it | there's a course, paper, talk or widely used library |

The site counts evidence next to each level: how many of your projects list the skill in their stack, how many roles do, and how many papers mention it. A level 5 with zero evidence will look odd, and that's the point.

**Two choices tune the design, so send them early.**
- **Your name's length tunes the hero.** The name fills 12 columns by adjusting the type's width axis at a fixed size. Long names get narrower letters, and past the narrowest width they wrap to two lines. If you go by a long full name, also tell us the display name you want.
- **Your paper count tunes the constellation.** Ten papers make a sparse sky; eighty make a dense one. The camera path, node sizes and edge density are tuned to the real count, and nothing in Research can be tuned on placeholders.

**Characters.** The fonts are subset to Latin (ASCII + Latin-1 + typographic punctuation). Names like "Júlia" work; letters outside Latin-1 (ł, ş, ő, Vietnamese, CJK…) need the font subset widened first. `npm test` lists any character the fonts can't draw.

---

## 1. Profile — one

| Field | Your answer | Rules | Example |
|---|---|---|---|
| `name` | ______ | ≤ 40 characters | Noor Halvorsen |
| `initials` | ______ | 1–3 capital letters (the hero's first particle state) | NH |
| `role` | ______ | ≤ 40 characters (it scrambles in the hero) | Design engineer & HCI researcher |
| `tagline` | ______ | ≤ 90 characters, one line | I build interfaces for machine learning and study how people read them. |
| `location.city` / `country` / `countryCode` | ______ / ______ / __ | ISO 3166 two-letter code | Amsterdam / Netherlands / NL |
| `coordinates.lat` / `lon` | ______ / ______ | decimal degrees; city level is plenty (it lights your city on the hero globe) | 52.3676 / 4.9041 |
| `timezone` | ______ | IANA name | Europe/Amsterdam |
| `workingHours.start` / `end` | __:__ / __:__ | 24-hour local time (drives the contact-time overlap) | 09:00 / 17:30 |
| `availability.status` | ______ | `open` · `limited` · `closed` | open |
| `availability.note` | ______ | ≤ 120 characters | Open to research-engineering roles from March 2027. |
| `bio.short` | ______ | ≤ 200 characters, one or two sentences | — |
| `bio.long` | ______ | 1–5 paragraphs, ≤ 700 characters each | — |
| `avatar.src` / `alt` | ______ / ______ | a path under `/media/…`; alt ≤ 160 characters, describing the photo | /media/profile/portrait.jpg |
| `resumeUrl` | ______ | a site path (`/media/…pdf`) or an https URL | /media/profile/noor-halvorsen-cv.pdf |
| `email` | ______ | a real inbox you read | hello@… |
| `socials[]` | platform · url · handle | platform ∈ github, linkedin, x, bluesky, mastodon, website, dribbble, youtube; https only | github · https://github.com/… · @noorh |
| `scholarProfiles[]` | platform · url · id | platform ∈ googleScholar, orcid, scopus, researchgate, dblp | orcid · https://orcid.org/0000-… · 0000-… |

**Strong:** the scholar profiles are where the site sends people for the canonical metrics, so include at least Google Scholar or ORCID.

## 2. Site copy

| Field | Your answer | Rules |
|---|---|---|
| `site.title` | ______ | ≤ 80 characters; the browser tab and search results |
| `site.description` | ______ | ≤ 200 characters; the search snippet |
| `site.sections[].title` | keep or rename | the eleven sections have a fixed order and codes; only their titles are yours |
| `site.topicClusters` | slug → name | one entry per research theme; each paper picks one (§4) |
| `site.labels.heroStrip` | four labels | the hero spec strip: years · shipped · papers · citations |

## 3. Experience — one block per role

The punch-card rail holds up to 12 cards. Five to eight reads best.

```
company:     __________________________   e.g. Northwind Labs
role:        __________________________   ≤ 60 · e.g. Senior Design Engineer
type:        __________________________   full-time | part-time | contract | freelance | internship | research
start:       ____-__                      YYYY-MM · e.g. 2024-03
end:         ____-__  or  present
location:    __________________________   e.g. Amsterdam (hybrid)
blurb:       __________________________   ≤ 200 · what the team/company does and what you owned
highlights:  1. ________________________  exactly three read best · ≤ 200 each · each with a number
             2. ________________________
             3. ________________________
metrics:     label · value · unit         ≤ 4 · e.g. "p95 render" · 610 · ms
stack:       __________________________   ≤ 10 · use the same spelling as your skills (§6)
logo:        /media/logos/______.svg      optional
url:         https://__________________   optional
```

**Strong:** "Shipped the embedding explorer used in 1,200 model reviews a month", not "Worked on ML tooling." The years printed on the card are real: the card's holes encode the company and years in Hollerith code, and the terminal's `decode` reads them back.

## 4. Publications — one block per paper

Include under-review and in-prep work: they're shown with a dashed outline and a STATUS stamp, and never counted in the totals.

```
slug:          ______________________   kebab-case, permanent (it's the URL: /research/<slug>) · e.g. embedding-explorer-chi-2025
title:         ______________________   ≤ 200, as published
authors:       name · isMe · affiliation   in byline order; exactly one isMe: true
coAuthorIds:   ______________________   one stable id per co-author, in byline order, the same id across papers · e.g. julia-varga
venue:         ______________________   full name · e.g. Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems
venueShort:    ______________________   ≤ 16 · e.g. CHI '25
venueType:     ______________________   journal | conference | workshop | preprint | patent | thesis | chapter
year / month:  ____ / __                month optional (1–12)
status:        ______________________   published | accepted | underReview | inPrep
doi:           10.____/_____________    bare DOI, no https://doi.org/ — checked at build
arxivId:       ____.______              e.g. 2507.12345 — checked at build
pdfUrl / codeUrl / datasetUrl:          optional, https (or a /media path for the PDF)
abstract:      ______________________   ≤ 2,500
tldr:          ______________________   ONE plain-language sentence, ≤ 200, ends with a period
keywords:      ______________________   1–8
citations:     ____                     your current count (the fallback when OpenAlex can't be reached)
citationsAsOf: ____-__-__               the date you read that count
citationSource: _____________________   OpenAlex | Google Scholar | Semantic Scholar | Crossref | Manual
impactFactor:  ____                     journals only, optional
isOpenAccess:  yes / no
isPeerReviewed: yes / no                only journals, conferences, workshops and chapters that are published or accepted
topicCluster:  ______________________   a key of site.topicClusters
relatedPublicationSlugs: ____________   slugs of papers this one builds on or extends
featured:      yes / no
bibtex:        @inproceedings{key, …}   its year, doi and arXiv id must match the fields above
```

**Strong:**
- **TLDR.** "People spot outliers faster when a million points render progressively instead of all at once." Not "We present a progressive rendering technique for large-scale embedding exploration."
- **Citations.** With a DOI, every build refreshes the count from OpenAlex and stamps the date. h-index and i10 are computed from the counts the site shows, and labeled that way. Google Scholar usually counts more sources, which is why the site links to your Scholar profile for the canonical numbers.
- **Cross-references.** Relations, shared co-authors and shared topics become the constellation's edges. A paper with no relations floats alone.

## 5. Projects — one block per project

Up to 8 can be `featured` (the slide carousel). The rest appear in the index.

```
slug:      ______________________   kebab-case, permanent (/work/<slug>)
title:     ______________________   ≤ 40
subtitle:  ______________________   ≤ 90 · what it is, in a line
year:      ____
role:      ______________________   ≤ 60 · your part, honestly · e.g. Lead engineer (team of 4)
category:  ______________________   ≤ 32
summary:   ______________________   ≤ 240
problem:   ______________________   ≤ 900 · who hurt, and how much
approach:  ______________________   ≤ 1,200 · what you did and the key decision
outcome:   ______________________   ≤ 700 · what changed, measured
metrics:   label · value · unit     ≤ 4
stack:     ______________________   1–10, same spellings as your skills
links:     live · repo · case · paper   all optional; https (case: a /media path)
media:     image | video · src · alt (≤ 240) · poster (video)   at least one; first is the slide cover
relatedPublicationSlugs: ________   papers this project came from or produced
featured:  yes / no
```

**Strong:** the outcome is a measurement ("Three pilot teams coded transcripts 41% faster") and the problem names who it was for. Link the paper if there is one: the project and the paper then link to each other.

## 6. Skills — one line each

Up to 40 keycaps; at most 6 `primary` (the accent keys). Group them into a handful of categories.

| `name` | `category` | `level` 1–5 | `years` | `legend.label` (≤ 6) | `primary` | `aliases` |
|---|---|---|---|---|---|---|
| ______ | ______ | __ | __ | ______ | yes/no | other spellings |
| three.js | Interface & graphics | 4 | 7 | three | yes | Three.js, R3F |

**Strong:** spell skills the way your project and role stacks spell them (or add the variant to `aliases`), so the evidence count finds them.

## 7. Certificates — one block per credential

```
slug:          ______________________   kebab-case
title:         ______________________   ≤ 120
issuer:        ______________________   e.g. Amazon Web Services
issueDate:     ____-__-__
expiryDate:    ____-__-__  or  none
credentialId:  ______________________   exactly as the issuer prints it
verifyUrl:     https://______________   public, logged-out — or none (shows ON FILE)
skillsCovered: ______________________   1–8
domain:        ______________________   ≤ 32 · e.g. Cloud
level:         ______________________   foundational | associate | professional | expert
proves:        ______________________   ≤ 140 · one line: what it demonstrates you can do
featured:      yes / no
issuerLogo:    /media/issuers/____.svg  optional
```

**Strong:**
- **Keep expired credentials.** They show as expired, which is honest, and the wall reads "12 CREDENTIALS / 5 ISSUERS / 11 ACTIVE".
- **`proves` answers "so what?"** "Can design fault-tolerant multi-region AWS architectures", not "AWS certification."
- **A verify URL proves the page exists, not that the credential is valid.** Some issuers return a normal page even for a wrong ID, so copy `credentialId` exactly: it travels with the stamp (the terminal's `verify` prints both) so anyone can check it with the issuer.

## 8. Achievements — awards, honors, talks, open source, press, grants, patents

```
title:       ______________________   ≤ 120
issuer:      ______________________   who gave it / where
date:        ____-__-__  or  ____-__
kind:        award | honor | speaking | oss | press | grant | patent
description: ______________________   ≤ 240
proofUrl:    https://______________   strongly recommended (the build warns without one)
metric:      label · value · unit     optional · e.g. "GitHub stars" · 2300 — OSS star counts add up into the records tile
```

## 9. Education

```
institution · degree (≤ 40) · field (≤ 80) · start YYYY-MM · end YYYY-MM | present · location
thesis (≤ 200, optional) · honors (≤ 80, optional) · url (optional)
```

## 10. Testimonials — only with permission

```
quote (≤ 400) · name · role · company · relationship (≤ 80, e.g. "Managed me for two years at Northwind")
url (optional) · consented: true   ← the build refuses a quote without it
```

**Strong:** a quote about a specific thing you did ("She rebuilt our review tool in six weeks and the backlog was gone by spring"), not your character. Ask the person to approve the exact wording.

## 11. Current focus — exactly one of each

| `kind` | `title` (≤ 80) | `detail` (≤ 160, optional) | `url` (optional) |
|---|---|---|---|
| building | ______ | ______ | ______ |
| reading | ______ | ______ | ______ |
| researching | ______ | ______ | ______ |

## 12. Files checklist

Paths are yours to choose; these are the conventions the placeholder uses. `npm run bake -- --verbose` lists every referenced file that's missing.

- [ ] `public/media/profile/` — portrait (≥ 1200 px on the long side) and the CV PDF
- [ ] `public/media/logos/` — one SVG per company, monochrome (color on this site is reserved for state)
- [ ] `public/media/projects/<slug>/` — the cover (3:2, ≥ 2048 × 1365) plus any gallery images and videos (MP4/H.264 with a poster frame)
- [ ] `public/media/skills/` — keycap logos, SVG (optional)
- [ ] `public/media/issuers/` — certificate issuer logos, SVG (optional)
- [ ] papers: PDFs under `public/media/papers/` only if you have the right to host them; otherwise link the publisher or arXiv

## 13. Before launch

- [ ] `IS_PLACEHOLDER = false`, and `npm run bake` runs live with no failures.
- [ ] Every warning on `/dev/content` is either fixed or a deliberate choice.
- [ ] Every number on `/dev/content` is one you'd defend to a reviewer.
- [ ] Every testimonial's author has approved the wording.
