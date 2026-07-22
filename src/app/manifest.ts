import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hell Blazer",
    short_name: "Hell Blazer",
    description:
      "Train like the strongest creature alive. Programs, savage-fast set logging, and power analytics.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0a0908",
    theme_color: "#0a0908",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
