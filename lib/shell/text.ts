import type { Line, Seg, Tone } from "./types";

/**
 * Text tools for the terminal (pure): templates, wrapping, tables, edit distance, completion's
 * common prefix, the command line's words, and search folding. Every cell is one character: the
 * panel is set in JetBrains Mono, whose advance is fixed.
 */

/** "{name} — {role}" with vars; an unknown key stays as written, so a missing value shows. */
export const fill = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export const seg = (t: string, k?: Tone, href?: string): Seg => ({ t, ...(k ? { k } : {}), ...(href ? { href } : {}) });

/** A template as a line, where a placeholder may be a segment of its own (a link mid-sentence). */
export function fillLine(template: string, vars: Record<string, string | number | Seg>, k?: Tone): Line {
  const out: Seg[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  for (let m = re.exec(template); m; m = re.exec(template)) {
    if (m.index > last) out.push(seg(template.slice(last, m.index), k));
    const v = vars[m[1] ?? ""];
    out.push(v === undefined ? seg(m[0], k) : typeof v === "object" ? v : seg(String(v), k));
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push(seg(template.slice(last), k));
  return out;
}
export const line = (...parts: (string | Seg)[]): Line => parts.map((p) => (typeof p === "string" ? seg(p) : p));
export const plain = (l: Line): string => l.map((s) => s.t).join("");

/** Words to lines of at most `width` cells (a word longer than the line is broken). */
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (w.length > width) {
        if (cur) {
          out.push(cur);
          cur = "";
        }
        out.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!cur) cur = w;
      else if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  return out;
}

/** A label column and wrapped text beside it: `LABEL   text…` / `        …more`. */
export function field(label: string, text: string, width: number, labelWidth: number, tone?: Tone): Line[] {
  const room = Math.max(8, width - labelWidth - 2);
  return wrap(text, room).map((l, i) => line(seg(i ? " ".repeat(labelWidth + 2) : `${label.padEnd(labelWidth)}  `, "dim"), tone ? seg(l, tone) : l));
}

/** Columns padded to their widest cell; the last column runs free. A header row is dimmed. */
export function table(rows: readonly (readonly string[])[], header?: readonly string[]): Line[] {
  const all = header ? [header, ...rows] : rows;
  const cols = Math.max(0, ...all.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, c) => Math.max(0, ...all.map((r) => (r[c] ?? "").length)));
  const fmt = (r: readonly string[]) => r.map((cell, c) => (c === r.length - 1 ? cell : cell.padEnd(widths[c] ?? 0))).join("  ");
  return [...(header ? [line(seg(fmt(header).toUpperCase(), "dim"))] : []), ...rows.map((r) => line(fmt(r)))];
}

/** Levenshtein distance (insert, delete, substitute), early-out past `max`. */
export function distance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** Candidates within `max` edits, nearest first (then alphabetical). */
export function suggest(word: string, candidates: readonly string[], max: number): string[] {
  const w = word.toLowerCase();
  return candidates
    .map((c) => ({ c, d: distance(w, c.toLowerCase(), max) }))
    .filter((x) => x.d <= max && x.c.toLowerCase() !== w)
    .sort((a, b) => a.d - b.d || a.c.localeCompare(b.c))
    .map((x) => x.c);
}

export function commonPrefix(words: readonly string[]): string {
  if (!words.length) return "";
  let p = words[0] ?? "";
  for (const w of words) while (!w.startsWith(p)) p = p.slice(0, -1);
  return p;
}

/** The command line's words: whitespace splits, quotes group ("food waste"). */
export function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (let m = re.exec(input); m; m = re.exec(input)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  return out;
}

/** For matching: lower case, accents off (résumé finds resume). */
export const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();

/** A window of `width` cells around the first match of `term` in `text`, the match marked. */
export function snippet(text: string, term: string, width: number): Seg[] {
  const flat = text.replace(/\s+/g, " ").trim();
  const at = fold(flat).indexOf(fold(term));
  if (at < 0) return [seg(flat.length > width ? `${flat.slice(0, width - 1)}…` : flat, "dim")];
  const room = Math.max(0, width - term.length);
  const start = Math.max(0, Math.min(at - Math.floor(room / 2), flat.length - width));
  const end = Math.min(flat.length, start + width);
  const pre = `${start > 0 ? "…" : ""}${flat.slice(start + (start > 0 ? 1 : 0), at)}`;
  const post = `${flat.slice(at + term.length, end - (end < flat.length ? 1 : 0))}${end < flat.length ? "…" : ""}`;
  return [seg(pre, "dim"), seg(flat.slice(at, at + term.length), "mark"), seg(post, "dim")];
}

/** "1 h 4 min", "12 min 3 s", "9 s" */
export function span(ms: number, units: { hour: string; minute: string; second: string }): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h} ${units.hour}${m ? ` ${m} ${units.minute}` : ""}`;
  if (m) return `${m} ${units.minute}${sec ? ` ${sec} ${units.second}` : ""}`;
  return `${sec} ${units.second}`;
}
