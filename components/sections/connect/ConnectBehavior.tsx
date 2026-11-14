"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { CheckGlyph } from "@/components/research/CheckGlyph";
import { CONTACT, ContactSchema, duration, mailtoFor, overlap, type ContactInput, type ErrorCode, type Intent } from "@/lib/contact";
import { cue } from "@/lib/cues";
import { HUD_HZ, localClock, onHud } from "@/lib/hud";

export interface ConnectLabels {
  errors: Record<ErrorCode, string>;
  log: { label: string; validate: string; id: string };
  availability: { label: string; local: string; overlap: string; yours: string; none: string; hours: string };
  intents: Record<Intent, string>;
  fallback: { note: string; link: string; subject: string };
}

const FIELDS = ["name", "email", "intent", "message"] as const;
/** HTTP's own reason phrases (RFC 9110), for the log's status line */
const REASON: Record<number, string> = { 202: "ACCEPTED", 400: "BAD REQUEST", 403: "FORBIDDEN", 413: "CONTENT TOO LARGE", 415: "UNSUPPORTED MEDIA TYPE", 422: "UNPROCESSABLE CONTENT", 429: "TOO MANY REQUESTS", 500: "INTERNAL SERVER ERROR", 502: "BAD GATEWAY", 503: "SERVICE UNAVAILABLE" };

interface LogLine {
  key: string;
  text: string;
  ok?: boolean;
}

/**
 * CONNECT's behaviour (DESIGN.md §7.4), loaded on the form's first focus or on idle:
 *   - the form: react-hook-form with lib/contact.ts's schema, registered on the server's own fields
 *     (no re-render under the visitor's typing); errors inline in the content's words, announced;
 *     the 2.5 s floor; POST /api/contact; a transmission log of what really happened (VALIDATE ✓ ·
 *     POST /api/contact · the status · the message id); then TRANSMISSION RECEIVED and the
 *     TRANSMIT cue — or, when the line is down, a mailto that keeps the visitor's words
 *   - COPY for the email, with its toast
 *   - availability: my time, ticking, and the overlap with the visitor's working day
 */
export default function ConnectBehavior({ labels, owner }: { labels: ConnectLabels; owner: { email: string } }) {
  const mark = useRef<HTMLSpanElement>(null);
  // client-only (loaded after hydration), so the server's log list is there to portal into
  const logEl = useMemo(() => document.querySelector<HTMLElement>("form[data-connect-form] [data-connect-log]"), []);
  const [log, setLog] = useState<LogLine[]>([]);
  const form = useForm<ContactInput>({ resolver: zodResolver(ContactSchema), mode: "onTouched", shouldFocusError: true });
  const { register, handleSubmit, setError, reset: resetForm } = form;
  const errors = form.formState.errors;
  const signature = FIELDS.map((f) => `${f}:${errors[f]?.message ?? ""}`).join("|");

  // the form: the server's fields, registered; the submit, ours
  useEffect(() => {
    const root = mark.current?.closest<HTMLElement>(".connect");
    const el = root?.querySelector<HTMLFormElement>("form[data-connect-form]");
    if (!root || !el) return;
    el.noValidate = true; // the content's errors, not the browser's bubbles
    const offs: (() => void)[] = [];
    for (const name of FIELDS) {
      const input = el.elements.namedItem(name) as HTMLInputElement | null;
      if (!input) continue;
      const r = register(name);
      r.ref(input);
      const change = (e: Event) => void r.onChange(e);
      const blur = (e: Event) => void r.onBlur(e);
      input.addEventListener("input", change);
      input.addEventListener("change", change);
      input.addEventListener("blur", blur);
      offs.push(() => {
        input.removeEventListener("input", change);
        input.removeEventListener("change", change);
        input.removeEventListener("blur", blur);
      });
    }
    const note = el.querySelector<HTMLElement>("[data-connect-note]");
    const fallback = el.querySelector<HTMLElement>("[data-connect-fallback]");
    const mailto = el.querySelector<HTMLAnchorElement>("[data-connect-mailto]");
    const received = el.querySelector<HTMLElement>("[data-connect-received]");
    const trap = el.elements.namedItem("website") as HTMLInputElement | null;
    const say = (text: string) => {
      if (note) note.textContent = text;
    };
    const send = async (values: ContactInput) => {
      const startedAt = Number(el.dataset.startedAt) || Date.now();
      if (Date.now() - startedAt < CONTACT.minFillMs) {
        say(labels.errors.fast);
        return;
      }
      say("");
      if (fallback) fallback.hidden = true;
      el.dataset.state = "sending";
      if (logEl) logEl.hidden = false;
      setLog([{ key: "validate", text: labels.log.validate, ok: true }, { key: "post", text: "POST /api/contact" }]);
      let res: Response | null = null;
      let body: { id?: string | null; error?: ErrorCode; fields?: Partial<Record<keyof ContactInput, ErrorCode>> } | null = null;
      try {
        res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, website: trap?.value ?? "", startedAt }) });
        body = await res.json().catch(() => null);
      } catch {
        res = null;
      }
      const status = res ? `${res.status} ${REASON[res.status] ?? res.statusText}`.trim() : "NO RESPONSE";
      setLog((l) => [...l, { key: "status", text: status, ok: res?.status === 202 }]);
      if (res?.status === 202) {
        if (body?.id) setLog((l) => [...l, { key: "id", text: `${labels.log.id} ${body?.id}` }]);
        el.dataset.state = "received";
        if (received) {
          received.hidden = false;
          received.focus();
        }
        cue("TRANSMIT");
        return;
      }
      el.dataset.state = "";
      const named = body?.fields ? Object.entries(body.fields) : [];
      if (res?.status === 400 && named.length) {
        for (const [k, code] of named) setError(k as keyof ContactInput, { message: code });
        return;
      }
      const code: ErrorCode = body?.error && body.error in labels.errors ? body.error : res ? "failed" : "unavailable";
      say(labels.errors[code]);
      if (code === "fast") return;
      // the line is down (or held back): the visitor's words go by email instead
      if (mailto) mailto.href = mailtoFor(owner.email, `${labels.fallback.subject} · ${labels.intents[values.intent]}`, values);
      if (fallback) fallback.hidden = false;
    };
    const submit = (e: SubmitEvent) => {
      e.preventDefault();
      if (el.dataset.state === "sending") return;
      void handleSubmit(send)();
    };
    el.addEventListener("submit", submit);
    const again = el.querySelector<HTMLElement>("[data-connect-again]");
    const reset = () => {
      resetForm();
      setLog([]);
      if (logEl) logEl.hidden = true;
      el.dataset.state = "";
      if (received) received.hidden = true;
      (el.elements.namedItem("name") as HTMLInputElement | null)?.focus();
      el.dataset.startedAt = String(Date.now());
    };
    again?.addEventListener("click", reset);
    return () => {
      el.removeEventListener("submit", submit);
      again?.removeEventListener("click", reset);
      for (const off of offs) off();
    };
  }, [register, handleSubmit, setError, resetForm, labels, owner, logEl]);

  // errors beside their fields, in the content's words; aria-invalid with them
  useEffect(() => {
    const el = mark.current?.closest(".connect")?.querySelector<HTMLFormElement>("form[data-connect-form]");
    if (!el) return;
    for (const f of FIELDS) {
      const code = errors[f]?.message as ErrorCode | undefined;
      const out = el.querySelector<HTMLElement>(`[data-error-for="${f}"]`);
      if (out) out.textContent = code ? (labels.errors[code] ?? labels.errors.required) : "";
      const input = el.elements.namedItem(f) as HTMLElement | null;
      if (code) input?.setAttribute("aria-invalid", "true");
      else input?.removeAttribute("aria-invalid");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature is the errors' content
  }, [signature, labels]);

  // COPY: the email to the clipboard, and the toast that says so
  useEffect(() => {
    const root = mark.current?.closest(".connect");
    const button = root?.querySelector<HTMLButtonElement>("[data-connect-copy]");
    const copied = root?.querySelector<HTMLElement>("[data-connect-copied]");
    if (!button || !navigator.clipboard) return;
    button.hidden = false;
    let timer = 0;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.connectCopy ?? owner.email);
        if (copied) copied.hidden = false;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (copied) copied.hidden = true;
        }, COPIED_MS);
      } catch {
        /* no clipboard here (an insecure context, a denied permission): nothing copied, no toast */
      }
    };
    button.addEventListener("click", copy);
    return () => {
      button.removeEventListener("click", copy);
      window.clearTimeout(timer);
    };
  }, [owner]);

  // availability: my time, at the HUD's text rate; the overlap with the visitor's working day
  useEffect(() => {
    const root = mark.current?.closest(".connect");
    const clock = root?.querySelector<HTMLElement>("[data-connect-clock]");
    const out = root?.querySelector<HTMLElement>("[data-connect-overlap]");
    if (!clock || !out) return;
    const zone = clock.dataset.zone ?? "UTC";
    const fmt = localClock(zone, clock.dataset.country);
    const off = onHud(HUD_HZ.text, () => {
      const text = fmt.format(new Date());
      if (clock.textContent !== text) clock.textContent = text;
    });
    const mine = { timeZone: out.dataset.zone ?? zone, start: out.dataset.start ?? "09:00", end: out.dataset.end ?? "17:00" };
    const visitor = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const A = labels.availability;
    const write = () => {
      const o = overlap(mine, visitor);
      out.textContent = "from" in o ? `${A.overlap} ${duration(o.minutes)} · ${o.from}–${o.to} ${A.yours}` : `${A.none} ${o.myStart} ${A.yours}`;
    };
    write();
    const timer = window.setInterval(write, 60_000);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [labels]);

  return (
    <>
      <span ref={mark} hidden />
      {logEl &&
        log.length > 0 &&
        createPortal(
          <>
            {log.map((l) => (
              <li key={l.key} className="teletype__logline" style={{ "--chars": l.text.length + (l.ok ? 2 : 0) } as CSSProperties}>
                <span>{l.text}</span>
                {l.ok && (
                  <>
                    {" "}
                    <CheckGlyph />
                  </>
                )}
              </li>
            ))}
          </>,
          logEl,
        )}
    </>
  );
}

/** the toast stays this long (ms) */
const COPIED_MS = 1600;
