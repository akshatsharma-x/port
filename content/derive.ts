import citationsJson from "./citations.json";
import graphJson from "./graph.json";
import { content } from "./index";
import nameFitJson from "./name-fit.json";
import { NameFitFileSchema } from "./name-fit";
import { CitationsFileSchema, GraphFileSchema, VerifyFileSchema } from "./schema";
import { derive, type Overlays } from "./selectors";
import verifyJson from "./verify.json";

/**
 * Everything the sections read, computed once per build from the validated content and the
 * files the bake wrote (content/{graph,citations,verify}.json). Server-only by convention:
 * client components receive slices as props, so content never ships as JavaScript
 * (tests/content-boundary.test.ts enforces it).
 *
 * Numbers are true as of the build date (RETROGRADE_BUILD_DATE=YYYY-MM-DD pins it).
 */
export * from "./selectors";
/** the validated input, for the /dev/content audit; sections read `derived` */
export { content };

const pinned = process.env.RETROGRADE_BUILD_DATE;
export const buildDate = pinned ? new Date(`${pinned}T00:00:00Z`) : new Date();

export const overlays: Overlays = {
  citations: CitationsFileSchema.parse(citationsJson),
  verify: VerifyFileSchema.parse(verifyJson),
  graph: GraphFileSchema.parse(graphJson),
};

export const derived = derive(content, overlays, buildDate);

/** The hero name's width model (scripts/fonts/name-fit.ts) — measured for this exact name. */
export const nameFit = NameFitFileSchema.parse(nameFitJson);
if (nameFit.text !== content.profile.name.toUpperCase()) {
  const message = `content/name-fit.json is for "${nameFit.text}", not the current name — run \`npx tsx scripts/fonts/name-fit.ts\`.`;
  if (process.env.NODE_ENV === "production") throw new Error(message);
  console.warn(`[content] ${message}`);
}

if (derived.graph.stale) {
  const message = "content/graph.json is stale for the current publications — run `npm run bake`.";
  // A production build runs the bake first (prebuild), so stale here means a mismatch: fail loudly.
  if (process.env.NODE_ENV === "production") throw new Error(message);
  console.warn(`[content] ${message}`);
}
