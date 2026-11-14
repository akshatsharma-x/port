/**
 * The site's address (PROMPTS.md Part 15): every canonical, Open Graph, JSON-LD and sitemap URL is
 * built on it.
 *   1. NEXT_PUBLIC_SITE_URL, once the site has a domain of its own;
 *   2. on Vercel, the project's production URL (VERCEL_PROJECT_PRODUCTION_URL, set for previews too,
 *      so a preview's canonicals already point at the site);
 *   3. the local server (PORT, else 3000).
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  if (env.NEXT_PUBLIC_SITE_URL) return new URL(env.NEXT_PUBLIC_SITE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL(`http://localhost:${env.PORT ?? 3000}`);
}

export const SITE_URL = siteUrl();

/** An absolute URL on the site, for the places that want one (sitemap, JSON-LD, the cards). */
export const absolute = (path: string): string => new URL(path, SITE_URL).toString();

/**
 * Whether search engines may index this build: a Vercel preview is not the site (noindex, and
 * robots.txt says so); production and every local build are (a local build is what Lighthouse
 * audits, and it must read as the site would).
 */
export function indexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "production";
}

/** The host, for a card's footer — none for a local server, whose address means nothing shared. */
export const shareHost = (url: URL = SITE_URL): string | null => (url.hostname === "localhost" ? null : url.host);
