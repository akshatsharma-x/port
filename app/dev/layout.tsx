import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** /dev/* is for review only: 404 in production unless RETROGRADE_DEV_ROUTES=1. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.RETROGRADE_DEV_ROUTES !== "1") notFound();
  return children;
}
