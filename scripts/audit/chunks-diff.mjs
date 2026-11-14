// first-load chunks of a route, before (a snapshot dir) and after (.next): gz sizes, the new and grown
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
const [beforeDir, afterDir = ".next", page = "index.html"] = process.argv.slice(2);
const list = (dir) => {
  const html = readFileSync(join(dir, "server/app", page), "utf8");
  return [...new Set([...html.matchAll(/<script([^>]*)src="([^"]+)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))].map((src) => {
    const f = join(dir, src.replace(/^\/_next\//, ""));
    const b = readFileSync(f);
    return { name: src.split("/").pop(), gz: gzipSync(b, { level: 9 }).length, raw: b.length, text: b.toString() };
  });
};
const a = list(beforeDir), b = list(afterDir);
const sum = (l) => (l.reduce((n, x) => n + x.gz, 0) / 1000).toFixed(1);
console.log(`before ${a.length} chunks ${sum(a)} KB · after ${b.length} chunks ${sum(b)} KB`);
const bNames = new Set(a.map((x) => x.name));
for (const x of b) if (!bNames.has(x.name)) console.log(`  new/changed ${x.name} ${(x.gz / 1000).toFixed(1)} KB gz`);
const aNames = new Set(b.map((x) => x.name));
for (const x of a) if (!aNames.has(x.name)) console.log(`  gone/changed ${x.name} ${(x.gz / 1000).toFixed(1)} KB gz`);
const marks = ["No signal", "noSignal", "skip-link", "StageBoundary", "stage failed", "no-signal", "Try again", "retry", "goto system", "sceneFailed", "holdPin", "target-touch"];
for (const m of marks) {
  const hits = b.filter((x) => x.text.includes(m)).map((x) => x.name);
  if (hits.length) console.log(`  "${m}" in ${hits.join(", ")}`);
}
