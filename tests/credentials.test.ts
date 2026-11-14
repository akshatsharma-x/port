import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { IdCard, stampOf } from "@/components/sections/credentials/IdCard";
import { buildDate, derived, overlays } from "@/content/derive";
import { parseContent, type VerifyFile } from "@/content/schema";
import { derive } from "@/content/selectors";
import { CRED, lampAt, lampFromTilt, readout } from "@/lib/credentials";
import { CARD_UNITS, guillocheFigures, guillocheFor, SINE_FIT } from "@/lib/guilloche";
import { MAX_TIMED_MS, springLinear, springs } from "@/lib/motion";
import { checkDigit, compositeDigit, issuerCode, MRZ, mrzDate, mrzLines, mrzText } from "@/lib/mrz";
import { FOIL_GRAIN, foilGrainPixels } from "../scripts/bake/foil-grain";
import { data } from "./fixtures/placeholder-content";

/** B1/B2 · CREDENTIALS (DESIGN.md §4.4, §7.4): the MRZ, the guilloche, the lamp, the stamps, the records' figures, the grain, the card's weight. */
const ROOT = resolve(__dirname, "..");
const fixture = derive(parseContent(data), overlays, buildDate);

describe("the machine-readable zone (ICAO 9303, 7-3-1)", () => {
  it("computes ICAO's own check digits", () => {
    // Doc 9303 part 5's TD1 specimen: document D23145890, born 740812, expires 120415
    expect(checkDigit("D23145890")).toBe(7);
    expect(checkDigit("740812")).toBe(2);
    expect(checkDigit("120415")).toBe(9);
    expect(compositeDigit("I<UTOD231458907<<<<<<<<<<<<<<<", "7408122F1204159UTO<<<<<<<<<<<6")).toBe(6);
    expect(checkDigit("<<<<<<")).toBe(0);
  });

  it("writes two lines of 30 whose check digits a reader can verify", () => {
    for (const c of fixture.certificates) {
      const [l1, l2] = mrzLines(c);
      expect(l1).toHaveLength(MRZ.width);
      expect(l2).toHaveLength(MRZ.width);
      expect(l1 + l2).toMatch(/^[A-Z0-9<]+$/);
      expect(l1.slice(0, 2)).toBe(MRZ.code);
      expect(l1.slice(2, 5)).toBe(issuerCode(c.issuer));
      // the number: nine in its field, then either its check digit, or a filler and the rest with the check digit after it
      const number = mrzText(c.credentialId).replace(/</g, "");
      if (l1[14] === "<") {
        const rest = l1.slice(15).replace(/<+$/, "");
        expect(Number(rest.slice(-1))).toBe(checkDigit(l1.slice(5, 14) + rest.slice(0, -1)));
        expect(l1.slice(5, 14) + rest.slice(0, -1)).toBe(number.slice(0, 23));
      } else expect(Number(l1[14])).toBe(checkDigit(l1.slice(5, 14)));
      expect(l2.slice(0, 6)).toBe(mrzDate(c.issueDate));
      expect(Number(l2[6])).toBe(checkDigit(l2.slice(0, 6)));
      expect(l2.slice(8, 14)).toBe(mrzDate(c.expiryDate));
      expect(Number(l2[14])).toBe(checkDigit(l2.slice(8, 14)));
      expect(Number(l2[29])).toBe(compositeDigit(l1, l2));
    }
  });

  it("reads an issuer as three letters and text as MRZ characters", () => {
    expect(issuerCode("Amazon Web Services")).toBe("AWS");
    expect(issuerCode("Google Cloud")).toBe("GCL");
    expect(issuerCode("Coursera")).toBe("COU");
    expect(issuerCode("Smart India Hackathon")).toBe("SIH");
    expect(mrzText("Société Générale – Café")).toBe("SOCIETE<GENERALE<CAFE");
    expect(mrzDate(null)).toBe("<<<<<<");
  });
});

describe("the guilloche: unique to each card, the same on every build", () => {
  const ids = [...data.certificates.map((c) => c.credentialId), ...Array.from({ length: 40 }, (_, i) => `${data.certificates[i % data.certificates.length]?.credentialId}-${String(i).padStart(2, "0")}`)];

  it("is deterministic and different for every credential", () => {
    expect(guillocheFor("X-1")).toEqual(guillocheFor("X-1"));
    const looks = new Set(ids.map((id) => JSON.stringify(guillocheFor(id))));
    expect(looks.size).toBe(ids.length);
  });

  it("places its figures on the card, and draws them once in a few kilobytes", () => {
    for (const id of ids) {
      for (const u of guillocheFor(id)) {
        const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(u.transform);
        expect(Number(m?.[1])).toBeGreaterThanOrEqual(0);
        expect(Number(m?.[1])).toBeLessThanOrEqual(CARD_UNITS.width);
        expect(Number(m?.[2])).toBeGreaterThanOrEqual(0);
        expect(Number(m?.[2])).toBeLessThanOrEqual(CARD_UNITS.height);
      }
    }
    const g = guillocheFigures();
    const bytes = JSON.stringify(g).length;
    expect(bytes).toBeLessThan(8_000);
    // the wave's half-sine fit (measured within 0.3% of a sine)
    expect(SINE_FIT).toEqual({ reach: 0.4125, lift: 1.337 });
  });
});

describe("the lamp, the springs, the readout", () => {
  it("tilts to the pointer's corner and rests at the middle (§4.4)", () => {
    expect(lampAt(0.5, 0.5)).toEqual({ mx: 0.5, my: 0.5, rx: 0, ry: 0 });
    expect(lampAt(1, 0)).toEqual({ mx: 1, my: 0, rx: CRED.tilt.max, ry: CRED.tilt.max });
    expect(lampAt(-3, 9, CRED.tilt.record)).toEqual({ mx: 0, my: 1, rx: -CRED.tilt.record, ry: -CRED.tilt.record });
    expect(lampFromTilt(0, 0)).toEqual({ mx: 0.5, my: 0.5 });
    expect(lampFromTilt(CRED.gyro.rangeDeg, -CRED.gyro.rangeDeg)).toEqual({ mx: 0, my: 1 });
    expect(lampFromTilt(90, 90)).toEqual({ mx: 1, my: 1 });
  });

  it("turns the springs it animates into easings that settle inside 900 ms, the overshoot over and back", () => {
    for (const s of [springs.overshoot, springs.tilt]) {
      const r = springLinear(s);
      const v = r.easing.slice("linear(".length, -1).split(", ").map(Number);
      expect(v[0]).toBe(0);
      expect(v[v.length - 1]).toBe(1);
      expect(r.ms).toBeLessThanOrEqual(MAX_TIMED_MS);
      expect(r.reachMs).toBeLessThan(r.ms);
    }
    expect(Math.max(...springLinear(springs.overshoot).easing.slice(7, -1).split(", ").map(Number))).toBeGreaterThan(1.05);
  });

  it("reads out the wall, singular and plural", () => {
    const L = derived.site.labels.credentials.readout;
    expect(readout({ total: 12, issuers: 5, active: 11 }, L)).toBe("12 credentials / 5 issuers / 11 active");
    expect(readout({ total: 1, issuers: 1, active: 1 }, L)).toBe("1 credential / 1 issuer / 1 active");
    // the fixture's twelve: DESIGN.md's own example
    expect(readout(fixture.credentials, L)).toBe("12 credentials / 5 issuers / 11 active");
  });
});

describe("the stamps tell the truth", () => {
  // the content's own first certificate (the derived list is newest first)
  const cert = data.certificates[0];
  const at = (status: "ok" | "dead" | "skipped" | null, expired = false) => {
    if (!cert) throw new Error("fixture");
    const results: VerifyFile["results"] = status ? { [`verifyUrl:${cert.slug}`]: { kind: "verifyUrl", owner: cert.slug, target: cert.verifyUrl ?? "", status, httpStatus: null, checkedAt: null } } : {};
    const c = derive(parseContent({ ...data, certificates: [{ ...data.certificates[0], ...(expired ? { issueDate: "2020-01-01", expiryDate: "2021-01-01" } : {}) }] }), { ...overlays, verify: { version: 1, mode: "live", results } }, buildDate).certificates[0];
    if (!c) throw new Error("derive");
    return stampOf(c);
  };

  it("says VERIFIED only when the build reached the URL; an expired card says EXPIRED first", () => {
    expect(at("ok")).toBe("verified");
    expect(at("dead")).toBe("onFile");
    expect(at("skipped")).toBe("onFile");
    expect(at(null)).toBe("onFile");
    expect(at("ok", true)).toBe("expired");
  });
});

describe("RECORDS' figures: true, and never a zero", () => {
  it("leads with every record and tiles the records' own metrics, then their kinds", () => {
    const F = derived.recordFigures;
    expect(F.lead).toBe(derived.achievements.length);
    expect(F.tiles.length).toBeLessThanOrEqual(3);
    for (const t of F.tiles) expect(t.value).toBeGreaterThan(0);
    // the owner's: the hackathon's 300+ teams, then two honors and an award
    expect(F.tiles.map((t) => [t.value, t.unit, t.kind])).toEqual([
      [300, "+", null],
      [2, null, "honor"],
      [1, null, "award"],
    ]);
  });

  it("never tiles a kind that only repeats the lead", () => {
    const one = derive(parseContent({ ...data, achievements: data.achievements.slice(0, 1) }), overlays, buildDate).recordFigures;
    expect(one.lead).toBe(1);
    expect(one.tiles.every((t) => t.kind === null)).toBe(true);
  });
});

describe("the bake: the foil's diffraction grain", () => {
  it("is a 128² gray WebP of about 6 KB, the same bytes every bake", async () => {
    const file = resolve(ROOT, FOIL_GRAIN.file);
    expect(statSync(file).size).toBeLessThanOrEqual(FOIL_GRAIN.maxBytes);
    const meta = await sharp(file).metadata();
    expect([meta.width, meta.height]).toEqual([FOIL_GRAIN.size, FOIL_GRAIN.size]);
    const again = await sharp(Buffer.from(foilGrainPixels()), { raw: { width: FOIL_GRAIN.size, height: FOIL_GRAIN.size, channels: 1 } }).webp({ quality: FOIL_GRAIN.quality, effort: 6 }).toBuffer();
    expect(again.equals(readFileSync(file))).toBe(true);
  });

  it("never lets the foil drop out, and tiles: its edges meet", () => {
    const px = foilGrainPixels();
    const N = FOIL_GRAIN.size;
    expect(Math.min(...px)).toBeGreaterThanOrEqual(Math.floor(FOIL_GRAIN.floor * 255));
    // the grating's phase runs a whole number of cycles across: the last column leads into the first
    const phase = (x: number, y: number) => ((FOIL_GRAIN.cycles[0] * x + FOIL_GRAIN.cycles[1] * y) / N) % 1;
    expect(phase(N, 0)).toBeCloseTo(phase(0, 0), 9);
    expect(phase(0, N)).toBeCloseTo(phase(0, 0), 9);
  });
});

describe("a card's weight in the page (the HTML budget, §8.3)", () => {
  it("costs about a kilobyte of gzip a certificate, both faces and its guilloche", () => {
    const L = derived.site.labels.credentials;
    const html = fixture.certificates.map((c) => renderToStaticMarkup(createElement(IdCard, { c, L }))).join("");
    const perCard = gzipSync(html).length / fixture.certificates.length;
    expect(perCard).toBeLessThan(1_000);
  });
});
