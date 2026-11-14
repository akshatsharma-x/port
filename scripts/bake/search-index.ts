import { existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { buildSearchIndex, SEARCH_INDEX_BUDGET_GZ, type IndexExtras, type SearchIndex } from "../../content/search-index";
import type { Derived } from "../../content/selectors";
import { buildInfo, installedVersion, recentCommits } from "../../lib/build-facts";
import { cellAspect, SHELL } from "../../lib/shell/config";
import { BakeError, OUT, ROOT, writeIfChanged } from "./lib";

/** search-index (DESIGN.md §8.2) → public/search-index.json, minified, ≤ 60 KB gz or the build fails. */
export function serializeSearchIndex(index: SearchIndex): { text: string; bytes: number; gzBytes: number } {
  const text = JSON.stringify(index);
  return { text, bytes: Buffer.byteLength(text), gzBytes: gzipSync(text, { level: 9 }).byteLength };
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

/** dark to light: the denser the glyph, the more light (all ASCII, all in the baked mono face) */
export const PORTRAIT_RAMP = " .:-=+*#%@";
const PORTRAIT = "public/media/profile/portrait.png";

/**
 * The About portrait as text, for neofetch: the bake's own gray portrait, contrast-stretched, one
 * glyph per cell. Its rows follow from the image's aspect and a terminal cell's (taller than wide).
 */
export async function portraitText(file: string, columns: number = SHELL.portraitColumns): Promise<string[]> {
  const meta = await sharp(file).metadata();
  if (!meta.width || !meta.height) return [];
  const rows = Math.max(1, Math.round((columns * (meta.height / meta.width)) / cellAspect));
  const data = await sharp(file).greyscale().resize(columns, rows, { fit: "fill" }).normalise().raw().toBuffer();
  const top = PORTRAIT_RAMP.length - 1;
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: columns }, (_, x) => PORTRAIT_RAMP[Math.min(top, Math.floor(((data[y * columns + x] ?? 0) / 256) * PORTRAIT_RAMP.length))]).join("").replace(/\s+$/, ""),
  );
}

/** What only the build knows (lib/build-facts.ts): the version, the stack as installed, the commits. */
export async function indexExtras(derived: Derived, root: string = ROOT): Promise<IndexExtras> {
  const b = buildInfo(root);
  const file = join(root, PORTRAIT);
  return {
    build: { version: b.version, sha: b.sha, stack: derived.site.labels.shell.stack.libraries.map((l) => ({ name: l.name, version: installedVersion(l.package, root) })) },
    commits: recentCommits(SHELL.commits, root),
    portrait: existsSync(file) ? await portraitText(file) : [],
  };
}

export async function searchIndexStep(derived: Derived): Promise<string> {
  const index = buildSearchIndex(derived, await indexExtras(derived));
  const { text, bytes, gzBytes } = serializeSearchIndex(index);
  if (gzBytes > SEARCH_INDEX_BUDGET_GZ) {
    throw new BakeError(`search index is ${kb(gzBytes)} gz — over the ${kb(SEARCH_INDEX_BUDGET_GZ)} budget (DESIGN.md §8.3). Trim long text fields.`);
  }
  const changed = await writeIfChanged(OUT.searchIndex, text);
  return `${index.docs.length} docs · ${index.cards.length} cards · ${index.commits.length} commits · ${kb(bytes)} · ${kb(gzBytes)} gz of ${kb(SEARCH_INDEX_BUDGET_GZ)}${changed ? "" : " · unchanged"}`;
}
