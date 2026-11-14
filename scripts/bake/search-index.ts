import { gzipSync } from "node:zlib";
import { buildSearchIndex, SEARCH_INDEX_BUDGET_GZ, type SearchIndex } from "../../content/search-index";
import type { Derived } from "../../content/selectors";
import { BakeError, OUT, writeIfChanged } from "./lib";

/** search-index (DESIGN.md §8.2) → public/search-index.json, minified, ≤ 60 KB gz or the build fails. */
export function serializeSearchIndex(index: SearchIndex): { text: string; bytes: number; gzBytes: number } {
  const text = JSON.stringify(index);
  return { text, bytes: Buffer.byteLength(text), gzBytes: gzipSync(text, { level: 9 }).byteLength };
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

export async function searchIndexStep(derived: Derived): Promise<string> {
  const index = buildSearchIndex(derived);
  const { text, bytes, gzBytes } = serializeSearchIndex(index);
  if (gzBytes > SEARCH_INDEX_BUDGET_GZ) {
    throw new BakeError(`search index is ${kb(gzBytes)} gz — over the ${kb(SEARCH_INDEX_BUDGET_GZ)} budget (DESIGN.md §8.3). Trim long text fields.`);
  }
  const changed = await writeIfChanged(OUT.searchIndex, text);
  return `${index.docs.length} docs · ${kb(bytes)} · ${kb(gzBytes)} gz of ${kb(SEARCH_INDEX_BUDGET_GZ)}${changed ? "" : " · unchanged"}`;
}
