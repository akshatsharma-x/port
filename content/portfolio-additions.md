# Portfolio additions

Projects and certifications for the site: the projects from Akshat Sharma's GitHub repositories (2026-11-26), the certifications from LinkedIn (2026-11-25). **All of it is on the site since 2026-11-26**, in `content/data.ts` (the site doesn't read this file; it's the record of where each fact came from). The field rules are in [CONTENT_INTAKE.md](../CONTENT_INTAKE.md) (§5 projects, §7 certificates). What's still missing is in the two "Still open" lists.

## Projects

Eight repositories. Two are already on the site under their résumé names (QuizMUJ and Automated Resume Screening), and six are new. Every live link below loaded (HTTP 200) on 2026-11-26.

**Front** is the WORK carousel (`featured`, up to 8) and **back** is the project index. The site uses this split; say if you want it changed.

| Place | Project | Repository | Live | On the site now |
|---|---|---|---|---|
| Front | NEXUS | [nexus](https://github.com/akshatsharma-x/nexus) | [nexus-opal-phi-60.vercel.app](https://nexus-opal-phi-60.vercel.app) | new |
| Front | ResearchX | [ResearchX](https://github.com/akshatsharma-x/ResearchX) (a fork) | — | new, unless it's Cognivault AI |
| Front | CV-Scan | [cv-scan](https://github.com/akshatsharma-x/cv-scan) | — | as Automated Resume Screening |
| Front | QuizMUJ | [Quiz-App](https://github.com/akshatsharma-x/Quiz-App) | — | as QuizMUJ |
| Front | BBC News Retrieval | [BBC-News-Retrieval](https://github.com/akshatsharma-x/BBC-News-Retrieval) | [search app](https://akshatsharma-x.github.io/BBC-News-Retrieval/app/) | new |
| Front | Vistara | [Vistara](https://github.com/akshatsharma-x/Vistara) | [vistara-delta-fawn.vercel.app](https://vistara-delta-fawn.vercel.app) | new |
| Back | CabinMUJ | [CabinMUJ](https://github.com/akshatsharma-x/CabinMUJ) | [cabin-muj.vercel.app](https://cabin-muj.vercel.app) | new |
| Back | MyHUB | [MyHub](https://github.com/akshatsharma-x/MyHub) | [akshatsharma-x.github.io/MyHub](https://akshatsharma-x.github.io/MyHub/) | new |
| Back | Cognivault AI · Customer Churn Prediction · Web Accessibility Analyzer | — | — | yes, from the résumé, with no screenshots yet |

Why this split: every front project has a repo and real screenshots, and together they cover agents, NLP, search, full-stack and fintech. CabinMUJ is a narrower campus tool. MyHUB's premise (public data read as one person's decade) needs more explaining than a slide gives. The three résumé projects have only a title card until their repos and screenshots arrive.

### NEXUS · front

A personalized learning platform for career transitions: conversational onboarding, an adaptive learning path, a 3D skill map, assessments and an offline tutor.

- Onboarding is a conversation. It extracts the target role, timeline, experience and skills, and shows the profile it's building as you talk.
- A staged journey of skills, resources, projects and assessments. Steps unlock as their prerequisites complete, and assessment results are written back into per-skill mastery.
- The Skill Universe draws every skill as a 3D knowledge map, coloured by mastery.
- The tutor answers from the learner's own progress and runs fully offline by default (Claude is optional). There are no accounts, and all data stays in the browser.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion, Three.js, React Three Fiber, Anthropic SDK (optional)
**First commit:** 2026-08-27 · **Screenshots:** [8 in docs/screenshots](https://github.com/akshatsharma-x/nexus/tree/main/docs/screenshots): home-dark (the README's lead), onboarding, journey, skills, assessment, tutor, home-light, mobile

### ResearchX · front

An autonomous multi-agent research platform. A LangGraph pipeline of 17 agents plans the research, searches the web, academic sources and news in parallel, fact-checks claims against the evidence, hunts for counter-evidence, and writes a report in which every `[n]` citation points to a real, numbered source.

- Two budgeted feedback loops: a replanner adds searches for unanswered sub-questions, and a critic and a citation verifier send weak drafts back for revision.
- Durable jobs: the graph's state is checkpointed to PostgreSQL after every step, so a job whose worker dies resumes where it stopped.
- Grounded citations: the reference list is generated from the source data, not by the model, and a citation can only point to a source that exists.
- Bounded cost: the research workers make no LLM calls, a run takes about 13 Gemini calls, and the public API has per-IP and daily job limits.

**Stack:** LangGraph, LangChain, Gemini, Tavily, FastAPI, Celery, Redis, PostgreSQL, Alembic, Next.js 16, React 19, Tailwind CSS 4
**History:** a fork of [Adyashas/ResearchX](https://github.com/Adyashas/ResearchX). Adyashas made the first commit (2026-08-12); Akshat's two commits (2026-11-26) wire up the full research pipeline and make the app deployable. **Live:** not yet; the README deploys the backend to Railway and the frontend to Vercel.
**Screenshots:** [3 in docs/screenshots](https://github.com/akshatsharma-x/ResearchX/tree/master/docs/screenshots): hero (lead), pipeline-running, agent-trace

### CV-Scan · front · on the site as "Automated Resume Screening"

Explainable AI resume screener: ranks resumes against a job description with a hybrid TF-IDF + Sentence-BERT score, shows which skills drive each score, and benchmarks candidates against 2,361 historical resumes.

- Batch screening of PDF, DOCX and TXT resumes into a ranked leaderboard, with CSV export.
- Each keyword score is broken down by term, next to the job's key requirements found and missing.
- A pool benchmark (the candidate's percentile among historical resumes for the same job), a 2D/3D PCA semantic map, and a calibrated SVM that predicts each resume's domain out of 24.

**Numbers** (held-out evaluation, from the README): hybrid category accuracy 0.786, against 0.704 for TF-IDF alone; job → resume ranking ROC-AUC 0.892, MRR 0.832, nDCG@10 0.666.
**Stack:** Python, Streamlit, Sentence-BERT (all-MiniLM-L6-v2), TF-IDF, LinearSVC, PCA, NLTK, Plotly
**First commit:** 2026-08-14 · **Live:** none (the README has Streamlit Community Cloud steps) · **Screenshots:** [8 in docs/screenshots](https://github.com/akshatsharma-x/cv-scan/tree/main/docs/screenshots): home (lead), results, results-light, deep-dive, benchmark, semantic-map, evaluation, ranking-benchmark
**Note:** the "Table 3" and "Figures 9–11" in its README come from the NLP course report in the repo, not from either SCI-2026 paper, so it stays unlinked to the papers.

### QuizMUJ · front · on the site

Proctored quiz and assessment platform for Manipal University Jaipur: focus-mode exams, live proctoring, instant analytics and leaderboards.

- Focus-mode exams with a server-controlled timer, plus autosave to the server and the device, so a reload, crash or device switch resumes the attempt.
- Proctoring: tab switches, leaving the window, exiting full screen, copy attempts and disconnects stream live to faculty, and more than 3 violations flags the attempt.
- Faculty get a quiz builder with cohort targeting and CSV import, per-quiz analytics down to each question's most common wrong answer, and a live monitor with a force-end button.
- Sign-up takes only university email addresses, verified by one-time codes. Sockets use the same JWT auth as the REST API, and answers stay hidden until the quiz's reveal policy allows.

**Stack:** HTML, CSS, JavaScript, Node.js, Express 5, MongoDB (Mongoose), Socket.io, Nodemailer, Docker
**First commit:** 2026-02-06 · **Live:** none (the README describes a free Render showcase but gives no URL) · **Screenshots:** [15 in docs/screenshots](https://github.com/akshatsharma-x/Quiz-App/tree/main/docs/screenshots): 03-student-dashboard is the lead; 05-exam-focus-mode and 06-faculty-live-monitor show the proctoring
**Fix on the site:** its stack lists Tailwind CSS, but the repo's front end is plain HTML, CSS and JavaScript, with no Tailwind in it.

### BBC News Retrieval · front

Lexical, semantic and hybrid search over the BBC News archive, with a purpose-built test collection, a full evaluation and a news-desk search interface. An Information Retrieval course project.

- Four rankers over one inverted index: TF-IDF, BM25, a Sentence Transformer (best-passage cosine), and a hybrid that fuses BM25 and the Sentence Transformer by Reciprocal Rank Fusion.
- A TREC-style test collection built from scratch: 25 topics, 12 of them deliberately paraphrased, with 957 graded relevance judgments.
- The live app runs entirely in the browser: a JavaScript port of the engine, with the encoder as a half-precision ONNX model through transformers.js. It matches the Python engine (TF-IDF and BM25 exactly, the neural models' MAP to 3 decimals).

**Numbers:** hybrid MAP 0.811 and Recall@100 0.992 on the 25 topics; on 2,066 known-item queries, hybrid MRR 0.812, ahead of every other model (p < 0.001); about 4 ms per hybrid query.
**Stack:** Python, Sentence Transformers (all-MiniLM-L6-v2), BM25, TF-IDF, NLTK, Streamlit, Altair, transformers.js, ONNX
**First commit:** 2026-11-25 · **Live:** [search app](https://akshatsharma-x.github.io/BBC-News-Retrieval/app/) · [project page](https://akshatsharma-x.github.io/BBC-News-Retrieval/), plus a report and slides (PDF) in docs/ · **Screenshots:** [outputs/figures](https://github.com/akshatsharma-x/BBC-News-Retrieval/tree/main/outputs/figures): ui_search (lead), ui_compare, ui_benchmark, ui_explorer, pipeline_light

### Vistara · front

Credit scoring for thin-file applicants that reads only the timing of recurring life events (vehicle service, UPI mandates, utility bills, phone recharges, FASTag), never amounts. A Next.js/TypeScript prototype built for the TVS Credit hackathon; all data is synthetic.

- Five signals, each with an expected cadence and a weight, each scored on how steady its gaps are. Coherence across signals carries 25% of the score, so being evenly consistent beats excelling at one habit.
- The result is a 300–900 score with a tier, a loan offer, a recommended EMI date and a dated path to the next tier. Thin files get a rhythm-building path instead.
- A loan officer's queue ranks the twelve sample applicants. The engine is plain TypeScript with no ML library, and seeded, so the same input always gives the same score.

**Stack:** Next.js, TypeScript
**First commit:** 2026-11-25 · **Screenshots:** [8 in docs/screenshots](https://github.com/akshatsharma-x/Vistara/tree/main/docs/screenshots): 01-landing to 08-method (the README embeds none of them)

### CabinMUJ · back

Find any Manipal University Jaipur faculty member, and their block, floor and cabin, in seconds. Students search and browse; an admin keeps the data accurate.

- Live search that shows block, floor and cabin as you type; a directory filtered by department, block, floor, designation or HoD; a campus map, block by block and floor by floor.
- Students report outdated locations. The admin panel tracks verification, resolves those reports, keeps a full change history with restore, and backs up all data as JSON.

**Stack:** Next.js, TypeScript, Upstash Redis, Vercel, Python (the faculty scraper)
**First commit:** 2026-08-16 · **Screenshots:** [9 in docs/screenshots](https://github.com/akshatsharma-x/CabinMUJ/tree/main/docs/screenshots): home, search, directory, profile, campus-map, mobile-profile, admin-dashboard, admin-faculty, admin-editor
**Check:** the README says the seed data's cabin locations were assigned at random and start as "unverified". The portfolio shouldn't call the locations accurate until they're verified.

### MyHUB · back

"Your Life, In Receipts." Three public datasets (162,588 rows) read as one person's decade: 2,411 receipts in nine kinds, the connections between them, and a story about what they add up to. None of the rows is Akshat's, and the app says so on its /sources page.

- Eight routes: searchable receipts, 120 threads with the reason printed on every link, a constellation of 131 entities, six eras, rhythms with 14 findings, a ten-beat story, and the sources.
- A deterministic build-time ETL, and no server or runtime network calls at all: every page is static, on GitHub Pages.
- A verification suite drives the production build in headless Chrome across 8 pages × 4 widths × 2 themes, checking overflow, an 11px type floor, keyboard paths, WCAG contrast and layout shift.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion, GitHub Pages
**First commit:** 2026-11-25 · **Screenshots:** [6 in docs/screenshots](https://github.com/akshatsharma-x/MyHub/tree/main/docs/screenshots): archive (lead), story, constellation, rhythms-light, receipt, phone

### Still open for the projects

- [ ] **ResearchX or Cognivault AI?** Both are multi-agent research assistants. Is ResearchX the same project or a second one? And what should its role line say, given Adyashas started the repo?
- [ ] **Years.** All eight repos were first committed in 2026, but MyHUB, BBC News Retrieval and Vistara on 2026-11-25, probably when they were uploaded. Their real years are needed, and the TVS Credit hackathon's date. Until then every project shows its year as pending.
- [ ] **Roles.** Solo or team, for each project (shown as pending until then).
- [ ] **Live links** for QuizMUJ and CV-Scan, if their Render and Streamlit apps are up.
- [ ] **Web Accessibility Analyzer's repo is private**, and Cognivault AI has no repo under that name, so both keep their title cards. [customer-churn-prediction](https://github.com/akshatsharma-x/customer-churn-prediction) is linked.
- [x] **Covers.** Each lead screenshot was cut to 3:2 by hand (centre, top or left, so no logo or nav is clipped). CabinMUJ's search and profile screenshots were left out: they show real faculty names beside placeholder cabin numbers, and one person's photo, email and phone.

## Licenses & certifications

Copied from LinkedIn on 2026-11-25, in LinkedIn's order. Every **Show credential** link opens [the LinkedIn certifications page][linkedin].

| # | Certification | Issuer | Issued | Credential ID | Skills | Credential |
|--:|---|---|---|---|---|---|
| 1 | Claude Code in Action | Anthropic | Jul 2026 | A3WZHUFAVB2T | Claude Code | [Show credential][linkedin] |
| 2 | Red Hat System Administration II (RH134 - RHA) - Ver. 9.3 | Red Hat | Mar 2025 | — | — | [Show credential][linkedin] |
| 3 | Red Hat System Administration I (RH124 - RHA) - Ver. 9.3 | Red Hat | Mar 2025 | — | — | [Show credential][linkedin] |
| 4 | Introduction to Containers w/ Docker, Kubernetes & OpenShift | IBM | Mar 2026 | Z8JB88YRGJCV | — | [Show credential][linkedin] |
| 5 | Introduction to DevOps and Git for Beginners | Simplilearn | Mar 2026 | EO663YJ19PUX | — | [Show credential][linkedin] |
| 6 | AWS Cloud Practitioner Essentials | Amazon Web Services (AWS) | Jul 2026 | CO9GMSYMB8XC | Amazon Web Services (AWS) | [Show credential][linkedin] |
| 7 | Network Fundamentals | Cisco | — | UOTYMANQCF0A | — | [Show credential][linkedin] |
| 8 | Data Analytics Workshop | Coding Ninjas 10X Club | — | — | Data Analysis, Microsoft Power BI, +1 skill | [Show credential][linkedin] |
| 9 | Java Programming for Beginners | IBM | Jul 2025 | — | Java, Object-Oriented Programming (OOP) | [Show credential][linkedin] |
| 10 | Database Design | Oracle | Nov 2024 | — | Oracle Database, Database Design | [Show credential][linkedin] |
| 11 | Smart India Hackathon (Internal Round) | Manipal University Jaipur | Sep 2024 | — | — | [Show credential][linkedin] |
| 12 | Database Programming with SQL | Oracle | Nov 2024 | — | Oracle Database, SQL, +2 skills | [Show credential][linkedin] |
| 13 | Data Structures & Algorithms lab | CodeChef | Nov 2024 | 6d3d989 | Data Structures, C (Programming Language) | [Show credential][linkedin] |
| 14 | Object Oriented Programming Using JAVA | GeeksforGeeks | — | — | Java, Object-Oriented Programming (OOP) | [Show credential][linkedin] |
| 15 | Design and analysis of algorithms | NPTEL | Apr 2025 | — | Data Structures, Algorithm Design, +1 skill | [Show credential][linkedin] |
| 16 | Data Structures and Algorithms using Java | NPTEL | Nov 2024 | — | Data Structures, Java | [Show credential][linkedin] |

**8 · Data Analytics Workshop.** LinkedIn describes the certificate as: 'Break into Data Analytics', hosted by Coding Ninjas in collaboration with KodeinKGP – IIT Kharagpur, featuring Anubhav Agarwal, Data Analyst & Sr. Product Manager at Avalara.

### Still open for the certifications

The table's columns became `title`, `issuer`, `issueDate`, `credentialId`, `skillsCovered` and `verifyUrl`. LinkedIn shows no expiry dates, so `expiryDate` is none for all of them.

- [x] **Dates.** A credential now takes the month alone, or no date (7, 8 and 14 show "Not listed"). The day can still be added from each certificate.
- [x] **Credential IDs.** A credential without one reads "Not listed" (2, 3, 8, 9, 10, 12, 14, 15 and 16). Add any the certificates print, exactly as printed.
- [ ] **Skills.** LinkedIn lists none for 2, 3, 4, 5 and 7, so the site's are drafted from the course titles (Linux and Red Hat Enterprise Linux; Docker, Kubernetes and OpenShift; DevOps and Git; Networking). The ones folded into "+1 skill" or "+2 skills" on 8, 12 and 15 are still missing.
- [x] **Verification.** Every card links to the LinkedIn certifications page and reads ON FILE: the build never fetches a page behind a sign-in. On LinkedIn, the **Show credential** buttons on 13 entries open the issuer's own page; send those links and the cards can earn VERIFIED. Entries 8, 10 and 12 have only a certificate image.
- [x] **Smart India Hackathon (11)** is the existing record's proof link, not a second card: 15 credentials on the wall.
- [ ] **Site-only fields.** Each credential's `domain` (AI · Cloud & DevOps · Linux & networking · Data · Programming · Algorithms), `level` (foundational, for all fifteen) and one-line `proves` are drafts from the course titles and syllabi, for you to confirm. Featured: Claude Code in Action, AWS Cloud Practitioner Essentials, IBM's containers course and Red Hat System Administration II.

[linkedin]: https://www.linkedin.com/in/akshatsharma-in/details/certifications/
