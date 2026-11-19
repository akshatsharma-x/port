import { z } from "zod";
import { SKY_LIMITS } from "../lib/archive";

/**
 * RETROGRADE content schema. Every word and number on the site is validated here before any
 * section can read it (via content/derive.ts). Objects are strict: an unknown key — a typo, or
 * a forbidden field like accentColor (color is state, not identity: DESIGN.md §2.4) — fails.
 * Cross-references (related papers, co-authors, BibTeX, featured counts …) are checked in
 * ContentSchema's superRefine, so the build fails loudly on any mismatch.
 */

// ── primitives ─────────────────────────────────────────────────────────────────────────────

const text = z.string().trim().min(1);
const sentence = (max: number) => text.max(max, `≤ ${max} characters`);
export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case slug (a-z, 0-9, hyphens)");
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM");
const yearOnly = z.string().regex(/^\d{4}$/, "YYYY");
const isoDate = z.iso.date();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM, 24-hour");
const year = z.int().min(1990).max(2100);
const httpsUrl = z.url({ protocol: /^https$/, error: "https:// URL" });
const assetPath = z.string().regex(/^\/(?!\/)[\w\-./]+$/, "site path like /media/…");
const doi = z.string().regex(/^10\.\d{4,9}\/\S+$/, "bare DOI like 10.1145/3544548.3580001 (no https://doi.org/)");
const arxivId = z.string().regex(/^\d{4}\.\d{4,5}(v\d+)?$/, "arXiv id like 2507.12345");

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ── vocabularies ───────────────────────────────────────────────────────────────────────────

export const VENUE_TYPES = ["journal", "conference", "workshop", "preprint", "patent", "thesis", "chapter"] as const;
export const PUBLICATION_STATUS = ["published", "accepted", "underReview", "inPrep"] as const;
export const SCHOLAR_PLATFORMS = ["googleScholar", "orcid", "scopus", "researchgate", "dblp"] as const;
export const SOCIAL_PLATFORMS = ["github", "linkedin", "x", "bluesky", "mastodon", "website", "dribbble", "youtube"] as const;
export const ROLE_TYPES = ["full-time", "part-time", "contract", "freelance", "internship", "research"] as const;
export const CERT_LEVELS = ["foundational", "associate", "professional", "expert"] as const;
export const ACHIEVEMENT_KINDS = ["award", "honor", "speaking", "oss", "press", "grant", "patent"] as const;
export const FOCUS_KINDS = ["building", "reading", "researching"] as const;
export const CITATION_SOURCES = ["OpenAlex", "Google Scholar", "Semantic Scholar", "Crossref", "Manual", "Placeholder"] as const;
export const AVAILABILITY = ["open", "limited", "closed"] as const;
/** DESIGN.md §7.1 — the fixed section order. Content names them; it can't reorder or drop them. */
export const SECTION_IDS = ["post", "system", "identity", "log", "archive", "work", "capabilities", "credentials", "connect", "halt", "shell"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** DESIGN.md §7.4 skill rubric — a level means evidence, never a self-rated percentage. */
export const SKILL_RUBRIC = { 1: "Used", 2: "Built", 3: "Shipped", 4: "Led", 5: "Taught/Published" } as const;
export type SkillLevel = keyof typeof SKILL_RUBRIC;

const PEER_REVIEWABLE: ReadonlySet<string> = new Set(["journal", "conference", "workshop", "chapter"]);
const COUNTED: ReadonlySet<string> = new Set(["published", "accepted"]);

// ── shared shapes ──────────────────────────────────────────────────────────────────────────

export const MetricSchema = z.strictObject({
  label: sentence(32),
  value: z.number(),
  unit: z.string().max(8).optional(),
});

export const MediaSchema = z.discriminatedUnion("type", [
  // a screenshot's intrinsic size, when it isn't the 3:2 cover (lib/covers.ts) — it reserves its box
  z.strictObject({ type: z.literal("image"), src: assetPath, alt: sentence(240), width: z.int().positive().optional(), height: z.int().positive().optional() }),
  z.strictObject({ type: z.literal("video"), src: assetPath, alt: sentence(240), poster: assetPath, width: z.int().positive().optional(), height: z.int().positive().optional() }),
]);

// ── site copy (every UI word lives in content, never in a component) ───────────────────────

export const SectionCopySchema = z.strictObject({
  id: z.enum(SECTION_IDS),
  index: z.int().min(0).max(99),
  code: z.string().regex(/^[A-Z]{2,14}$/, "uppercase codename"),
  title: sentence(40),
});

export const SiteSchema = z.strictObject({
  title: sentence(80),
  description: sentence(200),
  /** what the head, the share cards and the web manifest say (PROMPTS.md Part 15) */
  meta: z.strictObject({
    /** the installed app's name (manifest short_name: ≤ 12 characters) */
    appName: sentence(12),
    /** a page's <title> under the root: "%s" is the page's own */
    titleTemplate: sentence(60).refine((t) => t.includes("%s"), "must contain %s"),
    /** Open Graph's locale, language_TERRITORY */
    locale: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/),
    /** each share card's alt text; {braces} are filled from the record */
    ogAlt: z.strictObject({ home: sentence(200), project: sentence(200), paper: sentence(200) }),
  }),
  sections: z.array(SectionCopySchema).min(1),
  topicClusters: z.record(slug, sentence(40)),
  labels: z.strictObject({
    heroStrip: z.strictObject({ years: text, shipped: text, papers: text, citations: text }),
    /** the hero's typography layer (§7.4 SYSTEM) */
    hero: z.strictObject({
      micro: z.strictObject({ label: sentence(32), location: text, time: text, availability: text }),
      availability: z.strictObject({ open: sentence(24), limited: sentence(24), closed: sentence(24) }),
      cta: z.strictObject({ work: text, research: text, resume: text }),
      strip: sentence(32),
      scrollHint: sentence(24),
      idleHint: sentence(40),
      /** what the (aria-hidden) stage shows, for screen readers */
      stage: sentence(240),
    }),
    /** 02 · IDENTITY (§7.4): the spec sheet's rows, the CURRENTLY block, the portrait's lamp */
    identity: z.strictObject({
      /** the lamp's caption, by input: a cursor shines it; a finger presses and holds */
      lamp: z.strictObject({ pointer: sentence(40), touch: sentence(40) }),
      spec: z.strictObject({ label: sentence(32), role: text, experience: text, location: text, timezone: text, stack: text, hIndex: text, education: text, availability: text }),
      units: z.strictObject({ year: text, years: text, role: text, roles: text, internship: text, internships: text, asOf: text }),
      currently: z.strictObject({ label: sentence(32), building: text, reading: text, researching: text }),
    }),
    /** 03 · LOG (§7.4): the card deck, its year scale and HTML mirror, the printout */
    log: z.strictObject({
      /** the open end of a role: on its card ("2026-PRESENT") and its dates */
      present: sentence(16),
      scale: sentence(32),
      highlights: sentence(32),
      stack: sentence(32),
      /** the card's own print: "CARD 01/04" */
      card: sentence(16),
      /** what the (aria-hidden) stage shows, for screen readers */
      stage: sentence(240),
      printout: z.strictObject({ title: sentence(40), roles: sentence(32), education: sentence(32), page: sentence(16), end: sentence(40) }),
    }),
    /** 04 · ARCHIVE (§7.4): the query bar, the sky's HTML layer, the ledger, the metrics, the dossier */
    archive: z.strictObject({
      query: z.strictObject({
        label: sentence(32),
        all: sentence(16),
        /** a keyword from a dossier narrows the query: "Query “word” · 1 match", and a way back to all */
        scope: sentence(16),
        match: text,
        matches: text,
        clear: sentence(16),
        record: text,
        records: text,
        cited: text,
        citation: text,
        citations: text,
        layout: sentence(16),
      }),
      layouts: z.strictObject({ topic: sentence(12), year: sentence(12), venue: sentence(12) }),
      /** the shape legend's names, and a cited work's when it fits no venue type */
      venueTypes: z.strictObject({ journal: sentence(24), conference: sentence(24), workshop: sentence(24), preprint: sentence(24), patent: sentence(24), thesis: sentence(24), chapter: sentence(24), other: sentence(24) }),
      legend: z.strictObject({ label: sentence(32), filled: sentence(40), dashed: sentence(40), mine: sentence(40), cited: sentence(40), tuned: sentence(40) }),
      sky: z.strictObject({
        label: sentence(40),
        /** what the (aria-hidden) stage shows, for screen readers */
        stage: sentence(320),
        hint: sentence(120),
        keys: sentence(120),
        citedBy: sentence(24),
        /** a figure nobody has counted yet */
        unknown: z.string().min(1).max(4),
      }),
      ledger: z.strictObject({ caption: sentence(80), year: text, venue: text, title: text, authors: text, citations: text, open: sentence(32) }),
      status: z.strictObject({ published: sentence(24), accepted: sentence(24), underReview: sentence(24), inPrep: sentence(24), stamp: sentence(16) }),
      metrics: z.strictObject({
        label: sentence(32),
        /** the LED figure: peer-reviewed papers until anything is cited, then citations (v1.9) */
        lead: z.strictObject({ publications: sentence(40), citations: sentence(40) }),
        publications: text,
        hIndex: text,
        i10: text,
        firstAuthor: text,
        venues: text,
        asOf: sentence(16),
        computed: sentence(90),
        /** a figure counted from the records themselves, not from an index */
        counted: sentence(32),
        profiles: sentence(40),
        platforms: z.strictObject({ googleScholar: sentence(24), orcid: sentence(24), scopus: sentence(24), researchgate: sentence(24), dblp: sentence(24) }),
      }),
      byYear: z.strictObject({ title: sentence(40), peak: sentence(16), current: sentence(16), paper: text, papers: text, hollow: sentence(60) }),
      dossier: z.strictObject({
        close: sentence(16),
        back: sentence(32),
        id: sentence(16),
        tldr: sentence(24),
        abstract: sentence(24),
        more: sentence(32),
        less: sentence(24),
        pending: sentence(120),
        keywords: sentence(24),
        filter: sentence(60),
        metrics: sentence(24),
        impactFactor: text,
        year: text,
        citations: text,
        notCited: sentence(24),
        source: text,
        authors: sentence(24),
        venue: sentence(24),
        badges: z.strictObject({ peerReviewed: sentence(24), openAccess: sentence(24) }),
        actions: z.strictObject({ label: sentence(24), doi: sentence(12), pdf: sentence(12), arxiv: sentence(12), code: sentence(12), dataset: sentence(12), bibtex: sentence(24), copied: sentence(24) }),
        builtFrom: sentence(40),
        prev: sentence(24),
        next: sentence(24),
      }),
    }),
    /** 05 · WORK (§7.4): the slide carousel and its HTML layer, the INDEX, the case study */
    work: z.strictObject({
      /** a fact that isn't in yet (a project's year, its role): "—" on screen, this to a screen reader */
      pending: sentence(24),
      carousel: z.strictObject({
        label: sentence(32),
        /** what the (aria-hidden) stage shows, for screen readers */
        stage: sentence(240),
        keys: sentence(160),
        /** the live region's lead: "In the gate: 02/05 · QuizMUJ · Full-stack" */
        gate: sentence(24),
      }),
      index: z.strictObject({
        caption: sentence(40),
        number: sentence(8),
        title: sentence(16),
        role: sentence(16),
        year: sentence(16),
        stack: sentence(16),
        open: sentence(32),
        filters: sentence(32),
        all: sentence(16),
        category: sentence(16),
        stackGroup: sentence(16),
        /** "3 of 5 shown" */
        of: text,
        shown: text,
        none: sentence(80),
      }),
      /** the case study's sections, in order (§7.4), and its ways out */
      study: z.strictObject({
        context: sentence(24),
        problem: sentence(24),
        role: sentence(24),
        approach: sentence(24),
        outcome: sentence(24),
        stack: sentence(24),
        links: sentence(24),
        research: sentence(32),
        back: sentence(32),
        prev: sentence(24),
        next: sentence(24),
        link: z.strictObject({ live: text, repo: text, case: text, paper: text }),
      }),
    }),
    /** 06 · CAPABILITIES (§7.4): the primary stack, the keycap pile's HTML layer, the CSS grid, the panel */
    capabilities: z.strictObject({
      primary: sentence(32),
      /** what the (aria-hidden) stage shows, for screen readers */
      stage: sentence(240),
      /** the stage's focus target: what typing does there */
      keys: sentence(160),
      /** the category chips that re-cluster the pile */
      cluster: sentence(32),
      all: sentence(16),
      /** the panel */
      panel: sentence(32),
      /** "L2 BUILT": the rubric's level prefix */
      level: sentence(4),
      years: z.strictObject({ one: text, many: text }),
      /** "IN 2 PROJECTS · 1 PAPER · 3 ROLES" */
      evidence: z.strictObject({ in: text, project: text, projects: text, paper: text, papers: text, role: text, roles: text, none: sentence(40) }),
    }),
    /** 07 · CREDENTIALS (§7.4, §4.4 B1): the wall, its readout and chips, and the cards' two faces */
    credentials: z.strictObject({
      /** the wall, for screen readers: what it is and what turning a card shows */
      wall: sentence(160),
      /** "12 CREDENTIALS / 5 ISSUERS / 11 ACTIVE" */
      readout: z.strictObject({ credential: text, credentials: text, issuer: text, issuers: text, active: text }),
      /** the chips: their group, their groups' names, and the count while they narrow the wall */
      filters: z.strictObject({ label: sentence(32), all: sentence(16), issuer: sentence(16), domain: sentence(16), level: sentence(16), of: text, shown: text }),
      levels: z.strictObject({ foundational: sentence(16), associate: sentence(16), professional: sentence(16), expert: sentence(16) }),
      /** the stamps tell the truth: VERIFIED only when the build reached the verify URL */
      stamps: z.strictObject({ verified: sentence(12), onFile: sentence(12), expired: sentence(12) }),
      front: z.strictObject({ serial: sentence(8), issued: sentence(16) }),
      back: z.strictObject({ id: sentence(24), issued: sentence(16), expires: sentence(16), noExpiry: sentence(16), skills: sentence(24), proves: sentence(24), verify: sentence(16), mrz: sentence(40) }),
      /** the turn button (the card's title follows it, for screen readers) */
      turn: z.strictObject({ over: sentence(24), back: sentence(24) }),
      /** phones: device motion is asked for only from this chip, never on its own */
      tilt: z.strictObject({ ask: sentence(24), on: sentence(24), denied: sentence(60) }),
      /** no card matches the chips */
      none: sentence(60),
    }),
    /** 07 · RECORDS (§7.4, §4.4 B2): the figures, the record cards, the press marquee, the transmissions */
    records: z.strictObject({
      label: sentence(32),
      /** the section strip's count: "3 RECORDS" */
      count: z.strictObject({ one: text, many: text }),
      /** the LED figure (every record) and where the figures come from */
      lead: sentence(40),
      counted: sentence(40),
      /** a tile per kind with records, by its count */
      tiles: z.strictObject({ award: text, honor: text, speaking: text, oss: text, press: text, grant: text, patent: text }),
      /** each card's kind glyph */
      kinds: z.strictObject({ award: sentence(12), honor: sentence(12), speaking: sentence(12), oss: sentence(12), press: sentence(12), grant: sentence(12), patent: sentence(12) }),
      proof: sentence(16),
      press: sentence(32),
      transmissions: sentence(32),
      /** nothing on file at all: no certificate, no record */
      empty: sentence(80),
    }),
    /** 08 · CONNECT (§7.4): the invitation, the email, the teletype form and its log, availability, channels */
    connect: z.strictObject({
      invitation: sentence(32),
      copy: sentence(16),
      copied: sentence(16),
      /** the form's prompts, its intents, the send button and the honeypot (screen readers are told to skip it) */
      prompts: z.strictObject({ name: z.string().regex(/^[A-Z]+>$/), email: z.string().regex(/^[A-Z]+>$/), intent: z.string().regex(/^[A-Z]+>$/), message: z.string().regex(/^[A-Z]+>$/) }),
      fields: z.strictObject({ name: sentence(24), email: sentence(24), intent: sentence(24), message: sentence(24) }),
      intents: z.strictObject({ hire: sentence(24), collaborate: sentence(24), research: sentence(24), speak: sentence(24), other: sentence(24) }),
      send: sentence(16),
      trap: sentence(60),
      /** inline errors, by the code lib/contact.ts gives them */
      errors: z.strictObject({ required: sentence(40), email: sentence(40), short: sentence(60), long: sentence(60), fast: sentence(80), rate: sentence(80), unavailable: sentence(80), failed: sentence(80) }),
      /** the transmission log's lines: VALIDATE ✓ · POST /api/contact · status · id */
      log: z.strictObject({ label: sentence(32), validate: sentence(24), id: sentence(8) }),
      received: z.strictObject({ title: sentence(40), note: sentence(120), again: sentence(24) }),
      /** the line is down: the visitor's text goes by email instead */
      fallback: z.strictObject({ note: sentence(120), link: sentence(32), subject: sentence(40) }),
      availability: z.strictObject({ label: sentence(32), local: sentence(16), overlap: sentence(16), yours: sentence(16), none: sentence(60), hours: sentence(24) }),
      channels: z.strictObject({ label: sentence(32), email: sentence(16), linkedin: sentence(16), github: sentence(16), scholar: sentence(16), orcid: sentence(16), x: sentence(16) }),
      /** the download pair; a missing file shows no button */
      cta: z.strictObject({ resume: sentence(32), publications: sentence(40) }),
    }),
    /** 09 · HALT (§7.4): the index, the build line, back to top, the power-off */
    halt: z.strictObject({
      index: sentence(24),
      sections: sentence(24),
      projects: sentence(24),
      publications: sentence(24),
      build: z.strictObject({ deployed: sentence(16), built: sentence(16) }),
      top: sentence(24),
      halted: sentence(60),
    }),
    /**
     * ∞ · SHELL (§7.4, PROMPTS.md Part 13): every word the terminal prints. Templates take {name}
     * placeholders, filled from /search-index.json — the terminal is a view over the data.
     */
    shell: z.strictObject({
      label: sentence(32),
      close: sentence(32),
      input: sentence(32),
      output: sentence(32),
      user: z.string().regex(/^[a-z][a-z0-9-]{0,15}$/, "a shell user name"),
      host: z.string().regex(/^[a-z][a-z0-9-]{0,15}$/, "a host name"),
      tty: sentence(8),
      banner: z.array(sentence(120)).min(1).max(4),
      /** a returning visitor's greeting, as a tty's (Part 16): {when} in their zone, {tty} */
      lastLogin: sentence(60),
      loading: sentence(60),
      offline: sentence(160),
      notFound: sentence(60),
      didYouMean: sentence(60),
      or: sentence(8),
      usage: sentence(24),
      unknown: sentence(60),
      ambiguous: sentence(80),
      interrupted: sentence(8),
      copied: sentence(60),
      noClipboard: sentence(100),
      opening: sentence(40),
      none: sentence(8),
      states: z.strictObject({ on: sentence(8), off: sentence(8), auto: sentence(8), low: sentence(8) }),
      themes: z.strictObject({ phosphor: sentence(24), amber: sentence(24), paper: sentence(24) }),
      help: z.strictObject({
        title: sentence(24),
        groups: z.strictObject({ me: sentence(24), records: sentence(24), machine: sentence(24), toys: sentence(24) }),
        alias: sentence(40),
        footer: sentence(120),
      }),
      /** one line of help per command: how it's typed, what it does */
      commands: z.strictObject(
        Object.fromEntries(
          (["help", "whoami", "about", "stack", "date", "uptime", "clear", "history", "ls", "cat", "open", "cite", "scholar", "verify", "grep", "resume", "contact", "email", "social", "theme", "sound", "grid", "gfx", "goto", "sudo", "neofetch", "rain", "man", "decode", "debug"] as const).map((c) => [c, z.strictObject({ usage: sentence(64), about: sentence(100) })]),
        ) as Record<"help" | "whoami" | "about" | "stack" | "date" | "uptime" | "clear" | "history" | "ls" | "cat" | "open" | "cite" | "scholar" | "verify" | "grep" | "resume" | "contact" | "email" | "social" | "theme" | "sound" | "grid" | "gfx" | "goto" | "sudo" | "neofetch" | "rain" | "man" | "decode" | "debug", z.ZodObject<{ usage: typeof text; about: typeof text }, z.core.$strict>>,
      ),
      whoami: sentence(60),
      about: z.strictObject({ location: sentence(16), availability: sentence(16) }),
      stack: z.strictObject({
        primary: sentence(16),
        skills: sentence(16),
        skillsLine: sentence(80),
        site: sentence(16),
        /** what `stack` names as this site's own (each version read from its installed package at build) */
        libraries: z.array(z.strictObject({ name: sentence(24), package: z.string().regex(/^[@a-z0-9/._-]+$/) })).min(1),
      }),
      date: z.strictObject({ yours: sentence(24), mine: sentence(24) }),
      uptime: sentence(60),
      units: z.strictObject({ hour: sentence(4), minute: sentence(4), second: sentence(4) }),
      history: z.strictObject({ empty: sentence(40) }),
      ls: z.strictObject({
        kinds: sentence(24),
        columns: z.strictObject({ slug: sentence(12), year: sentence(12), title: sentence(12), venue: sentence(12), status: sentence(12), category: sentence(12), level: sentence(12), years: sentence(12), dates: sentence(12), role: sentence(12), date: sentence(12), count: sentence(12) }),
        noSuchKind: sentence(60),
        noCerts: sentence(60),
        empty: sentence(24),
      }),
      cat: z.strictObject({
        authors: sentence(16), me: sentence(12), venue: sentence(16), status: sentence(16), citations: sentence(16), tldr: sentence(16), abstract: sentence(16), keywords: sentence(16), doi: sentence(16), links: sentence(16),
        problem: sentence(16), approach: sentence(16), outcome: sentence(16), role: sentence(16), stack: sentence(16), metrics: sentence(16), highlights: sentence(16), dates: sentence(16), location: sentence(16),
        issuer: sentence(16), level: sentence(16), years: sentence(16), evidence: sentence(16), evidenceLine: sentence(80), field: sentence(16), proof: sentence(16), next: sentence(40), pending: sentence(24),
      }),
      cite: z.strictObject({ notPaper: sentence(60), noPapers: sentence(40) }),
      scholar: z.strictObject({ source: sentence(16), counted: sentence(40), profiles: sentence(16), noProfiles: sentence(80) }),
      verify: z.strictObject({ notCert: sentence(60), check: sentence(24), noUrl: sentence(60) }),
      grep: z.strictObject({ hits: sentence(60), hit: sentence(60), none: sentence(60) }),
      resume: z.strictObject({ none: sentence(100) }),
      contact: sentence(40),
      social: z.strictObject({ none: sentence(60), list: sentence(24) }),
      theme: z.strictObject({ now: sentence(60), set: sentence(60) }),
      sound: sentence(40),
      grid: sentence(40),
      gfx: sentence(40),
      goto: z.strictObject({ none: sentence(60), list: sentence(24) }),
      sudo: z.strictObject({ password: sentence(60), denied: sentence(100), pitch: z.array(z.string().max(100)).min(1) }),
      neofetch: z.strictObject({ os: sentence(12), host: sentence(12), role: sentence(12), stack: sentence(12), papers: sentence(12), citations: sentence(12), certs: sentence(12), uptime: sentence(12), theme: sentence(12), noCerts: sentence(40), papersLine: sentence(60), citationsLine: sentence(60) }),
      rain: z.strictObject({ start: sentence(100), stop: sentence(40) }),
      man: z.strictObject({
        which: sentence(80),
        missing: sentence(60),
        /** man retrograde (§7.5): why the name, and the archive's camera path (§4.3 A3) */
        retrograde: z.strictObject({ title: sentence(24), section: sentence(24), blocks: z.array(z.strictObject({ heading: sentence(40), body: sentence(600) })).min(1) }),
      }),
      decode: z.strictObject({ list: sentence(24), header: sentence(80), reads: sentence(40), unknown: sentence(60) }),
      debug: sentence(60),
    }),
    /** persistent chrome (DESIGN.md §7.3): the HUD readout's system name, the section rail's name */
    chrome: z.strictObject({
      os: z.string().regex(/^[A-Z0-9/ .-]{2,24}$/, "uppercase system name"),
      rail: sentence(32),
      /** what a screen reader hears after a link that opens a new tab (components/ui/Button) */
      newTab: sentence(32),
      /** the skip link, the first stop on every page (WCAG 2.4.1) */
      skip: sentence(32),
      /** the number keys tune the sections like channels (lib/channels.ts): the on-screen display's word */
      channel: sentence(8),
    }),
    /** 404 / 500 — NO SIGNAL (§7.4): an empty tube, a drifting on-screen box, the way back */
    noSignal: z.strictObject({
      title: sentence(24),
      notFound: sentence(60),
      error: sentence(60),
      hint: sentence(24),
      home: sentence(40),
      terminal: sentence(60),
      retry: sentence(24),
    }),
    /** <Nav> (§7.3): four destinations and the terminal key; `section` is where each one lands */
    nav: z.strictObject({
      label: sentence(32),
      items: z.array(z.strictObject({ label: sentence(16), section: z.enum(SECTION_IDS) })).min(1).max(6),
      terminal: z.strictObject({ glyph: z.string().min(1).max(2), label: sentence(32) }),
    }),
    /** the front panel's hardware switches (§7.3) */
    panel: z.strictObject({ label: sentence(32), tube: text, sound: text, soundName: text, on: text, off: text, meter: sentence(32), grid: text, gfx: text, gfxName: text, gfxAuto: text, gfxLow: text, themes: z.strictObject({ phosphor: text, amber: text, paper: text }) }),
    /** cursor chips over media (§7.3) */
    cursor: z.strictObject({ view: text, drag: text, flip: text, open: text }),
    /** the boot log (§7.4 POST) — every line is true; these are its words */
    boot: z.strictObject({
      version: text,
      build: text,
      cpu: text,
      cores: text,
      gpu: text,
      masked: text,
      notQueried: text,
      display: text,
      measured: text,
      hz: text,
      gfx: text,
      tier: text,
      particles: text,
      probe: text,
      font: text,
      data: text,
      papers: text,
      projects: text,
      credentials: text,
      a11y: text,
      reducedMotion: text,
      contrast: text,
      standard: text,
      more: text,
      on: text,
      off: text,
      sound: text,
      muted: text,
      soundKey: text,
      ok: text,
      unknown: text,
      loading: text,
      skip: sentence(24),
      skipLabel: sentence(60),
    }),
  }),
});

// ── entities ───────────────────────────────────────────────────────────────────────────────

export const ProfileSchema = z.strictObject({
  name: sentence(40),
  initials: z.string().regex(/^[A-Z]{1,3}$/, "1–3 uppercase letters"),
  role: sentence(40), // scrambles in the hero: ≤ 40 characters (DESIGN.md §3.7)
  tagline: sentence(90),
  location: z.strictObject({ city: text, country: text, countryCode: z.string().regex(/^[A-Z]{2}$/) }),
  coordinates: z.strictObject({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
  timezone: z.string().refine(isTimeZone, "IANA time zone, e.g. Europe/Amsterdam"),
  workingHours: z.strictObject({ start: hhmm, end: hhmm }).refine((w) => w.start < w.end, "start must be before end"),
  availability: z.strictObject({ status: z.enum(AVAILABILITY), note: sentence(120) }),
  bio: z
    .strictObject({
      short: sentence(200),
      long: z.array(sentence(700)).min(1).max(5),
      /** per paragraph, the ≤ 3 phrases the About bio sets in the accent (DESIGN.md §7.4 IDENTITY) */
      accents: z.array(z.array(text).max(3)).optional(),
    })
    .superRefine((b, ctx) => {
      if (!b.accents) return;
      if (b.accents.length > b.long.length) ctx.addIssue({ code: "custom", message: `accents has ${b.accents.length} entries for ${b.long.length} paragraphs`, path: ["accents"] });
      b.accents.forEach((list, i) =>
        list.forEach((phrase, j) => {
          if (!(b.long[i] ?? "").includes(phrase)) ctx.addIssue({ code: "custom", message: `"${phrase}" doesn't occur in paragraph ${i + 1}`, path: ["accents", i, j] });
        }),
      );
    }),
  avatar: z.strictObject({ src: assetPath, alt: sentence(160) }),
  /** null until the owner publishes one: every version of theirs carries a phone number (v2.3) */
  resumeUrl: z.union([assetPath, httpsUrl]).nullable(),
  email: z.email(),
  socials: z.array(z.strictObject({ platform: z.enum(SOCIAL_PLATFORMS), url: httpsUrl, handle: text })),
  scholarProfiles: z.array(z.strictObject({ platform: z.enum(SCHOLAR_PLATFORMS), url: httpsUrl, id: text })),
});

export const ExperienceSchema = z
  .strictObject({
    company: text,
    role: sentence(60),
    type: z.enum(ROLE_TYPES),
    start: yearMonth,
    end: z.union([yearMonth, z.literal("present")]),
    location: text,
    blurb: sentence(200),
    highlights: z.array(sentence(200)).min(1).max(3),
    metrics: z.array(MetricSchema).max(4),
    stack: z.array(text).max(10),
    logo: assetPath.optional(),
    url: httpsUrl.optional(),
  })
  .refine((e) => e.end === "present" || e.end >= e.start, { message: "end must be on or after start", path: ["end"] });

export const AuthorSchema = z.strictObject({ name: text, isMe: z.boolean(), affiliation: text.optional() });

/** One plain-language sentence (DESIGN.md §7.4: the TLDR is what non-specialists read). */
const tldr = sentence(200).refine((s) => {
  if (!/[.!?]$/.test(s) || /\n/.test(s)) return false;
  const body = s.slice(0, -1).replace(/\b(e\.g|i\.e|et al|vs|etc|approx)\./gi, "");
  return !/[.!?]\s+\S/.test(body);
}, "exactly one sentence, ending in a period");

export const PublicationSchema = z
  .strictObject({
    slug,
    title: sentence(200),
    authors: z.array(AuthorSchema).min(1),
    venue: text,
    venueShort: sentence(16),
    venueType: z.enum(VENUE_TYPES),
    year,
    month: z.int().min(1).max(12).optional(),
    doi: doi.optional(),
    arxivId: arxivId.optional(),
    pdfUrl: z.union([httpsUrl, assetPath]).optional(),
    codeUrl: httpsUrl.optional(),
    datasetUrl: httpsUrl.optional(),
    /** optional until the paper's abstract is public (proceedings still in press) */
    abstract: sentence(2500).optional(),
    tldr,
    keywords: z.array(text).min(1).max(8),
    citations: z.int().min(0),
    citationsAsOf: isoDate,
    citationSource: z.enum(CITATION_SOURCES),
    impactFactor: z.number().positive().optional(),
    isOpenAccess: z.boolean(),
    isPeerReviewed: z.boolean(),
    status: z.enum(PUBLICATION_STATUS),
    bibtex: text.refine((b) => /^@\w+\{[^,\s]+,/.test(b), "BibTeX entry starting with @type{key,"),
    coAuthorIds: z.array(slug),
    relatedPublicationSlugs: z.array(slug),
    topicCluster: slug,
    featured: z.boolean(),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
    const me = p.authors.filter((a) => a.isMe).length;
    if (me !== 1) issue(`exactly one author must be you (isMe: true), found ${me}`, ["authors"]);
    const others = p.authors.length - me;
    if (p.coAuthorIds.length !== others) issue(`coAuthorIds needs one id per co-author, in order (${others} co-authors, ${p.coAuthorIds.length} ids)`, ["coAuthorIds"]);
    if (p.relatedPublicationSlugs.includes(p.slug)) issue("a paper cannot be related to itself", ["relatedPublicationSlugs"]);
    if (!new RegExp(`year\\s*=\\s*[{"]?${p.year}\\b`).test(p.bibtex)) issue(`BibTeX year must be ${p.year}`, ["bibtex"]);
    if (p.doi) {
      const m = /doi\s*=\s*[{"]([^}"]+)[}"]/i.exec(p.bibtex);
      if (!m || m[1]?.toLowerCase() !== p.doi.toLowerCase()) issue(`BibTeX doi must equal ${p.doi}`, ["bibtex"]);
    }
    if (p.arxivId && !p.bibtex.includes(p.arxivId)) issue(`BibTeX must cite the arXiv id ${p.arxivId}`, ["bibtex"]);
    if (p.isPeerReviewed && (!PEER_REVIEWABLE.has(p.venueType) || !COUNTED.has(p.status))) {
      issue(`a ${p.venueType} that is ${p.status} cannot be marked peer reviewed`, ["isPeerReviewed"]);
    }
    if (p.impactFactor !== undefined && p.venueType !== "journal") issue("impactFactor applies to journals only", ["impactFactor"]);
  });

/** The marks a cited work may take: the seven venue types, plus "other" for reports, standards,
 *  datasets and web pages, drawn as a plain point outside the shape legend. */
export const CITED_VENUE_TYPES = [...VENUE_TYPES, "other"] as const;

/**
 * A work one of my papers cites, from its reference list (DESIGN.md §4.3 A3, v1.9): a faint star in
 * ARCHIVE's sky, with a "cites" edge to each paper whose list includes it. Kept as the reference
 * list prints it; a DOI lets the bake read its citation count (the star's size) from OpenAlex.
 */
export const CitedWorkSchema = z.strictObject({
  id: slug,
  title: sentence(300),
  /** as the reference list prints them, e.g. "S. M. Lundberg and S.-I. Lee" */
  authors: sentence(200),
  /** older than my own papers can be: reference lists reach back to the classics */
  year: z.int().min(1800).max(2100),
  venue: sentence(200),
  venueType: z.enum(CITED_VENUE_TYPES),
  doi: doi.optional(),
  url: httpsUrl.optional(),
  /** my publications whose reference lists include it */
  citedBy: z.array(slug).min(1),
});

export const ProjectSchema = z.strictObject({
  slug,
  title: sentence(40),
  subtitle: sentence(90),
  /** null until the owner says (v2.0): shown as pending, never guessed */
  year: year.nullable(),
  role: sentence(60).nullable(),
  category: sentence(32),
  summary: sentence(240),
  problem: sentence(900),
  approach: sentence(1200),
  outcome: sentence(700),
  metrics: z.array(MetricSchema).max(4),
  stack: z.array(text).min(1).max(10),
  links: z.strictObject({
    live: httpsUrl.optional(),
    repo: httpsUrl.optional(),
    case: assetPath.optional(),
    paper: z.union([httpsUrl, assetPath]).optional(),
  }),
  media: z.array(MediaSchema).min(1),
  featured: z.boolean(),
  relatedPublicationSlugs: z.array(slug),
});

export const SkillSchema = z.strictObject({
  name: sentence(32),
  category: sentence(32),
  level: z.int().min(1).max(5),
  years: z.number().min(0).max(60),
  /**
   * the keycap legend (DESIGN.md §4.3 A5): its label, and the technology's mark as a Simple Icons
   * slug (CC0, drawn into the legend atlas at build: scripts/bake/keycaps.ts) — a monogram without one
   */
  legend: z.strictObject({ label: sentence(6), icon: z.string().regex(/^[a-z0-9]+$/, "a Simple Icons slug").optional() }),
  primary: z.boolean(),
  /** other spellings used when counting evidence in project stacks and papers */
  aliases: z.array(text).optional(),
});

export const CertificateSchema = z
  .strictObject({
    slug,
    title: sentence(120),
    issuer: text,
    issuerLogo: assetPath.optional(),
    issueDate: isoDate,
    expiryDate: isoDate.nullable(),
    credentialId: text,
    verifyUrl: httpsUrl.nullable(),
    skillsCovered: z.array(text).min(1).max(8),
    domain: sentence(32),
    level: z.enum(CERT_LEVELS),
    proves: sentence(140),
    featured: z.boolean(),
  })
  .refine((c) => c.expiryDate === null || c.expiryDate > c.issueDate, { message: "expiryDate must be after issueDate", path: ["expiryDate"] });

export const AchievementSchema = z.strictObject({
  title: sentence(120),
  issuer: text,
  /** a day, a month, or only the year when that's all the record says */
  date: z.union([isoDate, yearMonth, yearOnly]),
  description: sentence(240),
  proofUrl: httpsUrl.optional(),
  kind: z.enum(ACHIEVEMENT_KINDS),
  metric: MetricSchema.optional(),
});

export const EducationSchema = z
  .strictObject({
    institution: text,
    degree: sentence(40),
    field: sentence(80),
    start: yearMonth,
    end: z.union([yearMonth, z.literal("present")]),
    location: text,
    thesis: sentence(200).optional(),
    honors: sentence(80).optional(),
    url: httpsUrl.optional(),
  })
  .refine((e) => e.end === "present" || e.end >= e.start, { message: "end must be on or after start", path: ["end"] });

export const TestimonialSchema = z.strictObject({
  quote: sentence(400),
  name: text,
  role: text,
  company: text,
  relationship: sentence(80),
  url: httpsUrl.optional(),
  /** publish a quote only with its author's permission */
  consented: z.literal(true, { error: "only publish a testimonial with its author's consent (consented: true)" }),
});

export const CurrentFocusSchema = z.strictObject({
  kind: z.enum(FOCUS_KINDS),
  title: sentence(80),
  detail: sentence(160).optional(),
  url: httpsUrl.optional(),
});

// ── the whole dataset, with cross-references ───────────────────────────────────────────────

export const ContentSchema = z
  .strictObject({
    isPlaceholder: z.boolean(),
    site: SiteSchema,
    profile: ProfileSchema,
    experience: z.array(ExperienceSchema).min(1),
    publications: z.array(PublicationSchema),
    citedWorks: z.array(CitedWorkSchema),
    projects: z.array(ProjectSchema),
    skills: z.array(SkillSchema),
    certificates: z.array(CertificateSchema),
    achievements: z.array(AchievementSchema),
    education: z.array(EducationSchema),
    testimonials: z.array(TestimonialSchema),
    currentFocus: z.array(CurrentFocusSchema),
  })
  .superRefine((c, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });
    const dupes = (values: string[]) => values.filter((v, i) => values.indexOf(v) !== i);

    for (const d of dupes(c.publications.map((p) => p.slug))) issue(`duplicate publication slug "${d}"`, ["publications"]);
    for (const d of dupes(c.projects.map((p) => p.slug))) issue(`duplicate project slug "${d}"`, ["projects"]);
    for (const d of dupes(c.certificates.map((x) => x.slug))) issue(`duplicate certificate slug "${d}"`, ["certificates"]);
    for (const d of dupes(c.skills.map((s) => s.name.toLowerCase()))) issue(`duplicate skill "${d}"`, ["skills"]);
    const order = c.site.sections.map((s) => s.id).join(" → ");
    if (order !== SECTION_IDS.join(" → ")) issue(`site.sections must be, in order: ${SECTION_IDS.join(" → ")} (found ${order})`, ["site", "sections"]);
    c.site.sections.forEach((s, i) => {
      if (s.index !== i) issue(`section "${s.id}" has index ${s.index}; its position is ${i}`, ["site", "sections", i, "index"]);
    });

    const papers = new Set(c.publications.map((p) => p.slug));
    c.publications.forEach((p, i) => {
      p.relatedPublicationSlugs.forEach((r, j) => {
        if (!papers.has(r)) issue(`unknown related publication "${r}"`, ["publications", i, "relatedPublicationSlugs", j]);
      });
      if (!(p.topicCluster in c.site.topicClusters)) issue(`topicCluster "${p.topicCluster}" has no name in site.topicClusters`, ["publications", i, "topicCluster"]);
    });
    c.projects.forEach((p, i) => {
      p.relatedPublicationSlugs.forEach((r, j) => {
        if (!papers.has(r)) issue(`unknown related publication "${r}"`, ["projects", i, "relatedPublicationSlugs", j]);
      });
    });

    for (const d of dupes(c.citedWorks.map((w) => w.id))) issue(`duplicate cited work id "${d}"`, ["citedWorks"]);
    c.citedWorks.forEach((w, i) => {
      if (papers.has(w.id)) issue(`cited work id "${w.id}" is also a publication slug`, ["citedWorks", i, "id"]);
      w.citedBy.forEach((s, j) => {
        if (!papers.has(s)) issue(`cited by unknown publication "${s}"`, ["citedWorks", i, "citedBy", j]);
      });
      for (const d of dupes(w.citedBy)) issue(`"${d}" listed twice in citedBy`, ["citedWorks", i, "citedBy"]);
    });
    const sky = c.publications.length + c.citedWorks.length;
    if (sky > SKY_LIMITS.nodes) issue(`ARCHIVE's sky holds ${SKY_LIMITS.nodes} stars (DESIGN.md §4.3 A3); publications + cited works = ${sky}`, ["citedWorks"]);

    const keys = c.publications.map((p) => /^@\w+\{([^,\s]+),/.exec(p.bibtex)?.[1] ?? "");
    for (const d of dupes(keys)) issue(`duplicate BibTeX key "${d}"`, ["publications"]);

    // one canonical name per co-author id
    const names = new Map<string, string>();
    c.publications.forEach((p, i) => {
      p.authors.filter((a) => !a.isMe).forEach((a, k) => {
        const id = p.coAuthorIds[k];
        if (!id) return;
        const seen = names.get(id);
        if (seen && seen !== a.name) issue(`co-author id "${id}" is "${seen}" elsewhere but "${a.name}" here`, ["publications", i, "coAuthorIds", k]);
        names.set(id, a.name);
      });
    });

    const primary = c.skills.filter((s) => s.primary).length;
    if (primary > 6) issue(`at most 6 primary skills (the PRIMARY STACK strip), found ${primary}`, ["skills"]);
    const featured = c.projects.filter((p) => p.featured).length;
    if (featured > 8) issue(`at most 8 featured projects (the slide carousel), found ${featured}`, ["projects"]);
    for (const kind of FOCUS_KINDS) {
      const n = c.currentFocus.filter((f) => f.kind === kind).length;
      if (n !== 1) issue(`currentFocus needs exactly one "${kind}" item, found ${n}`, ["currentFocus"]);
    }
  });

// ── generated files written by the bake (scripts/bake) ─────────────────────────────────────

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
export const EDGE_KINDS = ["author", "related", "topic", "cites"] as const;
export const NODE_KINDS = ["record", "cited"] as const;
export const LAYOUTS = ["topic", "year", "venue"] as const;

export const GraphFileSchema = z.strictObject({
  version: z.literal(1),
  /** hash of the structural inputs; derive.ts flags graph.json as stale when it differs */
  inputHash: z.string(),
  seed: z.int(),
  nodes: z.array(z.strictObject({ id: slug, kind: z.enum(NODE_KINDS), layouts: z.strictObject({ topic: vec3, year: vec3, venue: vec3 }) })),
  edges: z.array(z.strictObject({ source: slug, target: slug, kinds: z.array(z.enum(EDGE_KINDS)).min(1), weight: z.number().positive() })),
  labels: z.strictObject({
    topic: z.array(z.strictObject({ id: z.string(), position: vec3 })),
    year: z.array(z.strictObject({ id: z.string(), position: vec3 })),
    venue: z.array(z.strictObject({ id: z.string(), position: vec3 })),
  }),
});

export const CitationsFileSchema = z.strictObject({
  version: z.literal(1),
  /** dry: placeholder data or never refreshed — derive.ts falls back to data.ts counts */
  mode: z.enum(["dry", "live"]),
  source: z.literal("OpenAlex").nullable(),
  /** the last run that reached OpenAlex */
  asOf: isoDate.nullable(),
  /** per paper: a count kept from an earlier run (API down, rate-limited) keeps its own date */
  counts: z.record(slug, z.strictObject({ doi, citations: z.int().min(0), openalexId: z.string(), asOf: isoDate })),
  /** per cited work, by its id (v1.9): its star's size in ARCHIVE's sky, read by the same rules */
  cited: z.record(slug, z.strictObject({ doi, citations: z.int().min(0), openalexId: z.string(), asOf: isoDate })).default({}),
});

export const VERIFY_STATUS = ["ok", "dead", "blocked", "unreachable", "skipped"] as const;
export const VerifyFileSchema = z.strictObject({
  version: z.literal(1),
  mode: z.enum(["dry", "live"]),
  results: z.record(
    z.string(),
    z.strictObject({
      kind: z.enum(["doi", "arxiv", "verifyUrl"]),
      owner: slug,
      target: z.string(),
      status: z.enum(VERIFY_STATUS),
      httpStatus: z.int().nullable(),
      checkedAt: isoDate.nullable(),
    }),
  ),
});

// ── types ──────────────────────────────────────────────────────────────────────────────────

export type ContentInput = z.input<typeof ContentSchema>;
export type Content = z.output<typeof ContentSchema>;
export type Profile = Content["profile"];
export type Experience = Content["experience"][number];
export type Publication = Content["publications"][number];
export type Project = Content["projects"][number];
export type Skill = Content["skills"][number];
export type Certificate = Content["certificates"][number];
export type Achievement = Content["achievements"][number];
export type Education = Content["education"][number];
export type Testimonial = Content["testimonials"][number];
export type CurrentFocus = Content["currentFocus"][number];
export type CitedWork = Content["citedWorks"][number];
export type VenueType = (typeof VENUE_TYPES)[number];
export type CitedVenueType = (typeof CITED_VENUE_TYPES)[number];
export type PublicationStatus = (typeof PUBLICATION_STATUS)[number];
export type EdgeKind = (typeof EDGE_KINDS)[number];
export type NodeKind = (typeof NODE_KINDS)[number];
export type LayoutName = (typeof LAYOUTS)[number];
export type GraphFile = z.output<typeof GraphFileSchema>;
export type CitationsFile = z.output<typeof CitationsFileSchema>;
export type VerifyFile = z.output<typeof VerifyFileSchema>;
export type VerifyStatus = (typeof VERIFY_STATUS)[number];

export class ContentError extends Error {
  override name = "ContentError";
}

/** Parses the dataset; throws a readable, path-annotated error listing every problem. */
export function parseContent(input: unknown): Content {
  const result = ContentSchema.safeParse(input);
  if (!result.success) {
    throw new ContentError(`content/data.ts failed validation:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
