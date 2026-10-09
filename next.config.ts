import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here is meant to be framed; this also rules out clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          // The parts of a CSP that can't break the app: no <base> hijack, no
          // plugins, no framing, and forms only post back to this site.
          // Scripts aren't restricted (Next's inline bootstrap would need
          // per-request nonces); React's escaping is the XSS guard there.
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
  experimental: {
    // Let the client Router Cache reuse a recently-visited page for a short
    // window, so tab-to-tab (and back/forward) navigation is instant instead of
    // re-fetching the RSC payload every time. Mutations still call
    // revalidatePath, which busts the relevant entries.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
