/**
 * The credential card's machine-readable zone (DESIGN.md §4.4 B1): two lines of 30 in the TD1
 * layout — the ID-1 card's own MRZ (ICAO Doc 9303 part 5) — with real 7-3-1 check digits.
 *
 *   line 1  CR · issuer (3) · credential ID (9) · its check digit · optional data (15)
 *   line 2  issued YYMMDD · check · < · expires YYMMDD · check · level (3) · optional (11) · composite
 *
 * Long IDs follow TD1's rule: the first nine characters in the number field, a filler where its check
 * digit would be, and the rest in the optional data followed by the check digit over the whole
 * number as written (an ID past 23 characters is cut there). What isn't known is fillers, as ICAO
 * 9303 writes an unknown part: an absent expiry or issue date, the day of a date known only to the
 * month ("2026-07" → 2607<<), a credential without an ID (v2.8). A check digit over fillers is
 * what 7-3-1 makes of them (0).
 */
export const MRZ = { width: 30, code: "CR", weights: [7, 3, 1] as const, numberField: 9 } as const;

const value = (c: string): number => (c === "<" ? 0 : c >= "0" && c <= "9" ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 55);

/** ICAO 9303's check digit: each character's value (0–9, A–Z = 10–35, < = 0) by 7, 3, 1, repeating; the sum mod 10. */
export function checkDigit(field: string): number {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += value(field[i] as string) * (MRZ.weights[i % 3] as number);
  return sum % 10;
}

/** To MRZ characters: upper case, accents dropped, anything else a filler; trimmed of fillers at the ends. */
export function mrzText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "<")
    .replace(/^<+|<+$/g, "");
}

const pad = (s: string, n: number): string => (s + "<".repeat(n)).slice(0, n);

/** "2024-05-12" → "240512"; "2026-07" (the month only) → "2607<<"; null → fillers. */
export const mrzDate = (iso: string | null): string => (iso ? `${iso.slice(2, 4)}${iso.slice(5, 7)}${iso.slice(8, 10) || "<<"}` : "<<<<<<");

/**
 * An issuer's three letters: the initials of its words (not "of", "the", "and", "for"), then the
 * last word's next letters if there are fewer than three — "Amazon Web Services" AWS, "Google
 * Cloud" GCL, "Coursera" COU.
 */
export function issuerCode(issuer: string): string {
  const words = mrzText(issuer)
    .split("<")
    .filter((w) => w && !["OF", "THE", "AND", "FOR"].includes(w));
  let code = words.map((w) => w[0]).join("");
  const last = words[words.length - 1] ?? "";
  for (let i = 1; code.length < 3 && i < last.length; i++) code += last[i];
  return pad(code.slice(0, 3), 3);
}

/** The level in the nationality's three places. */
export const LEVEL_CODES = { foundational: "FND", associate: "ASC", professional: "PRO", expert: "EXP" } as const;

export interface MrzInput {
  credentialId: string | null;
  issuer: string;
  issueDate: string | null;
  expiryDate: string | null;
  level: keyof typeof LEVEL_CODES;
}

/** TD1's composite check digit: line 1 from position 6, and line 2's dates and optional data. */
export const compositeDigit = (line1: string, line2: string): number => checkDigit(line1.slice(5, 30) + line2.slice(0, 7) + line2.slice(8, 15) + line2.slice(18, 29));

export function mrzLines(c: MrzInput): [string, string] {
  const head = MRZ.code + issuerCode(c.issuer);
  // what fits: nine in the number field, the rest in the optional data before its check digit;
  // the check digit is over the number as written here, so a reader can check it
  const number = mrzText(c.credentialId ?? "").replace(/</g, "").slice(0, MRZ.width - head.length - 2);
  const field = pad(number.slice(0, MRZ.numberField), MRZ.numberField);
  const line1 = number.length > MRZ.numberField ? pad(`${head}${field}<${number.slice(MRZ.numberField)}${checkDigit(number)}`, MRZ.width) : pad(`${head}${field}${checkDigit(field)}`, MRZ.width);
  const issued = mrzDate(c.issueDate);
  const expires = mrzDate(c.expiryDate);
  const partial = `${issued}${checkDigit(issued)}<${expires}${checkDigit(expires)}${LEVEL_CODES[c.level]}${"<".repeat(11)}`;
  return [line1, `${partial}${compositeDigit(line1, partial)}`];
}
