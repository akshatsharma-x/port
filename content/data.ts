/**
 * Akshat Sharma's content — every word and number the site says (DESIGN.md §8, content/schema.ts).
 *
 * Source: the three résumé versions supplied on 2026-11-11 (akshat da.pdf, akshat-res.pdf,
 * ak_gen.pdf), merged; where they disagree the majority wins and the line says so. What the
 * résumés don't say is marked TODO(akshat): a draft from the facts, or a placeholder that says
 * it is one. Nothing here is invented to look complete. No phone number: the site doesn't
 * publish it.
 */
import { noSignal } from "./no-signal";
import type { ContentInput } from "./schema";

export const IS_PLACEHOLDER = false;

type In = ContentInput;

// ── site copy ────────────────────────────────────────────────────────────────────────────────

export const site = {
  title: "Akshat Sharma — AI & ML engineer, full-stack developer",
  description:
    "A portfolio you boot, not browse: generative-AI systems, full-stack software, and research in interpretable machine learning.",
  meta: {
    appName: "RETROGRADE",
    titleTemplate: "%s — Akshat Sharma",
    locale: "en_US",
    ogAlt: {
      home: "{name}, {role}: a phosphor-green RETROGRADE card in a bracket frame",
      project: "{title}, {subtitle}: a RETROGRADE project card",
      paper: "{title} — {venue}, {year}: a RETROGRADE publication card",
    },
  },
  sections: [
    { id: "post", index: 0, code: "POST", title: "Boot" },
    { id: "system", index: 1, code: "SYSTEM", title: "Hero" },
    { id: "identity", index: 2, code: "IDENTITY", title: "About" },
    { id: "log", index: 3, code: "LOG", title: "Experience" },
    { id: "archive", index: 4, code: "ARCHIVE", title: "Research & Publications" },
    { id: "work", index: 5, code: "WORK", title: "Projects" },
    { id: "capabilities", index: 6, code: "CAPABILITIES", title: "Skills" },
    { id: "credentials", index: 7, code: "CREDENTIALS", title: "Certificates & Records" },
    { id: "connect", index: 8, code: "CONNECT", title: "Contact" },
    { id: "halt", index: 9, code: "HALT", title: "Footer" },
    { id: "shell", index: 10, code: "SHELL", title: "Terminal" },
  ],
  topicClusters: {
    "ml-for-sustainability": "ML for sustainability",
  },
  labels: {
    heroStrip: { years: "Years", shipped: "Shipped", papers: "Papers", citations: "Citations" },
    hero: {
      micro: { label: "Where and when", location: "Loc", time: "Local", availability: "Status" },
      availability: { open: "Available", limited: "Limited availability", closed: "Not available" },
      cta: { work: "View work", research: "Read research", resume: "Resume" },
      strip: "At a glance",
      scrollHint: "Scroll",
      idleHint: "Press ~ for terminal",
      stage: "A field of light that forms my initials, then the citation graph of my papers, then the Earth with my city lit and today's daylight, and lands as this page's own grid.",
    },
    identity: {
      lamp: { pointer: "Shine the cursor to develop the portrait", touch: "Press and hold to develop the portrait" },
      spec: {
        label: "Spec sheet",
        role: "Role",
        experience: "Experience",
        location: "Location",
        timezone: "Timezone",
        stack: "Stack",
        hIndex: "H-index",
        education: "Education",
        availability: "Availability",
      },
      units: { year: "year", years: "years", role: "role", roles: "roles", internship: "internship", internships: "internships", asOf: "as of" },
      currently: { label: "Currently", building: "Building", reading: "Reading", researching: "Researching" },
    },
    log: {
      present: "Present",
      scale: "Years",
      highlights: "Highlights",
      stack: "Stack",
      card: "Card",
      stage: "A deck of punch cards, one per role, each punched with its company and years. The camera rides through the deck as you scroll, and light shines through the holes.",
      printout: { title: "Log report", roles: "Roles", education: "Education", page: "Page", end: "End of report" },
    },
    archive: {
      query: { label: "Archive query", all: "Query all", scope: "Query", match: "match", matches: "matches", clear: "Clear", record: "record", records: "records", cited: "cited works", citation: "citation", citations: "citations", layout: "Layout" },
      layouts: { topic: "Topic", year: "Year", venue: "Venue" },
      venueTypes: { journal: "Journal", conference: "Conference", workshop: "Workshop", preprint: "Preprint", patent: "Patent", thesis: "Thesis", chapter: "Chapter", other: "Other source" },
      legend: { label: "Shape legend", filled: "Published", dashed: "Under review or in prep", mine: "My records", cited: "Works they cite", tuned: "Tuned in" },
      sky: {
        label: "Citation constellation",
        stage:
          "A star chart of my publications, each drawn in the shape of its venue type, with the works they cite as fainter stars and lines joining papers that share a topic, an author or a reference. The camera loops around it as you scroll. Every record is in the ledger below.",
        hint: "Point at a star to read it; select a record to open its dossier.",
        keys: "Arrow keys move from star to star; Enter opens a record.",
        citedBy: "Cited by",
        unknown: "—",
      },
      ledger: { caption: "Every publication, by year", year: "Year", venue: "Venue", title: "Title", authors: "Authors", citations: "Citations", open: "Open its dossier" },
      status: { published: "Published", accepted: "Accepted", underReview: "Under review", inPrep: "In prep", stamp: "Status" },
      metrics: {
        label: "Research metrics",
        lead: { publications: "Peer-reviewed papers", citations: "Citations" },
        publications: "Publications",
        hIndex: "h-index",
        i10: "i10-index",
        firstAuthor: "First-author",
        venues: "Venues",
        asOf: "as of",
        computed: "h-index and i10 are computed from the per-paper counts.",
        counted: "Counted in the ledger",
        profiles: "Canonical numbers",
        platforms: { googleScholar: "Google Scholar", orcid: "ORCID", scopus: "Scopus", researchgate: "ResearchGate", dblp: "dblp" },
      },
      byYear: { title: "Publications by year", peak: "Peak", current: "This year", paper: "paper", papers: "papers", hollow: "Hollow cells are under review or in prep." },
      dossier: {
        close: "Close",
        back: "Back to the archive",
        id: "Archive ID",
        tldr: "In plain words",
        abstract: "Abstract",
        more: "Read the full abstract",
        less: "Show less",
        pending: "The abstract appears here once the proceedings are public.",
        keywords: "Keywords",
        filter: "Light the papers with this keyword in the sky",
        metrics: "Metrics",
        impactFactor: "Impact factor",
        year: "Year",
        citations: "Citations",
        notCited: "Not yet cited",
        source: "Source",
        authors: "Authors",
        venue: "Venue",
        badges: { peerReviewed: "Peer-reviewed", openAccess: "Open access" },
        actions: { label: "Links", doi: "DOI", pdf: "PDF", arxiv: "arXiv", code: "Code", dataset: "Dataset", bibtex: "Copy BibTeX", copied: "Copied" },
        builtFrom: "Built from this",
        prev: "Previous record",
        next: "Next record",
      },
    },
    work: {
      pending: "To come",
      carousel: {
        label: "Project slides",
        stage:
          "Each project is a 35 mm slide in a mount on a curved rail. The one in the gate projects in full color; the rest wait as two-tone dithers. Every project is also in the index below.",
        keys: "Drag, swipe or scroll sideways to move the slides; the arrow keys step one at a time; Enter opens the project.",
        gate: "In the gate",
      },
      index: {
        caption: "Every project",
        number: "#",
        title: "Title",
        role: "Role",
        year: "Year",
        stack: "Stack",
        open: "Open the case study",
        filters: "Filter the index",
        all: "All",
        category: "Category",
        stackGroup: "Stack",
        of: "of",
        shown: "shown",
        none: "Nothing matches these filters; clear one to see more.",
      },
      study: {
        context: "Context",
        problem: "Problem",
        role: "My role",
        approach: "Approach",
        outcome: "Outcome",
        stack: "Stack",
        links: "Links",
        research: "Published research",
        back: "All projects",
        prev: "Previous project",
        next: "Next project",
        link: { live: "Live", repo: "Code", case: "Case study", paper: "Paper" },
      },
    },
    capabilities: {
      primary: "Primary stack",
      stage:
        "Every skill is a keycap in a loose pile, the primary stack in accent; pressing one lights its row in the panel below, which holds the same skills with their years, levels and evidence.",
      keys: "Type a skill's name and its key goes down. Esc leaves the keys.",
      cluster: "Gather by category",
      all: "All",
      panel: "Every skill, by category",
      level: "L",
      years: { one: "year", many: "years" },
      evidence: { in: "In", project: "project", projects: "projects", paper: "paper", papers: "papers", role: "role", roles: "roles", none: "Not yet in a project, paper or role" },
    },
    credentials: {
      wall: "Every certificate as an ID card. Turn one over for its credential ID, its dates, the skills it covers, what it proves and where to verify it.",
      readout: { credential: "credential", credentials: "credentials", issuer: "issuer", issuers: "issuers", active: "active" },
      filters: { label: "Filter the credentials", all: "All", issuer: "Issuer", domain: "Domain", level: "Level", of: "of", shown: "shown" },
      levels: { foundational: "Foundational", associate: "Associate", professional: "Professional", expert: "Expert" },
      stamps: { verified: "Verified", onFile: "On file", expired: "Expired" },
      front: { serial: "No.", issued: "Issued" },
      back: { id: "Credential ID", issued: "Issued", expires: "Expires", noExpiry: "No expiry", skills: "Skills covered", proves: "What it proves", verify: "Verify", mrz: "Machine-readable zone" },
      turn: { over: "Turn over", back: "Turn back" },
      tilt: { ask: "Tilt to inspect", on: "Tilting", denied: "Motion access was declined; tap a card to turn it." },
      none: "No credential matches these filters.",
    },
    records: {
      label: "Records",
      count: { one: "record", many: "records" },
      lead: "On the record",
      counted: "Counted from the records",
      tiles: { award: "Awards", honor: "Honors", speaking: "Talks", oss: "Open source", press: "Press", grant: "Grants", patent: "Patents" },
      kinds: { award: "Award", honor: "Honor", speaking: "Talk", oss: "OSS", press: "Press", grant: "Grant", patent: "Patent" },
      proof: "Proof",
      press: "In the press",
      transmissions: "Transmissions",
      empty: "Nothing on file yet.",
    },
    connect: {
      invitation: "Send a signal",
      copy: "Copy",
      copied: "Copied",
      prompts: { name: "NAME>", email: "EMAIL>", intent: "INTENT>", message: "MESSAGE>" },
      fields: { name: "Your name", email: "Your email", intent: "What it's about", message: "Your message" },
      intents: { hire: "Hire", collaborate: "Collaborate", research: "Research", speak: "Speak", other: "Other" },
      send: "Transmit",
      trap: "Leave this field empty; it's here to catch bots.",
      errors: {
        required: "This one's needed.",
        email: "That doesn't look like an email address.",
        short: "A few more words, please: at least ten characters.",
        long: "That's longer than the line takes; trim it a little.",
        fast: "That was faster than anyone types. Give it a moment and send again.",
        rate: "Three signals in ten minutes is the limit. Try again a little later.",
        unavailable: "The line is down right now.",
        failed: "The transmission didn't go through.",
      },
      log: { label: "Transmission log", validate: "Validate", id: "ID" },
      received: { title: "Transmission received", note: "Your message is in my inbox. I'll reply to the address you gave.", again: "Send another" },
      fallback: { note: "Your words are kept: send them from your own email instead.", link: "Open it in your email", subject: "A signal from the portfolio" },
      availability: { label: "Availability", local: "My time", overlap: "Overlap", yours: "Your time", none: "No working hours in common; my day starts at", hours: "Working hours" },
      channels: { label: "Channels", email: "Email", linkedin: "LinkedIn", github: "GitHub", scholar: "Scholar", orcid: "ORCID", x: "X" },
      cta: { resume: "Download résumé", publications: "Download publication list (PDF)" },
    },
    halt: {
      index: "Index",
      sections: "Sections",
      projects: "Projects",
      publications: "Publications",
      build: { deployed: "Deployed", built: "Built with" },
      top: "Back to top",
      halted: "System halted. Scroll up to resume.",
    },
    // ∞ SHELL (Part 13): the terminal's words; {placeholders} are filled from the search index
    shell: {
      label: "Terminal",
      close: "Close the terminal",
      input: "Command",
      output: "Terminal output",
      user: "akshat",
      host: "retrograde",
      tty: "tty1",
      banner: ["{os} {version} · {sha} · {tty}", "{name} — {role}", "Type help for the commands. Tab completes, ↑ ↓ walk the history, Esc closes."],
      lastLogin: "Last login: {when} on {tty}",
      loading: "Reading the index…",
      offline: "The index didn't load, so the commands that read the site can't see it. The rest still work.",
      notFound: "command not found: {command}",
      didYouMean: "did you mean {suggestions}?",
      or: "or",
      usage: "usage: {usage}",
      unknown: "{command}: nothing called {name}",
      ambiguous: "{name} is more than one record: {options}",
      interrupted: "^C",
      copied: "Copied to the clipboard.",
      noClipboard: "The clipboard isn't available here, so nothing was copied.",
      opening: "Opening {target}…",
      none: "—",
      states: { on: "on", off: "off", auto: "auto", low: "low" },
      themes: { phosphor: "Phosphor (P1)", amber: "Amber (P3)", paper: "Paper" },
      help: {
        title: "Commands",
        groups: { me: "Who", records: "Records", machine: "The machine", toys: "Toys" },
        alias: "{alias} is {command}",
        footer: "Tab completes · ↑ ↓ history · Ctrl+C stops · Ctrl+L clears · Esc closes",
      },
      commands: {
        help: { usage: "help [command]", about: "List the commands, or explain one." },
        whoami: { usage: "whoami", about: "Whose machine this is." },
        about: { usage: "about", about: "Who I am, where I am, and what I'm working on." },
        stack: { usage: "stack", about: "What I build with, and what this site is built with." },
        date: { usage: "date", about: "Your time and mine." },
        uptime: { usage: "uptime", about: "How long this page has been running." },
        clear: { usage: "clear", about: "Clear the screen (Ctrl+L does too)." },
        history: { usage: "history", about: "What you've typed this visit." },
        ls: { usage: "ls [projects|papers|skills|experience|certs|awards]", about: "List the records." },
        cat: { usage: "cat <slug>", about: "Print a record: a project, paper, role, certificate or award." },
        open: { usage: "open <slug>", about: "Go to a record's page." },
        cite: { usage: "cite <paper>", about: "Print a paper's BibTeX and copy it." },
        scholar: { usage: "scholar", about: "Publication metrics, with where they come from." },
        verify: { usage: "verify <cert>", about: "A credential's ID, issuer and build-time check, then its verification page." },
        grep: { usage: "grep <term>", about: "Search everything on the site." },
        resume: { usage: "resume", about: "My résumé." },
        contact: { usage: "contact", about: "Go to the contact form." },
        email: { usage: "email", about: "Print my email address and copy it." },
        social: { usage: "social [platform]", about: "My profiles elsewhere." },
        theme: { usage: "theme [phosphor|amber|paper]", about: "Switch the tube." },
        sound: { usage: "sound [on|off]", about: "Turn the sound on or off." },
        grid: { usage: "grid", about: "Show or hide the layout grid." },
        gfx: { usage: "gfx [auto|low]", about: "Set the graphics tier." },
        goto: { usage: "goto <section>", about: "Jump to a section." },
        sudo: { usage: "sudo hire-me", about: "You know what this does." },
        neofetch: { usage: "neofetch", about: "The spec sheet." },
        rain: { usage: "rain", about: "Thirty seconds of rain made of this site's own data." },
        man: { usage: "man <page>", about: "Read a manual page: retrograde, or any command." },
        decode: { usage: "decode [card]", about: "Read a LOG punch card's holes back into text." },
        debug: { usage: "debug", about: "Show or hide the dev overlay." },
      },
      whoami: "{user} — {name}, {role}",
      about: { location: "Location", availability: "Availability" },
      stack: {
        primary: "Primary",
        skills: "Skills",
        skillsLine: "{count} across {categories} categories (ls skills)",
        site: "This site",
        libraries: [
          { name: "Next.js", package: "next" },
          { name: "React", package: "react" },
          { name: "three.js", package: "three" },
          { name: "GSAP", package: "gsap" },
          { name: "Lenis", package: "lenis" },
          { name: "zustand", package: "zustand" },
          { name: "Tailwind CSS", package: "tailwindcss" },
        ],
      },
      date: { yours: "your time", mine: "{name}'s time" },
      uptime: "up {duration}, since {time}",
      units: { hour: "h", minute: "min", second: "s" },
      history: { empty: "Nothing typed yet." },
      ls: {
        kinds: "Records",
        columns: { slug: "slug", year: "year", title: "title", venue: "venue", status: "status", category: "category", level: "level", years: "years", dates: "dates", role: "role", date: "date", count: "count" },
        noSuchKind: "ls: no {kind} here",
        noCerts: "No certificates on file yet.",
        empty: "none yet",
      },
      cat: {
        authors: "Authors",
        me: "me",
        venue: "Venue",
        status: "Status",
        citations: "Citations",
        tldr: "In short",
        abstract: "Abstract",
        keywords: "Keywords",
        doi: "DOI",
        links: "Links",
        problem: "Problem",
        approach: "Approach",
        outcome: "Outcome",
        role: "Role",
        stack: "Stack",
        metrics: "Results",
        highlights: "Highlights",
        dates: "Dates",
        location: "Location",
        issuer: "Issuer",
        level: "Level",
        years: "Years",
        evidence: "Evidence",
        evidenceLine: "{projects} projects · {papers} papers · {roles} roles",
        field: "Field",
        proof: "Proof",
        next: "next: {commands}",
        pending: "To come",
      },
      cite: { notPaper: "cite: {name} isn't a paper", noPapers: "No papers yet." },
      scholar: { source: "Source", counted: "{counted} counted", profiles: "Profiles", noProfiles: "No Google Scholar or ORCID profile is linked yet." },
      verify: { notCert: "verify: {name} isn't a certificate", check: "Build-time check", noUrl: "It has no verification page." },
      grep: { hits: "{count} hits for “{term}”", hit: "1 hit for “{term}”", none: "No hits for “{term}”." },
      resume: { none: "No résumé here yet. Write to {email} and I'll send you one." },
      contact: "Opening CONNECT…",
      social: { none: "No {platform} profile here.", list: "Profiles" },
      theme: { now: "The tube is {theme}.", set: "Switching to {theme}…" },
      sound: "Sound is {state}.",
      grid: "The grid is {state}.",
      gfx: "Graphics: {state}.",
      goto: { none: "goto: no section called {name}", list: "Sections" },
      sudo: {
        password: "[sudo] password for {user}: ••••••••",
        denied: "{user} is not in the sudoers file. This incident will be reported.",
        pitch: [
          "Access granted. Switching to recruiting mode.",
          "",
          "CANDIDATE  {name} — {role}",
          "NOW        {now}",
          "SHIPPED    {projects} projects",
          "PUBLISHED  {papers} peer-reviewed papers",
          "AVAILABLE  {availability}",
          "",
          "CONNECT is open behind this panel. Press Esc and you're in the form.",
        ],
      },
      neofetch: {
        os: "OS",
        host: "Host",
        role: "Role",
        stack: "Stack",
        papers: "Papers",
        citations: "Citations",
        certs: "Certs",
        uptime: "Uptime",
        theme: "Theme",
        noCerts: "none on file yet",
        papersLine: "{count} peer-reviewed ({venues})",
        citationsLine: "{count} · {source}, {asOf}",
      },
      rain: { start: "Rain: thirty seconds of this site's own data. Any key stops it.", stop: "Rain stopped." },
      man: {
        which: "What manual page do you want? Try man retrograde.",
        missing: "No manual entry for {page}.",
        retrograde: {
          title: "RETROGRADE(7)",
          section: "Miscellaneous",
          blocks: [
            { heading: "NAME", body: "retrograde — a portfolio you boot, not browse" },
            {
              heading: "DESCRIPTION",
              body: "In astronomy, retrograde motion is an illusion: a planet only appears to move backwards because we are moving faster. This site is a machine you boot, an operating system for one person, rendered with modern shaders out of old artifacts: phosphor, punch cards, microfiche, foil.",
            },
            {
              heading: "THE ARCHIVE'S CAMERA",
              body: "Scroll through ARCHIVE and the camera flies a retrograde loop: a prograde arc, a loop back, then prograde again. It passes the densest cluster of papers twice, from two angles, and the nearest one takes focus, like tuning a dial.",
            },
            { heading: "SEE ALSO", body: "goto archive · grep · cite" },
          ],
        },
      },
      decode: { list: "Cards", header: "{title} · {holes} holes in {columns} columns", reads: "reads: {text}", unknown: "decode: no card called {name}" },
      debug: "The dev overlay is {state}.",
    },
    chrome: { os: "RETROGRADE/OS", rail: "Sections", newTab: "(opens in a new tab)", skip: "Skip to content", channel: "Ch" },
    noSignal,
    nav: {
      label: "Primary",
      items: [
        { label: "Work", section: "work" },
        { label: "Research", section: "archive" },
        { label: "Credentials", section: "credentials" },
        { label: "Contact", section: "connect" },
      ],
      terminal: { glyph: "~", label: "Terminal" },
    },
    // the panel's keys say P1 · SND · GFX, as hardware does; a screen reader hears what they mean too
    // (after the visible label, so a speech command naming it still matches, WCAG 2.5.3)
    panel: { label: "Front panel", tube: "Tube", sound: "Snd", soundName: "(sound)", on: "On", off: "Off", meter: "Sound level", grid: "Grid", gfx: "Gfx", gfxName: "(graphics)", gfxAuto: "Auto", gfxLow: "Low", themes: { phosphor: "Phosphor", amber: "Amber", paper: "Paper" } },
    cursor: { view: "View", drag: "Drag", flip: "Flip", open: "Open" },
    boot: {
      version: "1.0",
      build: "Build",
      cpu: "CPU",
      cores: "logical cores",
      gpu: "GPU",
      masked: "masked by browser",
      notQueried: "not queried · reduced motion",
      display: "Disp",
      measured: "(measured)",
      hz: "Hz",
      gfx: "GFX",
      tier: "Tier",
      particles: "particles",
      probe: "probe p90",
      font: "Font",
      data: "Data",
      papers: "papers",
      projects: "projects",
      credentials: "credentials",
      a11y: "A11Y",
      reducedMotion: "Reduced motion",
      contrast: "Contrast",
      standard: "standard",
      more: "more",
      on: "on",
      off: "off",
      sound: "Snd",
      muted: "muted",
      soundKey: "[S]",
      ok: "OK",
      unknown: "unknown",
      loading: "Loading portfolio.sys",
      skip: "Skip [Esc]",
      skipLabel: "Skip the boot sequence",
    },
  },
} satisfies In["site"];

// ── profile ──────────────────────────────────────────────────────────────────────────────────

export const profile = {
  name: "Akshat Sharma",
  initials: "AS",
  // TODO(akshat): the headline and tagline are drafts written from the résumé
  role: "AI & ML engineer · full-stack developer",
  tagline: "Building generative-AI systems at United Airlines, and researching interpretable ML.",
  // TODO(akshat): the résumés name no city; Jaipur is inferred from Manipal University Jaipur
  location: { city: "Jaipur", country: "India", countryCode: "IN" },
  coordinates: { lat: 26.9124, lon: 75.7873 },
  timezone: "Asia/Kolkata",
  // working hours: confirmed by the owner (2026-11-14); CONNECT computes a visitor's overlap from them
  workingHours: { start: "10:00", end: "18:00" },
  // TODO(akshat): availability is inferred (interning now; the B.Tech ends July 2027)
  availability: { status: "limited", note: "Interning at United Airlines; graduating with a B.Tech in July 2027." },
  // TODO(akshat): the bio is a draft, written only from facts on the résumé
  bio: {
    short:
      "Computer science undergraduate at Manipal University Jaipur, building generative-AI systems at United Airlines and researching interpretable machine learning.",
    long: [
      "I'm a computer science undergraduate at Manipal University Jaipur, graduating in 2027, and I work where large language models meet production software. At United Airlines I'm building Cartographer, a LangGraph system that writes six documentation artifacts in two LLM calls on top of a code knowledge graph, at $0.08–0.11 a run.",
      "Before that I built full-stack features with Next.js and Django REST Framework for a TRAI engagement at EY, a Core Java backend at Truechip, and parts of Engazewell, an employee-management system with 2,500+ daily users, at WalkingTree. My research applies interpretable machine learning to sustainability — food waste in cold-chain logistics and short-term PM2.5 forecasting — and was presented at SCI-2026 (Springer LNNS).",
    ],
    accents: [
      ["large language models meet production software", "Cartographer", "six documentation artifacts in two LLM calls"],
      ["a TRAI engagement at EY", "interpretable machine learning", "SCI-2026"],
    ],
  },
  // TODO(akshat): no photo yet — this is a generated placeholder (scripts/bake/portrait.ts)
  avatar: { src: "/media/profile/portrait.png", alt: "A placeholder portrait: a soft-lit head-and-shoulders silhouette, until the real photo arrives." },
  // no résumé published for now (the owner's call, 2026-11-14): every version carries their phone
  // number. A phone-free PDF dropped in public/media/profile/ and named here brings the buttons back
  resumeUrl: null,
  email: "akshatsharma.data@gmail.com",
  socials: [
    { platform: "github", url: "https://github.com/akshatsharma-x", handle: "akshatsharma-x" },
    { platform: "linkedin", url: "https://www.linkedin.com/in/akshatsharma-in", handle: "akshatsharma-in" },
  ],
  scholarProfiles: [],
} satisfies In["profile"];

// ── experience (newest first) ────────────────────────────────────────────────────────────────
// TODO(akshat): the résumés give no work locations; "India" stands in for each

export const experience = [
  {
    company: "United Airlines",
    role: "AI & ML Intern (Generative AI)",
    type: "internship",
    start: "2026-06",
    end: "present",
    location: "India",
    blurb: "Generative-AI intern on LLM model monitoring and automation for United's enterprise-level ML models.",
    highlights: [
      "Built Cartographer with LangGraph, GPT-4.1 and Claude Sonnet 4.5: it generates 6 documentation artifacts in 2 LLM calls.",
      "Developed a code knowledge graph of dependencies, API surfaces and architectural relationships across large codebases.",
      "Cut inference cost to $0.08–0.11 a run with 22–25% token compression and SHA-256 caching, across 35 eval scenarios.",
    ],
    metrics: [
      { label: "Documentation artifacts", value: 6 },
      { label: "LLM calls", value: 2 },
      { label: "Eval scenarios", value: 35 },
      { label: "Token compression, min", value: 22, unit: "%" },
    ],
    stack: ["LangGraph", "GPT-4.1", "Claude Sonnet 4.5", "Knowledge graphs"],
  },
  {
    company: "Ernst & Young (EY)",
    role: "Software Development Intern",
    type: "internship",
    start: "2026-06",
    end: "2026-07",
    location: "India · hybrid",
    blurb: "Full-stack features for a TRAI India engagement in EY's IT Transformation practice for Government & Public Sector.",
    highlights: [
      "Built full-stack features with Next.js 16 (App Router), TypeScript, React and Tailwind CSS in a regulated public-sector environment.",
      "Built a Django REST Framework backend with JWT auth, RESTful APIs and PostgreSQL, tested end to end in Postman.",
      "Worked in an Agile team on Git and GitHub, contributing code reviews and SDLC-driven iterative delivery.",
    ],
    metrics: [],
    stack: ["Next.js", "TypeScript", "React", "Tailwind CSS", "Django REST Framework", "PostgreSQL", "JWT"],
  },
  {
    company: "Truechip Solutions",
    role: "Java Intern",
    type: "internship",
    start: "2025-12",
    end: "2026-01",
    location: "India",
    blurb: "Core Java backend work across 10+ modules, with unit testing and code review inside an enterprise SDLC.",
    highlights: [
      "Contributed to a Core Java backend across 10+ modules, with OOP and modular design for maintainable components.",
      "Reached 90%+ test coverage through unit testing and debugging, cutting post-integration defects by ~30%.",
      "Took part in code reviews with Git and enterprise coding standards, cutting review turnaround by ~25%.",
    ],
    metrics: [
      { label: "Modules", value: 10, unit: "+" },
      { label: "Test coverage", value: 90, unit: "%+" },
      { label: "Fewer defects", value: 30, unit: "%" },
      { label: "Faster reviews", value: 25, unit: "%" },
    ],
    stack: ["Java", "OOP", "Unit testing", "Git"],
  },
  {
    company: "WalkingTree Technologies",
    role: "Technical Intern",
    type: "internship",
    start: "2025-07",
    end: "2025-08",
    location: "India",
    blurb: "Backend and UI work on Engazewell, an enterprise employee-management system with 10,000+ records and 2,500+ daily users.",
    highlights: [
      "Optimized MongoDB aggregation pipelines in Engazewell's Java backend (10,000+ records, 2,500+ daily users) for fast retrieval.",
      "Worked on cloud-integrated systems and scalable backend architecture for enterprise applications.",
      // TODO(akshat): one résumé says "validated via A/B testing", two say "manual testing"; this follows the two
      "Built responsive React UI and Power BI dashboards for workforce analytics, validated through manual testing.",
    ],
    metrics: [
      { label: "Records", value: 10000, unit: "+" },
      { label: "Daily active users", value: 2500, unit: "+" },
    ],
    stack: ["Java", "MongoDB", "React", "Power BI"],
  },
] satisfies In["experience"];

// ── publications ─────────────────────────────────────────────────────────────────────────────
// TODO(akshat): for each paper — the co-authors (only you are listed, so the BibTeX reads as
// sole-authored), the abstract, the DOI once the LNNS volume is out (status then becomes
// "published"), open access, and whether the TLDR says it right

export const publications = [
  {
    slug: "food-waste-cold-chain-sci-2026",
    title: "An Interpretable Artificial Intelligence Framework for Food Waste Prediction and Prevention in Cold-Chain Logistics",
    authors: [{ name: "Akshat Sharma", isMe: true, affiliation: "Manipal University Jaipur" }],
    venue: "SCI-2026 International Conference, Swinburne Vietnam, Hanoi (Springer LNNS)",
    venueShort: "SCI-2026",
    venueType: "conference",
    year: 2026,
    month: 4,
    tldr: "An AI framework that predicts food waste in cold-chain logistics, and explains each prediction so the waste can be prevented.",
    keywords: ["interpretable AI", "explainable ML", "food waste", "cold-chain logistics", "sustainability"],
    citations: 0,
    citationsAsOf: "2026-11-11",
    citationSource: "Manual",
    isOpenAccess: false,
    isPeerReviewed: true,
    status: "accepted",
    bibtex: `@inproceedings{sharma2026foodwaste,
  author    = {Sharma, Akshat},
  title     = {An Interpretable Artificial Intelligence Framework for Food Waste Prediction and Prevention in Cold-Chain Logistics},
  booktitle = {SCI-2026 International Conference},
  series    = {Lecture Notes in Networks and Systems},
  publisher = {Springer},
  address   = {Hanoi, Vietnam},
  year      = {2026},
  note      = {Presented 28--29 April 2026, Swinburne Vietnam}
}`,
    coAuthorIds: [],
    relatedPublicationSlugs: [],
    topicCluster: "ml-for-sustainability",
    featured: true,
  },
  {
    slug: "pm25-forecasting-sci-2026",
    title: "Short-Term PM2.5 Forecasting Using ML for Sustainable Urban Air Quality",
    authors: [{ name: "Akshat Sharma", isMe: true, affiliation: "Manipal University Jaipur" }],
    venue: "SCI-2026 International Conference, Swinburne Vietnam, Hanoi (Springer LNNS)",
    venueShort: "SCI-2026",
    venueType: "conference",
    year: 2026,
    month: 4,
    tldr: "Machine-learning models that forecast fine-particle air pollution a short time ahead, so cities can act on air quality sooner.",
    keywords: ["PM2.5", "air quality", "time-series forecasting", "machine learning", "sustainability"],
    citations: 0,
    citationsAsOf: "2026-11-11",
    citationSource: "Manual",
    isOpenAccess: false,
    isPeerReviewed: true,
    status: "accepted",
    bibtex: `@inproceedings{sharma2026pm25,
  author    = {Sharma, Akshat},
  title     = {Short-Term PM2.5 Forecasting Using ML for Sustainable Urban Air Quality},
  booktitle = {SCI-2026 International Conference},
  series    = {Lecture Notes in Networks and Systems},
  publisher = {Springer},
  address   = {Hanoi, Vietnam},
  year      = {2026},
  note      = {Presented 28--29 April 2026, Swinburne Vietnam}
}`,
    coAuthorIds: [],
    relatedPublicationSlugs: [],
    topicCluster: "ml-for-sustainability",
    featured: true,
  },
] satisfies In["publications"];

// ── works my papers cite ───────────────────────────────────────────────────────────────────────
// TODO(akshat): each paper's reference list (the PDFs are enough). ARCHIVE's sky draws these as
// faint stars around your two papers, joined to each paper that cites them (DESIGN.md §4.3 A3,
// v1.9). Empty until then: the sky shows the two papers alone.

export const citedWorks = [] satisfies In["citedWorks"];

// ── projects ─────────────────────────────────────────────────────────────────────────────────
// TODO(akshat): for each project — the year, your role, repo/live links and screenshots. Until the
// year and role arrive they're null and show as pending (Part 9, the owner's call). Each cover is a
// build-time title card drawn from the project's own words (scripts/bake/covers.ts) until a real
// screenshot is dropped into content/covers/<slug>.(png|jpg|webp|avif): same path, no code change.

export const projects = [
  {
    slug: "cognivault-ai",
    title: "Cognivault AI",
    subtitle: "A multi-agent research assistant",
    year: null,
    role: null,
    category: "AI system",
    summary: "A multi-agent RAG system: agents coordinate over A2A, retrieve with FAISS and HyDE, read PDFs with Gemini Vision, and route sub-tasks by intent.",
    problem: "Research work means finding sources, reading long PDFs and summarizing them, mostly by hand; one model answering everything blurs those very different sub-tasks.",
    approach:
      "Agents talk to each other over A2A, built with FastAPI, LangChain and Gemini 1.5. Retrieval combines FAISS with HyDE, and a custom orchestrator routes each automatable sub-task by intent. Gemini Vision extracts structured data from PDFs.",
    outcome: "A working system on FastAPI, PostgreSQL, Next.js and Docker, with automated summarization, and retrieval evaluated with Ragas.",
    metrics: [],
    stack: ["FastAPI", "LangChain", "Gemini 1.5", "FAISS", "HyDE", "PostgreSQL", "Next.js", "Docker", "Ragas"],
    links: {},
    media: [{ type: "image", src: "/media/projects/cognivault-ai/cover.avif", alt: "A title card for Cognivault AI: its name, category and stack, set in type. The screenshot is to come." }],
    featured: true,
    relatedPublicationSlugs: [],
  },
  {
    slug: "quizmuj",
    title: "QuizMUJ",
    subtitle: "A real-time learning management system",
    year: null,
    role: null,
    category: "Full-stack",
    summary: "A role-based examination platform with a live exam room, tab-switch proctoring, bulk CSV uploads and an analytics API for results.",
    problem: "Running exams online needs roles, a live room where proctors can see what candidates do, and an easy way to load questions and export results.",
    approach:
      "A Node.js, Express and MongoDB backend with a Tailwind CSS front end. A live exam room on Socket.io carries proctoring signals such as browser tab switches. Admin tools take CSV bulk uploads, and an analytics API exports results. The app runs in Docker.",
    outcome: "A containerized, full-stack platform with secure session handling and data integrity built into the backend design.",
    metrics: [],
    stack: ["Node.js", "Express", "MongoDB", "Socket.io", "Tailwind CSS", "Docker"],
    links: {},
    media: [{ type: "image", src: "/media/projects/quizmuj/cover.avif", alt: "A title card for QuizMUJ: its name, category and stack, set in type. The screenshot is to come." }],
    featured: true,
    relatedPublicationSlugs: [],
  },
  {
    slug: "resume-screening",
    title: "Automated Resume Screening",
    subtitle: "NLP candidate classification with an explainability dashboard",
    year: null,
    role: null,
    category: "NLP",
    summary: "An NLP pipeline that classifies candidates and extracts their data with a TF-IDF + BERT ensemble, plus an XAI dashboard to show why.",
    problem: "Screening resumes by hand is slow and inconsistent, and an automated screen is only useful if people can see why it ranked someone.",
    approach:
      "A Python and Streamlit app on Transformers. A hybrid model pairs TF-IDF with BERT in a weighted ensemble, tuned to improve candidate matching. An XAI dashboard with PCA visualizations shows how candidates separate.",
    outcome: "An end-to-end screening pipeline for automated classification and data extraction, with an interpretable dashboard on top.",
    metrics: [],
    stack: ["Python", "Streamlit", "Transformers", "BERT", "TF-IDF", "PCA"],
    links: {},
    media: [{ type: "image", src: "/media/projects/resume-screening/cover.avif", alt: "A title card for Automated Resume Screening: its name, category and stack, set in type. The screenshot is to come." }],
    featured: true,
    relatedPublicationSlugs: [],
  },
  {
    slug: "churn-prediction",
    title: "Customer Churn Prediction",
    subtitle: "A stacking ensemble at 97% accuracy and 0.98 ROC-AUC",
    year: null,
    role: null,
    category: "Machine learning",
    summary: "An ML pipeline that predicts customer churn with a stacking ensemble, then explains what drives it to inform retention.",
    problem: "Retention work needs to know which customers are likely to leave, and why, before they do.",
    approach: "A stacking ensemble, with SMOTE for class imbalance and KerasTuner on TensorFlow for tuning, followed by feature-importance analysis of the churn drivers.",
    outcome: "97% accuracy and 0.98 ROC-AUC, with the churn drivers identified as actionable insights for retention strategy.",
    metrics: [
      { label: "Accuracy", value: 97, unit: "%" },
      { label: "ROC-AUC", value: 0.98 },
    ],
    stack: ["Python", "TensorFlow", "KerasTuner", "SMOTE"],
    links: {},
    media: [{ type: "image", src: "/media/projects/churn-prediction/cover.avif", alt: "A title card for Customer Churn Prediction: its name, category and stack, set in type. The screenshot is to come." }],
    featured: true,
    relatedPublicationSlugs: [],
  },
  {
    slug: "wcag-analyzer",
    title: "Web Accessibility Analyzer",
    subtitle: "A WCAG 2.1 compliance checker with a headless crawler",
    year: null,
    role: null,
    category: "Accessibility",
    summary: "A web app whose headless DOM crawler finds accessibility issues, from alt text to ARIA and navigation, then scores them and suggests fixes.",
    problem: "Accessibility problems hide across whole sites, and a checklist on one page doesn't find them.",
    approach: "A headless DOM crawler walks the site, and a rule-based analyzer checks it against WCAG 2.1: alt text, ARIA, navigation and more.",
    outcome: "An accessibility score per site, with fix suggestions and exportable reports.",
    metrics: [],
    // TODO(akshat): the résumé names no stack for this one
    stack: ["WCAG 2.1", "ARIA", "Headless crawler"],
    links: {},
    media: [{ type: "image", src: "/media/projects/wcag-analyzer/cover.avif", alt: "A title card for Web Accessibility Analyzer: its name, category and stack, set in type. The screenshot is to come." }],
    featured: true,
    relatedPublicationSlugs: [],
  },
] satisfies In["projects"];

// ── skills ───────────────────────────────────────────────────────────────────────────────────
// Levels follow the evidence rubric (CONTENT_INTAKE.md §0): 3 · Shipped where it ran in
// production for others (Engazewell), 2 · Built for your own projects and the systems you built at
// work, 1 · Used for the rest, 5 · Published for ML (two SCI-2026 papers). Levels and years
// confirmed by the owner (Part 10, 2026-11-12). Each legend's icon is a Simple Icons slug (CC0):
// Java's is OpenJDK's (Simple Icons carries no Java mark); none for SQL, ML, RAG, FAISS, Ragas or
// Power BI, which print a monogram.

export const skills = [
  { name: "Python", category: "Languages", level: 2, years: 3, legend: { label: "PY", icon: "python" }, primary: true },
  { name: "TypeScript", category: "Languages", level: 1, years: 1, legend: { label: "TS", icon: "typescript" }, primary: true },
  { name: "Java", category: "Languages", level: 3, years: 2, legend: { label: "JAVA", icon: "openjdk" }, primary: true },
  { name: "JavaScript", category: "Languages", level: 2, years: 2, legend: { label: "JS", icon: "javascript" }, primary: false },
  { name: "C/C++", category: "Languages", level: 1, years: 3, legend: { label: "C++", icon: "cplusplus" }, primary: false, aliases: ["C++", "C"] },
  { name: "SQL", category: "Languages", level: 2, years: 2, legend: { label: "SQL" }, primary: false },
  { name: "Kotlin", category: "Languages", level: 1, years: 1, legend: { label: "KT", icon: "kotlin" }, primary: false },

  { name: "Machine learning", category: "AI & ML", level: 5, years: 2, legend: { label: "ML" }, primary: false, aliases: ["ML", "Deep learning"] },
  { name: "LangGraph", category: "AI & ML", level: 2, years: 1, legend: { label: "LG", icon: "langgraph" }, primary: true },
  { name: "LangChain", category: "AI & ML", level: 2, years: 1, legend: { label: "LC", icon: "langchain" }, primary: false },
  { name: "RAG", category: "AI & ML", level: 2, years: 1, legend: { label: "RAG" }, primary: false, aliases: ["HyDE"] },
  { name: "FAISS", category: "AI & ML", level: 2, years: 1, legend: { label: "FAISS" }, primary: false },
  { name: "Ragas", category: "AI & ML", level: 2, years: 1, legend: { label: "RAGAS" }, primary: false },
  { name: "Transformers", category: "AI & ML", level: 2, years: 1, legend: { label: "HF", icon: "huggingface" }, primary: false, aliases: ["BERT"] },
  { name: "TensorFlow", category: "AI & ML", level: 2, years: 1, legend: { label: "TF", icon: "tensorflow" }, primary: false, aliases: ["KerasTuner"] },
  { name: "pandas", category: "AI & ML", level: 2, years: 2, legend: { label: "PD", icon: "pandas" }, primary: false },

  { name: "Next.js", category: "Frameworks & backend", level: 1, years: 1, legend: { label: "NEXT", icon: "nextdotjs" }, primary: true },
  { name: "React", category: "Frameworks & backend", level: 3, years: 2, legend: { label: "REACT", icon: "react" }, primary: false },
  { name: "FastAPI", category: "Frameworks & backend", level: 2, years: 1, legend: { label: "FAPI", icon: "fastapi" }, primary: true },
  { name: "Django REST Framework", category: "Frameworks & backend", level: 2, years: 1, legend: { label: "DRF", icon: "django" }, primary: false, aliases: ["Django"] },
  { name: "Node.js", category: "Frameworks & backend", level: 2, years: 1, legend: { label: "NODE", icon: "nodedotjs" }, primary: false, aliases: ["Express"] },
  { name: "Socket.io", category: "Frameworks & backend", level: 2, years: 1, legend: { label: "SIO", icon: "socketdotio" }, primary: false },
  { name: "Tailwind CSS", category: "Frameworks & backend", level: 2, years: 1, legend: { label: "TW", icon: "tailwindcss" }, primary: false },

  { name: "PostgreSQL", category: "Tools & platforms", level: 2, years: 1, legend: { label: "PG", icon: "postgresql" }, primary: false },
  { name: "MongoDB", category: "Tools & platforms", level: 3, years: 1, legend: { label: "MONGO", icon: "mongodb" }, primary: false },
  { name: "Docker", category: "Tools & platforms", level: 2, years: 1, legend: { label: "DOCK", icon: "docker" }, primary: false },
  { name: "Git", category: "Tools & platforms", level: 1, years: 3, legend: { label: "GIT", icon: "git" }, primary: false, aliases: ["GitHub"] },
  { name: "Power BI", category: "Tools & platforms", level: 3, years: 1, legend: { label: "PBI" }, primary: false },
] satisfies In["skills"];

// ── certificates ─────────────────────────────────────────────────────────────────────────────
// TODO(akshat): the résumés list no certificates; Part 11 needs them (with verify URLs)

export const certificates = [] satisfies In["certificates"];

// ── achievements ─────────────────────────────────────────────────────────────────────────────

export const achievements = [
  {
    title: "Smart India Hackathon — college-level qualifier, 2024 and 2025",
    issuer: "Smart India Hackathon",
    date: "2025",
    description: "Ranked among the top 50 teams selected from over 300 at Manipal University Jaipur's college round, in 2024 and again in 2025.",
    kind: "honor",
    metric: { label: "Teams in the round", value: 300, unit: "+" },
  },
  {
    title: "Dean's List for Academic Excellence",
    issuer: "Manipal University Jaipur",
    date: "2024",
    description: "Named to the Dean's List for academic excellence.",
    kind: "honor",
  },
  {
    title: "Student Excellence Award",
    issuer: "Manipal University Jaipur",
    date: "2026",
    description: "Manipal University Jaipur's Student Excellence Award.",
    kind: "award",
  },
] satisfies In["achievements"];

// ── education ────────────────────────────────────────────────────────────────────────────────

export const education = [
  {
    institution: "Manipal University Jaipur",
    degree: "B.Tech.",
    field: "Computer Science and Engineering",
    start: "2023-07",
    end: "2027-07",
    location: "Jaipur, India",
    honors: "CGPA 8.79 / 10",
  },
] satisfies In["education"];

// ── testimonials ─────────────────────────────────────────────────────────────────────────────

export const testimonials = [] satisfies In["testimonials"];

// ── currently ────────────────────────────────────────────────────────────────────────────────

export const currentFocus = [
  { kind: "building", title: "Cartographer — LLM documentation tooling at United Airlines", detail: "LangGraph, GPT-4.1 and Claude Sonnet 4.5 on a code knowledge graph." },
  // TODO(akshat): what you're reading isn't on the résumé
  { kind: "reading", title: "(to add)" },
  // TODO(akshat): taken from your SCI-2026 paper; say what you're researching now
  { kind: "researching", title: "Interpretable ML for food-waste prediction in cold chains", detail: "Presented at SCI-2026 (Springer LNNS)." },
] satisfies In["currentFocus"];

/** The whole dataset as one object; content/index.ts validates it before anything reads it. */
export const data = {
  isPlaceholder: IS_PLACEHOLDER,
  site,
  profile,
  experience,
  publications,
  citedWorks,
  projects,
  skills,
  certificates,
  achievements,
  education,
  testimonials,
  currentFocus,
} satisfies In;
