import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fatty",
    short_name: "Fatty",
    description:
      "Train like a Kengan fighter. Programs, savage-fast set logging, and power analytics.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      {
        name: "Start workout",
        short_name: "Train",
        description: "Open the workout launcher",
        url: "/log",
        icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
      },
      {
        name: "View progress",
        short_name: "Progress",
        description: "Open your strength record and fighter rank",
        url: "/progress",
        icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
      },
    ],
  };
}
