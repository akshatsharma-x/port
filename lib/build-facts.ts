import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * What only the build knows, all true: the version and the stack from package.json, the commit
 * from the deploy (Vercel's VERCEL_GIT_COMMIT_SHA) or the working copy's git (a "+" when it has
 * uncommitted changes), the installed packages' versions, and the latest commits. HALT's build line
 * reads it through lib/build-info.ts (server-only); the bake reads it here for the terminal's index.
 */
export interface BuildInfo {
  version: string;
  sha: string | null;
  next: string;
  three: string;
}

const git = (args: string[], root: string): string | null => {
  try {
    return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
};

const cache = new Map<string, BuildInfo>();
export function buildInfo(root: string = process.cwd()): BuildInfo {
  const hit = cache.get(root);
  if (hit) return hit;
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string; dependencies: Record<string, string> };
  const major = (range: string | undefined) => (range ?? "").replace(/^[^\d]*/, "").split(".");
  const fromDeploy = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const head = fromDeploy ?? git(["rev-parse", "--short", "HEAD"], root);
  const dirty = !fromDeploy && head !== null && (git(["status", "--porcelain"], root) ?? "") !== "";
  const info: BuildInfo = {
    version: pkg.version,
    sha: head ? `${head}${dirty ? "+" : ""}` : null,
    next: major(pkg.dependencies.next)[0] ?? "",
    three: `r${major(pkg.dependencies.three)[1] ?? ""}`,
  };
  cache.set(root, info);
  return info;
}

/** The version of a package as installed (what the build was built against), or null. */
export function installedVersion(pkg: string, root: string = process.cwd()): string | null {
  try {
    return (JSON.parse(readFileSync(join(root, "node_modules", pkg, "package.json"), "utf8")) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

/** The latest commits' short hashes, newest first: a deploy's shallow clone has fewer, a tarball none. */
export function recentCommits(count: number, root: string = process.cwd()): string[] {
  const log = git(["log", `-n${count}`, "--format=%h"], root);
  if (log) return log.split("\n").filter(Boolean);
  const sha = buildInfo(root).sha;
  return sha ? [sha.replace(/\+$/, "")] : [];
}
