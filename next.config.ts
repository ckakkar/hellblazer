import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
