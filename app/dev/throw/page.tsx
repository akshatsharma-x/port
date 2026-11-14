import { Thrower } from "./Thrower";

/**
 * Dev only (RETROGRADE_DEV_ROUTES=1): a page that throws, for the NO SIGNAL error page's gate.
 *   /dev/throw?at=server — a server error (a 500 with a digest)
 *   /dev/throw?at=client — a client component throws while rendering (no status: none is said)
 * Reading searchParams makes it render per request, so the build never meets the throw.
 */
export default async function ThrowPage({ searchParams }: { searchParams: Promise<{ at?: string }> }) {
  const { at } = await searchParams;
  if (at === "server") throw new Error("dev: a server error, on purpose");
  return <Thrower on={at === "client"} />;
}
