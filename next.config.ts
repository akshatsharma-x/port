import type { NextConfig } from "next";

/**
 * Security headers on every response (PROMPTS.md Part 15), whatever the host: no MIME sniffing, a
 * referrer that leaves only the origin across sites, never framed. Permissions-Policy closes the
 * sensors the site never asks for (camera, microphone, location, payment, USB); device motion stays
 * open — the credential cards' gyro tilt asks for it on a tap (DESIGN.md §7.4 CREDENTIALS).
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
