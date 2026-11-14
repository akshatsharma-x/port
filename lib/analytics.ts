/**
 * Privacy-light analytics (PROMPTS.md Part 15): Vercel Web Analytics (cookieless, no personal data)
 * and Speed Insights (field vitals). First-load JS carries only this — track(), a queue the script
 * reads (window.vaq) when it lands; the rest (lib/analytics-start.ts) is imported after idle, so an
 * event before then is queued, never lost.
 *
 * An event's data is never free text: slugs, section ids, theme names, a command's name (never its
 * arguments), an HTTP status. Never a message, an email, what was typed.
 */
export type AnalyticsEvent =
  | "section_view"
  | "project_open"
  | "dossier_open"
  | "bibtex_copy"
  | "cert_verify"
  | "terminal_open"
  | "command_run"
  | "resume_download"
  | "contact_submit"
  | "theme_switch"
  | "sound_enable";

type Data = Record<string, string | number | boolean>;
type Queue = Window & { va?: (...args: unknown[]) => void; vaq?: unknown[][] };

export function track(name: AnalyticsEvent, data?: Data): void {
  if (typeof window === "undefined") return;
  const w = window as Queue;
  w.va ??= (...args: unknown[]) => void (w.vaq ??= []).push(args);
  w.va("event", data ? { name, data } : { name });
}
