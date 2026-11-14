import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** A deliberately small CSS reader for our own token files: top-level rules and @media blocks. */
export interface CssRule {
  selector: string;
  media: string | null;
  decls: Record<string, string>;
}

const ROOT = resolve(__dirname, "../..");

export function readCss(path: string): CssRule[] {
  return parseCss(readFileSync(resolve(ROOT, path), "utf8"));
}

export function parseCss(src: string): CssRule[] {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  const walk = (body: string, media: string | null) => {
    let i = 0;
    while (i < body.length) {
      const open = body.indexOf("{", i);
      if (open === -1) break;
      const prelude = body.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < body.length && depth > 0) {
        if (body[j] === "{") depth++;
        else if (body[j] === "}") depth--;
        j++;
      }
      const inner = body.slice(open + 1, j - 1);
      if (prelude.startsWith("@media")) walk(inner, prelude.replace(/^@media\s*/, ""));
      else if (!prelude.startsWith("@")) rules.push({ selector: prelude.replace(/\s+/g, " "), media, decls: parseDecls(inner) });
      i = j;
    }
  };
  walk(text, null);
  return rules;
}

function parseDecls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split(";")) {
    const k = part.indexOf(":");
    if (k === -1) continue;
    const name = part.slice(0, k).trim();
    const value = part.slice(k + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

/** Declarations of the top-level rule whose selector list contains `[data-theme="<theme>"]`. */
export function themeBlock(rules: CssRule[], theme: string): Record<string, string> {
  const rule = rules.find((r) => r.media === null && r.selector.split(",").some((s) => s.trim() === `[data-theme="${theme}"]`));
  if (!rule) throw new Error(`no top-level [data-theme="${theme}"] block`);
  return rule.decls;
}

export function block(rules: CssRule[], selector: string, media: string | null = null): Record<string, string> {
  const rule = rules.find((r) => r.media === media && r.selector === selector);
  if (!rule) throw new Error(`no rule "${selector}"${media ? ` in @media ${media}` : ""}`);
  return rule.decls;
}

export function mediaRule(rules: CssRule[], mediaIncludes: string, selector: string): Record<string, string> {
  const rule = rules.find((r) => r.media !== null && r.media.includes(mediaIncludes) && r.selector === selector);
  if (!rule) throw new Error(`no rule "${selector}" in @media (…${mediaIncludes}…)`);
  return rule.decls;
}
