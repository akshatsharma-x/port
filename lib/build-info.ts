import "server-only";

/**
 * HALT's build line (DESIGN.md §7.4: `v1.0 · {sha} · DEPLOYED 2026-11-10 · NEXT 16 · THREE r187`),
 * read at build from lib/build-facts.ts. Server-only: it runs git and reads the file system.
 */
export { buildInfo, type BuildInfo } from "./build-facts";
