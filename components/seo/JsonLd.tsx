import type { Graph } from "schema-dts";
import { serialize } from "@/lib/jsonld";

/** A page's structured data (lib/jsonld.ts): a plain <script> — data, not code, so not next/script. */
export function JsonLd({ graph }: { graph: Graph }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialize(graph) }} />;
}
