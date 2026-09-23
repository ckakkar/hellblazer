import type { MetadataRoute } from "next";

/** Only the landing page is public; everything else is a signed-in app. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/welcome"] },
  };
}
