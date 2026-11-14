import type { MetadataRoute } from "next";
import { absolute, indexable } from "@/lib/site";

/**
 * robots.txt (PROMPTS.md Part 15): the site is open to every crawler but its review pages and its
 * one endpoint; a Vercel preview isn't the site, so it's closed (lib/site.ts indexable).
 */
export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/dev/", "/api/"] }, sitemap: absolute("/sitemap.xml") };
}
