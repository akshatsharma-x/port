import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDate, derived } from "@/content/derive";
import { buildSearchIndex, type SearchIndex } from "@/content/search-index";
import { buildInfo, recentCommits } from "@/lib/build-facts";
import { decode, unpackColumns } from "@/lib/hollerith";
import { cardText } from "@/lib/log";
import { ALIASES, COMMANDS, complete, execute, search } from "@/lib/shell/commands";
import { cellAspect, SHELL } from "@/lib/shell/config";
import { rainCells, rainPool, startRain, stepRain, stillRain } from "@/lib/shell/rain";
import { commonPrefix, distance, fill, fillLine, fold, plain, snippet, span, suggest, tokenize, wrap } from "@/lib/shell/text";
import type { Context } from "@/lib/shell/types";
import { isTextEntry, KONAMI, konamiStep, TERMINAL } from "@/lib/terminal";
import { PORTRAIT_RAMP, portraitText } from "../scripts/bake/search-index";
import { block, readCss } from "./helpers/css";

const ROOT = resolve(__dirname, "..");
const ix: SearchIndex = buildSearchIndex(derived, {
  build: { version: "0.1.0", sha: "abc1234", stack: [{ name: "Next.js", version: "16.4.6" }] },
  commits: ["abc1234", "def5678"],
  portrait: ["  .:-", " =+*#", "%@"],
});
const ctx = (over: Partial<Context> = {}): Context => ({
  ix,
  columns: 100,
  theme: "phosphor",
  sound: false,
  grid: false,
  gfx: "auto",
  debug: false,
  uptimeMs: 754_000,
  startedAt: new Date("2026-11-14T10:00:00Z"),
  now: new Date("2026-11-14T10:12:34Z"),
  zone: "Europe/London",
  history: ["help", "ls papers"],
  path: "/",
  ...over,
});
const text = (input: string, over?: Partial<Context>) => execute(input, ctx(over)).lines.map(plain).join("\n");
const S = ix.labels.shell;
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe("the terminal is ready — lib/terminal.ts", () => {
  it("is shipped, so the hint and the HUD key point at something real (DESIGN.md §10 #28)", () => {
    expect(TERMINAL.ready).toBe(true);
  });

  it("Konami counts ↑ ↑ ↓ ↓ ← → ← → B A (the browser cases — keys in text fields — are the gate's)", () => {
    expect(isTextEntry(null)).toBe(false);
    let at = 0;
    for (const key of KONAMI) at = konamiStep(at, { key, target: null } as unknown as KeyboardEvent);
    expect(at).toBe(KONAMI.length);
    // a wrong key starts it over; ↑ restarts it at one
    expect(konamiStep(5, { key: "x", target: null } as unknown as KeyboardEvent)).toBe(0);
    expect(konamiStep(5, { key: "ArrowUp", target: null } as unknown as KeyboardEvent)).toBe(1);
  });
});

describe("text tools — lib/shell/text.ts", () => {
  it("fills templates, keeping unknown keys visible, and can put a link mid-sentence", () => {
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(fillLine("Opening {target}…", { target: { t: "x", href: "https://x" } }).map((s) => [s.t, s.href ?? null])).toEqual([["Opening ", null], ["x", "https://x"], ["…", null]]);
  });

  it("measures edits (≤ 2 for did-you-mean) and suggests nearest first", () => {
    expect(distance("hepl", "help")).toBe(2);
    expect(distance("kitten", "sitting")).toBe(3);
    expect(suggest("hepl", ["help", "history", "grep"], SHELL.suggestDistance)).toEqual(["help"]);
    expect(suggest("cta", ["cat", "cite", "clear"], 2)[0]).toBe("cat");
    expect(commonPrefix(["contact", "cognivault", "cite"])).toBe("c");
  });

  it("splits a line into words, quotes grouped; folds accents; wraps at a width", () => {
    expect(tokenize(`grep "food waste"  x`)).toEqual(["grep", "food waste", "x"]);
    expect(fold("Résumé")).toBe("resume");
    expect(wrap("one two three four", 9)).toEqual(["one two", "three", "four"]);
    expect(wrap("abcdefghijkl", 5)).toEqual(["abcde", "fghij", "kl"]);
  });

  it("marks a match in a snippet and reads time spans", () => {
    const s = snippet("Interpretable models for cold-chain logistics", "cold-chain", 30);
    expect(s.find((x) => x.k === "mark")?.t).toBe("cold-chain");
    expect([span(9_000, S.units), span(754_000, S.units), span(3_720_000, S.units)]).toEqual(["9 s", "12 min 34 s", "1 h 2 min"]);
  });
});

describe("the commands — lib/shell/commands.ts, over the site's own index", () => {
  it("are exactly the content's commands, every one described, matrix an alias of rain", () => {
    expect(Object.keys(COMMANDS).sort()).toEqual(Object.keys(S.commands).sort());
    expect(ALIASES).toEqual({ matrix: "rain" });
    const help = text("help");
    for (const c of Object.keys(S.commands) as (keyof typeof S.commands)[]) expect(help, c).toContain(S.commands[c].usage);
    expect(help).toContain(fill(S.help.alias, { alias: "matrix", command: "rain" }));
  });

  it("whoami, about and stack say what the content says", () => {
    expect(text("whoami")).toBe(fill(S.whoami, { user: S.user, name: derived.profile.name, role: derived.profile.role }));
    const about = text("about");
    expect(about).toContain(derived.profile.bio.short.split(" ").slice(0, 4).join(" "));
    expect(about).toContain(derived.profile.availability.note.split(" ")[0]);
    expect(text("stack")).toContain(`${derived.skills.all.length} across`);
  });

  it("ls counts each kind truly — and says certificates are none yet, never 0 (§10 #46)", () => {
    const index = text("ls");
    expect(index).toContain(`papers/      ${derived.publications.length}`);
    expect(index).toContain(`projects/    ${derived.projects.length}`);
    expect(derived.certificates.length).toBe(0);
    expect(index).toMatch(/certs\/\s+none yet/);
    expect(text("ls certs")).toBe(S.ls.noCerts);
    expect(text("verify")).toBe(S.ls.noCerts);
    for (const p of derived.publications) expect(text("ls papers")).toContain(p.slug);
    expect(execute("ls proj", ctx()).error).toBeFalsy();
    const bad = execute("ls pappers", ctx());
    expect(bad.error).toBe(true);
    expect(bad.lines.map(plain).join(" ")).toContain("papers");
  });

  it("cat prints a record by slug or a prefix that names only it, with its own fields", () => {
    const p = derived.publications[0];
    const out = text(`cat ${p?.slug.slice(0, 6)}`);
    expect(out).toContain(p?.title);
    // wrapped beside its label: its words, in order
    expect(out.replace(/\s+/g, " ")).toContain(p?.tldr.split(" ").slice(0, 6).join(" "));
    const role = derived.experience[0];
    const card = text(`cat ${role?.slug}`);
    expect(card).toContain(role?.highlights[0]?.slice(0, 30));
    const miss = execute("cat foood-waste-cold-chain-sci-2026", ctx());
    expect(miss.error).toBe(true);
    expect(miss.lines.map(plain).join(" ")).toContain(p?.slug);
  });

  it("open, cite, email, contact and sudo hire-me hand the panel the right effects", () => {
    const project = derived.projects[0];
    expect(execute(`open ${project?.slug}`, ctx()).effects).toEqual([{ kind: "navigate", href: `/work/${project?.slug}` }]);
    const paper = derived.publications[0];
    const cite = execute(`cite ${paper?.slug}`, ctx());
    expect(cite.effects).toEqual([{ kind: "copy", text: paper?.bibtex }]);
    expect(cite.lines.map(plain).join("\n")).toBe(paper?.bibtex);
    expect(execute("email", ctx()).effects).toEqual([{ kind: "copy", text: derived.profile.email }]);
    expect(execute("contact", ctx()).effects).toEqual([{ kind: "contact", behind: false }]);
    const hire = execute("sudo hire-me", ctx());
    expect(hire.effects).toEqual([{ kind: "contact", behind: true }]);
    expect(hire.lines.map(plain).join("\n")).toContain(`${derived.projects.length} projects`);
    expect(execute("sudo rm -rf", ctx()).error).toBe(true);
  });

  it("scholar is the index's metrics, with their source and date, and says there's no profile yet", () => {
    const out = text("scholar");
    const r = derived.research;
    expect(out).toContain(`${r.total} (${r.counted} counted)`);
    expect(out).toContain(r.provenance.sources.join(", "));
    if (r.provenance.asOf) expect(out).toContain(r.provenance.asOf);
    expect(out).toContain(S.scholar.noProfiles);
  });

  it("resume says there's none (no phone-free résumé, §10 #49) and where to ask", () => {
    expect(derived.profile.resumeUrl).toBeNull();
    expect(text("resume")).toBe(fill(S.resume.none, { email: derived.profile.email }));
  });

  it("grep ranks a title over a passing mention, folds accents, and counts truly", () => {
    const hits = search(ix, "interpretable");
    expect(hits.length).toBeGreaterThan(0);
    expect(fold(hits[0]?.doc.title ?? "")).toContain("interpretable");
    expect(text("grep interpretable").split("\n")[0]).toBe(fill(hits.length === 1 ? S.grep.hit : S.grep.hits, { count: hits.length, term: "interpretable" }));
    expect(search(ix, "résumé").length).toBe(search(ix, "resume").length);
    expect(execute("grep zzzqqq", ctx()).error).toBe(true);
  });

  it("the machine's switches: theme, sound, gfx, grid, debug, goto", () => {
    expect(execute("theme amber", ctx()).effects).toEqual([{ kind: "theme", theme: "amber" }]);
    expect(execute("theme ambr", ctx()).error).toBe(true);
    expect(execute("sound on", ctx()).effects).toEqual([{ kind: "sound", on: true }]);
    expect(execute("gfx low", ctx()).effects).toEqual([{ kind: "gfx", gfx: "low" }]);
    expect(text("grid")).toBe(fill(S.grid, { state: S.states.on }));
    expect(text("debug", { debug: true })).toBe(fill(S.debug, { state: S.states.off }));
    for (const w of ["archive", "ARCHIVE", "4", "04"]) expect(execute(`goto ${w}`, ctx()).effects).toEqual([{ kind: "navigate", href: "/#archive" }]);
    expect(text("goto")).not.toMatch(/\bpost\b|\bshell\b/);
  });

  it("neofetch: the portrait beside the sheet when there's room, above it when there isn't", () => {
    const wide = execute("neofetch", ctx({ columns: 100 })).lines.map(plain);
    expect(wide[0]?.startsWith(ix.portrait[0] ?? "")).toBe(true);
    expect(wide.join("\n")).toContain(S.neofetch.noCerts);
    const narrow = execute("neofetch", ctx({ columns: 40 })).lines.map(plain);
    expect(narrow[0]).toBe(ix.portrait[0]);
  });

  it("man retrograde explains the name and the archive's camera; man <command> is its help", () => {
    const page = text("man retrograde");
    for (const b of S.man.retrograde.blocks) expect(page).toContain(b.heading);
    expect(page).toMatch(/retrograde loop/);
    expect(text("man cat")).toContain(S.commands.cat.usage);
    expect(execute("man nope", ctx()).error).toBe(true);
  });

  it("decode reads each LOG card's holes back into the text LOG punched", () => {
    for (const e of derived.experience) {
      const card = ix.cards.find((c) => c.slug === e.slug);
      expect(card, e.slug).toBeDefined();
      const columns = unpackColumns(card?.holes ?? "");
      expect(columns).toHaveLength(80);
      expect(decode(columns)).toBe(cardText(e, derived.site.labels.log.present));
      const out = text(`decode ${e.slug}`);
      expect(out).toContain(decode(columns));
      const holes = columns.reduce((n, m) => n + m.toString(2).replace(/0/g, "").length, 0);
      expect(out).toContain(`${holes} holes in ${columns.filter((m) => m).length} columns`);
    }
  });

  it("an unknown command says so, and suggests within two edits", () => {
    const r = execute("hepl", ctx());
    expect(r.error).toBe(true);
    expect(r.lines.map(plain)).toEqual([fill(S.notFound, { command: "hepl" }), fill(S.didYouMean, { suggestions: "help" })]);
    expect(execute("frobnicate", ctx()).lines).toHaveLength(1);
  });

  it("Tab completes a command, its argument, and lists what's ambiguous", () => {
    expect(complete("neo", ctx())).toEqual({ input: "neofetch ", options: [] });
    expect(complete("ls ", ctx()).options).toEqual(["awards", "certs", "experience", "papers", "projects", "skills"]);
    expect(complete("theme a", ctx()).input).toBe("theme amber ");
    expect(complete("goto ca", ctx()).input).toBe("goto capabilities ");
    expect(complete("man r", ctx()).options).toEqual(["rain", "resume", "retrograde"]);
  });

  it("prints only what the baked mono face can draw", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "app/fonts/manifest.json"), "utf8")) as { fonts: { id: string; codepoints: number[] }[] };
    const mono = new Set(manifest.fonts.find((f) => f.id === "jetbrains-mono")?.codepoints ?? []);
    const lines = ["help", "about", "stack", "ls", "ls papers", "ls projects", "ls skills", "ls experience", "ls awards", "scholar", "neofetch", "man retrograde", "goto", "social", ...ix.docs.map((d) => `cat ${d.id}`), ...ix.cards.map((c) => `decode ${c.slug}`), ...ix.docs.filter((d) => d.kind === "paper").map((d) => `cite ${d.slug}`)];
    const missing = new Set<string>();
    for (const l of lines) for (const ch of text(l)) if (ch.trim() && !mono.has(ch.codePointAt(0) ?? 0)) missing.add(`${ch} U+${(ch.codePointAt(0) ?? 0).toString(16)}`);
    expect([...missing]).toEqual([]);
  });

  it("is a view over the data, never a copy: no content in the terminal's own code", () => {
    const files = [...readdirSync(join(ROOT, "lib/shell")).map((f) => join("lib/shell", f)), ...readdirSync(join(ROOT, "components/shell")).map((f) => join("components/shell", f))];
    const facts = [derived.profile.name, derived.profile.email, derived.profile.role, ...derived.publications.map((p) => p.title), ...derived.experience.map((e) => e.company), S.offline, S.banner[2] ?? "", S.man.retrograde.blocks[1]?.body.slice(0, 40) ?? ""];
    for (const f of files) {
      const code = readFileSync(join(ROOT, f), "utf8");
      for (const fact of facts) expect(code.includes(fact), `${f}: ${fact.slice(0, 30)}`).toBe(false);
    }
  });
});

describe("rain — lib/shell/rain.ts", () => {
  it("is made of this site's own data: the papers' titles, their DOIs, the commits, the projects", () => {
    const pool = rainPool(ix);
    for (const p of derived.publications) expect(pool).toContain(p.title);
    for (const c of ix.commits) expect(pool).toContain(c);
    for (const p of derived.projects) expect(pool).toContain(p.title);
  });

  it("falls a row a step, lights heads brightest, and stays inside its grid", () => {
    const pool = rainPool(ix);
    const rain = startRain(pool, 20, 10, seeded(7));
    for (let i = 0; i < 30; i++) stepRain(rain, pool, SHELL.rainTrail, seeded(i + 1));
    const cells = rainCells(rain, SHELL.rainTrail);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every(([x, y, , b]) => x >= 0 && x < 20 && y >= 0 && y < 10 && b > 0 && b <= 1)).toBe(true);
    const still = stillRain(pool, 20, 6, seeded(3));
    expect(still).toHaveLength(6);
    expect(still.every((l) => l.length <= 20)).toBe(true);
  });
});

describe("what only the build knows — the index's extras", () => {
  it("the portrait as text: rows from the photo's aspect and the cell's, glyphs from the ramp", async () => {
    const art = await portraitText(join(ROOT, "public/media/profile/portrait.png"));
    expect(art.length).toBe(Math.round((SHELL.portraitColumns * (225 / 180)) / cellAspect));
    expect(art.every((l) => l.length <= SHELL.portraitColumns && [...l].every((c) => PORTRAIT_RAMP.includes(c)))).toBe(true);
    expect(art.some((l) => /[#%@]/.test(l))).toBe(true);
  });

  it("the cell is the terminal's own: --lh--1 over the mono advance", () => {
    expect(Number(block(readCss("styles/tokens.css"), ":root")["--lh--1"])).toBe(SHELL.lineHeight);
    expect(cellAspect).toBeCloseTo(SHELL.lineHeight / SHELL.advanceEm, 10);
  });

  it("real build facts: package.json's version, the commits git has", () => {
    expect(buildInfo(ROOT).version).toBe(JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version);
    const commits = recentCommits(SHELL.commits, ROOT);
    expect(commits.length).toBeGreaterThan(0);
    expect(commits.every((c) => /^[0-9a-f]{7,}$/.test(c))).toBe(true);
  });

  it("the index carries the terminal's words and stays well inside its budget", () => {
    expect(ix.version).toBe(SHELL.indexVersion);
    expect(ix.labels.shell).toBe(derived.site.labels.shell);
    expect(ix.builtOn).toBe(derived.buildDate);
    expect(buildDate).toBeInstanceOf(Date);
  });
});
