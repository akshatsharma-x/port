/**
 * The build-time bake (DESIGN.md §8.2, law 7). `npm run bake`, and automatically before
 * `npm run build` (prebuild) and `npm run dev` (predev, offline).
 *
 *   validate → layout-graph → citations → verify → search-index → posters (placeholders) → bluenoise → foil-grain → portrait → covers → atlases → keycaps · og (stub)
 *
 * Flags: --offline (or RETROGRADE_OFFLINE=1) keeps the last network results; --verbose prints every
 * warning. RETROGRADE_BUILD_DATE=YYYY-MM-DD pins "today". Placeholder content always bakes dry.
 */
import { performance } from "node:perf_hooks";
import { CitationsFileSchema, GraphFileSchema, VerifyFileSchema, type Content } from "../content/schema";
import { derive } from "../content/selectors";
import { citationsStep } from "./bake/citations";
import { layoutGraphStep } from "./bake/layout-graph";
import { blueNoiseStep } from "./bake/bluenoise";
import { foilGrainStep } from "./bake/foil-grain";
import { portraitStep } from "./bake/portrait";
import { coversStep } from "./bake/covers";
import { keycapsStep } from "./bake/keycaps";
import { atlasStep } from "./bake/atlases";
import { postersStep } from "./bake/posters";
import { BakeError, isoDay, OUT, readJson, resolveMode, type StepContext } from "./bake/lib";
import { searchIndexStep } from "./bake/search-index";
import { STUB_STEPS } from "./bake/stubs";
import { validateStep } from "./bake/validate";
import { verifyStep } from "./bake/verify";

const argv = process.argv.slice(2);
const verbose = argv.includes("--verbose");
const pinned = process.env.RETROGRADE_BUILD_DATE;
const now = pinned ? new Date(`${pinned}T00:00:00Z`) : new Date();
if (Number.isNaN(now.getTime())) throw new Error(`RETROGRADE_BUILD_DATE must be YYYY-MM-DD, got "${pinned}"`);

const warnings: string[] = [];
const warn = (message: string) => warnings.push(message);

const NAME_WIDTH = 13;
const print = (tag: string, name: string, text: string, ms?: number) =>
  console.log(`  ${tag.padEnd(5)} ${name.padEnd(NAME_WIDTH)} ${text}${ms === undefined ? "" : `  (${Math.round(ms)} ms)`}`);

async function step<T>(name: string, run: () => Promise<T> | T, describe: (value: T) => string): Promise<T> {
  const t = performance.now();
  try {
    const value = await run();
    print("ok", name, describe(value), performance.now() - t);
    return value;
  } catch (error) {
    print("FAIL", name, error instanceof BakeError ? error.message : "unexpected error", performance.now() - t);
    throw error;
  }
}

function printWarnings() {
  if (!warnings.length) return;
  const byArea = new Map<string, string[]>();
  for (const w of warnings) {
    const area = /^(\w[\w-]*):/.exec(w)?.[1] ?? "other";
    byArea.set(area, [...(byArea.get(area) ?? []), w]);
  }
  for (const [area, list] of byArea) {
    const shown = verbose ? list : list.slice(0, 3);
    for (const w of shown) print("warn", area, w.slice(area.length + 1).trim());
    if (shown.length < list.length) print("warn", area, `+${list.length - shown.length} more (npm run bake -- --verbose, or /dev/content)`);
  }
}

async function main() {
  const t0 = performance.now();
  const { content } = await step<{ content: Content; summary: string }>("validate", () => validateStep(warn), (v) => v.summary);
  const mode = resolveMode(argv, process.env, content.isPlaceholder);
  console.log(`  mode  ${mode}${content.isPlaceholder ? " (IS_PLACEHOLDER — see CONTENT_INTAKE.md)" : ""} · today ${isoDay(now)}`);
  const ctx: StepContext = { mode, now, fetch: globalThis.fetch.bind(globalThis), warn };

  await step("layout-graph", () => layoutGraphStep(content), (s) => s);
  await step("citations", () => citationsStep(content, ctx), (s) => s);
  await step("verify", () => verifyStep(content, ctx), (s) => s);
  await step(
    "search-index",
    async () => {
      // derive() over the files this run just wrote: the index sees the same numbers the page will
      const overlays = {
        citations: CitationsFileSchema.parse(await readJson(OUT.citations)),
        verify: VerifyFileSchema.parse(await readJson(OUT.verify)),
        graph: GraphFileSchema.parse(await readJson(OUT.graph)),
      };
      return searchIndexStep(derive(content, overlays, now));
    },
    (s) => s,
  );
  await step("posters", postersStep, (s) => s);
  await step("bluenoise", blueNoiseStep, (s) => s);
  await step("foil-grain", foilGrainStep, (s) => s);
  await step("portrait", portraitStep, (s) => s);
  await step("covers", () => coversStep(), (s) => s);
  await step("atlases", () => atlasStep(), (s) => s);
  await step("keycaps", () => keycapsStep(), (s) => s);
  for (const stub of STUB_STEPS) print("todo", stub.name, `${stub.summary} (${stub.part})`);

  printWarnings();
  console.log(`  done in ${Math.round(performance.now() - t0)} ms · ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`);
}

console.log("RETROGRADE bake");
main().catch((error: unknown) => {
  printWarnings();
  if (!(error instanceof BakeError)) console.error(error);
  console.error("  bake failed — the build stops here.");
  process.exitCode = 1;
});
