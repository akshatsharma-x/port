export type ClassValue = string | false | null | undefined | 0;

/** Joins class names, skipping falsy values. (The spacing lint rule also reads cx() calls.) */
export function cx(...values: ClassValue[]): string {
  let out = "";
  for (const v of values) {
    if (!v) continue;
    out = out ? `${out} ${v}` : v;
  }
  return out;
}
