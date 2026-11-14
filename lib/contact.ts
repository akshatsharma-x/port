// zod/mini: the same rules as classic zod's chains, a fifth of the bytes in CONNECT's idle chunk
// (classic zod was most of its 45.8 KB gz)
import * as z from "zod/mini";

/**
 * 08 · CONNECT (DESIGN.md §7.4): the form's rules, shared by the page (its lazy behaviour) and
 * POST /api/contact, and pure — the endpoint passes in the rate limiter and the sender, so
 * tests/contact.test.ts drives every path with fakes. Errors are codes; the page says them in the
 * content's words (labels.connect.errors).
 */
export const CONTACT = {
  intents: ["hire", "collaborate", "research", "speak", "other"] as const,
  /** a person takes longer than this to fill the form in; a script posting at once doesn't (ms) */
  minFillMs: 2500,
  limits: { name: 80, email: 254, message: 4000, minMessage: 10 },
  /** Upstash Ratelimit, a sliding window: this many sends per window, per IP */
  rate: { sends: 3, window: "10 m" },
  /** the request body's ceiling (bytes): the message's limit and its envelope */
  maxBody: 16_000,
  /** the visitor's working day in their own time, for the overlap readout */
  visitorDay: { start: "09:00", end: "17:00" },
} as const;

export type Intent = (typeof CONTACT.intents)[number];
export type ErrorCode = "required" | "email" | "short" | "long" | "fast" | "rate" | "unavailable" | "failed";

const L = CONTACT.limits;
/** The visitor's words: each check in order on the trimmed text, an issue's message its code. */
export const ContactSchema = z.object({
  name: z.string({ error: "required" }).check(z.trim(), z.minLength(1, { error: "required" }), z.maxLength(L.name, { error: "long" })),
  email: z.string({ error: "required" }).check(z.trim(), z.minLength(1, { error: "required" }), z.maxLength(L.email, { error: "long" }), z.email({ error: "email" })),
  intent: z.enum(CONTACT.intents, { error: "required" }),
  message: z.string({ error: "required" }).check(z.trim(), z.minLength(1, { error: "required" }), z.minLength(L.minMessage, { error: "short" }), z.maxLength(L.message, { error: "long" })),
});
export type ContactInput = z.infer<typeof ContactSchema>;

/**
 * What the page posts: the words and when the form was first touched (epoch ms). The honeypot
 * (`website`, empty for a person) is read before this, whatever its shape (handleContact).
 */
export const ContactPostSchema = z.extend(ContactSchema, {
  startedAt: z.int().check(z.gte(0)),
});

const FIELDS = Object.keys(ContactSchema.shape) as (keyof ContactInput)[];
const FIELD_CODES: readonly ErrorCode[] = ["required", "email", "short", "long"];

/** The first error code per visible field (a schema issue's message is its code); nothing else is named. */
export function fieldErrors(error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }): Partial<Record<keyof ContactInput, ErrorCode>> {
  const out: Partial<Record<keyof ContactInput, ErrorCode>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (!FIELDS.includes(key as keyof ContactInput) || out[key as keyof ContactInput]) continue;
    out[key as keyof ContactInput] = FIELD_CODES.includes(issue.message as ErrorCode) ? (issue.message as ErrorCode) : "required";
  }
  return out;
}

/** Anything in the honeypot: a script filled it, whatever else it sent. */
export function trapped(body: unknown): boolean {
  const trap = typeof body === "object" && body !== null ? (body as { website?: unknown }).website : undefined;
  return trap !== undefined && trap !== null && String(trap).trim() !== "";
}

export interface Mail {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}

/** What the endpoint needs from the world. A null limiter or sender is one that isn't configured. */
export interface ContactDeps {
  now(): number;
  /** the rate limit for this key; null: no limiter configured (the endpoint then refuses: fail closed) */
  limit: ((key: string) => Promise<{ ok: boolean }>) | null;
  /** sends the mail and returns its id; null: no sender configured (refuses too) */
  send: ((mail: Mail) => Promise<{ id: string }>) | null;
  to: string;
  subject: (input: ContactInput) => string;
}

export type ContactResult =
  | { status: 202; id: string | null }
  | { status: 400; fields: Partial<Record<keyof ContactInput, ErrorCode>> }
  | { status: 422 | 429 | 502 | 503; error: ErrorCode };

/**
 * One submission, in order: the honeypot (a bot's 202 and nothing sent — before anything that could
 * tell it what's wrong), the words (400), the time it took (422), the rate limit — per IP and per
 * sender address (429) — and the send (502). No limiter or no sender: 503, never an open relay.
 */
export async function handleContact(body: unknown, key: string, deps: ContactDeps): Promise<ContactResult> {
  if (trapped(body)) return { status: 202, id: null };
  const parsed = ContactPostSchema.safeParse(body);
  if (!parsed.success) return { status: 400, fields: fieldErrors(parsed.error) };
  const { startedAt, ...input } = parsed.data;
  if (deps.now() - startedAt < CONTACT.minFillMs) return { status: 422, error: "fast" };
  if (!deps.limit || !deps.send) return { status: 503, error: "unavailable" };
  // the IP's window and the sender's own: a forwarded-for header is only as true as the proxy
  // that sets it, so one address can't send past the limit from many
  let allowed = true;
  try {
    for (const k of [key, `mail:${input.email.toLowerCase()}`]) if (!(await deps.limit(k)).ok) allowed = false;
  } catch {
    // the limiter can't say: closed, not open
    return { status: 503, error: "unavailable" };
  }
  if (!allowed) return { status: 429, error: "rate" };
  try {
    const { id } = await deps.send({ to: deps.to, replyTo: input.email, subject: deps.subject(input), text: `${input.message}\n\n— ${input.name} <${input.email}>` });
    return { status: 202, id };
  } catch {
    return { status: 502, error: "failed" };
  }
}

/** The fallback when the line is down: a mailto that keeps the visitor's words. */
export function mailtoFor(to: string, subject: string, input: Partial<ContactInput>): string {
  const body = [input.message?.trim(), input.name || input.email ? `— ${[input.name, input.email && `<${input.email}>`].filter(Boolean).join(" ")}` : ""].filter(Boolean).join("\n\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
}

// ── availability: the working hours two people share ─────────────────────────────────────────

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A time zone's offset from UTC at an instant, in minutes (Intl: DST included). */
export function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return Math.round((local - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

const hhmm = (m: number) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;

/**
 * My working hours against a visitor's day (CONTACT.visitorDay in their zone), both on the visitor's
 * today: the shared stretch in the visitor's own time, or null and where my day starts for them.
 */
export function overlap(mine: { timeZone: string; start: string; end: string }, visitorZone: string, at: Date = new Date()): { minutes: number; from: string; to: string } | { minutes: 0; myStart: string } {
  const shift = offsetMinutes(visitorZone, at) - offsetMinutes(mine.timeZone, at);
  const myStart = minutes(mine.start) + shift;
  const myEnd = minutes(mine.end) + shift;
  const yours = { start: minutes(CONTACT.visitorDay.start), end: minutes(CONTACT.visitorDay.end) };
  // my day may sit across their midnight: compare it a day either side too
  let best = { minutes: 0, from: 0, to: 0 };
  for (const day of [-1440, 0, 1440]) {
    const from = Math.max(myStart + day, yours.start);
    const to = Math.min(myEnd + day, yours.end);
    if (to - from > best.minutes) best = { minutes: to - from, from, to };
  }
  return best.minutes > 0 ? { minutes: best.minutes, from: hhmm(best.from), to: hhmm(best.to) } : { minutes: 0, myStart: hhmm(myStart) };
}

/** "3H 30M", "7H", "30M" (a New Zealand winter shares half an hour with an IST day) */
export function duration(m: number): string {
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest}M`;
  return rest ? `${h}H ${String(rest).padStart(2, "0")}M` : `${h}H`;
}
