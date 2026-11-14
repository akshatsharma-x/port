"use client";

import { useEffect } from "react";

/**
 * Throws when asked (dev only) — in the browser, after hydration: the server's render is fine (a
 * 200), then the page breaks, and global-error's NO SIGNAL takes over with no status to say. An
 * effect's throw reaches the error boundary as a render's does; throwing while rendering would
 * throw during SSR too, a 500.
 */
export function Thrower({ on }: { on: boolean }) {
  useEffect(() => {
    if (on) throw new Error("dev: a client error, on purpose");
  }, [on]);
  return null;
}
