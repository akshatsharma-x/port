"use client";

import { useEffect, useRef, useState } from "react";

export interface InViewOptions {
  /** how far outside the viewport counts as "in view" (mount heavy children early) */
  rootMargin?: string;
  threshold?: number;
  /** stay mounted after the first intersection */
  once?: boolean;
}

/**
 * Mounts heavy children only near the viewport and unmounts them when they leave (unless `once`).
 * Returns [ref, inView]; render `{inView && <Heavy />}`.
 */
export function useInViewMount<T extends Element>({ rootMargin = "50% 0px", threshold = 0, once = false }: InViewOptions = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, threshold, once]);

  return [ref, inView] as const;
}
