import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { derived } from "@/content/derive";
import { CONTACT, handleContact, type ContactDeps, type ContactInput, type Mail } from "@/lib/contact";

/**
 * POST /api/contact — CONNECT's form (DESIGN.md §7.4), the site's one server endpoint. The rules are
 * lib/contact.ts's; this wires them to the world, from server-only environment variables (none
 * reaches the client bundle):
 *
 *   RESEND_API_KEY                                   the send (Resend's REST API)
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  the rate limit (Upstash Ratelimit, 3 per 10 min per IP)
 *   CONTACT_TO     where it goes (default: the profile's email)
 *   CONTACT_FROM   who it's from (default: Resend's onboarding sender, which can only write to the
 *                  account's own address until a domain is verified)
 *
 * Fails closed: without the limiter or the sender it answers 503 and sends nothing; the page then
 * offers a mailto that keeps the visitor's words. It takes JSON only, from this site's own pages,
 * up to CONTACT.maxBody bytes.
 */
// POST handlers are never cached (Next 16, getting-started/route-handlers): no segment config needed.

let limiter: Ratelimit | null | undefined;
function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  limiter = url && token ? new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(CONTACT.rate.sends, CONTACT.rate.window), prefix: "retrograde:contact" }) : null;
  return limiter;
}

async function sendWithResend(key: string, from: string, mail: Mail): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], reply_to: mail.replyTo, subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as { id?: string } | null;
  if (!res.ok || !body?.id) throw new Error(`resend ${res.status}`);
  return { id: body.id };
}

function deps(): ContactDeps {
  const L = derived.site.labels.connect;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM ?? "RETROGRADE <onboarding@resend.dev>";
  const rl = getLimiter();
  return {
    now: () => Date.now(),
    limit: rl ? async (k) => ({ ok: (await rl.limit(k)).success }) : null,
    send: key ? (mail) => sendWithResend(key, from, mail) : null,
    to: process.env.CONTACT_TO ?? derived.profile.email,
    subject: (input: ContactInput) => `${L.fallback.subject} · ${L.intents[input.intent]} · ${input.name}`,
  };
}

const hostOf = (origin: string): string | null => {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
};

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  if (!(request.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "json" }, 415);
  // this site's own pages only: a cross-site page can't post here ("null" and other unparsable
  // origins included)
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && hostOf(origin) !== host) return json({ error: "origin" }, 403);
  // the declared size before reading a byte, the true size after (a body can omit or understate it)
  if (Number(request.headers.get("content-length") ?? 0) > CONTACT.maxBody) return json({ error: "size" }, 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > CONTACT.maxBody) return json({ error: "size" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "json" }, 400);
  }
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();
  const result = await handleContact(body, ip, deps());
  return json(result, result.status);
}
