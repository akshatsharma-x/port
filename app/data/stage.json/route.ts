import { derived } from "@/content/derive";
import { stageData } from "@/content/stage-data";

/** The stage's data file (content/stage-data.ts), prerendered at build: a static JSON file. */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(stageData(derived));
}
