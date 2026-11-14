import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import citationsJson from "@/content/citations.json";
import { data as real } from "@/content/data";
import { data } from "./fixtures/placeholder-content";
import { buildGraphModel } from "@/content/graph";
import { CitationsFileSchema, GraphFileSchema, parseContent, VENUE_TYPES, VerifyFileSchema, type CitationsFile, type VerifyFile } from "@/content/schema";
import { buildSearchIndex, SEARCH_INDEX_BUDGET_GZ } from "@/content/search-index";
import { derive } from "@/content/selectors";
import verifyJson from "@/content/verify.json";
import { DRY_CITATIONS, openAlexUrl, refreshCitations } from "../scripts/bake/citations";
import { LAYOUT_RADIUS, layoutGraph, SEED } from "../scripts/bake/layout-graph";
import { CONCURRENCY, formatJson, resolveMode, type Fetch, type StepContext } from "../scripts/bake/lib";
import { serializeSearchIndex } from "../scripts/bake/search-index";
import { ARXIV_ABS, classify, DOI_HANDLE_API, dryVerify, verifyLinks, verifyTargets } from "../scripts/bake/verify";

/**
 * The bake (DESIGN.md §8.2): deterministic layouts, a committed graph.json that matches the
 * content, an index inside its budget, and network steps that degrade — never invent — when the
 * network misbehaves. Network steps run against a fake fetch.
 */
const ROOT = resolve(__dirname, "..");
const NOW = new Date("2026-11-10T00:00:00Z");
const TODAY = "2026-11-10";
const content = parseContent(data);
const model = buildGraphModel(content.publications);

type Vec3 = [number, number, number];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ── fake network ─────────────────────────────────────────────────────────────────────────────
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const down = (): never => {
  throw new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND") });
};
function fake(handler: (url: string, init?: RequestInit) => Response) {
  const calls: string[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push(url);
    return handler(url, init);
  };
  return { fetch, calls };
}
function context(fetch: Fetch, mode: StepContext["mode"] = "live") {
  const warnings: string[] = [];
  return { ctx: { mode, now: NOW, fetch, warn: (m: string) => warnings.push(m) } satisfies StepContext, warnings };
}
const healthy = (url: string, init?: RequestInit) => {
  if (url.startsWith("https://api.openalex.org/")) return json({ id: "https://openalex.org/W42", doi: "x", cited_by_count: 77 });
  if (url.startsWith(DOI_HANDLE_API)) return json({ responseCode: 1 });
  if (url.startsWith(ARXIV_ABS)) return new Response(null, { status: init?.method === "HEAD" ? 200 : 200 });
  return new Response("<html></html>", { status: 200 });
};

describe("layout-graph — deterministic, fresh, sane", () => {
  it("same input → byte-identical output", () => {
    expect(formatJson(layoutGraph(model))).toBe(formatJson(layoutGraph(buildGraphModel(parseContent(data).publications))));
  });

  it("the committed content/graph.json matches the current content (run `npm run bake` if not)", () => {
    const committed = readFileSync(join(ROOT, "content/graph.json"), "utf8");
    expect(committed).toBe(formatJson(layoutGraph(buildGraphModel(parseContent(real).publications))));
    expect(GraphFileSchema.safeParse(JSON.parse(committed)).success).toBe(true);
  });

  it("gives every node three finite coordinate sets inside the layout radius", () => {
    const g = layoutGraph(model);
    expect(g.nodes.map((n) => n.id)).toEqual(model.nodes.map((n) => n.id));
    for (const n of g.nodes) {
      for (const p of [n.layouts.topic, n.layouts.year, n.layouts.venue]) {
        expect(p.every(Number.isFinite)).toBe(true);
        expect(Math.hypot(...p)).toBeLessThanOrEqual(LAYOUT_RADIUS + 1e-3);
      }
    }
  });

  it("TOPIC: papers sit closer to their own cluster than to the others", () => {
    const g = layoutGraph(model);
    const pos = new Map(g.nodes.map((n) => [n.id, n.layouts.topic]));
    let within = 0;
    let withinN = 0;
    let across = 0;
    let acrossN = 0;
    for (const a of model.nodes) {
      for (const b of model.nodes) {
        if (a.id >= b.id) continue;
        const d = dist(pos.get(a.id) as Vec3, pos.get(b.id) as Vec3);
        if (a.cluster === b.cluster) {
          within += d;
          withinN++;
        } else {
          across += d;
          acrossN++;
        }
      }
    }
    expect(within / withinN).toBeLessThan(0.75 * (across / acrossN));
  });

  it("YEAR orders x by year; VENUE orders columns by venue type", () => {
    const g = layoutGraph(model);
    const node = (id: string) => model.nodes.find((n) => n.id === id);
    const byYear = [...g.nodes].sort((a, b) => a.layouts.year[0] - b.layouts.year[0]).map((n) => node(n.id)?.year ?? 0);
    expect(byYear).toEqual([...byYear].sort((a, b) => a - b));
    const order = (t: string) => VENUE_TYPES.indexOf(t as (typeof VENUE_TYPES)[number]);
    const byX = [...g.nodes].sort((a, b) => a.layouts.venue[0] - b.layouts.venue[0]).map((n) => order(node(n.id)?.venueType ?? ""));
    expect(byX).toEqual([...byX].sort((a, b) => a - b));
    expect(g.labels.year.map((l) => l.id)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(g.labels.topic.map((l) => l.id)).toEqual(Object.keys(content.site.topicClusters).sort());
  });

  it("the seed moves TOPIC only; the lattices are seed-free", () => {
    const a = layoutGraph(model, SEED);
    const b = layoutGraph(model, SEED + 1);
    expect(a.nodes.map((n) => n.layouts.topic)).not.toEqual(b.nodes.map((n) => n.layouts.topic));
    expect(a.nodes.map((n) => [n.layouts.year, n.layouts.venue])).toEqual(b.nodes.map((n) => [n.layouts.year, n.layouts.venue]));
  });

  it("copes with zero and one paper", () => {
    expect(layoutGraph(buildGraphModel([])).nodes).toEqual([]);
    const one = layoutGraph(buildGraphModel(content.publications.slice(0, 1)));
    expect(one.nodes[0]?.layouts.topic).toEqual([0, 0, 0]);
    expect(one.edges).toEqual([]);
  });
});

describe("citations — OpenAlex, never fatal", () => {
  const withDoi = content.publications.filter((p) => p.doi);

  it("dry mode touches no network and defers to content/data.ts", async () => {
    const { fetch, calls } = fake(healthy);
    const { file } = await refreshCitations(content, null, context(fetch, "dry").ctx);
    expect(calls).toEqual([]);
    expect(file).toEqual(DRY_CITATIONS);
  });

  it("live: one request per DOI; counts stamped with today's date", async () => {
    const { fetch, calls } = fake(healthy);
    const { file } = await refreshCitations(content, null, context(fetch).ctx);
    expect(calls).toHaveLength(withDoi.length);
    expect(file).toMatchObject({ mode: "live", source: "OpenAlex", asOf: TODAY });
    expect(Object.keys(file.counts).sort()).toEqual(withDoi.map((p) => p.slug).sort());
    expect(Object.values(file.counts).every((c) => c.citations === 77 && c.openalexId === "W42" && c.asOf === TODAY)).toBe(true);
    expect(CitationsFileSchema.safeParse(file).success).toBe(true);
  });

  it("live: a DOI OpenAlex doesn't know keeps its data.ts count, with a warning", async () => {
    const missing = withDoi[0]?.doi ?? "";
    const { fetch } = fake((url, init) => (url.includes(missing.split("/")[1] ?? "§") ? json({ error: "not found" }, 404) : healthy(url, init)));
    const { ctx, warnings } = context(fetch);
    const { file } = await refreshCitations(content, null, ctx);
    expect(file.counts[withDoi[0]?.slug ?? ""]).toBeUndefined();
    expect(warnings.join("\n")).toMatch(/has no record/);
  });

  it("unreachable: keeps the last values and their dates, warns, and stops early", async () => {
    const previous: CitationsFile = {
      version: 1,
      mode: "live",
      source: "OpenAlex",
      asOf: "2026-10-01",
      counts: Object.fromEntries(withDoi.map((p) => [p.slug, { doi: p.doi ?? "", citations: 5, openalexId: "W1", asOf: "2026-10-01" }])),
      cited: {},
    };
    const { fetch, calls } = fake(down);
    const { ctx, warnings } = context(fetch);
    const { file } = await refreshCitations(content, previous, ctx);
    expect(file).toEqual(previous);
    expect(calls.length).toBeLessThanOrEqual(CONCURRENCY);
    expect(warnings.join("\n")).toMatch(/unreachable/);
  });

  it("a server error keeps that paper's last value", async () => {
    const victim = withDoi[0];
    if (!victim?.doi) throw new Error("fixture needs a DOI");
    const previous: CitationsFile = { version: 1, mode: "live", source: "OpenAlex", asOf: "2026-10-01", counts: { [victim.slug]: { doi: victim.doi, citations: 5, openalexId: "W1", asOf: "2026-10-01" } }, cited: {} };
    const { fetch } = fake((url, init) => (url.includes(victim.doi?.split("/")[1] ?? "§") ? new Response("", { status: 503 }) : healthy(url, init)));
    const { file } = await refreshCitations(content, previous, context(fetch).ctx);
    expect(file.counts[victim.slug]).toEqual(previous.counts[victim.slug]);
  });

  it("live: the works my papers cite are read too, by DOI (their stars' sizes); one without a DOI stays unknown", async () => {
    const by = withDoi[0]?.slug ?? content.publications[0]?.slug ?? "";
    const withCited = {
      ...content,
      citedWorks: [
        { id: "ref-counted", title: "A cited work", authors: "A. B.", year: 2001, venue: "A journal", venueType: "journal" as const, doi: "10.1000/ref-counted", citedBy: [by] },
        { id: "ref-unknown", title: "A cited report", authors: "C. D.", year: 1999, venue: "An agency", venueType: "other" as const, citedBy: [by] },
      ],
    };
    const { fetch, calls } = fake(healthy);
    const { file, summary } = await refreshCitations(withCited, null, context(fetch).ctx);
    expect(calls).toHaveLength(withDoi.length + 1);
    expect(file.cited["ref-counted"]).toEqual({ doi: "10.1000/ref-counted", citations: 77, openalexId: "W42", asOf: TODAY });
    expect(file.cited["ref-unknown"]).toBeUndefined();
    expect(Object.keys(file.counts).sort()).toEqual(withDoi.map((p) => p.slug).sort());
    expect(summary).toMatch(/cited works 1\/1/);
    expect(CitationsFileSchema.safeParse(file).success).toBe(true);
  });

  it("offline mode keeps the previous file untouched", async () => {
    const { fetch, calls } = fake(healthy);
    const previous = CitationsFileSchema.parse(citationsJson);
    const { file } = await refreshCitations(content, previous, context(fetch, "offline").ctx);
    expect(calls).toEqual([]);
    expect(file).toEqual(previous);
  });

  it("builds the OpenAlex URL by DOI, with the polite-pool mailto when set", () => {
    const url = new URL(openAlexUrl("10.1145/3544548.3580001", { OPENALEX_MAILTO: "me@example.org" }));
    expect(url.pathname).toBe("/works/doi:10.1145/3544548.3580001");
    expect(url.searchParams.get("select")).toBe("id,doi,cited_by_count");
    expect(url.searchParams.get("mailto")).toBe("me@example.org");
  });
});

describe("verify — dead DOIs fail, dead credentials downgrade", () => {
  const targets = verifyTargets(content);

  it("covers every DOI, arXiv id and verifyUrl", () => {
    const dois = content.publications.filter((p) => p.doi).length;
    const arxiv = content.publications.filter((p) => p.arxivId).length;
    const urls = content.certificates.filter((c) => c.verifyUrl).length;
    expect(targets).toHaveLength(dois + arxiv + urls);
  });

  it("dry mode skips everything, with no network", async () => {
    const { fetch, calls } = fake(healthy);
    const { file, failures } = await verifyLinks(content, null, context(fetch, "dry").ctx);
    expect(calls).toEqual([]);
    expect(failures).toEqual([]);
    expect(file).toEqual(dryVerify(content));
    // the committed file covers exactly the real content's targets, whichever mode last wrote it
    const committed = VerifyFileSchema.parse(verifyJson);
    expect(Object.keys(committed.results).sort()).toEqual(verifyTargets(parseContent(real)).map((t) => t.key).sort());
  });

  it("live and healthy: every check ok, stamped today", async () => {
    const { fetch } = fake(healthy);
    const { file, failures } = await verifyLinks(content, null, context(fetch).ctx);
    expect(failures).toEqual([]);
    expect(Object.values(file.results).every((r) => r.status === "ok" && r.checkedAt === TODAY)).toBe(true);
  });

  it("a dead DOI is a build failure", async () => {
    const dead = content.publications.find((p) => p.doi)?.doi ?? "";
    const { fetch } = fake((url, init) => (url === `${DOI_HANDLE_API}/${dead}` ? json({ responseCode: 100, handle: dead }, 404) : healthy(url, init)));
    const { failures, file } = await verifyLinks(content, null, context(fetch).ctx);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(new RegExp(`DOI ${dead.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} on .* does not resolve`));
    expect(file.results[`doi:${dead}`]?.status).toBe("dead");
  });

  it("a dead or blocked verify URL warns and downgrades to ON FILE — never fails", async () => {
    const certs = content.certificates.filter((c) => c.verifyUrl);
    const [deadCert, blockedCert] = certs;
    const { fetch } = fake((url, init) => (url === deadCert?.verifyUrl ? new Response("", { status: 404 }) : url === blockedCert?.verifyUrl ? new Response("", { status: 403 }) : healthy(url, init)));
    const { ctx, warnings } = context(fetch);
    const { file, failures } = await verifyLinks(content, null, ctx);
    expect(failures).toEqual([]);
    expect(file.results[`verifyUrl:${deadCert?.slug}`]?.status).toBe("dead");
    expect(file.results[`verifyUrl:${blockedCert?.slug}`]?.status).toBe("blocked");
    expect(warnings.filter((w) => /shows ON FILE/.test(w))).toHaveLength(2);
    const certsAfter = derive(content, { citations: DRY_CITATIONS, verify: file, graph: layoutGraph(model) }, NOW).certificates;
    expect(certsAfter.find((c) => c.slug === deadCert?.slug)?.verification).toBe("onFile");
    expect(certsAfter.find((c) => c.slug === certs[2]?.slug)?.verification).toBe("verified");
  });

  it("no network: keeps earlier results, fails nothing", async () => {
    const previous: VerifyFile = {
      version: 1,
      mode: "live",
      results: Object.fromEntries(targets.map((t) => [t.key, { kind: t.kind, owner: t.owner, target: t.target, status: "ok" as const, httpStatus: 200, checkedAt: "2026-10-01" }])),
    };
    const { fetch } = fake(down);
    const { ctx, warnings } = context(fetch);
    const { file, failures } = await verifyLinks(content, previous, ctx);
    expect(failures).toEqual([]);
    expect(file.results).toEqual(previous.results);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("classifies responses", () => {
    const res = (status: number, body = "") => ({ kind: "response" as const, status, body });
    expect(classify("doi", res(200, '{"responseCode":1}'))).toBe("ok");
    expect(classify("doi", res(404, '{"responseCode":100}'))).toBe("dead");
    expect(classify("doi", res(503))).toBe("unreachable");
    expect(classify("arxiv", res(404))).toBe("dead");
    expect(classify("verifyUrl", res(999))).toBe("blocked");
    expect(classify("verifyUrl", res(410))).toBe("dead");
    expect(classify("verifyUrl", { kind: "network", reason: "timeout" })).toBe("unreachable");
  });
});

describe("search index — the terminal's view, inside its budget", () => {
  const index = buildSearchIndex(derive(content, { citations: DRY_CITATIONS, verify: dryVerify(content), graph: layoutGraph(model) }, NOW));
  const { gzBytes } = serializeSearchIndex(index);

  it(`stays ≤ ${SEARCH_INDEX_BUDGET_GZ / 1024} KB gzipped`, () => {
    expect(gzBytes).toBeLessThanOrEqual(SEARCH_INDEX_BUDGET_GZ);
  });

  it("has one doc per record, with unique ids", () => {
    const c = content;
    const expected = c.publications.length + c.projects.length + c.experience.length + c.education.length + c.skills.length + c.certificates.length + c.achievements.length + c.testimonials.length;
    expect(index.docs).toHaveLength(expected);
    expect(new Set(index.docs.map((x) => x.id)).size).toBe(expected);
  });

  it("carries what cite, verify and scholar print", () => {
    const paper = index.docs.find((x) => x.kind === "paper");
    expect(paper?.kind === "paper" && paper.bibtex.startsWith("@")).toBe(true);
    const cert = index.docs.find((x) => x.kind === "cert");
    expect(cert?.kind === "cert" && cert.credentialId.length > 0).toBe(true);
    expect(index.metrics.research).toMatchObject({ citations: 246, hIndex: 6, i10: 4 });
    expect(index.metrics.research.provenance.sources).toEqual(["Placeholder"]);
  });

  it("links each record to the route that shows it", () => {
    for (const x of index.docs) {
      if (x.kind === "paper") expect(x.href).toBe(`/research/${x.slug}`);
      else if (x.kind === "project") expect(x.href).toBe(`/work/${x.slug}`);
      else expect(x.href).toBe(`/#${x.section}`);
    }
  });
});

describe("modes", () => {
  it("placeholder content always bakes dry; --offline or the env var forces offline", () => {
    expect(resolveMode([], {}, true)).toBe("dry");
    expect(resolveMode(["--offline"], {}, true)).toBe("dry");
    expect(resolveMode([], {}, false)).toBe("live");
    expect(resolveMode(["--offline"], {}, false)).toBe("offline");
    expect(resolveMode([], { RETROGRADE_OFFLINE: "1" }, false)).toBe("offline");
  });

  it("formatJson round-trips and is stable", () => {
    const value = { a: [1, 2, { b: "x".repeat(200) }], c: null, d: {} };
    expect(JSON.parse(formatJson(value))).toEqual(value);
    expect(formatJson(value)).toBe(formatJson(structuredClone(value)));
  });
});
