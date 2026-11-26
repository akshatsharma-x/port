import { Grid } from "@/components/ui/Grid";
import { Text } from "@/components/ui/Text";
import type { Derived } from "@/content/selectors";
import { readout } from "@/lib/credentials";
import { CredentialsEnhance } from "./CredentialsEnhance";
import { CredDefs } from "./Defs";
import { idCardHtml } from "./IdCard";
import { Records } from "./Records";

/**
 * 07 · CREDENTIALS (DESIGN.md §7.4, §4.4 B1/B2) — Tier B, no canvas. Server HTML throughout:
 *   - the wall, when there are certificates (never "0 CREDENTIALS": the owner's call, v2.2): the
 *     readout from derive.ts, the chips by issuer, domain and level, and an ID-1 card per certificate
 *   - RECORDS: the figures, the record cards, the press, the transmissions
 * Their behaviour — the tilt and live foil, the turn, the chips' FLIP, the deal, the phones' tilt
 * chip — loads on idle (CredentialsEnhance), never in first-load JS.
 */
export function Credentials({ d }: { d: Derived }) {
  const L = d.site.labels.credentials;
  const certs = d.certificates;
  const groups = [
    { key: "issuer", label: L.filters.issuer, values: d.credentials.byIssuer.map((g) => g.value) },
    { key: "domain", label: L.filters.domain, values: d.credentials.byDomain.map((g) => g.value) },
    { key: "level", label: L.filters.level, values: [...new Set(certs.map((c) => c.level))] },
  ] as const;
  const text = (key: (typeof groups)[number]["key"], v: string) => (key === "level" ? L.levels[v as keyof typeof L.levels] : v);
  return (
    <>
      {certs.length > 0 && (
        <section className="cred-wall-wrap" aria-label={L.wall} data-cred-root="">
          <CredDefs />
          <Grid className="cred-head">
            <p className="cred-readout col-span-12 t-micro">{readout(d.credentials, L.readout)}</p>
            <div className="cred-filters col-span-12" role="group" aria-label={L.filters.label}>
              {groups.map((g) =>
                g.values.length > 1 ? (
                  <div key={g.key} className="cred-filters__group">
                    <span className="t-micro">{g.label}</span>
                    {["", ...g.values].map((v) => (
                      <button key={v || "all"} type="button" className="chip chip--toggle t-micro" data-filter={g.key} data-value={v} aria-pressed={v === "" ? "true" : "false"}>
                        <span aria-hidden="true">{v === "" ? "■" : "□"}</span>
                        {v === "" ? L.filters.all : text(g.key, v)}
                      </button>
                    ))}
                  </div>
                ) : null,
              )}
              <p className="cred-count t-micro" data-cred-count="" aria-live="polite" />
            </div>
            <button type="button" className="cred-tilt chip t-micro col-span-12" data-cred-tilt="" hidden>
              {L.tilt.ask}
            </button>
          </Grid>
          {/* the cards as one string of server HTML (v2.8, IdCard.tsx): carried once in the RSC payload, not hydrated */}
          <ul className="cred-wall" dangerouslySetInnerHTML={{ __html: certs.map((c) => idCardHtml(c, L)).join("") }} />
          <p className="cred-none t-small" data-cred-none="" hidden>
            {L.none}
          </p>
        </section>
      )}
      {d.achievements.length > 0 && <Records d={d} />}
      {certs.length === 0 && d.achievements.length === 0 && (
        <Grid className="py-section-y">
          <Text as="p" step="lead" tone="fg-2" className="col-span-12">
            {d.site.labels.records.empty}
          </Text>
        </Grid>
      )}
      {(certs.length > 0 || d.achievements.length > 0) && <CredentialsEnhance labels={{ of: L.filters.of, shown: L.filters.shown, tilt: L.tilt, total: certs.length }} />}
    </>
  );
}
