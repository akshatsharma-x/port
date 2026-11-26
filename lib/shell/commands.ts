import type { SearchDoc, SearchIndex } from "@/content/search-index";
import { CARD, decode, PUNCH_ROWS, unpackColumns } from "@/lib/hollerith";
import { routes } from "@/lib/routes";
import { THEMES, type Theme } from "@/lib/tokens";
import { SHELL } from "./config";
import { commonPrefix, field, fill, fillLine, fold, line, seg, snippet, span, suggest, table, tokenize, wrap } from "./text";
import type { Context, Effect, Line, Result } from "./types";

/**
 * The terminal's commands (DESIGN.md §7.4 SHELL, PROMPTS.md Part 13). Pure: each reads the index —
 * the site's own data, built from content/derive.ts — and the machine's state, and returns lines
 * and effects for the panel to carry out. No words live here: every one is the content's
 * (labels.shell), filled with the records' own values.
 */
type Shell = SearchIndex["labels"]["shell"];
export type CommandName = keyof Shell["commands"];
type Group = keyof Shell["help"]["groups"];

interface Command {
  group: Group;
  /** what Tab offers for the first argument */
  args?: (ctx: Context) => readonly string[];
  run: (ctx: Context, args: readonly string[]) => Result;
}

/** `matrix` is `rain` (§7.4) */
export const ALIASES: Readonly<Record<string, CommandName>> = { matrix: "rain" };

const LS_KINDS = { projects: ["project"], papers: ["paper"], skills: ["skill"], experience: ["role", "education"], certs: ["cert"], awards: ["award"] } as const satisfies Record<string, readonly SearchDoc["kind"][]>;
type LsKind = keyof typeof LS_KINDS;
const SOUND = ["on", "off"] as const;
const GFX = ["auto", "low"] as const;
/** the places `goto` goes: the page's sections, not the boot (post) or this terminal (shell) */
const NOT_PLACES = new Set(["post", "shell"]);

// ── shared ───────────────────────────────────────────────────────────────────────────────────

const S = (ctx: Context): Shell => ctx.ix.labels.shell;
const out = (...lines: Line[]): Result => ({ lines });
const fail = (...lines: Line[]): Result => ({ lines, error: true });
const say = (text: string, k?: Parameters<typeof seg>[1]): Line => [seg(text, k)];
const usage = (ctx: Context, name: CommandName): Result => fail(say(fill(S(ctx).usage, { usage: S(ctx).commands[name].usage }), "dim"));
const orList = (ctx: Context, items: readonly string[]) => items.join(` ${S(ctx).or} `);
const youMean = (ctx: Context, word: string, pool: readonly string[]): Line[] => {
  const near = suggest(word, pool, SHELL.suggestDistance).slice(0, 3);
  return near.length ? [say(fill(S(ctx).didYouMean, { suggestions: orList(ctx, near) }), "dim")] : [];
};
const sectionOf = (ctx: Context, doc: SearchDoc) => ctx.ix.sections.find((s) => s.id === doc.section);
const docs = <K extends SearchDoc["kind"]>(ctx: Context, ...kinds: K[]) => ctx.ix.docs.filter((d): d is Extract<SearchDoc, { kind: K }> => (kinds as string[]).includes(d.kind));
const none = (ctx: Context, v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? S(ctx).none : String(v));
const range = (start: string, end: string) => `${start} – ${end}`;
const stampOf = (ctx: Context, c: Extract<SearchDoc, { kind: "cert" }>) => {
  const L = ctx.ix.labels.stamps;
  if (c.expiryDate !== null && c.expiryDate < ctx.ix.builtOn) return L.expired;
  return c.verification === "verified" ? L.verified : L.onFile;
};
const labelWidth = (labels: readonly string[]) => Math.max(...labels.map((l) => l.length));
const blank: Line = [];

/** A record by slug, id (kind:slug) or a prefix of one that names only it. */
type Found<D> = { doc: D } | { none: true; near: string[] } | { many: D[] };
function find<D extends SearchDoc>(pool: readonly D[], name: string): Found<D> {
  const n = name.toLowerCase();
  const exact = pool.filter((d) => d.slug === n || d.id === n);
  if (exact.length === 1) return { doc: exact[0] as D };
  if (exact.length > 1) return { many: exact };
  const prefixed = pool.filter((d) => d.slug.startsWith(n));
  if (prefixed.length === 1) return { doc: prefixed[0] as D };
  if (prefixed.length > 1) return { many: prefixed };
  return { none: true, near: suggest(n, [...new Set(pool.map((d) => d.slug))], SHELL.suggestDistance) };
}
function notFound(ctx: Context, command: CommandName, name: string, f: { none: true; near: string[] } | { many: SearchDoc[] }): Result {
  if ("many" in f) return fail(say(fill(S(ctx).ambiguous, { name, options: f.many.map((d) => d.id).join(", ") }), "dim"));
  return fail(say(fill(S(ctx).unknown, { command, name }), "hot"), ...(f.near.length ? [say(fill(S(ctx).didYouMean, { suggestions: orList(ctx, f.near.slice(0, 3)) }), "dim")] : []));
}

// ── records, formatted (cat) ─────────────────────────────────────────────────────────────────

function record(ctx: Context, d: SearchDoc): Line[] {
  const C = S(ctx).cat;
  const w = ctx.columns;
  const head: Line[] = [say(d.title, "bold"), say(d.meta, "dim"), blank];
  const rows: [string, string, Parameters<typeof seg>[1]?][] = [];
  const links: [string, string][] = [];
  let next: string[] = [];
  switch (d.kind) {
    case "paper": {
      rows.push([C.authors, d.authors.map((a) => (a.isMe ? `${a.name} (${C.me})` : a.name)).join(", ")]);
      rows.push([C.venue, `${d.venue}, ${d.year}`]);
      rows.push([C.status, ctx.ix.labels.status[d.status as keyof typeof ctx.ix.labels.status] ?? d.status]);
      rows.push([C.citations, fill(S(ctx).neofetch.citationsLine, { count: d.citations, source: d.citationSource, asOf: d.citationsAsOf })]);
      rows.push([C.tldr, d.tldr]);
      rows.push([C.abstract, d.abstract ?? C.pending]);
      if (d.keywords.length) rows.push([C.keywords, d.keywords.join(", ")]);
      rows.push([C.doi, d.links.doi ?? S(ctx).none]);
      const P = ctx.ix.labels.paperLinks;
      if (d.links.doi) links.push([P.doi, `https://doi.org/${d.links.doi}`]);
      for (const k of ["pdf", "arxiv", "code", "dataset"] as const) {
        const v = d.links[k];
        if (v) links.push([P[k], k === "arxiv" ? `https://arxiv.org/abs/${v}` : v]);
      }
      next = [`open ${d.slug}`, `cite ${d.slug}`];
      break;
    }
    case "project": {
      rows.push([C.problem, d.problem], [C.approach, d.approach], [C.outcome, d.outcome]);
      if (d.role) rows.push([C.role, d.role]);
      rows.push([C.stack, d.stack.join(" · ")]);
      if (d.metrics.length) rows.push([C.metrics, d.metrics.map((m) => `${m.label} ${m.value}${m.unit ?? ""}`).join(" · ")]);
      const P = ctx.ix.labels.projectLinks;
      for (const k of ["live", "repo", "paper"] as const) {
        const v = d.links[k];
        if (v) links.push([P[k], v]);
      }
      next = [`open ${d.slug}`];
      break;
    }
    case "role":
      rows.push([C.dates, range(d.start, d.end)], [C.location, d.location], [C.role, d.blurb]);
      d.highlights.forEach((h, i) => rows.push([i ? "" : C.highlights, `· ${h}`]));
      if (d.stack.length) rows.push([C.stack, d.stack.join(" · ")]);
      next = [`decode ${d.slug}`, "goto log"];
      break;
    case "education":
      rows.push([C.dates, range(d.start, d.end)], [C.location, d.location], [C.field, d.field]);
      if (d.honors) rows.push(["", d.honors]);
      next = ["goto log"];
      break;
    case "skill":
      rows.push([C.level, `L${d.level} · ${d.rubric}`], [C.years, String(d.years)], [C.evidence, fill(C.evidenceLine, d.evidence)]);
      next = ["goto capabilities"];
      break;
    case "cert": {
      const K = ctx.ix.labels.card;
      rows.push([C.issuer, d.issuer], [C.level, ctx.ix.labels.levels[d.level as keyof typeof ctx.ix.labels.levels] ?? d.level], [K.id, d.credentialId ?? K.notListed]);
      rows.push([K.issued, d.issueDate ?? K.notListed], [K.expires, d.expiryDate ?? K.noExpiry], [K.proves, d.proves]);
      rows.push([S(ctx).verify.check, stampOf(ctx, d)]);
      next = [`verify ${d.slug}`];
      break;
    }
    case "award":
      rows.push([C.issuer, d.issuer], [C.dates, d.date], ["", d.description]);
      if (d.proofUrl) links.push([C.proof, d.proofUrl]);
      next = ["goto credentials"];
      break;
    case "quote":
      rows.push(["", d.text]);
      break;
  }
  const lw = labelWidth([...rows.map((r) => r[0]), ...links.map((l) => l[0]), C.links]);
  const body = rows.flatMap(([label, text]) => field(label, text, w, lw));
  const linkLines = links.map(([label, href], i) => line(seg(`${(i ? "" : C.links).padEnd(lw)}  `, "dim"), seg(`${label} `), seg(href, "accent", href)));
  return [...head, ...body, ...linkLines, ...(next.length ? [blank, say(fill(C.next, { commands: next.join(" · ") }), "dim")] : [])];
}

// ── the commands ─────────────────────────────────────────────────────────────────────────────

const names = (): CommandName[] => Object.keys(COMMANDS) as CommandName[];
const slugs = (ctx: Context, ...kinds: SearchDoc["kind"][]) => [...new Set((kinds.length ? docs(ctx, ...kinds) : ctx.ix.docs).map((d) => d.slug))];
const places = (ctx: Context) => ctx.ix.sections.filter((s) => !NOT_PLACES.has(s.id));
const currentRole = (ctx: Context) => docs(ctx, "role").find((r) => r.end === "present");
const themeName = (ctx: Context, t: Theme) => S(ctx).themes[t];
const stateWord = (ctx: Context, on: boolean) => (on ? S(ctx).states.on : S(ctx).states.off);

export const COMMANDS: Record<CommandName, Command> = {
  help: {
    group: "machine",
    args: () => names(),
    run(ctx, [name]) {
      const L = S(ctx);
      if (name) {
        const c = resolveCommand(name);
        if (!c) return unknownCommand(ctx, name);
        const aliases = Object.entries(ALIASES).filter(([, to]) => to === c).map(([a]) => fill(L.help.alias, { alias: a, command: c }));
        return out(say(L.commands[c].usage, "bold"), ...wrap(L.commands[c].about, ctx.columns).map((l) => say(l)), ...aliases.map((a) => say(a, "dim")));
      }
      // the usage column fits the usual usage; a longer one takes its own line, its words under it
      const usageWidth = Math.max(...names().map((n) => L.commands[n].usage.length).filter((n) => n <= SHELL.helpUsageMax));
      const room = Math.max(12, ctx.columns - usageWidth - 4);
      const groups = Object.keys(L.help.groups) as Group[];
      const lines: Line[] = [say(L.help.title, "bold")];
      for (const g of groups) {
        lines.push(blank, say(L.help.groups[g].toUpperCase(), "dim"));
        for (const n of names().filter((x) => COMMANDS[x].group === g)) {
          const { usage: u, about } = L.commands[n];
          const long = u.length > usageWidth;
          if (long) lines.push(line(seg(`  ${u}`, "bold")));
          wrap(about, room).forEach((t, i) => lines.push(line(seg(`  ${(i || long ? "" : u).padEnd(usageWidth)}  `, "bold"), t)));
        }
      }
      const aliases = Object.entries(ALIASES).map(([a, c]) => fill(L.help.alias, { alias: a, command: c }));
      return out(...lines, blank, ...aliases.map((a) => say(a, "dim")), say(L.help.footer, "dim"));
    },
  },
  whoami: {
    group: "me",
    run: (ctx) => out(say(fill(S(ctx).whoami, { user: S(ctx).user, name: ctx.ix.profile.name, role: ctx.ix.profile.role }))),
  },
  about: {
    group: "me",
    run(ctx) {
      const p = ctx.ix.profile;
      const A = S(ctx).about;
      const cur = ctx.ix.labels.currently;
      const rows: [string, string][] = [
        [A.location, `${p.location} · ${p.timezone}`],
        [A.availability, `${ctx.ix.labels.availability[p.availability.status as keyof typeof ctx.ix.labels.availability] ?? p.availability.status} — ${p.availability.note}`],
        ...p.currentFocus.map((f): [string, string] => [cur[f.kind as keyof typeof cur] ?? f.kind, f.detail ? `${f.title} — ${f.detail}` : f.title]),
      ];
      const lw = labelWidth(rows.map((r) => r[0]));
      return out(say(`${p.name} — ${p.role}`, "bold"), ...wrap(p.bio, ctx.columns).map((l) => say(l)), blank, ...rows.flatMap(([l, t]) => field(l, t, ctx.columns, lw)));
    },
  },
  stack: {
    group: "me",
    run(ctx) {
      const L = S(ctx).stack;
      const skills = docs(ctx, "skill");
      const site = ctx.ix.build.stack.map((s) => (s.version ? `${s.name} ${s.version}` : s.name)).join(" · ");
      const rows: [string, string][] = [
        [L.primary, ctx.ix.metrics.primaryStack.join(" · ")],
        [L.skills, fill(L.skillsLine, { count: skills.length, categories: new Set(skills.map((s) => s.category)).size })],
        [L.site, site],
      ];
      const lw = labelWidth(rows.map((r) => r[0]));
      return out(...rows.flatMap(([l, t]) => field(l, t, ctx.columns, lw)));
    },
  },
  date: {
    group: "machine",
    run(ctx) {
      const L = S(ctx).date;
      const fmt = (timeZone: string, locale?: string) => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "long", timeZone }).format(ctx.now);
      // mine is named as my country writes it in English (the HUD's rule): IST, not GMT+5:30
      const mine = fmt(ctx.ix.profile.timezone, `en-${ctx.ix.profile.countryCode}`);
      return out(line(fmt(ctx.zone), seg(`  ${L.yours}`, "dim")), line(mine, seg(`  ${fill(L.mine, { name: ctx.ix.profile.name })}`, "dim")));
    },
  },
  uptime: {
    group: "machine",
    run(ctx) {
      const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short", timeZone: ctx.zone }).format(ctx.startedAt);
      return out(say(fill(S(ctx).uptime, { duration: span(ctx.uptimeMs, S(ctx).units), time })));
    },
  },
  clear: { group: "machine", run: () => ({ lines: [], effects: [{ kind: "clear" }] }) },
  history: {
    group: "machine",
    run(ctx) {
      if (!ctx.history.length) return out(say(S(ctx).history.empty, "dim"));
      const w = String(ctx.history.length).length;
      return out(...ctx.history.map((h, i) => line(seg(`${String(i + 1).padStart(w)}  `, "dim"), h)));
    },
  },
  ls: {
    group: "records",
    args: () => Object.keys(LS_KINDS),
    run(ctx, [kind]) {
      const L = S(ctx).ls;
      const C = L.columns;
      if (!kind) {
        const rows = (Object.keys(LS_KINDS) as LsKind[]).map((k) => {
          const n = docs(ctx, ...LS_KINDS[k]).length;
          return [`${k}/`, n ? String(n) : L.empty];
        });
        return out(say(L.kinds, "bold"), ...table(rows));
      }
      const typed = kind.toLowerCase().replace(/\/$/, "");
      const prefixed = Object.keys(LS_KINDS).filter((x) => x.startsWith(typed));
      const k = (typed in LS_KINDS ? typed : prefixed.length === 1 ? prefixed[0] : null) as LsKind | null;
      if (!k) return fail(say(fill(L.noSuchKind, { kind }), "hot"), ...youMean(ctx, kind, Object.keys(LS_KINDS)));
      switch (k) {
        case "projects":
          return out(...table(docs(ctx, "project").map((d) => [d.slug, none(ctx, d.year), d.title]), [C.slug, C.year, C.title]));
        case "papers":
          return out(...table(docs(ctx, "paper").map((d) => [d.slug, String(d.year), d.venueShort, ctx.ix.labels.status[d.status as keyof typeof ctx.ix.labels.status] ?? d.status]), [C.slug, C.year, C.venue, C.status]));
        case "skills":
          return out(...table(docs(ctx, "skill").map((d) => [d.slug, d.category, `L${d.level} · ${d.rubric}`, String(d.years)]), [C.slug, C.category, C.level, C.years]));
        case "experience":
          return out(...table([...docs(ctx, "role").map((d) => [d.slug, range(d.start, d.end), d.title]), ...docs(ctx, "education").map((d) => [d.slug, range(d.start, d.end), d.title])], [C.slug, C.dates, C.role]));
        case "certs": {
          const c = docs(ctx, "cert");
          if (!c.length) return out(say(L.noCerts, "dim"));
          return out(...table(c.map((d) => [d.slug, d.issueDate ?? ctx.ix.labels.card.notListed, stampOf(ctx, d), d.title]), [C.slug, C.date, C.status, C.title]));
        }
        case "awards": {
          const a = docs(ctx, "award");
          if (!a.length) return out(say(L.empty, "dim"));
          return out(...table(a.map((d) => [d.slug, d.date, d.title]), [C.slug, C.date, C.title]));
        }
      }
    },
  },
  cat: {
    group: "records",
    args: (ctx) => slugs(ctx),
    run(ctx, [name]) {
      if (!name) return usage(ctx, "cat");
      const f = find(ctx.ix.docs, name);
      return "doc" in f ? out(...record(ctx, f.doc)) : notFound(ctx, "cat", name, f);
    },
  },
  open: {
    group: "records",
    args: (ctx) => slugs(ctx),
    run(ctx, [name]) {
      if (!name) return usage(ctx, "open");
      const f = find(ctx.ix.docs, name);
      if (!("doc" in f)) return notFound(ctx, "open", name, f);
      return { lines: [say(fill(S(ctx).opening, { target: f.doc.title }), "dim")], effects: [{ kind: "navigate", href: f.doc.href }] };
    },
  },
  cite: {
    group: "records",
    args: (ctx) => slugs(ctx, "paper"),
    run(ctx, [name]) {
      const papers = docs(ctx, "paper");
      if (!papers.length) return out(say(S(ctx).cite.noPapers, "dim"));
      if (!name) return usage(ctx, "cite");
      const f = find(ctx.ix.docs, name);
      if (!("doc" in f)) return notFound(ctx, "cite", name, f);
      if (f.doc.kind !== "paper") return fail(say(fill(S(ctx).cite.notPaper, { name }), "hot"));
      return { lines: f.doc.bibtex.split("\n").map((l) => say(l)), effects: [{ kind: "copy", text: f.doc.bibtex }] };
    },
  },
  scholar: {
    group: "records",
    run(ctx) {
      const r = ctx.ix.metrics.research;
      const M = ctx.ix.labels.metrics;
      const L = S(ctx).scholar;
      const rows: [string, string][] = [
        [M.lead.publications, `${r.total} (${fill(L.counted, { counted: r.counted })})`],
        [M.lead.citations, String(r.citations)],
        [M.hIndex, String(r.hIndex)],
        [M.i10, String(r.i10)],
        [L.source, [r.provenance.sources.join(", "), r.provenance.method, r.provenance.asOf ? `${M.asOf} ${r.provenance.asOf}` : null].filter(Boolean).join(" · ")],
      ];
      const profiles = ctx.ix.profile.scholarProfiles;
      const lw = labelWidth([...rows.map((x) => x[0]), L.profiles]);
      const links: Line[] = profiles.length
        ? profiles.map((p, i) => line(seg(`${(i ? "" : L.profiles).padEnd(lw)}  `, "dim"), seg(`${M.platforms[p.platform as keyof typeof M.platforms] ?? p.platform} `), seg(p.url, "accent", p.url)))
        : field(L.profiles, L.noProfiles, ctx.columns, lw);
      return out(...rows.flatMap(([l, t]) => field(l, t, ctx.columns, lw)), ...links);
    },
  },
  verify: {
    group: "records",
    args: (ctx) => slugs(ctx, "cert"),
    run(ctx, [name]) {
      const certs = docs(ctx, "cert");
      // no certificates yet: said once, never "0" (DESIGN.md §10 #46)
      if (!certs.length) return out(say(S(ctx).ls.noCerts, "dim"));
      if (!name) return usage(ctx, "verify");
      const f = find(ctx.ix.docs, name);
      if (!("doc" in f)) return notFound(ctx, "verify", name, f);
      if (f.doc.kind !== "cert") return fail(say(fill(S(ctx).verify.notCert, { name }), "hot"));
      const c = f.doc;
      const K = ctx.ix.labels.card;
      const rows: [string, string][] = [
        [S(ctx).cat.issuer, c.issuer],
        [K.id, c.credentialId ?? K.notListed],
        [S(ctx).verify.check, stampOf(ctx, c)],
      ];
      const lw = labelWidth(rows.map((r) => r[0]));
      const lines = [say(c.title, "bold"), ...rows.flatMap(([l, t]) => field(l, t, ctx.columns, lw))];
      if (!c.verifyUrl) return out(...lines, say(S(ctx).verify.noUrl, "dim"));
      return { lines: [...lines, fillLine(S(ctx).opening, { target: seg(c.verifyUrl, "accent", c.verifyUrl) }, "dim")], effects: [{ kind: "url", href: c.verifyUrl }] };
    },
  },
  grep: {
    group: "records",
    run(ctx, args) {
      const L = S(ctx).grep;
      const term = args.join(" ").trim();
      if (!term) return usage(ctx, "grep");
      const hits = search(ctx.ix, term);
      if (!hits.length) return fail(say(fill(L.none, { term }), "dim"));
      const lines: Line[] = [say(fill(hits.length === 1 ? L.hit : L.hits, { count: hits.length, term }), "dim")];
      for (const { doc } of hits.slice(0, SHELL.grepHits)) {
        const code = sectionOf(ctx, doc)?.code ?? doc.section.toUpperCase();
        lines.push(line(seg(`[${code}] `, "accent"), seg(doc.title, "bold"), seg(`  ${doc.slug}`, "dim")));
        // where else it says so: the title is already printed above
        const where = [doc.text, doc.meta].find((t) => fold(t).includes(fold(term)));
        if (where) lines.push([seg("    "), ...snippet(where, term, Math.max(20, ctx.columns - 4))]);
      }
      return out(...lines);
    },
  },
  resume: {
    group: "me",
    run(ctx) {
      const url = ctx.ix.profile.resumeUrl;
      if (!url) return out(say(fill(S(ctx).resume.none, { email: ctx.ix.profile.email })));
      return { lines: [say(fill(S(ctx).opening, { target: S(ctx).commands.resume.about }), "dim")], effects: [{ kind: "url", href: url }] };
    },
  },
  contact: {
    group: "me",
    run: (ctx) => ({ lines: [say(S(ctx).contact, "dim")], effects: [{ kind: "contact", behind: false }] }),
  },
  email: {
    group: "me",
    run(ctx) {
      const e = ctx.ix.profile.email;
      return { lines: [[seg(e, "accent", `mailto:${e}`)]], effects: [{ kind: "copy", text: e }] };
    },
  },
  social: {
    group: "me",
    args: (ctx) => ctx.ix.profile.socials.map((s) => s.platform),
    run(ctx, [platform]) {
      const L = S(ctx).social;
      const all = ctx.ix.profile.socials;
      const nameOf = (p: string) => ctx.ix.labels.channels[p as keyof typeof ctx.ix.labels.channels] ?? p;
      if (!platform) {
        if (!all.length) return out(say(L.list, "bold"), say(S(ctx).none, "dim"));
        return out(say(L.list, "bold"), ...all.map((s) => line(seg(`${s.platform.padEnd(labelWidth(all.map((x) => x.platform)))}  `, "dim"), seg(s.url, "accent", s.url))));
      }
      const s = all.find((x) => x.platform === platform.toLowerCase());
      if (!s) return fail(say(fill(L.none, { platform }), "hot"), ...youMean(ctx, platform, all.map((x) => x.platform)));
      return { lines: [say(fill(S(ctx).opening, { target: nameOf(s.platform) }), "dim")], effects: [{ kind: "url", href: s.url }] };
    },
  },
  theme: {
    group: "machine",
    args: () => THEMES,
    run(ctx, [name]) {
      const L = S(ctx).theme;
      if (!name) return out(say(fill(L.now, { theme: themeName(ctx, ctx.theme) })), say(THEMES.map((t) => (t === ctx.theme ? `[${t}]` : t)).join("  "), "dim"));
      const t = THEMES.find((x) => x === name.toLowerCase());
      if (!t) return fail(...usage(ctx, "theme").lines, ...youMean(ctx, name, THEMES));
      return { lines: [say(fill(L.set, { theme: themeName(ctx, t) }), "dim")], effects: [{ kind: "theme", theme: t }] };
    },
  },
  sound: {
    group: "machine",
    args: () => SOUND,
    run(ctx, [state]) {
      if (!state) return out(say(fill(S(ctx).sound, { state: stateWord(ctx, ctx.sound) })));
      const on = state.toLowerCase() === "on" ? true : state.toLowerCase() === "off" ? false : null;
      if (on === null) return fail(...usage(ctx, "sound").lines, ...youMean(ctx, state, SOUND));
      return { lines: [say(fill(S(ctx).sound, { state: stateWord(ctx, on) }))], effects: [{ kind: "sound", on }] };
    },
  },
  grid: {
    group: "machine",
    run: (ctx) => ({ lines: [say(fill(S(ctx).grid, { state: stateWord(ctx, !ctx.grid) }))], effects: [{ kind: "grid" }] }),
  },
  gfx: {
    group: "machine",
    args: () => GFX,
    run(ctx, [state]) {
      const word = (g: (typeof GFX)[number]) => S(ctx).states[g];
      if (!state) return out(say(fill(S(ctx).gfx, { state: word(ctx.gfx) })));
      const g = GFX.find((x) => x === state.toLowerCase());
      if (!g) return fail(...usage(ctx, "gfx").lines, ...youMean(ctx, state, GFX));
      return { lines: [say(fill(S(ctx).gfx, { state: word(g) }))], effects: [{ kind: "gfx", gfx: g }] };
    },
  },
  goto: {
    group: "machine",
    args: (ctx) => places(ctx).map((s) => s.id),
    run(ctx, [name]) {
      const L = S(ctx).goto;
      const ps = places(ctx);
      if (!name) return out(say(L.list, "bold"), ...table(ps.map((s) => [String(s.index).padStart(2, "0"), s.id, s.title])));
      const n = name.toLowerCase();
      const s = ps.find((x) => x.id === n || x.code.toLowerCase() === n || String(x.index) === n.replace(/^0+(?=\d)/, ""));
      if (!s) return fail(say(fill(L.none, { name }), "hot"), ...youMean(ctx, name, ps.map((x) => x.id)));
      return { lines: [say(fill(S(ctx).opening, { target: `${String(s.index).padStart(2, "0")} ${s.code}` }), "dim")], effects: [{ kind: "navigate", href: routes.section(s.id) }] };
    },
  },
  sudo: {
    group: "toys",
    args: () => ["hire-me"],
    run(ctx, args) {
      const L = S(ctx).sudo;
      if (!args.length) return usage(ctx, "sudo");
      const password = say(fill(L.password, { user: S(ctx).user }), "dim");
      if (args.join(" ").toLowerCase() !== "hire-me") return fail(password, say(fill(L.denied, { user: S(ctx).user }), "hot"));
      const p = ctx.ix.profile;
      const now = currentRole(ctx);
      const vars = {
        name: p.name,
        role: p.role,
        now: now ? now.title : S(ctx).none,
        projects: ctx.ix.metrics.projects,
        papers: ctx.ix.metrics.research.counted,
        availability: `${ctx.ix.labels.availability[p.availability.status as keyof typeof ctx.ix.labels.availability] ?? p.availability.status} — ${p.availability.note}`,
      };
      return { lines: [password, ...L.pitch.map((l) => (l ? say(fill(l, vars)) : blank))], effects: [{ kind: "contact", behind: true }] };
    },
  },
  neofetch: {
    group: "toys",
    run(ctx) {
      const N = S(ctx).neofetch;
      const ix = ctx.ix;
      const r = ix.metrics.research;
      const papers = docs(ctx, "paper");
      const venues = [...new Set(papers.map((p) => p.venueShort))].join(", ");
      const certs = ix.metrics.credentials.total;
      const rows: [string, string][] = [
        [N.os, [ix.labels.os, ix.build.version].filter(Boolean).join(" ")],
        [N.host, ix.profile.name],
        [N.role, ix.profile.role],
        [N.stack, ix.metrics.primaryStack.join(" · ")],
        [N.papers, papers.length ? fill(N.papersLine, { count: r.counted, venues }) : S(ctx).none],
        [N.citations, fill(N.citationsLine, { count: r.citations, source: r.provenance.sources.join(", "), asOf: none(ctx, r.provenance.asOf) })],
        [N.certs, certs ? String(certs) : N.noCerts],
        [N.uptime, span(ctx.uptimeMs, S(ctx).units)],
        [N.theme, themeName(ctx, ctx.theme)],
      ];
      const art = ix.portrait;
      const artWidth = Math.max(0, ...art.map((a) => a.length));
      const sideBySide = art.length > 0 && ctx.columns >= artWidth + 2 + 40;
      const room = sideBySide ? ctx.columns - artWidth - 2 : ctx.columns;
      const lw = labelWidth(rows.map((x) => x[0]));
      const title = `${S(ctx).user}@${S(ctx).host}`;
      const spec: Line[] = [say(title, "accent"), say("-".repeat(title.length), "dim"), ...rows.flatMap(([l, t]) => field(l, t, room, lw)), blank, [seg("███", "accent"), seg(" "), seg("███", "hot"), seg(" "), seg("███", "warn"), seg(" "), seg("███", "bold"), seg(" "), seg("███", "dim")]];
      if (!sideBySide) return out(...art.map((a): Line => [{ t: a, k: "accent", nowrap: true }]), ...(art.length ? [blank] : []), ...spec);
      const height = Math.max(art.length, spec.length);
      return out(...Array.from({ length: height }, (_, i): Line => [{ t: (art[i] ?? "").padEnd(artWidth + 2), k: "accent", nowrap: true }, ...(spec[i] ?? [])]));
    },
  },
  rain: {
    group: "toys",
    run: (ctx) => ({ lines: [say(S(ctx).rain.start, "dim")], effects: [{ kind: "rain" }] }),
  },
  man: {
    group: "machine",
    args: () => ["retrograde", ...names()],
    run(ctx, [page]) {
      const M = S(ctx).man;
      if (!page) return fail(say(M.which, "dim"));
      const w = ctx.columns;
      const header = (left: string, mid: string) => {
        const gap = Math.max(1, Math.floor((w - left.length * 2 - mid.length) / 2));
        return say(`${left}${" ".repeat(gap)}${mid}${" ".repeat(gap)}${left}`.slice(0, Math.max(w, left.length)), "dim");
      };
      const body = (text: string) => wrap(text, Math.max(20, w - 4)).map((l) => say(`    ${l}`));
      if (page.toLowerCase() === "retrograde") {
        const R = M.retrograde;
        return out(header(R.title, R.section), blank, ...R.blocks.flatMap((b) => [say(b.heading, "bold"), ...body(b.body), blank]), header([ctx.ix.labels.os, ctx.ix.build.version].filter(Boolean).join(" "), ctx.ix.builtOn));
      }
      const c = resolveCommand(page);
      if (!c) return fail(say(fill(M.missing, { page }), "hot"), ...youMean(ctx, page, ["retrograde", ...names()]));
      const L = S(ctx).commands[c];
      const title = `${c.toUpperCase()}(1)`;
      return out(header(title, S(ctx).label), blank, say("NAME", "bold"), ...body(`${c} — ${L.about}`), blank, say("SYNOPSIS", "bold"), ...body(L.usage));
    },
  },
  decode: {
    group: "records",
    args: (ctx) => ctx.ix.cards.map((c) => c.slug),
    run(ctx, [name]) {
      const D = S(ctx).decode;
      const cards = ctx.ix.cards;
      if (!name) return out(say(D.list, "bold"), ...table(cards.map((c) => [c.slug, c.title])));
      const n = name.toLowerCase();
      const card = cards.find((c) => c.slug === n) ?? (cards.filter((c) => c.slug.startsWith(n)).length === 1 ? cards.find((c) => c.slug.startsWith(n)) : undefined);
      if (!card) return fail(say(fill(D.unknown, { name }), "hot"), ...youMean(ctx, name, cards.map((c) => c.slug)));
      const cols = unpackColumns(card.holes);
      const holes = cols.reduce((sum, m) => sum + (m.toString(2).match(/1/g)?.length ?? 0), 0);
      const used = cols.filter((m) => m !== 0).length;
      const edge = "─".repeat(CARD.columns);
      const art: Line[] = [
        [{ t: `    ┌${edge}┐`, k: "dim", nowrap: true }],
        ...PUNCH_ROWS.map((row, r): Line => [
          { t: `${String(row).padStart(2)}  │`, k: "dim", nowrap: true },
          // a hole is narrower than its column (0.055 in of 0.087): a half block, so neighbours stay apart
          ...cols.map((m): Line[number] => ((m >> r) & 1 ? { t: "▌", k: "accent", nowrap: true } : { t: "·", k: "dim", nowrap: true })),
          { t: "│", k: "dim", nowrap: true },
        ]),
        [{ t: `    └${edge}┘`, k: "dim", nowrap: true }],
      ];
      return out(say(fill(D.header, { title: card.title, holes, columns: used }), "bold"), ...art, line(seg(fill(D.reads, { text: "" })), seg(decode(cols), "accent")));
    },
  },
  debug: {
    group: "machine",
    run: (ctx) => ({ lines: [say(fill(S(ctx).debug, { state: stateWord(ctx, !ctx.debug) }))], effects: [{ kind: "debug" }] }),
  },
};

// ── grep: ranked hits across everything ─────────────────────────────────────────────────────

/** Every doc that has the term (or, failing that, all its words), best first: title over meta over text, whole words over parts. */
export function search(ix: SearchIndex, term: string): { doc: SearchDoc; score: number }[] {
  const q = fold(term.trim());
  const words = q.split(/\s+/).filter(Boolean);
  const weigh = (hay: string, needle: string, weight: number) => {
    const h = fold(hay);
    let at = h.indexOf(needle);
    let score = 0;
    while (at >= 0) {
      const whole = (at === 0 || !/[\p{L}\p{N}]/u.test(h[at - 1] ?? "")) && !/[\p{L}\p{N}]/u.test(h[at + needle.length] ?? "");
      score += weight * (whole ? 2 : 1);
      at = h.indexOf(needle, at + needle.length);
    }
    return score;
  };
  const scoreOf = (d: SearchDoc, needle: string) => weigh(d.title, needle, 8) + weigh(d.slug, needle, 4) + weigh(d.meta, needle, 3) + weigh(d.text, needle, 1);
  return ix.docs
    .map((doc) => {
      const phrase = scoreOf(doc, q);
      if (phrase) return { doc, score: phrase * 2 };
      if (words.length < 2) return { doc, score: 0 };
      const each = words.map((w) => scoreOf(doc, w));
      return { doc, score: each.every((x) => x > 0) ? each.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
}

// ── the line: run it, complete it ────────────────────────────────────────────────────────────

export function resolveCommand(word: string): CommandName | null {
  const w = word.toLowerCase();
  if (w in COMMANDS) return w as CommandName;
  return ALIASES[w] ?? null;
}

function unknownCommand(ctx: Context, word: string): Result {
  return fail(say(fill(S(ctx).notFound, { command: word }), "hot"), ...youMean(ctx, word, [...names(), ...Object.keys(ALIASES)]));
}

/** One typed line → what it prints and does. */
export function execute(input: string, ctx: Context): Result {
  const [head, ...args] = tokenize(input);
  if (!head) return { lines: [] };
  const name = resolveCommand(head);
  return name ? COMMANDS[name].run(ctx, args) : unknownCommand(ctx, head);
}

/**
 * Tab: complete the last word — a command, or its first argument. One match completes (and adds a
 * space); several extend to their common prefix, or, when that adds nothing, are listed.
 */
export function complete(input: string, ctx: Context): { input: string; options: string[] } {
  const words = input.trimStart().split(/\s+/);
  const current = words.pop() ?? "";
  const before = input.slice(0, input.length - current.length);
  const position = words.filter(Boolean).length;
  let pool: readonly string[] = [];
  if (position === 0) pool = [...names(), ...Object.keys(ALIASES)];
  else if (position === 1) {
    const c = resolveCommand(words[0] ?? "");
    pool = c ? (COMMANDS[c].args?.(ctx) ?? []) : [];
  }
  const cur = current.toLowerCase();
  const matches = [...new Set(pool.filter((p) => p.toLowerCase().startsWith(cur)))].sort();
  if (!matches.length) return { input, options: [] };
  if (matches.length === 1) return { input: `${before}${matches[0]} `, options: [] };
  const prefix = commonPrefix(matches);
  return prefix.length > current.length ? { input: `${before}${prefix}`, options: [] } : { input, options: matches };
}

export const ALL_EFFECTS: readonly Effect["kind"][] = ["clear", "copy", "url", "navigate", "contact", "theme", "sound", "grid", "gfx", "debug", "rain"];
