/**
 * 404 / 500 — NO SIGNAL's words (DESIGN.md §7.4). Its own module, which content/data.ts takes into
 * site.labels: app/global-error.tsx replaces the root layout when it renders, so nothing can hand it
 * labels, and it imports these few lines rather than the whole content.
 */
export const noSignal = {
  title: "No signal",
  notFound: "Nothing is on this channel.",
  error: "The signal dropped.",
  hint: "goto system",
  home: "Back to the system",
  terminal: "or press ~ and type it",
  retry: "Try again",
};
