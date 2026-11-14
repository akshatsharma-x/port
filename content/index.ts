import { data, IS_PLACEHOLDER } from "./data";
import { parseContent, type Content } from "./schema";

/**
 * The validated dataset. Importing this module parses content/data.ts against the schema and
 * throws a readable, path-annotated error on any problem — so `next build` fails loudly too, not
 * only the prebuild bake. Sections never import this directly: they read content/derive.ts.
 */
export const content: Content = parseContent(data);

export { IS_PLACEHOLDER };
