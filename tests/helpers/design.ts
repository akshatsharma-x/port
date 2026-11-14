import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Reads tables straight out of DESIGN.md, so tests bind the code to the bible, not to a copy. */
const DESIGN = readFileSync(resolve(__dirname, "../../DESIGN.md"), "utf8");

/** Text from the first heading matching `heading` up to the next heading of the same or higher level. */
export function section(heading: RegExp): string {
  const lines = DESIGN.split("\n");
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) throw new Error(`DESIGN.md heading not found: ${heading}`);
  const level = (/^(#+)/.exec(lines[start] ?? "")?.[1] ?? "#").length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#+)\s/.exec(lines[i] ?? "");
    if (m && (m[1]?.length ?? 99) <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** All markdown tables in a block of text, as rows of cleaned cells (header and separator dropped). */
export function tables(text: string): string[][][] {
  const out: string[][][] = [];
  let current: string[][] | null = null;
  let headerSeen = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|")) {
      if (current?.length) out.push(current);
      current = null;
      headerSeen = false;
      continue;
    }
    if (!current) {
      current = [];
      headerSeen = false;
    }
    if (/^\|[\s\-:|]+\|$/.test(line)) {
      headerSeen = true;
      continue;
    }
    if (!headerSeen) continue; // header row
    current.push(
      line
        .slice(1, -1)
        .split("|")
        .map((c) => c.replace(/`/g, "").trim()),
    );
  }
  if (current?.length) out.push(current);
  return out;
}

/** First table under a heading. */
export function table(heading: RegExp): string[][] {
  const t = tables(section(heading))[0];
  if (!t) throw new Error(`no table under ${heading}`);
  return t;
}

/** "18.02:1" / "14.01:1 on --accent" → 18.02; "—" or "" → null. */
export function ratioCell(cell: string | undefined): number | null {
  const m = /([\d.]+):1/.exec(cell ?? "");
  return m ? Number(m[1]) : null;
}
