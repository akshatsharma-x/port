import "server-only";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * HALT's build line (DESIGN.md §7.4: `v1.0 · {sha} · DEPLOYED 2026-11-10 · NEXT 16 · THREE r187`),
 * read at build, all true: the version and the stack from package.json, the commit from the
 * deploy (Vercel's VERCEL_GIT_COMMIT_SHA) or the working copy's git — a "+" when it has uncommitted
 * changes — and the date the content was built for.
 */
export interface BuildInfo {
  version: string;
  sha: string | null;
  next: string;
  three: string;
}

const git = (args: string[]): string | null => {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
};

let cached: BuildInfo | null = null;
export function buildInfo(): BuildInfo {
  if (cached) return cached;
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string; dependencies: Record<string, string> };
  const major = (range: string | undefined) => (range ?? "").replace(/^[^\d]*/, "").split(".");
  const fromDeploy = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const head = fromDeploy ?? git(["rev-parse", "--short", "HEAD"]);
  const dirty = !fromDeploy && head !== null && (git(["status", "--porcelain"]) ?? "") !== "";
  cached = {
    version: pkg.version,
    sha: head ? `${head}${dirty ? "+" : ""}` : null,
    next: major(pkg.dependencies.next)[0] ?? "",
    three: `r${major(pkg.dependencies.three)[1] ?? ""}`,
  };
  return cached;
}
