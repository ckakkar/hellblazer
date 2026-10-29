import type { NextConfig } from "next";

// The database the browser talks to (REST and Realtime's socket).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null;
const dev = process.env.NODE_ENV !== "production";

/**
 * Where the page may load scripts from and connect to. Scripts only from
 * this site (inline allowed: Next's bootstrap is inline, and per-request
 * nonces would make every page dynamic), so an injected tag can't pull in
 * code from elsewhere; connections only to this site and the database, so
 * nothing on the page can send data anywhere else. Images may come from
 * any https host (account pictures are Google's and Apple's). Plus the
 * rules that never could break the app: no <base> hijack, no plugins, no
 * framing, forms post back here.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` https://${supabase} wss://${supabase}` : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Anything it blocks is logged (src/app/api/report), so a broken page shows.
  "report-uri /api/report",
].join("; ");

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
          { key: "Content-Security-Policy", value: csp },
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
