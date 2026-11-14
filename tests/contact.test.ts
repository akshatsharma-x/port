import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { derived } from "@/content/derive";
import { CONTACT, ContactSchema, duration, handleContact, mailtoFor, offsetMinutes, overlap, trapped, type ContactDeps, type ContactInput, type ErrorCode, type Mail } from "@/lib/contact";
import { PUBLICATION_LIST } from "@/lib/publication-list";
import { citation, PUBLICATION_LIST_JSON, publicationListHash, publicationListHtml } from "../scripts/bake/publication-list";

const ROOT = resolve(__dirname, "..");
const T0 = Date.UTC(2026, 10, 14, 11, 0);
const good: ContactInput = { name: "Ada Lovelace", email: "Ada@Example.com", intent: "collaborate", message: "Interpretable models for logistics?" };
const post = (over: Record<string, unknown> = {}) => ({ ...good, website: "", startedAt: T0 - CONTACT.minFillMs, ...over });

/** Upstash's sliding window, in memory: `sends` per `windowMs` per key; a refused call isn't counted. */
function slidingWindow(sends: number, windowMs: number, clock: () => number) {
  const hits = new Map<string, number[]>();
  return vi.fn(async (key: string) => {
    const now = clock();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const ok = recent.length < sends;
    if (ok) recent.push(now);
    hits.set(key, recent);
    return { ok };
  });
}

function world(over: Partial<ContactDeps> = {}) {
  let now = T0;
  const sent: Mail[] = [];
  const limit = slidingWindow(CONTACT.rate.sends, 10 * 60_000, () => now);
  const send = vi.fn(async (mail: Mail) => {
    sent.push(mail);
    return { id: `re_${sent.length}` };
  });
  const deps: ContactDeps = { now: () => now, limit, send, to: "owner@example.com", subject: (i) => `A signal · ${i.intent} · ${i.name}`, ...over };
  return { deps, sent, limit, send, advance: (ms: number) => (now += ms) };
}

describe("the form's rules — lib/contact.ts", () => {
  it("are the prompt's numbers: 2.5 s to fill in, 3 sends per 10 minutes, five intents", () => {
    expect(CONTACT.minFillMs).toBe(2500);
    expect(CONTACT.rate).toEqual({ sends: 3, window: "10 m" });
    expect(CONTACT.intents).toEqual(["hire", "collaborate", "research", "speak", "other"]);
  });

  it("say what's wrong as codes, one per field", () => {
    const codes = (input: Record<string, unknown>) => {
      const r = ContactSchema.safeParse(input);
      return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]).reverse());
    };
    expect(codes({ name: "", email: "", intent: "", message: "" })).toEqual({ name: "required", email: "required", intent: "required", message: "required" });
    expect(codes({ ...good, email: "ada@" })).toEqual({ email: "email" });
    expect(codes({ ...good, message: "Hi there" })).toEqual({ message: "short" });
    expect(codes({ ...good, message: "x".repeat(CONTACT.limits.message + 1) })).toEqual({ message: "long" });
    expect(codes({ ...good, name: "x".repeat(CONTACT.limits.name + 1) })).toEqual({ name: "long" });
    expect(codes({ ...good, intent: "sell" })).toEqual({ intent: "required" });
    // whitespace isn't words
    expect(codes({ ...good, name: "   ", message: `   ${"x".repeat(CONTACT.limits.minMessage - 1)}   ` })).toEqual({ name: "required", message: "short" });
    expect(ContactSchema.parse({ ...good, name: "  Ada  " }).name).toBe("Ada");
  });

  it("are said in the content's words: a label for every code and every intent", () => {
    const L = derived.site.labels.connect;
    const all: ErrorCode[] = ["required", "email", "short", "long", "fast", "rate", "unavailable", "failed"];
    for (const code of all) expect(L.errors[code], code).toMatch(/\S/);
    for (const intent of CONTACT.intents) expect(L.intents[intent], intent).toMatch(/\S/);
  });
});

describe("POST /api/contact's paths — handleContact with fakes", () => {
  it("sends a person's message: both rate keys, the reply-to, the words, the id", async () => {
    const w = world();
    const r = await handleContact(post(), "203.0.113.7", w.deps);
    expect(r).toEqual({ status: 202, id: "re_1" });
    expect(w.limit.mock.calls.map((c) => c[0])).toEqual(["203.0.113.7", "mail:ada@example.com"]);
    expect(w.sent).toEqual([{ to: "owner@example.com", replyTo: "Ada@Example.com", subject: "A signal · collaborate · Ada Lovelace", text: `${good.message}\n\n— Ada Lovelace <Ada@Example.com>` }]);
  });

  it("names the fields a person got wrong (400) and never a hidden one", async () => {
    const w = world();
    expect(await handleContact(post({ email: "nope", message: "" }), "ip", w.deps)).toEqual({ status: 400, fields: { email: "email", message: "required" } });
    // the timestamp is the page's, not the person's: wrong, it's a 400 that names nothing
    expect(await handleContact(post({ startedAt: "soon" }), "ip", w.deps)).toEqual({ status: 400, fields: {} });
    expect(await handleContact(null, "ip", w.deps)).toMatchObject({ status: 400 });
    expect(w.limit).not.toHaveBeenCalled();
    expect(w.send).not.toHaveBeenCalled();
  });

  it("answers a filled honeypot with a quiet 202 and sends nothing — whatever else was posted", async () => {
    const w = world();
    for (const website of ["https://spam.example", "x".repeat(20_000), { a: 1 }, 42]) expect(await handleContact(post({ website, email: "bad" }), "ip", w.deps)).toEqual({ status: 202, id: null });
    expect(w.limit).not.toHaveBeenCalled();
    expect(w.send).not.toHaveBeenCalled();
    expect(trapped({ website: "   " })).toBe(false);
    expect(trapped({ website: null })).toBe(false);
    expect(trapped("website")).toBe(false);
  });

  it("refuses a form filled faster than a person types (422), and takes one at exactly 2.5 s", async () => {
    const w = world();
    expect(await handleContact(post({ startedAt: T0 - CONTACT.minFillMs + 1 }), "ip", w.deps)).toEqual({ status: 422, error: "fast" });
    expect(w.limit).not.toHaveBeenCalled();
    expect(await handleContact(post({ startedAt: T0 - CONTACT.minFillMs }), "ip", w.deps)).toMatchObject({ status: 202 });
  });

  it("fails closed: no limiter, no sender, or a limiter that can't answer is a 503 and nothing sent", async () => {
    const w = world();
    expect(await handleContact(post(), "ip", { ...w.deps, limit: null })).toEqual({ status: 503, error: "unavailable" });
    expect(await handleContact(post(), "ip", { ...w.deps, send: null })).toEqual({ status: 503, error: "unavailable" });
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await handleContact(post(), "ip", { ...w.deps, limit: down })).toEqual({ status: 503, error: "unavailable" });
    expect(w.send).not.toHaveBeenCalled();
  });

  it("holds an IP to 3 sends in 10 minutes, and an address to 3 from any number of IPs", async () => {
    const w = world();
    for (let i = 0; i < CONTACT.rate.sends; i++) expect(await handleContact(post({ email: `p${i}@example.com` }), "198.51.100.1", w.deps)).toMatchObject({ status: 202 });
    expect(await handleContact(post({ email: "p9@example.com" }), "198.51.100.1", w.deps)).toEqual({ status: 429, error: "rate" });
    // the window slides: ten minutes on, the IP may send again
    w.advance(10 * 60_000);
    expect(await handleContact(post({ email: "p9@example.com", startedAt: T0 }), "198.51.100.1", w.deps)).toMatchObject({ status: 202 });
    // one address, a new IP each time (a spoofed forwarded-for): the address's own window holds
    const v = world();
    for (let i = 0; i < CONTACT.rate.sends; i++) expect(await handleContact(post(), `192.0.2.${i}`, v.deps)).toMatchObject({ status: 202 });
    expect(await handleContact(post({ email: "ADA@example.com" }), "192.0.2.99", v.deps)).toEqual({ status: 429, error: "rate" });
    expect(v.sent).toHaveLength(CONTACT.rate.sends);
  });

  it("says when the send itself fails (502)", async () => {
    const w = world({
      send: async () => {
        throw new Error("resend 500");
      },
    });
    expect(await handleContact(post(), "ip", w.deps)).toEqual({ status: 502, error: "failed" });
  });
});

describe("the fallback — mailtoFor keeps the visitor's words", () => {
  it("carries the message and who wrote it, encoded", () => {
    const href = mailtoFor("owner@example.com", "A signal · Hire", { ...good, message: "Rates & dates? #1\nThanks" });
    const url = new URL(href);
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("owner@example.com");
    expect(url.searchParams.get("subject")).toBe("A signal · Hire");
    expect(url.searchParams.get("body")).toBe("Rates & dates? #1\nThanks\n\n— Ada Lovelace <Ada@Example.com>");
  });

  it("has no body when there are no words yet", () => {
    expect(mailtoFor("owner@example.com", "Hi", {})).toBe("mailto:owner@example.com?subject=Hi");
  });
});

describe("availability — the hours two people share", () => {
  const mine = { timeZone: derived.profile.timezone, ...derived.profile.workingHours };
  const at = (iso: string) => new Date(iso);

  it("reads the owner's confirmed hours: 10:00–18:00 in India", () => {
    expect(mine).toEqual({ timeZone: "Asia/Kolkata", start: "10:00", end: "18:00" });
  });

  it("offsets include DST and the half- and quarter-hour zones", () => {
    expect(offsetMinutes("Asia/Kolkata", at("2026-01-15T12:00Z"))).toBe(330);
    expect(offsetMinutes("Asia/Kathmandu", at("2026-01-15T12:00Z"))).toBe(345);
    expect(offsetMinutes("Europe/London", at("2026-01-15T12:00Z"))).toBe(0);
    expect(offsetMinutes("Europe/London", at("2026-07-15T12:00Z"))).toBe(60);
    expect(offsetMinutes("America/New_York", at("2026-01-15T12:00Z"))).toBe(-300);
    expect(offsetMinutes("Australia/Lord_Howe", at("2026-07-15T12:00Z"))).toBe(630);
    // the minute the clocks go forward (29 March 2026, 01:00 UTC)
    expect(offsetMinutes("Europe/London", at("2026-03-29T00:59Z"))).toBe(0);
    expect(offsetMinutes("Europe/London", at("2026-03-29T01:00Z"))).toBe(60);
  });

  it("is DESIGN.md's example in a London winter, an hour longer in its summer", () => {
    expect(overlap(mine, "Europe/London", at("2026-01-15T12:00Z"))).toEqual({ minutes: 210, from: "09:00", to: "12:30" });
    expect(duration(210)).toBe("3H 30M");
    expect(overlap(mine, "Europe/London", at("2026-07-15T12:00Z"))).toEqual({ minutes: 270, from: "09:00", to: "13:30" });
  });

  it("covers the other side of the world, and says when there's none", () => {
    expect(overlap(mine, "Asia/Kolkata", at("2026-01-15T12:00Z"))).toEqual({ minutes: 420, from: "10:00", to: "17:00" });
    expect(overlap(mine, "Asia/Tokyo", at("2026-01-15T12:00Z"))).toEqual({ minutes: 210, from: "13:30", to: "17:00" });
    // a New Zealand winter shares half an hour; its summer, none
    expect(overlap(mine, "Pacific/Auckland", at("2026-07-15T12:00Z"))).toEqual({ minutes: 30, from: "16:30", to: "17:00" });
    expect(overlap(mine, "Pacific/Auckland", at("2026-01-15T12:00Z"))).toEqual({ minutes: 0, myStart: "17:30" });
    expect(overlap(mine, "America/New_York", at("2026-01-15T12:00Z"))).toEqual({ minutes: 0, myStart: "23:30" });
    expect(overlap(mine, "America/Los_Angeles", at("2026-01-15T12:00Z"))).toEqual({ minutes: 0, myStart: "20:30" });
  });

  it("reads as hours and minutes", () => {
    expect([duration(420), duration(30), duration(65), duration(270)]).toEqual(["7H", "30M", "1H 05M", "4H 30M"]);
  });
});

describe("the endpoint's secrets stay on the server", () => {
  const read = (f: string) => readFileSync(join(ROOT, f), "utf8");
  const walk = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((f) => {
      const rel = join(dir, f);
      return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(f) ? [rel] : [];
    });

  it("only the server-only route reads them", () => {
    const SECRET = /RESEND_API_KEY|UPSTASH_REDIS_REST_(URL|TOKEN)|CONTACT_(TO|FROM)\b/;
    const readers = ["app", "components", "lib", "content"].flatMap(walk).filter((f) => SECRET.test(read(f)));
    expect(readers).toEqual([join("app", "api", "contact", "route.ts")]);
    expect(read(readers[0] as string)).toMatch(/^import "server-only";/);
  });

  it("no client module imports the route", () => {
    const clients = ["app", "components", "lib"].flatMap(walk).filter((f) => /^["']use client["']/.test(read(f)));
    expect(clients.length).toBeGreaterThan(0);
    for (const f of clients) expect(read(f), f).not.toMatch(/api\/contact\/route/);
  });
});

describe("the publication list — scripts/bake/publication-list.ts", () => {
  const meta = JSON.parse(read(PUBLICATION_LIST_JSON)) as { inputHash: string; fontHash: string; papers: number; bytes: number };
  function read(f: string) {
    return readFileSync(join(ROOT, f), "utf8");
  }

  it("is printed from today's papers and faces (rebake: npx tsx scripts/bake/publication-list.ts)", () => {
    const fonts = ["app/fonts/HubotSans-Variable.woff2", "app/fonts/MonaSans-Variable.woff2", "app/fonts/JetBrainsMono-Variable.woff2"].map((f) => readFileSync(join(ROOT, f)));
    const fontHash = createHash("sha256").update(Buffer.concat(fonts)).digest("hex").slice(0, 16);
    expect(meta.fontHash).toBe(fontHash);
    expect(publicationListHash(derived, fontHash)).toBe(meta.inputHash);
    expect(meta.papers).toBe(derived.publications.length);
    expect(existsSync(join(ROOT, PUBLICATION_LIST.file))).toBe(true);
    expect(statSync(join(ROOT, PUBLICATION_LIST.file)).size).toBe(meta.bytes);
    expect(readFileSync(join(ROOT, PUBLICATION_LIST.file)).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("cites each paper as the content holds it — and carries no phone number", () => {
    const status = derived.site.labels.archive.status as unknown as Record<string, string>;
    for (const p of derived.publications) {
      const c = citation(p, status);
      expect(c.title).toBe(p.title);
      expect(c.authors).toBe(p.authors.map((a) => a.name).join(", "));
      expect(c.venue).toBe(`${p.venue}, ${p.year}`);
      expect(c.link).toBe(p.links.doi ?? p.links.pdf ?? null);
    }
    // the PDF's text is compressed: read the page it's printed from
    const html = publicationListHtml(derived, { display: "", body: "", mono: "" });
    for (const p of derived.publications) expect(html).toContain(p.title.replace(/&/g, "&amp;"));
    expect(html).toContain(derived.profile.email);
    expect(html.replace(/base64,[^)]*/g, "")).not.toMatch(/\+91|\b\d{5}[\s-]?\d{5}\b|\b\d{10}\b/);
  });
});
